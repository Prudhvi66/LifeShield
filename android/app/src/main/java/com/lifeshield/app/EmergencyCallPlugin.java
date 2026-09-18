package com.lifeshield.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.activity.result.ActivityResult;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.regex.Pattern;

@CapacitorPlugin(name = "EmergencyCall", permissions = {
        @com.getcapacitor.annotation.Permission(strings = { Manifest.permission.CALL_PHONE }, alias = "phone")
})
public class EmergencyCallPlugin extends Plugin {

    private static final int REQUEST_CALL_PHONE = 77301;
    private static final String PHONE_PATTERN = "^\\+?[1-9]\\d{6,14}$";

    /**
     * Check if CALL_PHONE permission is currently granted.
     */
    @PluginMethod
    public void hasCallPermission(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();

        boolean granted = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            granted = ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED;
        } else {
            granted = true; // Pre-Marshmallow, permissions granted at install
        }

        ret.put("granted", granted);
        call.resolve(ret);
    }

    /**
     * Request CALL_PHONE permission at runtime.
     */
    @PluginMethod
    public void requestCallPermission(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (ContextCompat.checkSelfPermission(
                        getContext(),
                        Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) {
                    JSObject ret = new JSObject();
                    ret.put("granted", true);
                    call.resolve(ret);
                    return;
                }

                requestPermissionForAlias("phone", call, "handleCallPermissionResult");
            } else {
                JSObject ret = new JSObject();
                ret.put("granted", true);
                call.resolve(ret);
            }
        } catch (Exception e) {
            call.reject("Failed to request call permission: " + e.getMessage());
        }
    }

    /**
     * Handle the result of the runtime permission request.
     */
    @PermissionCallback
    private void handleCallPermissionResult(PluginCall call) {
        if (call == null) {
            return;
        }

        boolean granted = getPermissionState("phone") != null
                && getPermissionState("phone").toString().contains("granted");

        // Double-check with direct system API
        if (!granted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            granted = ContextCompat.checkSelfPermission(
                    getContext(),
                    Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED;
        }

        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    /**
     * Validate a phone number string.
     * Accepts international formats: +919876543210, +14155552671, 9876543210 (7-15
     * digits).
     */
    @PluginMethod
    public void validatePhoneNumber(PluginCall call) {
        String phone = call.getString("phoneNumber", "");
        JSObject ret = new JSObject();

        boolean valid = isValidPhoneNumber(phone);
        ret.put("valid", valid);
        call.resolve(ret);
    }

    /**
     * Place an automatic phone call to the given number.
     * Requires CALL_PHONE permission.
     * Uses ACTION_CALL (direct) not ACTION_DIAL (manual).
     */
    @PluginMethod
    public void callNumber(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber", "");

        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            call.reject("Phone number is empty.");
            return;
        }

        String cleaned = phoneNumber.replaceAll("[\\s\\-\\(\\)\\.]", "");

        if (!isValidPhoneNumber(cleaned)) {
            call.reject("Invalid phone number format: " + phoneNumber);
            return;
        }

        // Check permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(
                    getContext(),
                    Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("error", "CALL_PHONE permission not granted");
                ret.put("requiresPermission", true);
                call.resolve(ret);
                return;
            }
        }

        try {
            Intent callIntent = new Intent(Intent.ACTION_CALL);
            callIntent.setData(Uri.parse("tel:" + cleaned));
            callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            Activity activity = getActivity();
            if (activity == null) {
                call.reject("No active Android activity available.");
                return;
            }

            activity.startActivity(callIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("phoneNumber", cleaned);
            ret.put("message", "Call initiated to " + cleaned);
            call.resolve(ret);

        } catch (SecurityException se) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "SecurityException: " + se.getMessage());
            ret.put("requiresPermission", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to initiate call: " + e.getMessage());
        }
    }

    private boolean isValidPhoneNumber(String phone) {
        if (phone == null || phone.isEmpty()) {
            return false;
        }
        String cleaned = phone.replaceAll("[\\s\\-\\(\\)\\.]", "");
        return Pattern.matches(PHONE_PATTERN, cleaned);
    }
}
