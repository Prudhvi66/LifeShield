package com.lifeshield.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.util.ArrayList;
import java.util.Locale;

public class FallDetectionService extends Service implements SensorEventListener {

    private static final String TAG = "FallDetectionService";
    private static final String CHANNEL_ID = "lifeshield_fall_detection";
    private static final String ALERT_CHANNEL_ID = "lifeshield_fall_alerts";
    private static final int NOTIFICATION_ID = 77501;
    public static final int ALERT_NOTIFICATION_ID = 77502;

    private static final String PREF_NAME = "lifeshield_fall_pref";
    private static final String PREF_KEY_ENABLED = "fall_detection_enabled";

    // Fall detection thresholds — ported from JS fallDetectionService.ts
    private static final float IMPACT_THRESHOLD_G = 3.0f;
    private static final float STILLNESS_VARIANCE_THRESHOLD = 0.35f;
    private static final int POST_IMPACT_DELAY_MS = 1200;
    private static final long COOLDOWN_MS = 10000;
    private static final int ROLLING_WINDOW_SIZE = 25;

    // Sensor
    private SensorManager sensorManager;
    private Sensor accelerometer;

    // State
    private boolean isMonitoring = false;
    private long lastStillnessCheckTime = 0;
    private long lastFallTriggerTime = 0;
    private final ArrayList<Float> recentGForces = new ArrayList<>();
    private boolean pendingStillnessCheck = false;
    private float pendingPeakG = 0;
    private long sampleCount = 0;

    // Wake lock for screen-off monitoring
    private PowerManager.WakeLock wakeLock;

    // Static ToneGenerator for native siren
    private static ToneGenerator sToneGenerator;

    // Communication with plugin
    private static FallDetectionListener sListener;
    private static FallDetectionService sInstance;

    public interface FallDetectionListener {
        void onFallDetected(float peakG, String timestamp);
    }

    public static void setListener(FallDetectionListener listener) {
        sListener = listener;
    }

    public static FallDetectionService getInstance() {
        return sInstance;
    }

    public static boolean isServiceRunning() {
        return sInstance != null && sInstance.isMonitoring;
    }

    /**
     * Stop any active alarm tone and dismiss the alert notification.
     */
    public static void stopAlarm(Context context) {
        try {
            if (sToneGenerator != null) {
                sToneGenerator.stopTone();
                sToneGenerator.release();
                sToneGenerator = null;
                Log.d(TAG, "Native fall siren stopped");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error stopping siren tone", e);
        }

        if (context != null) {
            try {
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.cancel(ALERT_NOTIFICATION_ID);
                }
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        }
        createNotificationChannels();
        Log.d(TAG, "FallDetectionService created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);

        if (intent != null && "STOP".equals(intent.getAction())) {
            Log.d(TAG, "onStartCommand: STOP requested by user");
            prefs.edit().putBoolean(PREF_KEY_ENABLED, false).apply();
            stopMonitoring();
            stopAlarm(this);
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        // Check if recreated by Android after process kill (intent == null)
        if (intent == null) {
            boolean wasEnabled = prefs.getBoolean(PREF_KEY_ENABLED, false);
            if (!wasEnabled) {
                Log.d(TAG, "onStartCommand: restarted by Android but feature was disabled; stopping");
                stopSelf();
                return START_NOT_STICKY;
            }
            Log.d(TAG, "onStartCommand: restarted by Android, restoring active fall monitoring");
        }

        prefs.edit().putBoolean(PREF_KEY_ENABLED, true).apply();
        startForegroundServiceCompat();
        startMonitoring();
        return START_STICKY;
    }

    private void startForegroundServiceCompat() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        Log.d(TAG, "Foreground service active with health type");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopMonitoring();
        stopAlarm(this);
        sInstance = null;
        releaseWakeLock();
        Log.d(TAG, "FallDetectionService destroyed");
        super.onDestroy();
    }

    private void startMonitoring() {
        if (isMonitoring) {
            Log.d(TAG, "startMonitoring: already monitoring, ignoring duplicate call");
            return;
        }

        if (accelerometer == null) {
            Log.w(TAG, "Accelerometer not available on this device");
            stopSelf();
            return;
        }

        isMonitoring = true;
        recentGForces.clear();
        lastStillnessCheckTime = 0;
        lastFallTriggerTime = 0;
        pendingStillnessCheck = false;
        sampleCount = 0;

        // Register accelerometer with SENSOR_DELAY_GAME (~50Hz) to capture sharp impact spikes
        boolean registered = sensorManager.registerListener(
                this,
                accelerometer,
                SensorManager.SENSOR_DELAY_GAME
        );

        Log.d(TAG, "Accelerometer listener registration result: " + registered + " (rate: SENSOR_DELAY_GAME)");
        Log.d(TAG, "Accelerometer sensor: " + accelerometer.getName()
                + ", vendor=" + accelerometer.getVendor()
                + ", maxRange=" + accelerometer.getMaximumRange()
                + ", resolution=" + accelerometer.getResolution());

        acquireWakeLock();
        Log.d(TAG, "Fall monitoring started — partial wake lock held for background/screen-off monitoring");
    }

    private void stopMonitoring() {
        if (!isMonitoring) return;
        isMonitoring = false;
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        releaseWakeLock();
        Log.d(TAG, "Fall monitoring stopped — listener unregistered");
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!isMonitoring) return;
        if (event.sensor.getType() != Sensor.TYPE_ACCELEROMETER) return;

        float x = event.values[0];
        float y = event.values[1];
        float z = event.values[2];

        // Total G-force (including gravity)
        float totalAcc = (float) Math.sqrt(x * x + y * y + z * z);
        float gForce = totalAcc / SensorManager.GRAVITY_EARTH;

        sampleCount++;
        // Throttle diagnostic logging: log every 50 samples (~1 sec at 50Hz) or whenever gForce >= 2.0
        if (sampleCount % 50 == 0 || gForce >= 2.0f) {
            Log.d(TAG, String.format(
                    Locale.US,
                    "ACCEL x=%.2f y=%.2f z=%.2f gForce=%.2f (screen-off active)",
                    x, y, z, gForce
            ));
        }

        // Maintain rolling window
        recentGForces.add(gForce);
        if (recentGForces.size() > ROLLING_WINDOW_SIZE) {
            recentGForces.remove(0);
        }

        // If we have a pending stillness check, do not re-trigger
        if (pendingStillnessCheck) return;

        // Impact detection
        if (gForce > IMPACT_THRESHOLD_G) {
            long now = System.currentTimeMillis();
            if (now - lastStillnessCheckTime > COOLDOWN_MS) {
                lastStillnessCheckTime = now;
                pendingPeakG = gForce;
                pendingStillnessCheck = true;
                Log.w(TAG, String.format(Locale.US,
                        "IMPACT DETECTED: peakG=%.2f > %.1f. Verifying stillness in %dms...",
                        pendingPeakG, IMPACT_THRESHOLD_G, POST_IMPACT_DELAY_MS));

                // Schedule stillness verification after post-impact delay
                new Handler(Looper.getMainLooper()).postDelayed(this::verifyPostImpactStillness, POST_IMPACT_DELAY_MS);
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        if (sensor != null && sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            Log.d(TAG, "Accelerometer accuracy changed: " + accuracy);
        }
    }

    private void verifyPostImpactStillness() {
        pendingStillnessCheck = false;

        if (recentGForces.isEmpty()) return;

        // Calculate variance of recent G-forces
        float sum = 0;
        for (float g : recentGForces) {
            sum += g;
        }
        float avg = sum / recentGForces.size();

        float varianceSum = 0;
        for (float g : recentGForces) {
            varianceSum += (g - avg) * (g - avg);
        }
        float variance = varianceSum / recentGForces.size();

        Log.d(TAG, String.format(Locale.US,
                "Stillness check: peakG=%.2f, variance=%.4f (threshold=%.2f), window=%d",
                pendingPeakG, variance, STILLNESS_VARIANCE_THRESHOLD, recentGForces.size()));

        // Low variance = user is stationary after impact = probable fall
        if (variance < STILLNESS_VARIANCE_THRESHOLD) {
            long now = System.currentTimeMillis();
            if (now - lastFallTriggerTime > COOLDOWN_MS) {
                lastFallTriggerTime = now;
                Log.w(TAG, "STILLNESS CONFIRMED: variance " + variance + " < threshold " + STILLNESS_VARIANCE_THRESHOLD);
                onFallConfirmed(pendingPeakG);
            }
        } else {
            Log.d(TAG, "Stillness check rejected: user is moving (variance " + variance + " >= threshold)");
        }
    }

    private void onFallConfirmed(float peakG) {
        Log.w(TAG, "FALL CONFIRMED — peakG=" + peakG + " — initiating emergency alert");

        // Wake screen if display was off or locked
        wakeScreenOnAlert();

        // Play native emergency siren
        playSiren();

        // Vibrate
        vibrate();

        // Notify the plugin/WebView
        String timestamp = new java.text.SimpleDateFormat(
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                .format(new java.util.Date());

        if (sListener != null) {
            sListener.onFallDetected(peakG, timestamp);
        }

        // Bring the app to foreground via full-screen notification & direct Intent
        bringAppToForeground(peakG, timestamp);
    }

    private void wakeScreenOnAlert() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                @SuppressWarnings("deprecation")
                PowerManager.WakeLock screenLock = pm.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                        "lifeshield:fall_alert_screen");
                screenLock.acquire(10000L); // 10 seconds screen wake
                Log.d(TAG, "Screen wake lock acquired for fall alert");
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire screen wake lock", e);
        }
    }

    private void bringAppToForeground(float peakG, String timestamp) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction("com.lifeshield.app.FALL_DETECTED");
        intent.putExtra("peakG", peakG);
        intent.putExtra("timestamp", timestamp);
        intent.putExtra("source", "native_fall_detection");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        // Try direct activity start (works when activity has priority/alarm category)
        try {
            startActivity(intent);
            Log.d(TAG, "Direct startActivity invoked for fall alert");
        } catch (Exception e) {
            Log.w(TAG, "Direct startActivity deferred to fullScreenIntent: " + e.getMessage());
        }

        // Full-screen PendingIntent for immediate lock-screen display
        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                this, ALERT_NOTIFICATION_ID, intent, pendingFlags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle("LifeShield — Fall Detected!")
                .setContentText(String.format(Locale.US, "Potential fall detected (%.1fg). Emergency countdown started.", peakG))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setOngoing(true)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setContentIntent(fullScreenPendingIntent);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(ALERT_NOTIFICATION_ID, builder.build());
        }
    }

    private void playSiren() {
        try {
            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) return;

            if (sToneGenerator != null) {
                try {
                    sToneGenerator.stopTone();
                    sToneGenerator.release();
                } catch (Exception ignored) {}
            }

            sToneGenerator = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            sToneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, 30000);

            // Auto-release after 31 seconds if not cancelled earlier
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    if (sToneGenerator != null) {
                        sToneGenerator.stopTone();
                        sToneGenerator.release();
                        sToneGenerator = null;
                    }
                } catch (Exception ignored) {}
            }, 31000);
        } catch (Exception e) {
            Log.w(TAG, "Siren playback error", e);
        }
    }

    private void vibrate() {
        try {
            long[] pattern = {0, 500, 200, 500, 200, 500};

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) {
                    vm.getDefaultVibrator().vibrate(VibrationEffect.createWaveform(pattern, -1));
                }
            } else {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) {
                    v.vibrate(VibrationEffect.createWaveform(pattern, -1));
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Vibration error", e);
        }
    }

    private void acquireWakeLock() {
        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK,
                        "lifeshield:fall_detection");
                wakeLock.acquire(4 * 60 * 60 * 1000L); // 4 hours, renewed on monitoring
            }
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            // Persistent monitoring channel
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Fall Detection Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Persistent notification while fall detection is actively monitoring in the background");
            serviceChannel.setShowBadge(false);
            nm.createNotificationChannel(serviceChannel);

            // High-priority emergency alert channel
            NotificationChannel alertChannel = new NotificationChannel(
                    ALERT_CHANNEL_ID,
                    "Emergency Fall Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            alertChannel.setDescription("Critical notifications when a fall is detected");
            alertChannel.enableVibration(true);
            alertChannel.setBypassDnd(true);
            nm.createNotificationChannel(alertChannel);
        }
    }

    private Notification buildNotification() {
        // Tap action — open the app
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, flags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("LifeShield Fall Detection Active")
                .setContentText("Monitoring for falls in the background")
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();
    }
}
