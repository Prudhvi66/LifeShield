package com.lifeshield.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * LifeShield Native BLE GATT Plugin
 *
 * Implements native Android BLE connection, dynamic GATT service discovery,
 * device capability assessment, and real-time streaming for standard Bluetooth SIG
 * health profiles:
 *   - Heart Rate Service (0x180D -> 0x2A37)
 *   - Pulse Oximeter Service (0x1822 -> 0x2A5E / 0x2A5F)
 *   - Health Thermometer (0x1809 -> 0x2A1C)
 *   - Running Speed and Cadence (0x1814 -> 0x2A53)
 *   - Battery Service (0x180F -> 0x2A19)
 *
 * If a device does not expose any supported standard health service, it cleanly
 * reports: "This device does not expose a supported health-data service."
 */
@CapacitorPlugin(
        name = "BluetoothGatt",
        permissions = {
                @Permission(strings = {Manifest.permission.BLUETOOTH_SCAN}, alias = "bluetoothScan"),
                @Permission(strings = {Manifest.permission.BLUETOOTH_CONNECT}, alias = "bluetoothConnect"),
                @Permission(strings = {Manifest.permission.ACCESS_FINE_LOCATION}, alias = "location")
        }
)
public class BluetoothGattPlugin extends Plugin {

    private static final String TAG = "LifeShield_BLE";

    // Standard BLE GATT Service UUIDs
    private static final UUID HEART_RATE_SERVICE        = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb");
    private static final UUID PULSE_OX_SERVICE          = UUID.fromString("00001822-0000-1000-8000-00805f9b34fb");
    private static final UUID HEALTH_THERMOMETER_SERVICE = UUID.fromString("00001809-0000-1000-8000-00805f9b34fb");
    private static final UUID RSC_SERVICE               = UUID.fromString("00001814-0000-1000-8000-00805f9b34fb");
    private static final UUID BATTERY_SERVICE           = UUID.fromString("0000180f-0000-1000-8000-00805f9b34fb");

    // Standard BLE GATT Characteristic UUIDs
    private static final UUID HEART_RATE_MEASUREMENT    = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb");
    private static final UUID PLX_CONTINUOUS            = UUID.fromString("00002a5e-0000-1000-8000-00805f9b34fb");
    private static final UUID PLX_SPOT_CHECK            = UUID.fromString("00002a5f-0000-1000-8000-00805f9b34fb");
    private static final UUID TEMPERATURE_MEASUREMENT   = UUID.fromString("00002a1c-0000-1000-8000-00805f9b34fb");
    private static final UUID RSC_MEASUREMENT           = UUID.fromString("00002a53-0000-1000-8000-00805f9b34fb");
    private static final UUID BATTERY_LEVEL             = UUID.fromString("00002a19-0000-1000-8000-00805f9b34fb");
    private static final UUID CLIENT_CONFIG_DESCRIPTOR  = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    // Scan timeout: 15 seconds
    private static final long SCAN_PERIOD_MS = 15000L;

    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner bleScanner;
    private BluetoothGatt activeGatt;
    private ScanCallback scanCallback;
    private PluginCall pendingScanCall;

    // Discovered Device State & Capabilities
    private String connectedDeviceName = null;
    private String connectedDeviceAddress = null;
    private boolean capHeartRate = false;
    private boolean capSpO2 = false;
    private boolean capTemperature = false;
    private boolean capCadence = false;
    private boolean capBattery = false;

    // Latest Vitals
    private int lastHeartRate = 0;
    private int lastSpO2 = -1;
    private double lastTemperature = -1.0;
    private int lastCadence = -1;
    private int lastBattery = -1;
    private long lastVitalsTimestamp = 0;

    private final Handler handler = new Handler(Looper.getMainLooper());

    // ---------------------------------------------------------------------------
    // isSupported
    // ---------------------------------------------------------------------------
    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        boolean hasFeature = getContext().getPackageManager()
                .hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE);
        ret.put("supported", hasFeature);
        ret.put("platform", "android_native");
        call.resolve(ret);
    }

    // ---------------------------------------------------------------------------
    // checkBlePermissions
    // ---------------------------------------------------------------------------
    @PluginMethod
    public void checkBlePermissions(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = hasBlePermissions();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    // ---------------------------------------------------------------------------
    // requestBlePermissions
    // ---------------------------------------------------------------------------
    @PluginMethod
    public void requestBlePermissions(PluginCall call) {
        if (hasBlePermissions()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissionForAliases(
                    new String[]{"bluetoothScan", "bluetoothConnect"},
                    call,
                    "blePermissionsResult"
            );
        } else {
            requestPermissionForAlias("location", call, "blePermissionsResult");
        }
    }

    @PermissionCallback
    private void blePermissionsResult(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasBlePermissions());
        call.resolve(ret);
    }

    private boolean isLikelyWatch(String name) {
        if (name == null) return false;
        String lower = name.toLowerCase();
        return lower.contains("watch") || lower.contains("band") || lower.contains("fit") ||
                lower.contains("noise") || lower.contains("boat") || lower.contains("fire") ||
                lower.contains("garmin") || lower.contains("amazfit") || lower.contains("titan") ||
                lower.contains("fastrack") || lower.contains("galaxy") || lower.contains("pixel") ||
                lower.contains("dapit") || lower.contains("colorfit");
    }

    private String getDetectedBondedWatch() {
        if (bluetoothAdapter != null && hasBlePermissions()) {
            try {
                Set<BluetoothDevice> bonded = bluetoothAdapter.getBondedDevices();
                if (bonded != null) {
                    for (BluetoothDevice d : bonded) {
                        String dName = d.getName();
                        if (isLikelyWatch(dName)) {
                            return dName;
                        }
                    }
                }
            } catch (SecurityException ignored) {}
        }
        return null;
    }

    // ---------------------------------------------------------------------------
    // checkBluetoothState
    // ---------------------------------------------------------------------------
    @PluginMethod
    public void checkBluetoothState(PluginCall call) {
        JSObject ret = new JSObject();
        boolean hasFeature = getContext().getPackageManager()
                .hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE);
        ret.put("supported", hasFeature);

        boolean perms = hasBlePermissions();
        ret.put("hasPermissions", perms);

        BluetoothManager btManager = (BluetoothManager) getContext()
                .getSystemService(Context.BLUETOOTH_SERVICE);
        bluetoothAdapter = btManager != null ? btManager.getAdapter() : null;

        boolean enabled = bluetoothAdapter != null && bluetoothAdapter.isEnabled();
        ret.put("enabled", enabled);

        JSArray bondedList = new JSArray();
        String detectedWatchName = null;
        if (bluetoothAdapter != null && perms) {
            try {
                Set<BluetoothDevice> bonded = bluetoothAdapter.getBondedDevices();
                if (bonded != null) {
                    for (BluetoothDevice d : bonded) {
                        JSObject devObj = new JSObject();
                        String dName = d.getName() != null ? d.getName() : "Bluetooth Device";
                        devObj.put("name", dName);
                        devObj.put("address", d.getAddress());
                        devObj.put("type", d.getType());
                        boolean isWatch = isLikelyWatch(dName);
                        devObj.put("isWearable", isWatch);
                        if (isWatch && detectedWatchName == null) {
                            detectedWatchName = dName;
                        }
                        bondedList.put(devObj);
                    }
                }
            } catch (SecurityException ignored) {}
        }
        ret.put("bondedDevices", bondedList);
        ret.put("detectedWatchName", detectedWatchName);

        if (!hasFeature) {
            ret.put("status", "UNSUPPORTED");
            ret.put("message", "Bluetooth LE is not supported on this device.");
        } else if (!perms) {
            ret.put("status", "PERMISSION_REQUIRED");
            ret.put("message", "Bluetooth permission required. Please allow Bluetooth permission.");
        } else if (!enabled) {
            ret.put("status", "BLUETOOTH_OFF");
            ret.put("message", "Bluetooth is turned off. Please turn on Bluetooth and try again.");
        } else if (activeGatt != null) {
            ret.put("status", "CONNECTED");
            ret.put("deviceName", connectedDeviceName);
            ret.put("message", "Connected to " + connectedDeviceName);
        } else {
            ret.put("status", "READY");
            ret.put("message", "Bluetooth is active and ready.");
        }

        call.resolve(ret);
    }

    // ---------------------------------------------------------------------------
    // scanAndConnect
    // ---------------------------------------------------------------------------
    @PluginMethod
    public void scanAndConnect(PluginCall call) {
        if (!hasBlePermissions()) {
            JSObject err = new JSObject();
            err.put("isConnected", false);
            err.put("status", "PERMISSION_REQUIRED");
            err.put("error", "Bluetooth permission required.");
            err.put("message", "Bluetooth permission required. Please allow Bluetooth permission in Android Settings.");
            call.resolve(err);
            return;
        }

        BluetoothManager btManager = (BluetoothManager) getContext()
                .getSystemService(Context.BLUETOOTH_SERVICE);
        if (btManager == null) {
            JSObject err = new JSObject();
            err.put("isConnected", false);
            err.put("status", "UNSUPPORTED");
            err.put("error", "BluetoothManager is not available.");
            err.put("message", "BluetoothManager is not available on this device.");
            call.resolve(err);
            return;
        }

        bluetoothAdapter = btManager.getAdapter();
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            JSObject err = new JSObject();
            err.put("isConnected", false);
            err.put("status", "BLUETOOTH_OFF");
            err.put("error", "Bluetooth is turned off.");
            err.put("message", "Bluetooth is turned off. Please turn on Bluetooth and try again.");
            call.resolve(err);
            return;
        }

        disconnectGatt();

        bleScanner = bluetoothAdapter.getBluetoothLeScanner();
        if (bleScanner == null) {
            JSObject err = new JSObject();
            err.put("isConnected", false);
            err.put("status", "BLE_SCANNER_UNAVAILABLE");
            err.put("error", "BLE Scanner is unavailable.");
            err.put("message", "BLE Scanner is unavailable.");
            call.resolve(err);
            return;
        }

        pendingScanCall = call;

        // Construct scan filters: Include standard health service UUIDs
        List<ScanFilter> filters = new ArrayList<>();
        filters.add(new ScanFilter.Builder().setServiceUuid(new ParcelUuid(HEART_RATE_SERVICE)).build());
        filters.add(new ScanFilter.Builder().setServiceUuid(new ParcelUuid(PULSE_OX_SERVICE)).build());
        filters.add(new ScanFilter.Builder().setServiceUuid(new ParcelUuid(HEALTH_THERMOMETER_SERVICE)).build());
        filters.add(new ScanFilter.Builder().setServiceUuid(new ParcelUuid(RSC_SERVICE)).build());

        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();

        final Set<String> seenAddresses = new HashSet<>();

        scanCallback = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                BluetoothDevice device = result.getDevice();
                if (device == null || seenAddresses.contains(device.getAddress())) {
                    return;
                }
                seenAddresses.add(device.getAddress());

                String name = "BLE Health Device";
                try {
                    if (hasBlePermissions() && device.getName() != null && !device.getName().trim().isEmpty()) {
                        name = device.getName().trim();
                    }
                } catch (SecurityException ignored) {}

                Log.i(TAG, "Found candidate device: " + name + " (" + device.getAddress() + ")");

                // Stop scanning and connect to discover actual capabilities
                stopScan();
                connectToDevice(device, name, call);
            }

            @Override
            public void onScanFailed(int errorCode) {
                stopScan();
                Log.e(TAG, "BLE Scan failed with error code: " + errorCode);
                if (pendingScanCall != null) {
                    JSObject err = new JSObject();
                    err.put("isConnected", false);
                    err.put("status", "SCAN_FAILED");
                    err.put("error", "BLE scan failed with code " + errorCode);
                    err.put("message", "BLE scan failed (Error " + errorCode + "). Ensure Bluetooth and Location are active.");
                    pendingScanCall.resolve(err);
                    pendingScanCall = null;
                }
            }
        };

        try {
            // First attempt targeted scan with health service filters
            bleScanner.startScan(filters, settings, scanCallback);
            Log.i(TAG, "Started BLE scan for standard health devices...");

            // If no targeted device found in 7 seconds, broaden scan to all nearby BLE peripherals
            handler.postDelayed(() -> {
                if (pendingScanCall != null && seenAddresses.isEmpty()) {
                    try {
                        Log.i(TAG, "Broadening scan to all nearby BLE peripherals (in case device omits service UUID from advertisement)...");
                        stopScan();
                        bleScanner.startScan(null, settings, scanCallback);
                    } catch (SecurityException | IllegalStateException ignored) {}
                }
            }, 7000L);

            // Timeout after SCAN_PERIOD_MS
            handler.postDelayed(() -> {
                if (pendingScanCall != null) {
                    stopScan();
                    String detectedWatch = getDetectedBondedWatch();
                    JSObject err = new JSObject();
                    err.put("isConnected", false);
                    if (detectedWatch != null) {
                        err.put("status", "COMPANION_APP_BRIDGE");
                        err.put("deviceName", detectedWatch);
                        err.put("error", "Watch paired to phone via companion app.");
                        err.put("message", "Your watch (" + detectedWatch + ") is paired with your phone. Proprietary smartwatches communicate through their companion app and do not stream direct Bluetooth GATT. Please use Health Connect to sync your watch's health records.");
                    } else {
                        err.put("status", "NO_DEVICES_FOUND");
                        err.put("error", "No compatible Bluetooth health device found nearby within 15 seconds.");
                        err.put("message", "No compatible Bluetooth health device found nearby within 15 seconds. Ensure your smartwatch/sensor is turned on, nearby, and in pairing mode.");
                    }
                    pendingScanCall.resolve(err);
                    pendingScanCall = null;
                }
            }, SCAN_PERIOD_MS);
        } catch (SecurityException e) {
            JSObject err = new JSObject();
            err.put("isConnected", false);
            err.put("status", "PERMISSION_REQUIRED");
            err.put("error", "BLE scan permission denied: " + e.getMessage());
            err.put("message", "Bluetooth permission required. Please allow Bluetooth permission.");
            call.resolve(err);
        }
    }

    // ---------------------------------------------------------------------------
    // getCapabilities
    // ---------------------------------------------------------------------------
    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isConnected", activeGatt != null);
        ret.put("deviceName", connectedDeviceName);
        ret.put("deviceAddress", connectedDeviceAddress);

        JSObject caps = new JSObject();
        caps.put("heartRate", capHeartRate);
        caps.put("spO2", capSpO2);
        caps.put("temperature", capTemperature);
        caps.put("steps", capCadence);
        caps.put("sleep", false); // Standard BLE GATT does not broadcast sleep; sleep is processed retrospectively by companion apps
        caps.put("battery", capBattery);

        ret.put("capabilities", caps);
        call.resolve(ret);
    }

    // ---------------------------------------------------------------------------
    // readVitals
    // ---------------------------------------------------------------------------
    @PluginMethod
    public void readVitals(PluginCall call) {
        JSObject ret = new JSObject();
        if (activeGatt == null) {
            ret.put("connected", false);
            ret.put("heartRate", (Object) null);
            ret.put("spO2", (Object) null);
            ret.put("temperature", (Object) null);
            ret.put("steps", (Object) null);
            ret.put("batteryLevel", (Object) null);
            ret.put("timestamp", 0);
            ret.put("source", "Bluetooth GATT");
            call.resolve(ret);
            return;
        }

        ret.put("connected", true);
        ret.put("deviceName", connectedDeviceName);
        ret.put("heartRate", lastHeartRate > 0 ? lastHeartRate : (Object) null);
        ret.put("spO2", lastSpO2 > 0 ? lastSpO2 : (Object) null);
        ret.put("temperature", lastTemperature > 0 ? lastTemperature : (Object) null);
        ret.put("steps", (Object) null); // Live step accumulation via Health Connect
        ret.put("batteryLevel", lastBattery >= 0 ? lastBattery : (Object) null);
        ret.put("timestamp", lastVitalsTimestamp);
        ret.put("source", "Bluetooth GATT");
        call.resolve(ret);
    }

    // ---------------------------------------------------------------------------
    // disconnect
    // ---------------------------------------------------------------------------
    @PluginMethod
    public void disconnect(PluginCall call) {
        disconnectGatt();
        JSObject ret = new JSObject();
        ret.put("disconnected", true);
        call.resolve(ret);
    }

    // ============================= PRIVATE HELPERS ============================

    private boolean hasBlePermissions() {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN)
                    == PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT)
                    == PackageManager.PERMISSION_GRANTED;
        } else {
            return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;
        }
    }

    private void stopScan() {
        try {
            if (bleScanner != null && scanCallback != null && hasBlePermissions()) {
                bleScanner.stopScan(scanCallback);
            }
        } catch (SecurityException | IllegalStateException ignored) {}
        scanCallback = null;
    }

    private void connectToDevice(BluetoothDevice device, String deviceName, PluginCall call) {
        try {
            connectedDeviceName = deviceName;
            connectedDeviceAddress = device.getAddress();

            activeGatt = device.connectGatt(getContext(), false, new BluetoothGattCallback() {

                @Override
                public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
                    if (newState == BluetoothProfile.STATE_CONNECTED) {
                        Log.i(TAG, "Connected to " + deviceName + ". Discovering services...");
                        try {
                            gatt.discoverServices();
                        } catch (SecurityException ignored) {}
                    } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                        Log.i(TAG, "Disconnected from " + deviceName);
                        disconnectGatt();

                        JSObject data = new JSObject();
                        data.put("connected", false);
                        data.put("deviceName", deviceName);
                        notifyListeners("bleDisconnected", data);
                    }
                }

                @Override
                public void onServicesDiscovered(BluetoothGatt gatt, int status) {
                    if (status != BluetoothGatt.GATT_SUCCESS) {
                        Log.e(TAG, "GATT service discovery failed with status " + status);
                        disconnectGatt();
                        if (pendingScanCall != null) {
                            pendingScanCall.reject("Service discovery failed. Status: " + status);
                            pendingScanCall = null;
                        }
                        return;
                    }

                    // Discover capabilities across all services
                    List<BluetoothGattService> services = gatt.getServices();
                    List<String> serviceUuids = new ArrayList<>();
                    capHeartRate = false;
                    capSpO2 = false;
                    capTemperature = false;
                    capCadence = false;
                    capBattery = false;

                    for (BluetoothGattService s : services) {
                        UUID u = s.getUuid();
                        serviceUuids.add(u.toString());
                        if (HEART_RATE_SERVICE.equals(u)) {
                            capHeartRate = true;
                        } else if (PULSE_OX_SERVICE.equals(u)) {
                            capSpO2 = true;
                        } else if (HEALTH_THERMOMETER_SERVICE.equals(u)) {
                            capTemperature = true;
                        } else if (RSC_SERVICE.equals(u)) {
                            capCadence = true;
                        } else if (BATTERY_SERVICE.equals(u)) {
                            capBattery = true;
                        }
                    }

                    Log.i(TAG, "Discovered capabilities for " + deviceName + ": HR=" + capHeartRate +
                            ", SpO2=" + capSpO2 + ", Temp=" + capTemperature + ", RSC=" + capCadence + ", Batt=" + capBattery);

                    // Check if device exposes AT LEAST ONE standard health service
                    boolean hasSupportedHealthService = capHeartRate || capSpO2 || capTemperature || capCadence;

                    if (!hasSupportedHealthService) {
                        Log.w(TAG, "Device " + deviceName + " does not expose standard Bluetooth SIG health services.");
                        disconnectGatt();

                        if (pendingScanCall != null) {
                            JSObject errObj = new JSObject();
                            errObj.put("isConnected", false);
                            errObj.put("status", "COMPANION_APP_BRIDGE");
                            errObj.put("pairedWatchDetected", true);
                            errObj.put("deviceName", deviceName);
                            errObj.put("error", "This device communicates via its companion app.");
                            errObj.put("message", "Your watch (" + deviceName + ") is connected via its companion app. Consumer smartwatches sync to Android Health Connect. Please use Health Connect to read health records in LifeShield.");
                            pendingScanCall.resolve(errObj);
                            pendingScanCall = null;
                        }
                        return;
                    }

                    // Enable notifications on all supported characteristics
                    if (capHeartRate) {
                        enableNotification(gatt, HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT);
                    }
                    if (capSpO2) {
                        enableNotification(gatt, PULSE_OX_SERVICE, PLX_CONTINUOUS);
                        enableNotification(gatt, PULSE_OX_SERVICE, PLX_SPOT_CHECK);
                    }
                    if (capTemperature) {
                        enableNotification(gatt, HEALTH_THERMOMETER_SERVICE, TEMPERATURE_MEASUREMENT);
                    }
                    if (capCadence) {
                        enableNotification(gatt, RSC_SERVICE, RSC_MEASUREMENT);
                    }
                    if (capBattery) {
                        readBatteryLevel(gatt);
                    }

                    if (pendingScanCall != null) {
                        JSObject ret = new JSObject();
                        ret.put("isConnected", true);
                        ret.put("deviceName", deviceName);
                        ret.put("deviceAddress", device.getAddress());

                        JSObject caps = new JSObject();
                        caps.put("heartRate", capHeartRate);
                        caps.put("spO2", capSpO2);
                        caps.put("temperature", capTemperature);
                        caps.put("steps", capCadence);
                        caps.put("sleep", false);
                        caps.put("battery", capBattery);
                        ret.put("capabilities", caps);

                        JSArray sUuids = new JSArray();
                        for (String uuidStr : serviceUuids) {
                            sUuids.put(uuidStr);
                        }
                        ret.put("servicesDiscovered", sUuids);

                        pendingScanCall.resolve(ret);
                        pendingScanCall = null;
                    }
                }

                @Override
                public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic ch) {
                    UUID uuid = ch.getUuid();
                    boolean updated = false;

                    if (HEART_RATE_MEASUREMENT.equals(uuid)) {
                        int hr = parseHeartRate(ch);
                        if (hr > 30 && hr < 240) {
                            lastHeartRate = hr;
                            updated = true;
                        }
                    } else if (PLX_CONTINUOUS.equals(uuid) || PLX_SPOT_CHECK.equals(uuid)) {
                        int spo2 = parseSpO2(ch);
                        if (spo2 > 50 && spo2 <= 100) {
                            lastSpO2 = spo2;
                            updated = true;
                        }
                    } else if (TEMPERATURE_MEASUREMENT.equals(uuid)) {
                        double temp = parseTemperature(ch);
                        if (temp > 30.0 && temp < 45.0) {
                            lastTemperature = temp;
                            updated = true;
                        }
                    } else if (RSC_MEASUREMENT.equals(uuid)) {
                        int cadence = parseCadence(ch);
                        if (cadence >= 0) {
                            lastCadence = cadence;
                            updated = true;
                        }
                    }

                    if (updated) {
                        lastVitalsTimestamp = System.currentTimeMillis();
                        JSObject data = new JSObject();
                        data.put("heartRate", lastHeartRate > 0 ? lastHeartRate : (Object) null);
                        data.put("spO2", lastSpO2 > 0 ? lastSpO2 : (Object) null);
                        data.put("temperature", lastTemperature > 0 ? lastTemperature : (Object) null);
                        data.put("batteryLevel", lastBattery >= 0 ? lastBattery : (Object) null);
                        data.put("cadence", lastCadence >= 0 ? lastCadence : (Object) null);
                        data.put("timestamp", lastVitalsTimestamp);
                        data.put("source", "Bluetooth GATT");
                        data.put("isLive", true);

                        notifyListeners("bleVitalsUpdate", data);
                    }
                }

                @Override
                public void onCharacteristicRead(BluetoothGatt gatt, BluetoothGattCharacteristic ch, int status) {
                    if (status == BluetoothGatt.GATT_SUCCESS && BATTERY_LEVEL.equals(ch.getUuid())) {
                        lastBattery = ch.getIntValue(BluetoothGattCharacteristic.FORMAT_UINT8, 0);
                        Log.d(TAG, "Battery level: " + lastBattery + "%");
                    }
                }
            });
        } catch (SecurityException e) {
            call.reject("BLE connect permission denied: " + e.getMessage());
        }
    }

    private boolean enableNotification(BluetoothGatt gatt, UUID serviceUuid, UUID charUuid) {
        try {
            BluetoothGattService service = gatt.getService(serviceUuid);
            if (service == null) return false;
            BluetoothGattCharacteristic ch = service.getCharacteristic(charUuid);
            if (ch == null) return false;

            gatt.setCharacteristicNotification(ch, true);
            BluetoothGattDescriptor descriptor = ch.getDescriptor(CLIENT_CONFIG_DESCRIPTOR);
            if (descriptor != null) {
                descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                gatt.writeDescriptor(descriptor);
            }
            return true;
        } catch (SecurityException | IllegalArgumentException e) {
            Log.e(TAG, "enableNotification error: " + e.getMessage());
            return false;
        }
    }

    private void readBatteryLevel(BluetoothGatt gatt) {
        try {
            BluetoothGattService battSvc = gatt.getService(BATTERY_SERVICE);
            if (battSvc != null) {
                BluetoothGattCharacteristic battChar = battSvc.getCharacteristic(BATTERY_LEVEL);
                if (battChar != null) {
                    gatt.readCharacteristic(battChar);
                }
            }
        } catch (SecurityException ignored) {}
    }

    // ---------------------------------------------------------------------------
    // Parsers for Standard Bluetooth SIG Characteristics
    // ---------------------------------------------------------------------------

    private int parseHeartRate(BluetoothGattCharacteristic ch) {
        try {
            int flags = ch.getIntValue(BluetoothGattCharacteristic.FORMAT_UINT8, 0);
            boolean is16bit = (flags & 0x01) == 1;
            if (is16bit) {
                return ch.getIntValue(BluetoothGattCharacteristic.FORMAT_UINT16, 1);
            } else {
                return ch.getIntValue(BluetoothGattCharacteristic.FORMAT_UINT8, 1);
            }
        } catch (Exception e) {
            return 0;
        }
    }

    private int parseSpO2(BluetoothGattCharacteristic ch) {
        try {
            byte[] val = ch.getValue();
            if (val == null || val.length < 3) return 0;
            int raw = (val[2] & 0xFF) << 8 | (val[1] & 0xFF);
            int mantissa = raw & 0x0FFF;
            int exponent = raw >> 12;
            if (exponent > 7) exponent -= 16;
            double value = mantissa * Math.pow(10, exponent);
            return (int) Math.round(value);
        } catch (Exception e) {
            return 0;
        }
    }

    private double parseTemperature(BluetoothGattCharacteristic ch) {
        try {
            // Temperature Measurement characteristic (0x2A1C): Flags (1 byte) + FLOAT (4 bytes)
            byte[] val = ch.getValue();
            if (val == null || val.length < 5) return -1.0;
            int raw = (val[4] & 0xFF) << 24 | (val[3] & 0xFF) << 16 | (val[2] & 0xFF) << 8 | (val[1] & 0xFF);
            int mantissa = raw & 0x00FFFFFF;
            if ((mantissa & 0x00800000) != 0) mantissa |= 0xFF000000; // Sign extend 24-bit mantissa
            int exponent = raw >> 24;
            double tempCelsius = mantissa * Math.pow(10, exponent);
            return Math.round(tempCelsius * 10.0) / 10.0;
        } catch (Exception e) {
            return -1.0;
        }
    }

    private int parseCadence(BluetoothGattCharacteristic ch) {
        try {
            // RSC Measurement (0x2A53): Flags (1 byte) + Instantaneous Speed (2 bytes) + Instantaneous Cadence (1 byte)
            byte[] val = ch.getValue();
            if (val == null || val.length < 4) return -1;
            return val[3] & 0xFF; // Cadence in RPM (steps per minute)
        } catch (Exception e) {
            return -1;
        }
    }

    private void disconnectGatt() {
        try {
            if (activeGatt != null) {
                activeGatt.disconnect();
                activeGatt.close();
                activeGatt = null;
            }
        } catch (SecurityException | IllegalArgumentException ignored) {}
        connectedDeviceName = null;
        connectedDeviceAddress = null;
        capHeartRate = false;
        capSpO2 = false;
        capTemperature = false;
        capCadence = false;
        capBattery = false;
        lastHeartRate = 0;
        lastSpO2 = -1;
        lastTemperature = -1.0;
        lastCadence = -1;
        lastBattery = -1;
        lastVitalsTimestamp = 0;
    }

    @Override
    protected void handleOnDestroy() {
        stopScan();
        disconnectGatt();
        super.handleOnDestroy();
    }
}
