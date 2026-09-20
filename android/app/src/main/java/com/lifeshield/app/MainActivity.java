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
        registerPlugin(HealthConnectPlugin.class);
        registerPlugin(EmergencyCallPlugin.class);
        registerPlugin(EmergencySmsPlugin.class);
        registerPlugin(TextToSpeechPlugin.class);
        registerPlugin(LocationPlugin.class);
        registerPlugin(PermissionsPlugin.class);
        registerPlugin(FallDetectionPlugin.class);
        super.onCreate(savedInstanceState);
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }
        } catch (Exception ignored) {
        }

        // Handle fall detection intent if app was launched by the service notification
        handleFallDetectionIntent(getIntent());
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
