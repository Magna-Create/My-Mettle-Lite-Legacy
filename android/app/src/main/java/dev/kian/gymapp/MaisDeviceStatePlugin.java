package dev.kian.gymapp;

import android.app.ActivityManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.PowerManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.ref.WeakReference;

@CapacitorPlugin(name = "MaisDeviceState")
public class MaisDeviceStatePlugin extends Plugin {
    private static WeakReference<MaisDeviceStatePlugin> activeInstance = new WeakReference<>(null);

    private final BroadcastReceiver powerReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            emitState();
        }
    };

    @Override
    public void load() {
        activeInstance = new WeakReference<>(this);
        getContext().registerReceiver(powerReceiver, new IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED));
    }

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(snapshot());
    }

    static void notifyVisibilityChanged() {
        MaisDeviceStatePlugin plugin = activeInstance.get();
        if (plugin != null) plugin.emitState();
    }

    private void emitState() {
        notifyListeners("stateChange", snapshot(), true);
    }

    private JSObject snapshot() {
        Context context = getContext();
        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        ActivityManager activityManager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo memoryInfo = new ActivityManager.MemoryInfo();
        activityManager.getMemoryInfo(memoryInfo);

        Intent battery = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        int status = battery == null ? -1 : battery.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        boolean charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL;

        JSObject state = new JSObject();
        state.put("appVisibility", AppVisibility.isForeground() ? "foreground" : "background");
        state.put("batterySaver", powerManager != null && powerManager.isPowerSaveMode());
        state.put("isCharging", charging);
        state.put("availableMemoryMb", Math.max(0L, memoryInfo.availMem / (1024L * 1024L)));
        state.put("capturedAt", java.time.Instant.now().toString());
        return state;
    }

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().unregisterReceiver(powerReceiver);
        } catch (IllegalArgumentException ignored) {
            // Receiver was already removed with the process.
        }
        MaisDeviceStatePlugin plugin = activeInstance.get();
        if (plugin == this) activeInstance.clear();
        super.handleOnDestroy();
    }
}
