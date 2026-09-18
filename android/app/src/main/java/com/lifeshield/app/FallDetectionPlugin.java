package com.lifeshield.app;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FallDetection")
public class FallDetectionPlugin extends Plugin implements FallDetectionService.FallDetectionListener {

    private static final String TAG = "FallDetectionPlugin";

    // Stores fall data if detected before JS listener is ready (cold start from notification)
    private static float sPendingPeakG = 0;
    private static String sPendingTimestamp = null;
    private static boolean sHasPendingFall = false;

    @Override
    public void load() {
        super.load();
        FallDetectionService.setListener(this);
        Log.d(TAG, "FallDetection plugin loaded");
    }

    @Override
    public void handleOnDestroy() {
        FallDetectionService.setListener(null);
        super.handleOnDestroy();
    }

    /**
     * Start the fall detection foreground service.
     */
    @PluginMethod
    public void start(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("No context available");
            return;
        }

        if (FallDetectionService.isServiceRunning()) {
            JSObject ret = new JSObject();
            ret.put("started", true);
            ret.put("message", "Fall detection is already running");
            call.resolve(ret);
            return;
        }

        Intent intent = new Intent(context, FallDetectionService.class);
        intent.setAction("START");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }

        JSObject ret = new JSObject();
        ret.put("started", true);
        ret.put("message", "Fall detection foreground service started");
        call.resolve(ret);
        Log.d(TAG, "Fall detection service started from plugin");
    }

    /**
     * Stop the fall detection foreground service.
     */
    @PluginMethod
    public void stop(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("No context available");
            return;
        }

        Intent intent = new Intent(context, FallDetectionService.class);
        intent.setAction("STOP");
        context.startService(intent);

        JSObject ret = new JSObject();
        ret.put("stopped", true);
        ret.put("message", "Fall detection foreground service stopped");
        call.resolve(ret);
        Log.d(TAG, "Fall detection service stopped from plugin");
    }

    /**
     * Check if fall detection is currently running.
     */
    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", FallDetectionService.isServiceRunning());
        call.resolve(ret);
    }

    /**
     * Check if there is a pending fall event from a cold start (notification tap).
     * Returns the data once and clears it.
     */
    @PluginMethod
    public void getPendingFall(PluginCall call) {
        JSObject ret = new JSObject();
        if (sHasPendingFall) {
            ret.put("hasPending", true);
            ret.put("peakG", sPendingPeakG);
            ret.put("timestamp", sPendingTimestamp);
            ret.put("source", "native_fall_detection");
            ret.put("id", "native-fall-" + System.currentTimeMillis());
            sHasPendingFall = false;
            sPendingPeakG = 0;
            sPendingTimestamp = null;
        } else {
            ret.put("hasPending", false);
        }
        call.resolve(ret);
    }

    /**
     * Called by FallDetectionService when a fall is confirmed.
     * Notifies the JavaScript side via a Capacitor event.
     * If JS is not ready, stores as pending for later retrieval.
     */
    @Override
    public void onFallDetected(float peakG, String timestamp) {
        JSObject data = new JSObject();
        data.put("peakG", peakG);
        data.put("timestamp", timestamp);
        data.put("source", "native_fall_detection");
        data.put("id", "native-fall-" + System.currentTimeMillis());

        // Always store as pending in case this is a cold start
        sPendingPeakG = peakG;
        sPendingTimestamp = timestamp;
        sHasPendingFall = true;

        // Try to notify JS listeners (works if WebView is active)
        notifyListeners("fallDetected", data);
        Log.w(TAG, "Fall detected event — peakG=" + peakG);
    }
}
