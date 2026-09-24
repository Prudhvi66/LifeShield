package com.lifeshield.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import androidx.health.connect.client.HealthConnectClient;
import androidx.health.connect.client.contracts.HealthPermissionsRequestContract;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.util.Log;
import androidx.health.connect.client.records.BodyTemperatureRecord;
import androidx.health.connect.client.records.HeartRateRecord;
import androidx.health.connect.client.records.OxygenSaturationRecord;
import androidx.health.connect.client.records.Record;
import androidx.health.connect.client.records.SleepSessionRecord;
import androidx.health.connect.client.records.StepsRecord;
import androidx.health.connect.client.request.ReadRecordsRequest;
import androidx.health.connect.client.response.ReadRecordsResponse;
import androidx.health.connect.client.time.TimeRangeFilter;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import kotlin.coroutines.Continuation;
import kotlin.coroutines.CoroutineContext;
import kotlin.coroutines.EmptyCoroutineContext;
import kotlin.jvm.JvmClassMappingKt;
import kotlin.reflect.KClass;

@CapacitorPlugin(name = "HealthConnect")
public class HealthConnectPlugin extends Plugin {

    private static final String HEALTH_CONNECT_PACKAGE =
            "com.google.android.apps.healthdata";

    private static final String[] HEALTH_PERMISSIONS = {
            "android.permission.health.READ_HEART_RATE",
            "android.permission.health.READ_STEPS",
            "android.permission.health.READ_OXYGEN_SATURATION",
            "android.permission.health.READ_SLEEP",
            "android.permission.health.READ_BODY_TEMPERATURE"
    };

    /**
     * Get the HealthConnectClient instance.
     * On Android 14+ (API 34+), Health Connect is a platform module in the system framework,
     * so getOrCreate(context) must be called without the package name.
     * On Android 13 and below, the standalone APK package is used.
     */
    private HealthConnectClient getHealthConnectClient(Context context) {
        if (Build.VERSION.SDK_INT >= 34) {
            return HealthConnectClient.getOrCreate(context);
        } else {
            return HealthConnectClient.getOrCreate(context, HEALTH_CONNECT_PACKAGE);
        }
    }

    /**
     * Helper to query Health Connect records asynchronously from Java.
     */
    private <T extends Record> ReadRecordsResponse<T> queryRecords(
            HealthConnectClient client,
            Class<T> recordClass,
            Instant startTime,
            Instant endTime
    ) {
        try {
            KClass<T> kClass = JvmClassMappingKt.getKotlinClass(recordClass);
            TimeRangeFilter timeRange = TimeRangeFilter.between(startTime, endTime);

            ReadRecordsRequest<T> request = new ReadRecordsRequest<>(
                    kClass,
                    timeRange,
                    Collections.emptySet(),
                    false, // ascending=false → newest records first (index 0 = most recent)
                    200,   // fetch up to 200 records to ensure coverage
                    null
            );

            final AtomicReference<ReadRecordsResponse<T>> responseRef = new AtomicReference<>(null);
            final CountDownLatch latch = new CountDownLatch(1);

            Continuation<ReadRecordsResponse<T>> continuation = new Continuation<ReadRecordsResponse<T>>() {
                @Override
                public CoroutineContext getContext() {
                    return EmptyCoroutineContext.INSTANCE;
                }

                @Override
                @SuppressWarnings("unchecked")
                public void resumeWith(Object result) {
                    try {
                        if (result instanceof ReadRecordsResponse) {
                            responseRef.set((ReadRecordsResponse<T>) result);
                        }
                    } catch (Exception ignored) {
                    } finally {
                        latch.countDown();
                    }
                }
            };

            Object directResult = client.readRecords(request, continuation);
            if (directResult instanceof ReadRecordsResponse) {
                return (ReadRecordsResponse<T>) directResult;
            } else {
                latch.await(5, TimeUnit.SECONDS); // extended timeout for slow Health Connect responses
                return responseRef.get();
            }
        } catch (Exception e) {
            Log.e("HealthConnect", "Error reading records for " + recordClass.getSimpleName() + ": " + e.getMessage());
            return null;
        }
    }

    /**
     * Check whether Health Connect is available on this device.
     */
    @PluginMethod
    public void checkAvailability(PluginCall call) {
        Context context = getContext();

        JSObject ret = new JSObject();

        boolean isAvailable = false;
        String status = "UNAVAILABLE";
        String provider = "NONE";

        try {
            int sdkStatus;
            if (Build.VERSION.SDK_INT >= 34) {
                sdkStatus = HealthConnectClient.getSdkStatus(context);
            } else {
                sdkStatus = HealthConnectClient.getSdkStatus(context, HEALTH_CONNECT_PACKAGE);
            }

            if (sdkStatus == HealthConnectClient.SDK_AVAILABLE) {
                isAvailable = true;
                status = "AVAILABLE";
                provider = Build.VERSION.SDK_INT >= 34 ? "ANDROID_FRAMEWORK" : "HEALTH_CONNECT";
            } else if (
                    sdkStatus ==
                            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
            ) {
                status = "PROVIDER_UPDATE_REQUIRED";
                provider = Build.VERSION.SDK_INT >= 34 ? "ANDROID_FRAMEWORK" : "HEALTH_CONNECT";
            } else {
                status = "UNAVAILABLE";
                provider = Build.VERSION.SDK_INT >= 34 ? "ANDROID_FRAMEWORK" : "HEALTH_CONNECT";
            }

            Log.i("HealthConnect", "checkAvailability result: isAvailable=" + isAvailable + ", status=" + status + ", provider=" + provider);

        } catch (Exception e) {
            Log.w("HealthConnect", "checkAvailability error: " + e.getMessage());
            // Fallback for unexpected provider/API errors.
            if (Build.VERSION.SDK_INT >= 34) {
                isAvailable = true;
                status = "AVAILABLE_SYSTEM_SERVICE";
                provider = "ANDROID_FRAMEWORK";
            } else {
                try {
                    PackageManager pm = context.getPackageManager();

                    pm.getPackageInfo(
                            HEALTH_CONNECT_PACKAGE,
                            PackageManager.GET_ACTIVITIES
                    );

                    isAvailable = true;
                    status = "AVAILABLE_STANDALONE_APP";
                    provider = "GOOGLE_HEALTH_CONNECT";

                } catch (PackageManager.NameNotFoundException ignored) {
                    isAvailable = false;
                    status = "NOT_INSTALLED";
                    provider = "PLAY_STORE_REQUIRED";
                }
            }
        }

        ret.put("isAvailable", isAvailable);
        ret.put("status", status);
        ret.put("provider", provider);
        ret.put("sdkVersion", Build.VERSION.SDK_INT);

        call.resolve(ret);
    }

    /**
     * Check the current Health Connect permissions.
     *
     * Handles both Android 14+ platform runtime permissions and Health Connect
     * PermissionController Kotlin suspend Continuation invocation from Java.
     */
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        Context context = getContext();

        JSObject ret = new JSObject();
        JSObject perms = new JSObject();

        try {
            final Set<String> grantedPermissions = new HashSet<>();

            // 1. Android 14+ (API 34+) standard platform health runtime permission check
            if (Build.VERSION.SDK_INT >= 34) {
                for (String permission : HEALTH_PERMISSIONS) {
                    if (ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED) {
                        grantedPermissions.add(permission);
                    }
                }
            }

            // 2. Health Connect SDK PermissionController check via Kotlin Continuation
            try {
                HealthConnectClient healthConnectClient = getHealthConnectClient(context);

                final AtomicReference<Set<String>> sdkGrantedRef = new AtomicReference<>(new HashSet<>());
                final CountDownLatch latch = new CountDownLatch(1);

                Continuation<Set<String>> continuation = new Continuation<Set<String>>() {
                    @Override
                    public CoroutineContext getContext() {
                        return EmptyCoroutineContext.INSTANCE;
                    }

                    @Override
                    @SuppressWarnings("unchecked")
                    public void resumeWith(Object result) {
                        try {
                            if (result instanceof Set) {
                                sdkGrantedRef.set((Set<String>) result);
                            }
                        } catch (Exception ignored) {
                        } finally {
                            latch.countDown();
                        }
                    }
                };

                Object directResult = healthConnectClient
                        .getPermissionController()
                        .getGrantedPermissions(continuation);

                if (directResult instanceof Set) {
                    grantedPermissions.addAll((Set<String>) directResult);
                } else {
                    try {
                        latch.await(2, TimeUnit.SECONDS);
                        grantedPermissions.addAll(sdkGrantedRef.get());
                    } catch (InterruptedException ignored) {
                    }
                }
            } catch (Exception sdkEx) {
                Log.d("HealthConnect", "SDK permission check fallback: " + sdkEx.getMessage());
            }

            boolean allGranted = true;

            for (String permission : HEALTH_PERMISSIONS) {
                boolean granted = grantedPermissions.contains(permission);
                String shortName = permission.substring(permission.lastIndexOf('.') + 1);

                perms.put(shortName, granted);

                if (!granted) {
                    allGranted = false;
                }
            }

            ret.put("permissionsGranted", allGranted);
            ret.put("permissions", perms);

            call.resolve(ret);

        } catch (Exception e) {
            ret.put("permissionsGranted", false);
            ret.put("permissions", perms);
            ret.put("error", e.getMessage());

            call.resolve(ret);
        }
    }    /**
     * Request Health Connect permissions.
     */
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        try {
            Set<String> permissions = new HashSet<>(Arrays.asList(HEALTH_PERMISSIONS));
            HealthPermissionsRequestContract contract;
            if (Build.VERSION.SDK_INT >= 34) {
                contract = new HealthPermissionsRequestContract();
            } else {
                contract = new HealthPermissionsRequestContract(HEALTH_CONNECT_PACKAGE);
            }

            Intent intent = contract.createIntent(getContext(), permissions);
            startActivityForResult(call, intent, "healthPermissionsResult");
        } catch (Exception e) {
            Log.e("HealthConnect", "Unable to request Health Connect permissions: " + e.getMessage(), e);
            call.reject("Unable to request Health Connect permissions: " + e.getMessage());
        }
    }

    /**
     * Receive the result from the Health Connect permission screen.
     */
    @ActivityCallback
    private void healthPermissionsResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        try {
            HealthPermissionsRequestContract contract;
            if (Build.VERSION.SDK_INT >= 34) {
                contract = new HealthPermissionsRequestContract();
            } else {
                contract = new HealthPermissionsRequestContract(HEALTH_CONNECT_PACKAGE);
            }

            Set<String> grantedPermissions = contract.parseResult(result.getResultCode(), result.getData());

            // On Android 14+, also verify against platform runtime permissions
            if (Build.VERSION.SDK_INT >= 34) {
                for (String permission : HEALTH_PERMISSIONS) {
                    if (ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED) {
                        grantedPermissions.add(permission);
                    }
                }
            }

            JSObject ret = new JSObject();
            JSObject perms = new JSObject();
            boolean allGranted = true;

            for (String permission : HEALTH_PERMISSIONS) {
                boolean granted = grantedPermissions.contains(permission);
                String shortName = permission.substring(permission.lastIndexOf('.') + 1);

                perms.put(shortName, granted);

                if (!granted) {
                    allGranted = false;
                }
            }

            ret.put("permissionsGranted", allGranted);
            ret.put("permissions", perms);
            ret.put("grantedCount", grantedPermissions.size());
            ret.put("resultCode", result.getResultCode());
            ret.put("cancelled", result.getResultCode() == Activity.RESULT_CANCELED && grantedPermissions.isEmpty());

            Log.i("HealthConnect", "healthPermissionsResult: grantedCount=" + grantedPermissions.size() + ", allGranted=" + allGranted);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e("HealthConnect", "Failed to process Health Connect permission result: " + e.getMessage(), e);
            call.reject("Failed to process Health Connect permission result: " + e.getMessage());
        }
    }

    /**
     * Open Health Connect settings.
     */
    @PluginMethod
    public void openHealthConnectSettings(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();

        // 1. Android 14+ (API 34+) platform Health Connect settings
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                Intent intent = new Intent("android.health.connect.action.HEALTH_CONNECT_SETTINGS");
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                ret.put("opened", true);
                ret.put("action", "ANDROID_FRAMEWORK_HEALTH_CONNECT_SETTINGS");
                call.resolve(ret);
                return;
            } catch (Exception ignored) {
            }
        }

        // 2. AndroidX ACTION_HEALTH_CONNECT_SETTINGS
        try {
            Intent intent = new Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            ret.put("opened", true);
            ret.put("action", "HEALTH_CONNECT_SETTINGS");
            call.resolve(ret);
            return;
        } catch (Exception ignored) {
        }

        // 3. Standalone APK launch intent
        try {
            Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(HEALTH_CONNECT_PACKAGE);
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(launchIntent);
                ret.put("opened", true);
                ret.put("action", "HEALTH_CONNECT_APP");
                call.resolve(ret);
                return;
            }
        } catch (Exception ignored) {
        }

        // 4. Play Store fallback
        try {
            Intent marketIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + HEALTH_CONNECT_PACKAGE));
            marketIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(marketIntent);
            ret.put("opened", true);
            ret.put("action", "PLAY_STORE");
            call.resolve(ret);
        } catch (Exception e2) {
            ret.put("opened", false);
            ret.put("error", e2.getMessage());
            call.resolve(ret);
        }
    }

    /**
     * Internal helper to determine which Health Connect permissions are granted.
     */
    private Set<String> getGrantedPermissionsInternal(Context context) {
        final Set<String> grantedPermissions = new HashSet<>();

        // 1. Android 14+ (API 34+) standard platform health runtime permission check
        if (Build.VERSION.SDK_INT >= 34) {
            for (String permission : HEALTH_PERMISSIONS) {
                if (ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED) {
                    grantedPermissions.add(permission);
                }
            }
        }

        // 2. Health Connect SDK PermissionController check via Kotlin Continuation
        try {
            HealthConnectClient healthConnectClient = getHealthConnectClient(context);

            final AtomicReference<Set<String>> sdkGrantedRef = new AtomicReference<>(new HashSet<>());
            final CountDownLatch latch = new CountDownLatch(1);

            Continuation<Set<String>> continuation = new Continuation<Set<String>>() {
                @Override
                public CoroutineContext getContext() {
                    return EmptyCoroutineContext.INSTANCE;
                }

                @Override
                @SuppressWarnings("unchecked")
                public void resumeWith(Object result) {
                    try {
                        if (result instanceof Set) {
                            sdkGrantedRef.set((Set<String>) result);
                        }
                    } catch (Exception ignored) {
                    } finally {
                        latch.countDown();
                    }
                }
            };

            Object directResult = healthConnectClient
                    .getPermissionController()
                    .getGrantedPermissions(continuation);

            if (directResult instanceof Set) {
                grantedPermissions.addAll((Set<String>) directResult);
            } else {
                try {
                    latch.await(2, TimeUnit.SECONDS);
                    grantedPermissions.addAll(sdkGrantedRef.get());
                } catch (InterruptedException ignored) {
                }
            }
        } catch (Exception sdkEx) {
            Log.d("HealthConnect", "SDK permission check fallback: " + sdkEx.getMessage());
        }

        return grantedPermissions;
    }

    private String formatSourceAppName(String pkg) {
        if (pkg == null || pkg.isEmpty()) return "Health Connect";
        if (pkg.contains("shealth") || pkg.contains("samsung")) return "Samsung Health";
        if (pkg.contains("fitness") || pkg.contains("google.android.apps.fitness")) return "Google Fit";
        if (pkg.contains("fitbit")) return "Fitbit";
        if (pkg.contains("noise")) return "NoiseFit";
        if (pkg.contains("garmin")) return "Garmin Connect";
        if (pkg.contains("boat") || pkg.contains("crest")) return "boAt Crest";
        if (pkg.contains("zepp") || pkg.contains("amazfit")) return "Zepp Life";
        if (pkg.contains("withings")) return "Withings Health Mate";
        if (pkg.contains("whoop")) return "WHOOP";
        if (pkg.contains("polar")) return "Polar Flow";
        return "Health Connect";
    }

    /**
     * Read actual real health data from Health Connect with granular per-metric details.
     */
    @PluginMethod
    public void readAggregatedData(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();
        JSObject data = new JSObject();
        JSObject metrics = new JSObject();

        try {
            HealthConnectClient healthConnectClient = getHealthConnectClient(context);

            Set<String> grantedPerms = getGrantedPermissionsInternal(context);

            Instant now = Instant.now();
            Instant past7d   = now.minus(7, ChronoUnit.DAYS);
            Instant past24h  = now.minus(24, ChronoUnit.HOURS);

            String primaryOriginPackage = null;

            // 1. Heart Rate
            boolean hrPerm = grantedPerms.contains("android.permission.health.READ_HEART_RATE");
            Integer heartRate = null;
            String hrTime = null;
            int hrCount = 0;
            if (hrPerm) {
                try {
                    ReadRecordsResponse<HeartRateRecord> hrRes = queryRecords(healthConnectClient, HeartRateRecord.class, past7d, now);
                    if (hrRes != null && !hrRes.getRecords().isEmpty()) {
                        hrCount = hrRes.getRecords().size();
                        HeartRateRecord latestRecord = hrRes.getRecords().get(0);
                        List<HeartRateRecord.Sample> samples = latestRecord.getSamples();
                        if (!samples.isEmpty()) {
                            heartRate = (int) samples.get(samples.size() - 1).getBeatsPerMinute();
                            hrTime = latestRecord.getEndTime().toString();
                            if (latestRecord.getMetadata() != null && latestRecord.getMetadata().getDataOrigin() != null) {
                                primaryOriginPackage = latestRecord.getMetadata().getDataOrigin().getPackageName();
                            }
                            Log.i("HealthConnect", "Heart rate from " + hrCount + " records: " + heartRate + " BPM at " + hrTime + " (origin: " + primaryOriginPackage + ")");
                        }
                    } else {
                        Log.i("HealthConnect", "No HeartRateRecord found in past 7 days (hrPerm=" + hrPerm + ")");
                    }
                } catch (Exception e) {
                    Log.e("HealthConnect", "Heart rate query error: " + e.getMessage(), e);
                }
            }
            JSObject hrObj = new JSObject();
            hrObj.put("permissionGranted", hrPerm);
            hrObj.put("recordsFound", heartRate != null);
            hrObj.put("value", heartRate);
            hrObj.put("unit", "BPM");
            hrObj.put("recordCount", hrCount);
            hrObj.put("latestTimestamp", hrTime);
            hrObj.put("status", !hrPerm ? "Permission not granted" : (heartRate != null ? "Records found" : "No heart-rate records available from connected sources"));
            metrics.put("heart_rate", hrObj);

            // 2. SpO2 / Oxygen Saturation
            boolean spo2Perm = grantedPerms.contains("android.permission.health.READ_OXYGEN_SATURATION");
            Integer spo2 = null;
            String spo2Time = null;
            int spo2Count = 0;
            if (spo2Perm) {
                try {
                    ReadRecordsResponse<OxygenSaturationRecord> spo2Res = queryRecords(healthConnectClient, OxygenSaturationRecord.class, past7d, now);
                    if (spo2Res != null && !spo2Res.getRecords().isEmpty()) {
                        spo2Count = spo2Res.getRecords().size();
                        OxygenSaturationRecord latestRecord = spo2Res.getRecords().get(0);
                        spo2 = (int) Math.round(latestRecord.getPercentage().getValue());
                        spo2Time = latestRecord.getTime().toString();
                        if (primaryOriginPackage == null && latestRecord.getMetadata() != null && latestRecord.getMetadata().getDataOrigin() != null) {
                            primaryOriginPackage = latestRecord.getMetadata().getDataOrigin().getPackageName();
                        }
                        Log.i("HealthConnect", "SpO2 from " + spo2Count + " records: " + spo2 + "% at " + spo2Time);
                    }
                } catch (Exception e) {
                    Log.e("HealthConnect", "SpO2 query error: " + e.getMessage(), e);
                }
            }
            JSObject spo2Obj = new JSObject();
            spo2Obj.put("permissionGranted", spo2Perm);
            spo2Obj.put("recordsFound", spo2 != null);
            spo2Obj.put("value", spo2);
            spo2Obj.put("unit", "%");
            spo2Obj.put("recordCount", spo2Count);
            spo2Obj.put("latestTimestamp", spo2Time);
            spo2Obj.put("status", !spo2Perm ? "Permission not granted" : (spo2 != null ? "Records found" : "No SpO2 records available from connected sources"));
            metrics.put("spo2", spo2Obj);

            // 3. Steps
            boolean stepsPerm = grantedPerms.contains("android.permission.health.READ_STEPS");
            Integer steps = null;
            String stepsTime = null;
            int stepsCount = 0;
            if (stepsPerm) {
                try {
                    ReadRecordsResponse<StepsRecord> stepsRes = queryRecords(healthConnectClient, StepsRecord.class, past24h, now);
                    if (stepsRes != null && !stepsRes.getRecords().isEmpty()) {
                        stepsCount = stepsRes.getRecords().size();
                        long totalSteps = 0;
                        for (StepsRecord r : stepsRes.getRecords()) {
                            totalSteps += r.getCount();
                        }
                        steps = (int) totalSteps;
                        stepsTime = stepsRes.getRecords().get(0).getEndTime().toString();
                        if (primaryOriginPackage == null && stepsRes.getRecords().get(0).getMetadata() != null && stepsRes.getRecords().get(0).getMetadata().getDataOrigin() != null) {
                            primaryOriginPackage = stepsRes.getRecords().get(0).getMetadata().getDataOrigin().getPackageName();
                        }
                        Log.i("HealthConnect", "Steps from " + stepsCount + " records: " + steps + " at " + stepsTime);
                    }
                } catch (Exception e) {
                    Log.d("HealthConnect", "Steps query error: " + e.getMessage());
                }
            }
            JSObject stepsObj = new JSObject();
            stepsObj.put("permissionGranted", stepsPerm);
            stepsObj.put("recordsFound", steps != null);
            stepsObj.put("value", steps);
            stepsObj.put("unit", "steps");
            stepsObj.put("recordCount", stepsCount);
            stepsObj.put("latestTimestamp", stepsTime);
            stepsObj.put("status", !stepsPerm ? "Permission not granted" : (steps != null ? "Records found" : "No step records available from connected sources"));
            metrics.put("steps", stepsObj);

            // 4. Sleep
            boolean sleepPerm = grantedPerms.contains("android.permission.health.READ_SLEEP");
            Double sleep = null;
            String sleepTime = null;
            int sleepCount = 0;
            if (sleepPerm) {
                try {
                    ReadRecordsResponse<SleepSessionRecord> sleepRes = queryRecords(healthConnectClient, SleepSessionRecord.class, past24h, now);
                    if (sleepRes != null && !sleepRes.getRecords().isEmpty()) {
                        sleepCount = sleepRes.getRecords().size();
                        double totalMins = 0;
                        for (SleepSessionRecord r : sleepRes.getRecords()) {
                            long mins = Duration.between(r.getStartTime(), r.getEndTime()).toMinutes();
                            totalMins += mins;
                        }
                        sleep = Math.round((totalMins / 60.0) * 10.0) / 10.0;
                        sleepTime = sleepRes.getRecords().get(0).getEndTime().toString();
                        if (primaryOriginPackage == null && sleepRes.getRecords().get(0).getMetadata() != null && sleepRes.getRecords().get(0).getMetadata().getDataOrigin() != null) {
                            primaryOriginPackage = sleepRes.getRecords().get(0).getMetadata().getDataOrigin().getPackageName();
                        }
                        Log.i("HealthConnect", "Sleep from " + sleepCount + " records: " + sleep + " hours at " + sleepTime);
                    }
                } catch (Exception e) {
                    Log.d("HealthConnect", "Sleep query error: " + e.getMessage());
                }
            }
            JSObject sleepObj = new JSObject();
            sleepObj.put("permissionGranted", sleepPerm);
            sleepObj.put("recordsFound", sleep != null);
            sleepObj.put("value", sleep);
            sleepObj.put("unit", "hours");
            sleepObj.put("recordCount", sleepCount);
            sleepObj.put("latestTimestamp", sleepTime);
            sleepObj.put("status", !sleepPerm ? "Permission not granted" : (sleep != null ? "Records found" : "No sleep records available from connected sources"));
            metrics.put("sleep", sleepObj);

            // 5. Body Temperature
            boolean tempPerm = grantedPerms.contains("android.permission.health.READ_BODY_TEMPERATURE");
            Double temp = null;
            String tempTime = null;
            int tempCount = 0;
            if (tempPerm) {
                try {
                    ReadRecordsResponse<BodyTemperatureRecord> tempRes = queryRecords(healthConnectClient, BodyTemperatureRecord.class, past7d, now);
                    if (tempRes != null && !tempRes.getRecords().isEmpty()) {
                        tempCount = tempRes.getRecords().size();
                        BodyTemperatureRecord latestRecord = tempRes.getRecords().get(0);
                        temp = Math.round(latestRecord.getTemperature().getCelsius() * 10.0) / 10.0;
                        tempTime = latestRecord.getTime().toString();
                        if (primaryOriginPackage == null && latestRecord.getMetadata() != null && latestRecord.getMetadata().getDataOrigin() != null) {
                            primaryOriginPackage = latestRecord.getMetadata().getDataOrigin().getPackageName();
                        }
                        Log.i("HealthConnect", "Body temp from " + tempCount + " records: " + temp + "°C at " + tempTime);
                    }
                } catch (Exception e) {
                    Log.e("HealthConnect", "Body temp query error: " + e.getMessage(), e);
                }
            }
            JSObject tempObj = new JSObject();
            tempObj.put("permissionGranted", tempPerm);
            tempObj.put("recordsFound", temp != null);
            tempObj.put("value", temp);
            tempObj.put("unit", "°C");
            tempObj.put("recordCount", tempCount);
            tempObj.put("latestTimestamp", tempTime);
            tempObj.put("status", !tempPerm ? "Permission not granted" : (temp != null ? "Records found" : "No temperature records available from connected sources"));
            metrics.put("temperature", tempObj);

            boolean hasData = (heartRate != null || spo2 != null || steps != null || sleep != null || temp != null);

            data.put("heart_rate", heartRate);
            data.put("spo2", spo2);
            data.put("steps", steps);
            data.put("sleep", sleep);
            data.put("temperature", temp);

            ret.put("permissionsGranted", !grantedPerms.isEmpty());
            ret.put("data", data);
            ret.put("metrics", metrics);
            ret.put("hasData", hasData);

            String appName = primaryOriginPackage != null ? formatSourceAppName(primaryOriginPackage) : "Health Connect";
            String formattedSourceName = appName.equals("Health Connect") ? "Health Connect" : "Health Connect (" + appName + ")";

            ret.put("source", formattedSourceName);
            ret.put("sourcePackage", primaryOriginPackage != null ? primaryOriginPackage : "");

            if (hasData) {
                ret.put("message", "Health Connect records fetched successfully from " + formattedSourceName + ".");
            } else {
                ret.put("message", "Health Connect is connected, but no wearable records were found in the query window.");
            }

            Log.i("HealthConnect", "readAggregatedData complete: hasData=" + hasData + ", source=" + formattedSourceName);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e("HealthConnect", "readAggregatedData exception: " + e.getMessage(), e);

            data.put("heart_rate", null);
            data.put("spo2", null);
            data.put("steps", null);
            data.put("sleep", null);
            data.put("temperature", null);

            ret.put("permissionsGranted", false);
            ret.put("data", data);
            ret.put("metrics", metrics);
            ret.put("hasData", false);
            ret.put("error", e.getMessage());
            ret.put("message", "Error querying Health Connect records: " + e.getMessage());
            ret.put("source", "Android Health Connect");

            call.resolve(ret);
        }
    }
}