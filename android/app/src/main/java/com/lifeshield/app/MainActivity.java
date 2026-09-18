package com.lifeshield.app;

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
        super.onCreate(savedInstanceState);
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }
        } catch (Exception ignored) {
        }
    }
}
