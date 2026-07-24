package dev.kian.gymapp

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Debug
import android.os.PowerManager
import android.os.StatFs
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.io.File
import java.util.ArrayDeque

@CapacitorPlugin(name = "MaisDeveloperTools")
class MaisDeveloperToolsPlugin : Plugin() {
    @PluginMethod
    fun getSnapshot(call: PluginCall) {
        try {
            call.resolve(snapshot())
        } catch (error: Throwable) {
            call.reject(rootMessage(error), asException(error))
        }
    }

    @PluginMethod
    fun clearDiagnostics(call: PluginCall) {
        try {
            MaisDiagnosticsStore.clear(context)
            call.resolve(JSObject().apply { put("cleared", true) })
        } catch (error: Throwable) {
            call.reject(rootMessage(error), asException(error))
        }
    }

    private fun snapshot(): JSObject {
        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memoryInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memoryInfo)
        val runtime = Runtime.getRuntime()
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val storage = StatFs(context.filesDir.absolutePath)
        val sourceStats = directoryStats(File(context.filesDir, "mais-models"))
        val genieStats = directoryStats(File(context.filesDir, "geniex"))
        val battery = batterySnapshot()

        return JSObject().apply {
            put("capturedAtEpochMs", System.currentTimeMillis())
            put("process", JSObject().apply {
                put("pssBytes", Debug.getPss() * 1024L)
                put("nativeHeapAllocatedBytes", Debug.getNativeHeapAllocatedSize())
                put("nativeHeapSizeBytes", Debug.getNativeHeapSize())
                put("nativeHeapFreeBytes", Debug.getNativeHeapFreeSize())
                put("javaHeapUsedBytes", runtime.totalMemory() - runtime.freeMemory())
                put("javaHeapCommittedBytes", runtime.totalMemory())
                put("javaHeapMaxBytes", runtime.maxMemory())
            })
            put("deviceMemory", JSObject().apply {
                put("availableBytes", memoryInfo.availMem)
                put("totalBytes", memoryInfo.totalMem)
                put("thresholdBytes", memoryInfo.threshold)
                put("lowMemory", memoryInfo.lowMemory)
            })
            put("storage", JSObject().apply {
                put("availableBytes", storage.availableBytes)
                put("totalBytes", storage.totalBytes)
                put("sourceModelBytes", sourceStats.bytes)
                put("sourceModelFiles", sourceStats.files)
                put("genieCacheBytes", genieStats.bytes)
                put("genieCacheFiles", genieStats.files)
            })
            put("power", JSObject().apply {
                put("powerSaveMode", powerManager.isPowerSaveMode)
                put(
                    "thermalStatus",
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) powerManager.currentThermalStatus else -1,
                )
                put(
                    "thermalLabel",
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) thermalLabel(powerManager.currentThermalStatus) else "Unavailable",
                )
                put("batteryPercent", battery.percent)
                put("batteryTemperatureC", battery.temperatureC ?: JSONObject.NULL)
                put("charging", battery.charging)
            })
            put("lastNativeStage", MaisDiagnosticsStore.last(context) ?: JSONObject.NULL)
            put("breadcrumbs", MaisDiagnosticsStore.read(context))
            put("recentProcessExits", recentProcessExits(activityManager))
        }
    }

    private fun recentProcessExits(activityManager: ActivityManager): JSArray {
        val output = JSArray()
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return output
        activityManager
            .getHistoricalProcessExitReasons(context.packageName, 0, 8)
            .forEach { info ->
                output.put(JSObject().apply {
                    put("timestampEpochMs", info.timestamp)
                    put("reason", info.reason)
                    put("reasonLabel", exitReasonLabel(info.reason))
                    put("description", info.description ?: JSONObject.NULL)
                    put("status", info.status)
                    put("importance", info.importance)
                    put("pssBytes", info.pss)
                    put("rssBytes", info.rss)
                })
            }
        return output
    }

    private fun batterySnapshot(): BatterySnapshot {
        val intent: Intent? = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        if (intent == null) return BatterySnapshot(null, null, false)
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        val percent = if (level >= 0 && scale > 0) level * 100.0 / scale else null
        val rawTemperature = intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1)
        val temperature = if (rawTemperature >= 0) rawTemperature / 10.0 else null
        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN)
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL
        return BatterySnapshot(percent, temperature, charging)
    }

    private fun directoryStats(root: File): DirectoryStats {
        if (!root.exists()) return DirectoryStats(0L, 0)
        var bytes = 0L
        var files = 0
        val pending = ArrayDeque<File>()
        pending.add(root)
        while (pending.isNotEmpty()) {
            val current = pending.removeFirst()
            val children = current.listFiles() ?: continue
            for (child in children) {
                if (child.isDirectory) pending.add(child)
                else if (child.isFile) {
                    bytes += child.length()
                    files += 1
                }
            }
        }
        return DirectoryStats(bytes, files)
    }

    private fun thermalLabel(status: Int): String = when (status) {
        PowerManager.THERMAL_STATUS_NONE -> "None"
        PowerManager.THERMAL_STATUS_LIGHT -> "Light"
        PowerManager.THERMAL_STATUS_MODERATE -> "Moderate"
        PowerManager.THERMAL_STATUS_SEVERE -> "Severe"
        PowerManager.THERMAL_STATUS_CRITICAL -> "Critical"
        PowerManager.THERMAL_STATUS_EMERGENCY -> "Emergency"
        PowerManager.THERMAL_STATUS_SHUTDOWN -> "Shutdown"
        else -> "Unknown"
    }

    private fun exitReasonLabel(reason: Int): String = when (reason) {
        ApplicationExitInfo.REASON_ANR -> "ANR"
        ApplicationExitInfo.REASON_CRASH -> "Java crash"
        ApplicationExitInfo.REASON_CRASH_NATIVE -> "Native crash"
        ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "Dependency died"
        ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "Excessive resource usage"
        ApplicationExitInfo.REASON_EXIT_SELF -> "Self exit"
        ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "Initialisation failure"
        ApplicationExitInfo.REASON_LOW_MEMORY -> "Low memory"
        ApplicationExitInfo.REASON_OTHER -> "Other"
        ApplicationExitInfo.REASON_PERMISSION_CHANGE -> "Permission change"
        ApplicationExitInfo.REASON_SIGNALED -> "Signalled"
        ApplicationExitInfo.REASON_USER_REQUESTED -> "User requested"
        ApplicationExitInfo.REASON_USER_STOPPED -> "User stopped"
        else -> "Unknown"
    }

    private fun asException(error: Throwable): Exception =
        error as? Exception ?: RuntimeException(rootMessage(error), error)

    private fun rootMessage(error: Throwable): String {
        var current = error
        while (current.cause != null) current = current.cause!!
        return current.message?.takeIf { it.isNotBlank() } ?: current.javaClass.simpleName
    }

    private data class DirectoryStats(val bytes: Long, val files: Int)
    private data class BatterySnapshot(
        val percent: Double?,
        val temperatureC: Double?,
        val charging: Boolean,
    )
}
