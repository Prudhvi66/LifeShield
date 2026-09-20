package com.lifeshield.app;

import android.content.Intent;
import android.os.Bundle;
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
            float peakG = intent.getFloatExtra("peakG", 0f);
            String timestamp = intent.getStringExtra("timestamp");
            // Notify the FallDetectionPlugin so it can relay to JavaScript
            FallDetectionPlugin plugin = getFallDetectionPlugin();
            if (plugin != null) {
                plugin.onFallDetected(peakG, timestamp != null ? timestamp : "");
            }
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
