package com.lifeshield.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "Permissions",
    permissions = {
        @Permission(
            alias = "activityRecognition",
            strings = { Manifest.permission.ACTIVITY_RECOGNITION }
        ),
        @Permission(
            alias = "bodySensors",
            strings = { Manifest.permission.BODY_SENSORS }
        )
    }
)
public class PermissionsPlugin extends Plugin {

    // ---------------------------------------------------------------
    // Activity Recognition
    // ---------------------------------------------------------------

    @PluginMethod
    public void checkActivityRecognition(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int status = ContextCompat.checkSelfPermission(
                    getContext(), Manifest.permission.ACTIVITY_RECOGNITION);
            result.put("granted", status == PackageManager.PERMISSION_GRANTED);
            result.put("required", true);
        } else {
            result.put("granted", true);
            result.put("required", false);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void requestActivityRecognition(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            JSObject result = new JSObject();
            result.put("granted", true);
            result.put("required", false);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("activityRecognition", call, "handleActivityRecognitionResult");
    }

    @PermissionCallback
    private void handleActivityRecognitionResult(PluginCall call) {
        JSObject result = new JSObject();
        int status = ContextCompat.checkSelfPermission(
                getContext(), Manifest.permission.ACTIVITY_RECOGNITION);
        result.put("granted", status == PackageManager.PERMISSION_GRANTED);
        call.resolve(result);
    }

    // ---------------------------------------------------------------
    // Body Sensors
    // ---------------------------------------------------------------

    @PluginMethod
    public void checkBodySensors(PluginCall call) {
        JSObject result = new JSObject();
        int status = ContextCompat.checkSelfPermission(
                getContext(), Manifest.permission.BODY_SENSORS);
        result.put("granted", status == PackageManager.PERMISSION_GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void requestBodySensors(PluginCall call) {
        requestPermissionForAlias("bodySensors", call, "handleBodySensorsResult");
    }

    @PermissionCallback
    private void handleBodySensorsResult(PluginCall call) {
        JSObject result = new JSObject();
        int status = ContextCompat.checkSelfPermission(
                getContext(), Manifest.permission.BODY_SENSORS);
        result.put("granted", status == PackageManager.PERMISSION_GRANTED);
        call.resolve(result);
    }

    // ---------------------------------------------------------------
    // Open App Settings (for permanently-denied permissions)
    // ---------------------------------------------------------------

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("opened", false);
            result.put("error", e.getMessage());
            call.resolve(result);
        }
    }
}
