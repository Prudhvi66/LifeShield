package com.lifeshield.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.IBinder;
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
    private static final int NOTIFICATION_ID = 77501;

    // Fall detection thresholds — ported from JS fallDetectionService.ts
    private static final float IMPACT_THRESHOLD_G = 3.0f;
    private static final float STILLNESS_VARIANCE_THRESHOLD = 0.35f;
    private static final int POST_IMPACT_DELAY_MS = 1200;
    private static final long COOLDOWN_MS = 10000;
    private static final int ROLLING_WINDOW_SIZE = 20;

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

    // Wake lock for screen-off monitoring
    private PowerManager.WakeLock wakeLock;

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

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        }
        createNotificationChannel();
        Log.d(TAG, "FallDetectionService created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP".equals(intent.getAction())) {
            stopMonitoring();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground(NOTIFICATION_ID, buildNotification());
        startMonitoring();
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopMonitoring();
        sInstance = null;
        releaseWakeLock();
        Log.d(TAG, "FallDetectionService destroyed");
        super.onDestroy();
    }

    private void startMonitoring() {
        if (isMonitoring) return;

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

        // Register at NORMAL rate to save battery — sufficient for fall detection
        sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_NORMAL);

        acquireWakeLock();
        Log.d(TAG, "Fall monitoring started");
    }

    private void stopMonitoring() {
        if (!isMonitoring) return;
        isMonitoring = false;
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        releaseWakeLock();
        Log.d(TAG, "Fall monitoring stopped");
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

        // Maintain rolling window
        recentGForces.add(gForce);
        if (recentGForces.size() > ROLLING_WINDOW_SIZE) {
            recentGForces.remove(0);
        }

        // If we have a pending stillness check, don't re-trigger
        if (pendingStillnessCheck) return;

        // Impact detection
        if (gForce > IMPACT_THRESHOLD_G) {
            long now = System.currentTimeMillis();
            if (now - lastStillnessCheckTime > COOLDOWN_MS) {
                lastStillnessCheckTime = now;
                pendingPeakG = gForce;
                pendingStillnessCheck = true;

                // Schedule stillness verification after delay
                new android.os.Handler(getMainLooper()).postDelayed(() -> {
                    verifyPostImpactStillness();
                }, POST_IMPACT_DELAY_MS);
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
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
                "Stillness check: peakG=%.2f, variance=%.3f, window=%d",
                pendingPeakG, variance, recentGForces.size()));

        // Low variance = user is stationary after impact = probable fall
        if (variance < STILLNESS_VARIANCE_THRESHOLD) {
            long now = System.currentTimeMillis();
            if (now - lastFallTriggerTime > COOLDOWN_MS) {
                lastFallTriggerTime = now;
                onFallConfirmed(pendingPeakG);
            }
        }
    }

    private void onFallConfirmed(float peakG) {
        Log.w(TAG, "FALL DETECTED — peakG=" + peakG);

        // Play siren
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

        // Bring the app to foreground via full-screen notification
        bringAppToForeground(peakG, timestamp);
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

        // Full-screen PendingIntent for immediate app launch
        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                this, NOTIFICATION_ID + 1, intent, pendingFlags);

        // Also create notification tap action
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle("LifeShield — Fall Detected!")
                .setContentText("A probable fall was detected. Emergency countdown started.")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setContentIntent(fullScreenPendingIntent);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID + 1, builder.build());
        }
    }

    private void playSiren() {
        try {
            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) return;

            ToneGenerator toneGenerator = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            // Play a repeating alarm tone for up to 30 seconds
            toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, 30000);

            // Release after tone duration
            new android.os.Handler(getMainLooper()).postDelayed(() -> {
                try {
                    toneGenerator.release();
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
                wakeLock.acquire(60 * 60 * 1000L); // 1 hour max, will be released on stop
            }
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Fall Detection",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Persistent notification while fall detection is active");
            channel.setShowBadge(false);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
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
