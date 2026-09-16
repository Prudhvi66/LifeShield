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
                    false, // newest records first
                    100,
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
                latch.await(3, TimeUnit.SECONDS);
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
            int sdkStatus = HealthConnectClient.getSdkStatus(
                    context,
                    HEALTH_CONNECT_PACKAGE
            );

            if (sdkStatus == HealthConnectClient.SDK_AVAILABLE) {
                isAvailable = true;
                status = "AVAILABLE";
                provider = "HEALTH_CONNECT";
            } else if (
                    sdkStatus ==
                            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
            ) {
                status = "PROVIDER_UPDATE_REQUIRED";
                provider = "HEALTH_CONNECT";
            } else {
                status = "UNAVAILABLE";
                provider = "HEALTH_CONNECT";
            }

        } catch (Exception e) {
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
                HealthConnectClient healthConnectClient =
                        HealthConnectClient.getOrCreate(
                                context,
                                HEALTH_CONNECT_PACKAGE
                        );

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
    }

    /**
     * Request Health Connect permissions.
     */
    @PluginMethod
    public void requestPermissions(PluginCall call) {

        try {

            Set<String> permissions =
                    new HashSet<>(
                            Arrays.asList(HEALTH_PERMISSIONS)
                    );

            HealthPermissionsRequestContract contract =
                    new HealthPermissionsRequestContract(
                            HEALTH_CONNECT_PACKAGE
                    );

            Intent intent =
                    contract.createIntent(
                            getContext(),
                            permissions
                    );

            startActivityForResult(
                    call,
                    intent,
                    "healthPermissionsResult"
            );

        } catch (Exception e) {

            call.reject(
                    "Unable to request Health Connect permissions: "
                            + e.getMessage()
            );
        }
    }

    /**
     * Receive the result from the Health Connect permission screen.
     */
    @ActivityCallback
    private void healthPermissionsResult(
            PluginCall call,
            ActivityResult result
    ) {

        if (call == null) {
            return;
        }

        try {

            HealthPermissionsRequestContract contract =
                    new HealthPermissionsRequestContract(
                            HEALTH_CONNECT_PACKAGE
                    );

            Set<String> grantedPermissions =
                    contract.parseResult(
                            result.getResultCode(),
                            result.getData()
                    );

            JSObject ret = new JSObject();

            JSObject perms = new JSObject();

            boolean allGranted = true;

            for (String permission : HEALTH_PERMISSIONS) {

                boolean granted =
                        grantedPermissions.contains(permission);

                String shortName =
                        permission.substring(
                                permission.lastIndexOf('.') + 1
                        );

                perms.put(shortName, granted);

                if (!granted) {
                    allGranted = false;
                }
            }

            ret.put("permissionsGranted", allGranted);
            ret.put("permissions", perms);
            ret.put("grantedCount", grantedPermissions.size());
            ret.put(
                    "resultCode",
                    result.getResultCode()
            );

            if (result.getResultCode() == Activity.RESULT_CANCELED) {
                ret.put("cancelled", true);
            } else {
                ret.put("cancelled", false);
            }

            call.resolve(ret);

        } catch (Exception e) {

            call.reject(
                    "Failed to process Health Connect permission result: "
                            + e.getMessage()
            );
        }
    }

    /**
     * Open Health Connect settings.
     */
    @PluginMethod
    public void openHealthConnectSettings(PluginCall call) {

        Context context = getContext();
        JSObject ret = new JSObject();

        try {

            Intent intent = new Intent(
                    "androidx.health.ACTION_HEALTH_CONNECT_SETTINGS"
            );

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            context.startActivity(intent);

            ret.put("opened", true);
            ret.put("action", "HEALTH_CONNECT_SETTINGS");

            call.resolve(ret);

        } catch (Exception e1) {

            try {

                Intent launchIntent =
                        context.getPackageManager()
                                .getLaunchIntentForPackage(
                                        HEALTH_CONNECT_PACKAGE
                                );

                if (launchIntent != null) {

                    launchIntent.addFlags(
                            Intent.FLAG_ACTIVITY_NEW_TASK
                    );

                    context.startActivity(launchIntent);

                    ret.put("opened", true);
                    ret.put(
                            "action",
                            "HEALTH_CONNECT_APP"
                    );

                    call.resolve(ret);
                    return;
                }

            } catch (Exception ignored) {
            }

            try {

                Intent marketIntent =
                        new Intent(
                                Intent.ACTION_VIEW,
                                Uri.parse(
                                        "market://details?id="
                                                + HEALTH_CONNECT_PACKAGE
                                )
                        );

                marketIntent.addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK
                );

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
    }

    /**
     * Read actual real health data from Health Connect.
     */
    @PluginMethod
    public void readAggregatedData(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();
        JSObject data = new JSObject();

        try {
            HealthConnectClient healthConnectClient = HealthConnectClient.getOrCreate(
                    context,
                    HEALTH_CONNECT_PACKAGE
            );

            Instant now = Instant.now();
            Instant past24h = now.minus(24, ChronoUnit.HOURS);

            // 1. Heart Rate
            Integer heartRate = null;
            try {
                ReadRecordsResponse<HeartRateRecord> hrRes = queryRecords(healthConnectClient, HeartRateRecord.class, past24h, now);
                if (hrRes != null && !hrRes.getRecords().isEmpty()) {
                    HeartRateRecord latestRecord = hrRes.getRecords().get(0);
                    List<HeartRateRecord.Sample> samples = latestRecord.getSamples();
                    if (!samples.isEmpty()) {
                        heartRate = (int) samples.get(samples.size() - 1).getBeatsPerMinute();
                    }
                }
            } catch (Exception e) {
                Log.d("HealthConnect", "Heart rate query error: " + e.getMessage());
            }

            // 2. SpO2
            Integer spo2 = null;
            try {
                ReadRecordsResponse<OxygenSaturationRecord> spo2Res = queryRecords(healthConnectClient, OxygenSaturationRecord.class, past24h, now);
                if (spo2Res != null && !spo2Res.getRecords().isEmpty()) {
                    OxygenSaturationRecord latestRecord = spo2Res.getRecords().get(0);
                    spo2 = (int) Math.round(latestRecord.getPercentage().getValue());
                }
            } catch (Exception e) {
                Log.d("HealthConnect", "SpO2 query error: " + e.getMessage());
            }

            // 3. Steps
            Integer steps = null;
            try {
                ReadRecordsResponse<StepsRecord> stepsRes = queryRecords(healthConnectClient, StepsRecord.class, past24h, now);
                if (stepsRes != null && !stepsRes.getRecords().isEmpty()) {
                    long totalSteps = 0;
                    for (StepsRecord r : stepsRes.getRecords()) {
                        totalSteps += r.getCount();
                    }
                    steps = (int) totalSteps;
                }
            } catch (Exception e) {
                Log.d("HealthConnect", "Steps query error: " + e.getMessage());
            }

            // 4. Sleep
            Double sleep = null;
            try {
                ReadRecordsResponse<SleepSessionRecord> sleepRes = queryRecords(healthConnectClient, SleepSessionRecord.class, past24h, now);
                if (sleepRes != null && !sleepRes.getRecords().isEmpty()) {
                    double totalMins = 0;
                    for (SleepSessionRecord r : sleepRes.getRecords()) {
                        long mins = Duration.between(r.getStartTime(), r.getEndTime()).toMinutes();
                        totalMins += mins;
                    }
                    sleep = Math.round((totalMins / 60.0) * 10.0) / 10.0;
                }
            } catch (Exception e) {
                Log.d("HealthConnect", "Sleep query error: " + e.getMessage());
            }

            // 5. Body Temperature
            Double temp = null;
            try {
                ReadRecordsResponse<BodyTemperatureRecord> tempRes = queryRecords(healthConnectClient, BodyTemperatureRecord.class, past24h, now);
                if (tempRes != null && !tempRes.getRecords().isEmpty()) {
                    BodyTemperatureRecord latestRecord = tempRes.getRecords().get(0);
                    temp = Math.round(latestRecord.getTemperature().getCelsius() * 10.0) / 10.0;
                }
            } catch (Exception e) {
                Log.d("HealthConnect", "Body temp query error: " + e.getMessage());
            }

            boolean hasData = (heartRate != null || spo2 != null || steps != null || sleep != null || temp != null);

            data.put("heart_rate", heartRate);
            data.put("spo2", spo2);
            data.put("steps", steps);
            data.put("sleep", sleep);
            data.put("temperature", temp);

            ret.put("permissionsGranted", true);
            ret.put("data", data);
            ret.put("hasData", hasData);
            ret.put("source", "Android Health Connect");
            if (hasData) {
                ret.put("message", "Health Connect records fetched successfully.");
            } else {
                ret.put("message", "Health Connect permissions are granted, but no health records were found in the past 24 hours.");
            }

            call.resolve(ret);

        } catch (Exception e) {
            data.put("heart_rate", null);
            data.put("spo2", null);
            data.put("steps", null);
            data.put("sleep", null);
            data.put("temperature", null);

            ret.put("permissionsGranted", false);
            ret.put("data", data);
            ret.put("hasData", false);
            ret.put("error", e.getMessage());
            ret.put("message", "Error querying Health Connect records: " + e.getMessage());
            ret.put("source", "Android Health Connect");

            call.resolve(ret);
        }
    }
}