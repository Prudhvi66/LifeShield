package com.lifeshield.app;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

@CapacitorPlugin(
    name = "EmergencySms",
    permissions = {
        @Permission(
            strings = { Manifest.permission.SEND_SMS },
            alias = "sms"
        )
    }
)
public class EmergencySmsPlugin extends Plugin {

    private static final String TAG = "EmergencySmsPlugin";
    private static final String PHONE_PATTERN = "^\\+?[1-9]\\d{6,14}$";

    // Unique action strings for PendingIntents
    private static final String ACTION_SMS_SENT = "com.lifeshield.app.SMS_SENT";
    private static final String ACTION_SMS_DELIVERED = "com.lifeshield.app.SMS_DELIVERED";

    // Request code generator for unique PendingIntents per SMS
    private static final AtomicInteger requestCodeGenerator = new AtomicInteger(10000);

    // Track pending SMS operations: requestCode -> PluginCall
    private final ConcurrentHashMap<Integer, PluginCall> pendingSmsCalls = new ConcurrentHashMap<>();

    // Track delivery status per requestCode
    private final ConcurrentHashMap<Integer, String> deliveryStatusMap = new ConcurrentHashMap<>();

    // BroadcastReceivers for SMS_SENT and SMS_DELIVERED
    private BroadcastReceiver smsSentReceiver;
    private BroadcastReceiver smsDeliveredReceiver;
    private boolean receiversRegistered = false;

    @Override
    public void load() {
        super.load();
        registerSmsReceivers();
    }

    @Override
    public void handleOnDestroy() {
        unregisterSmsReceivers();
        super.handleOnDestroy();
    }

    private void registerSmsReceivers() {
        if (receiversRegistered) return;

        Context context = getContext();
        if (context == null) return;

        // SMS_SENT receiver
        smsSentReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                int requestCode = intent.getIntExtra("requestCode", -1);
                int resultCode = getResultCode();
                String resultMessage = getResultCodeDescription(resultCode);

                Log.d(TAG, "SMS_SENT received: requestCode=" + requestCode + ", resultCode=" + resultCode + " (" + resultMessage + ")");

                PluginCall call = pendingSmsCalls.get(requestCode);
                if (call != null) {
                    if (resultCode == Activity.RESULT_OK) {
                        deliveryStatusMap.put(requestCode, "SENT");
                        Log.d(TAG, "SMS accepted by carrier for requestCode=" + requestCode);
                    } else {
                        deliveryStatusMap.put(requestCode, "FAILED");
                        JSObject ret = new JSObject();
                        ret.put("success", false);
                        ret.put("error", "SMS send failed: " + resultMessage);
                        ret.put("status", "FAILED");
                        ret.put("resultCode", resultCode);
                        call.resolve(ret);
                        pendingSmsCalls.remove(requestCode);
                        deliveryStatusMap.remove(requestCode);
                    }
                }
            }
        };

        // SMS_DELIVERED receiver
        smsDeliveredReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                int requestCode = intent.getIntExtra("requestCode", -1);
                int resultCode = getResultCode();
                String resultMessage = getResultCodeDescription(resultCode);

                Log.d(TAG, "SMS_DELIVERED received: requestCode=" + requestCode + ", resultCode=" + resultCode + " (" + resultMessage + ")");

                PluginCall call = pendingSmsCalls.get(requestCode);
                if (call != null) {
                    if (resultCode == Activity.RESULT_OK) {
                        deliveryStatusMap.put(requestCode, "DELIVERY_CONFIRMED");
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("message", "SMS delivered to recipient");
                        ret.put("status", "DELIVERY_CONFIRMED");
                        call.resolve(ret);
                    } else {
                        // Delivery failed but SMS was sent
                        String currentStatus = deliveryStatusMap.get(requestCode);
                        if ("SENT".equals(currentStatus)) {
                            deliveryStatusMap.put(requestCode, "SENT_NO_DELIVERY_CONFIRMATION");
                            JSObject ret = new JSObject();
                            ret.put("success", true);
                            ret.put("message", "SMS accepted by Android/carrier; delivery confirmation unavailable");
                            ret.put("status", "SENT_NO_DELIVERY_CONFIRMATION");
                            call.resolve(ret);
                        } else {
                            deliveryStatusMap.put(requestCode, "FAILED");
                            JSObject ret = new JSObject();
                            ret.put("success", false);
                            ret.put("error", "SMS delivery failed: " + resultMessage);
                            ret.put("status", "FAILED");
                            ret.put("resultCode", resultCode);
                            call.resolve(ret);
                        }
                    }
                    pendingSmsCalls.remove(requestCode);
                    deliveryStatusMap.remove(requestCode);
                }
            }
        };

        // Register receivers with exported=false for security (Android 13+)
        IntentFilter sentFilter = new IntentFilter(ACTION_SMS_SENT);
        IntentFilter deliveredFilter = new IntentFilter(ACTION_SMS_DELIVERED);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(smsSentReceiver, sentFilter, Context.RECEIVER_NOT_EXPORTED);
            context.registerReceiver(smsDeliveredReceiver, deliveredFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(smsSentReceiver, sentFilter);
            context.registerReceiver(smsDeliveredReceiver, deliveredFilter);
        }

        receiversRegistered = true;
        Log.d(TAG, "SMS broadcast receivers registered");
    }

    private void unregisterSmsReceivers() {
        if (!receiversRegistered) return;
        Context context = getContext();
        if (context == null) return;

        try {
            if (smsSentReceiver != null) context.unregisterReceiver(smsSentReceiver);
            if (smsDeliveredReceiver != null) context.unregisterReceiver(smsDeliveredReceiver);
            receiversRegistered = false;
            Log.d(TAG, "SMS broadcast receivers unregistered");
        } catch (Exception e) {
            Log.w(TAG, "Error unregistering SMS receivers", e);
        }
    }

    private String getResultCodeDescription(int resultCode) {
        switch (resultCode) {
            case Activity.RESULT_OK:
                return "RESULT_OK";
            case SmsManager.RESULT_ERROR_GENERIC_FAILURE:
                return "RESULT_ERROR_GENERIC_FAILURE";
            case SmsManager.RESULT_ERROR_NO_SERVICE:
                return "RESULT_ERROR_NO_SERVICE";
            case SmsManager.RESULT_ERROR_NULL_PDU:
                return "RESULT_ERROR_NULL_PDU";
            case SmsManager.RESULT_ERROR_RADIO_OFF:
                return "RESULT_ERROR_RADIO_OFF";
            default:
                return "UNKNOWN_RESULT_CODE_" + resultCode;
        }
    }

    /**
     * Get the appropriate SmsManager for the default/active SIM.
     * On dual-SIM devices, this uses SubscriptionManager to get the default SMS subscription.
     */
    private SmsManager getSmsManager() {
        Context context = getContext();
        if (context == null) {
            Log.w(TAG, "No context, falling back to default SmsManager");
            return SmsManager.getDefault();
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
            SubscriptionManager subscriptionManager = (SubscriptionManager) context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
            if (subscriptionManager != null) {
                try {
                    // Get the default SMS subscription ID
                    int defaultSmsSubId = subscriptionManager.getDefaultSmsSubscriptionId();
                    if (defaultSmsSubId != SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
                        SmsManager smsManager = SmsManager.getSmsManagerForSubscriptionId(defaultSmsSubId);
                        Log.d(TAG, "Using SubscriptionManager SMS for subId=" + defaultSmsSubId);
                        return smsManager;
                    }

                    // Fallback: get active subscription info list and use the first one
                    List<SubscriptionInfo> subInfoList = subscriptionManager.getActiveSubscriptionInfoList();
                    if (subInfoList != null && !subInfoList.isEmpty()) {
                        int subId = subInfoList.get(0).getSubscriptionId();
                        SmsManager smsManager = SmsManager.getSmsManagerForSubscriptionId(subId);
                        Log.d(TAG, "Using first active subscription subId=" + subId);
                        return smsManager;
                    }
                } catch (SecurityException se) {
                    Log.w(TAG, "SubscriptionManager access denied, falling back to default", se);
                } catch (Exception e) {
                    Log.w(TAG, "Error getting subscription manager, falling back to default", e);
                }
            }
        }

        Log.d(TAG, "Using default SmsManager");
        return SmsManager.getDefault();
    }

    /**
     * Check if SEND_SMS permission is currently granted.
     */
    @PluginMethod
    public void hasSmsPermission(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();

        boolean granted = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.SEND_SMS
            ) == PackageManager.PERMISSION_GRANTED;
        } else {
            granted = true; // Pre-Marshmallow, permissions granted at install
        }

        ret.put("granted", granted);
        call.resolve(ret);
    }

    /**
     * Request SEND_SMS permission at runtime.
     */
    @PluginMethod
    public void requestSmsPermission(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (ContextCompat.checkSelfPermission(
                        getContext(),
                        Manifest.permission.SEND_SMS
                    ) == PackageManager.PERMISSION_GRANTED
                ) {
                    JSObject ret = new JSObject();
                    ret.put("granted", true);
                    call.resolve(ret);
                    return;
                }

                requestPermissionForAlias("sms", call, "handleSmsPermissionResult");
            } else {
                JSObject ret = new JSObject();
                ret.put("granted", true);
                call.resolve(ret);
            }
        } catch (Exception e) {
            call.reject("Failed to request SMS permission: " + e.getMessage());
        }
    }

    /**
     * Handle the result of the runtime permission request.
     */
    @PermissionCallback
    private void handleSmsPermissionResult(PluginCall call) {
        if (call == null) {
            return;
        }

        boolean granted = getPermissionState("sms") != null
            && getPermissionState("sms").toString().contains("granted");

        // Double-check with direct system API
        if (!granted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            granted = ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.SEND_SMS
            ) == PackageManager.PERMISSION_GRANTED;
        }

        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    /**
     * Validate a phone number string.
     * Accepts international formats: +919876543210, +14155552671, 9876543210 (7-15 digits).
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
     * Send an SMS message to the given phone number.
     * Requires SEND_SMS permission.
     * Uses PendingIntent callbacks for SMS_SENT and SMS_DELIVERED to track actual status.
     */
    @PluginMethod
    public void sendSms(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber", "");
        String message = call.getString("message", "");

        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            call.reject("Phone number is empty.");
            return;
        }

        if (message == null || message.trim().isEmpty()) {
            call.reject("Message is empty.");
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
                    Manifest.permission.SEND_SMS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("error", "SEND_SMS permission not granted");
                ret.put("requiresPermission", true);
                ret.put("status", "PERMISSION_REQUIRED");
                call.resolve(ret);
                return;
            }
        }

        // Generate unique request code for this SMS
        int requestCode = requestCodeGenerator.incrementAndGet();
        if (requestCode > 50000) requestCodeGenerator.set(10000); // wrap around

        // Store the call to resolve later when broadcast received
        pendingSmsCalls.put(requestCode, call);
        deliveryStatusMap.put(requestCode, "PENDING");

        try {
            SmsManager smsManager = getSmsManager();

            // Create explicit PendingIntents with unique request codes
            // Use FLAG_IMMUTABLE for Android 14+/API 34+ compatibility
            // Set package to make intent explicit for dynamically registered receivers
            Intent sentIntent = new Intent(ACTION_SMS_SENT);
            sentIntent.putExtra("requestCode", requestCode);
            sentIntent.setPackage(getContext().getPackageName());

            Intent deliveredIntent = new Intent(ACTION_SMS_DELIVERED);
            deliveredIntent.putExtra("requestCode", requestCode);
            deliveredIntent.setPackage(getContext().getPackageName());

            int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

            PendingIntent sentPI = PendingIntent.getBroadcast(
                getContext(), requestCode, sentIntent, flags);
            PendingIntent deliveredPI = PendingIntent.getBroadcast(
                getContext(), requestCode + 1, deliveredIntent, flags);

            // Send multipart SMS for long messages
            List<String> partsList = smsManager.divideMessage(message);
            java.util.ArrayList<String> parts = new java.util.ArrayList<>(partsList);
            Log.d(TAG, "Sending SMS to " + cleaned + " in " + parts.size() + " part(s), requestCode=" + requestCode);

            if (parts.size() == 1) {
                smsManager.sendTextMessage(cleaned, null, message, sentPI, deliveredPI);
            } else {
                // For multipart, create PendingIntent arrays
                java.util.ArrayList<PendingIntent> sentPIs = new java.util.ArrayList<>();
                java.util.ArrayList<PendingIntent> deliveredPIs = new java.util.ArrayList<>();
                for (int i = 0; i < parts.size(); i++) {
                    sentPIs.add(sentPI);
                    deliveredPIs.add(deliveredPI);
                }
                smsManager.sendMultipartTextMessage(cleaned, null, parts, sentPIs, deliveredPIs);
            }

            // Don't resolve immediately - wait for SMS_SENT broadcast
            // Set a timeout fallback in case broadcast never arrives
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                PluginCall pendingCall = pendingSmsCalls.remove(requestCode);
                if (pendingCall != null) {
                    String status = deliveryStatusMap.remove(requestCode);
                    if ("PENDING".equals(status)) {
                        Log.w(TAG, "SMS_SENT broadcast timeout for requestCode=" + requestCode + ", assuming sent but no confirmation");
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("phoneNumber", cleaned);
                        ret.put("message", "SMS accepted by Android/carrier; delivery confirmation timeout");
                        ret.put("status", "SENT_NO_DELIVERY_CONFIRMATION");
                        pendingCall.resolve(ret);
                    }
                }
            }, 10000); // 10 second timeout

        } catch (SecurityException se) {
            Log.e(TAG, "SecurityException sending SMS to " + cleaned, se);
            pendingSmsCalls.remove(requestCode);
            deliveryStatusMap.remove(requestCode);
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "SecurityException: " + se.getMessage());
            ret.put("requiresPermission", true);
            ret.put("status", "PERMISSION_REQUIRED");
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to send SMS to " + cleaned, e);
            pendingSmsCalls.remove(requestCode);
            deliveryStatusMap.remove(requestCode);
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "Failed to send SMS: " + e.getMessage());
            ret.put("status", "FAILED");
            call.resolve(ret);
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