package com.lifeshield.app;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Install emergency diagnostic crash logger
        final Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            android.util.Log.e("LifeShield", "FATAL UNCAUGHT EXCEPTION in thread " + thread.getName() + ": " + throwable.getMessage(), throwable);
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        });

        // Safely register plugins so that failure of any one plugin NEVER crashes app startup
        safeRegisterPlugin(HealthConnectPlugin.class);
        safeRegisterPlugin(BluetoothGattPlugin.class);
        safeRegisterPlugin(EmergencyCallPlugin.class);
        safeRegisterPlugin(EmergencySmsPlugin.class);
        safeRegisterPlugin(TextToSpeechPlugin.class);
        safeRegisterPlugin(LocationPlugin.class);
        safeRegisterPlugin(PermissionsPlugin.class);
        safeRegisterPlugin(FallDetectionPlugin.class);

        super.onCreate(savedInstanceState);

        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }
        } catch (Throwable t) {
            android.util.Log.w("LifeShield", "WebView mixed content setting note: " + t.getMessage());
        }

        // Handle fall detection intent if app was launched by the service notification
        try {
            handleFallDetectionIntent(getIntent());
        } catch (Throwable t) {
            android.util.Log.w("LifeShield", "Fall detection intent note: " + t.getMessage());
        }
    }

    private void safeRegisterPlugin(Class<? extends com.getcapacitor.Plugin> pluginClass) {
        try {
            registerPlugin(pluginClass);
            android.util.Log.d("LifeShield", "Safely registered plugin: " + pluginClass.getSimpleName());
        } catch (Throwable t) {
            android.util.Log.e("LifeShield", "Could not register plugin " + pluginClass.getSimpleName() + " (will continue without it): " + t.getMessage(), t);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleFallDetectionIntent(intent);
    }

    private void handleFallDetectionIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if ("com.lifeshield.app.FALL_DETECTED".equals(action)) {
            // Ensure activity displays immediately over lock screen and turns screen on
            wakeAndShowOverLockScreen();

            float peakG = intent.getFloatExtra("peakG", 0f);
            String timestamp = intent.getStringExtra("timestamp");
            // Notify the FallDetectionPlugin so it can relay to JavaScript
            FallDetectionPlugin plugin = getFallDetectionPlugin();
            if (plugin != null) {
                plugin.onFallDetected(peakG, timestamp != null ? timestamp : "");
            }
        }
    }

    private void wakeAndShowOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }
    }

    private FallDetectionPlugin getFallDetectionPlugin() {
        try {
            if (this.bridge != null) {
                Object plugin = this.bridge.getPlugin("FallDetection");
                if (plugin instanceof com.getcapacitor.Plugin) {
                    return (FallDetectionPlugin) plugin;
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }
}
