package com.lifeshield.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(
    name = "Location",
    permissions = {
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }
        )
    }
)
public class LocationPlugin extends Plugin {

    private static final String TAG = "LocationPlugin";
    private static final long DEFAULT_TIMEOUT_MS = 10000;

    private FusedLocationProviderClient fusedClient;
    private LocationCallback locationCallback;
    private PluginCall pendingCall;

    @Override
    public void load() {
        super.load();
        Context ctx = getContext();
        if (ctx != null) {
            fusedClient = LocationServices.getFusedLocationProviderClient(ctx);
            Log.d(TAG, "Location plugin loaded");
        }
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("No context available");
            return;
        }

        boolean fine = ActivityCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ActivityCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        JSObject result = new JSObject();
        result.put("granted", fine || coarse);
        result.put("fineLocation", fine);
        result.put("coarseLocation", coarse);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("No context available");
            return;
        }

        boolean fine = ActivityCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (fine) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        // Store call for permission callback
        this.pendingCall = call;
        requestPermissionForAlias("location", call, "handleLocationPermissionResult");
    }

    @PermissionCallback
    private void handleLocationPermissionResult(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            if (pendingCall != null) {
                pendingCall.reject("No context available");
                pendingCall = null;
            }
            return;
        }

        boolean granted = ActivityCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);

        this.pendingCall = null;
    }

    @PluginMethod
    public void getCurrentLocation(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("No context available");
            return;
        }

        if (fusedClient == null) {
            call.reject("Location services not available");
            return;
        }

        boolean fine = ActivityCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ActivityCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        if (!fine && !coarse) {
            call.reject("location_permission_not_granted");
            return;
        }

        long timeout = call.getLong("timeout", DEFAULT_TIMEOUT_MS);

        try {
            // First try last known location for speed
            @SuppressWarnings("MissingPermission")
            Location lastKnown = fusedClient.getLastLocation().getResult();

            if (lastKnown != null && (System.currentTimeMillis() - lastKnown.getTime()) < 30000) {
                JSObject loc = buildLocationResult(lastKnown);
                loc.put("fromCache", true);
                call.resolve(loc);
                return;
            }

            // Request fresh location with timeout
            LocationRequest request = LocationRequest.create();
            request.setPriority(LocationRequest.PRIORITY_HIGH_ACCURACY);
            request.setInterval(1000);
            request.setFastestInterval(500);
            request.setNumUpdates(1);
            request.setExpirationDuration(timeout);

            final CountDownLatch latch = new CountDownLatch(1);
            final boolean[] resolved = {false};

            locationCallback = new LocationCallback() {
                @Override
                public void onLocationResult(LocationResult locationResult) {
                    if (resolved[0]) return;

                    Location location = locationResult.getLastLocation();
                    if (location != null) {
                        resolved[0] = true;
                        latch.countDown();
                        JSObject loc = buildLocationResult(location);
                        loc.put("fromCache", false);
                        call.resolve(loc);
                    }
                }
            };

            //noinspection MissingPermission
            fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());

            // Timeout handler
            new android.os.Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (!resolved[0]) {
                    resolved[0] = true;
                    latch.countDown();
                    // Try last known as fallback
                    @SuppressWarnings("MissingPermission")
                    Location fallback = null;
                    try {
                        fallback = fusedClient.getLastLocation().getResult();
                    } catch (Exception e) {
                        // ignore
                    }

                    if (fallback != null) {
                        JSObject loc = buildLocationResult(fallback);
                        loc.put("fromCache", true);
                        loc.put("timedOut", true);
                        call.resolve(loc);
                    } else {
                        call.reject("location_timeout");
                    }

                    removeLocationUpdates();
                }
            }, timeout);

        } catch (Exception e) {
            Log.e(TAG, "Location request failed", e);
            call.reject("location_error: " + e.getMessage());
        }
    }

    private JSObject buildLocationResult(Location location) {
        JSObject result = new JSObject();
        result.put("latitude", location.getLatitude());
        result.put("longitude", location.getLongitude());
        result.put("accuracy", (double) location.getAccuracy());
        result.put("altitude", location.getAltitude());
        result.put("speed", (double) location.getSpeed());
        result.put("bearing", (double) location.getBearing());
        result.put("timestamp", location.getTime());
        return result;
    }

    private void removeLocationUpdates() {
        if (locationCallback != null && fusedClient != null) {
            fusedClient.removeLocationUpdates(locationCallback);
            locationCallback = null;
        }
    }

    @PluginMethod
    public void stopWatch(PluginCall call) {
        removeLocationUpdates();
        JSObject result = new JSObject();
        result.put("stopped", true);
        call.resolve(result);
    }

    @Override
    public void handleOnDestroy() {
        removeLocationUpdates();
        super.handleOnDestroy();
    }
}
