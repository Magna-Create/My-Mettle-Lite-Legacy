package dev.kian.gymapp

import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregateRequest
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import kotlin.reflect.KClass

@CapacitorPlugin(name = "MaisHealthConnect")
class MaisHealthConnectPlugin : Plugin() {
    companion object {
        private const val SAMSUNG_HEALTH_PACKAGE = "com.sec.android.app.shealth"
        private const val MAX_WINDOW_DAYS = 120L
        private const val PAGE_SIZE = 1_000
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val corePermissions: Set<String> by lazy {
        setOf(
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        )
    }

    private val contextPermissions: Set<String> by lazy {
        setOf(
            HealthPermission.getReadPermission(BodyFatRecord::class),
            HealthPermission.getReadPermission(BasalMetabolicRateRecord::class),
            HealthPermission.getReadPermission(NutritionRecord::class),
        )
    }

    private val supplementaryPermissions: Set<String> by lazy {
        setOf(
            HealthPermission.getReadPermission(OxygenSaturationRecord::class),
            HealthPermission.getReadPermission(BloodGlucoseRecord::class),
            HealthPermission.getReadPermission(Vo2MaxRecord::class),
        )
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val status = HealthConnectClient.getSdkStatus(context)
        if (status != HealthConnectClient.SDK_AVAILABLE) {
            call.resolve(statusObject(status, emptySet()))
            return
        }
        scope.launch {
            runCatching {
                HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()
            }.onSuccess { granted -> resolve(call, statusObject(status, granted)) }
                .onFailure { reject(call, it) }
        }
    }

    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        val status = HealthConnectClient.getSdkStatus(context)
        if (status != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("Health Connect is unavailable or requires an update.")
            return
        }
        val requested = permissionsForScope(call.getString("scope", "core") ?: "core")
        val intent = Intent(context, MaisHealthPermissionActivity::class.java).apply {
            putStringArrayListExtra(MaisHealthPermissionActivity.EXTRA_PERMISSIONS, ArrayList(requested.sorted()))
        }
        startActivityForResult(call, intent, "permissionRequestResult")
    }

    @ActivityCallback
    private fun permissionRequestResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val granted = result.data
            ?.getStringArrayListExtra(MaisHealthPermissionActivity.EXTRA_GRANTED_PERMISSIONS)
            ?.toSet()
            .orEmpty()
        val response = JSObject()
        response.put("completed", result.resultCode == Activity.RESULT_OK)
        response.put("grantedPermissions", stringArray(granted.sorted()))
        response.put("groups", permissionGroups(granted))
        call.resolve(response)
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        val intent = HealthConnectClient.getHealthConnectManageDataIntent(context)
        runCatching { activity.startActivity(intent) }
            .onSuccess { call.resolve() }
            .onFailure { call.reject(it.message ?: "Health Connect settings could not be opened.") }
    }

    @PluginMethod
    fun syncWindow(call: PluginCall) {
        val start = parseInstant(call, "startTime") ?: return
        val end = parseInstant(call, "endTime") ?: return
        if (!end.isAfter(start)) {
            call.reject("Health sync endTime must be after startTime.")
            return
        }
        if (Duration.between(start, end).toDays() > MAX_WINDOW_DAYS) {
            call.reject("Health sync windows are limited to $MAX_WINDOW_DAYS days per request.")
            return
        }
        val includeContext = call.getBoolean("includeContext", true) ?: true
        val includeSupplementary = call.getBoolean("includeSupplementary", false) ?: false

        scope.launch {
            runCatching {
                val client = requireClient()
                val granted = client.permissionController.getGrantedPermissions()
                val response = JSObject()
                response.put("startTime", start.toString())
                response.put("endTime", end.toString())
                response.put("capturedAt", Instant.now().toString())
                response.put("provider", "health_connect")
                response.put("samsungHealthPackage", SAMSUNG_HEALTH_PACKAGE)
                response.put("grantedPermissions", stringArray(granted.sorted()))
                response.put("missingPermissions", stringArray(requiredPermissions(includeContext, includeSupplementary).minus(granted).sorted()))
                response.put("heartRate", if (hasPermission(granted, HeartRateRecord::class)) readHeartRate(client, start, end) else JSArray())
                response.put("activity", readActivity(client, granted, start, end))
                response.put("exerciseSessions", if (hasPermission(granted, ExerciseSessionRecord::class)) readExerciseSessions(client, start, end) else JSArray())
                response.put("bodyComposition", if (includeContext) readBodyComposition(client, granted, start, end) else JSArray())
                response.put("nutrition", if (includeContext && hasPermission(granted, NutritionRecord::class)) readNutrition(client, start, end) else JSArray())
                response.put("supplementary", if (includeSupplementary) readSupplementary(client, granted, start, end) else JSArray())
                response
            }.onSuccess { resolve(call, it) }
                .onFailure { reject(call, it) }
        }
    }

    private fun permissionsForScope(scopeName: String): Set<String> = when (scopeName.lowercase()) {
        "core" -> corePermissions
        "context" -> contextPermissions
        "supplementary" -> supplementaryPermissions
        "all" -> corePermissions + contextPermissions + supplementaryPermissions
        else -> throw IllegalArgumentException("Unknown Health Connect permission scope: $scopeName")
    }

    private fun requiredPermissions(includeContext: Boolean, includeSupplementary: Boolean): Set<String> {
        var permissions = corePermissions
        if (includeContext) permissions = permissions + contextPermissions
        if (includeSupplementary) permissions = permissions + supplementaryPermissions
        return permissions
    }

    private fun statusObject(status: Int, granted: Set<String>): JSObject = JSObject().apply {
        put("sdkStatus", when (status) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
            else -> "unavailable"
        })
        put("available", status == HealthConnectClient.SDK_AVAILABLE)
        put("grantedPermissions", stringArray(granted.sorted()))
        put("groups", permissionGroups(granted))
        put("readOnly", true)
        put("directSamsungSdk", false)
        put("samsungDataAvailableThroughHealthConnect", true)
    }

    private fun permissionGroups(granted: Set<String>): JSObject = JSObject().apply {
        put("core", granted.containsAll(corePermissions))
        put("context", granted.containsAll(contextPermissions))
        put("supplementary", granted.containsAll(supplementaryPermissions))
    }

    private fun parseInstant(call: PluginCall, key: String): Instant? {
        val value = call.getString(key)
        if (value.isNullOrBlank()) {
            call.reject("$key is required.")
            return null
        }
        return runCatching { Instant.parse(value) }
            .onFailure { call.reject("$key must be an ISO-8601 instant.") }
            .getOrNull()
    }

    private fun requireClient(): HealthConnectClient {
        val status = HealthConnectClient.getSdkStatus(context)
        check(status == HealthConnectClient.SDK_AVAILABLE) { "Health Connect is unavailable or requires an update." }
        return HealthConnectClient.getOrCreate(context)
    }

    private fun <T : Record> hasPermission(granted: Set<String>, recordType: KClass<T>): Boolean =
        HealthPermission.getReadPermission(recordType) in granted

    private suspend fun <T : Record> readAll(
        client: HealthConnectClient,
        recordType: KClass<T>,
        start: Instant,
        end: Instant,
    ): List<T> {
        val records = mutableListOf<T>()
        var pageToken: String? = null
        do {
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = recordType,
                    timeRangeFilter = TimeRangeFilter.between(start, end),
                    ascendingOrder = true,
                    pageSize = PAGE_SIZE,
                    pageToken = pageToken,
                )
            )
            records += response.records
            pageToken = response.pageToken
        } while (pageToken != null)
        return records
    }

    private suspend fun readHeartRate(client: HealthConnectClient, start: Instant, end: Instant): JSArray {
        val output = JSArray()
        for (record in readAll(client, HeartRateRecord::class, start, end)) {
            val origin = record.metadata.dataOrigin.packageName
            for (sample in record.samples) {
                output.put(JSObject().apply {
                    put("id", "${record.metadata.id}:${sample.time}")
                    put("recordId", record.metadata.id)
                    put("time", sample.time.toString())
                    put("beatsPerMinute", sample.beatsPerMinute)
                    put("dataOrigin", origin)
                    put("isSamsungHealth", origin == SAMSUNG_HEALTH_PACKAGE)
                    put("recordingMethod", record.metadata.recordingMethod)
                    put("device", deviceObject(record))
                })
            }
        }
        return output
    }

    private suspend fun readActivity(
        client: HealthConnectClient,
        granted: Set<String>,
        start: Instant,
        end: Instant,
    ): JSObject {
        val metrics = buildSet {
            if (hasPermission(granted, StepsRecord::class)) add(StepsRecord.COUNT_TOTAL)
            if (hasPermission(granted, DistanceRecord::class)) add(DistanceRecord.DISTANCE_TOTAL)
        }
        if (metrics.isEmpty()) return JSObject().apply { put("available", false) }
        val result = client.aggregate(AggregateRequest(metrics, TimeRangeFilter.between(start, end)))
        return JSObject().apply {
            put("available", true)
            put("steps", result[StepsRecord.COUNT_TOTAL])
            put("distanceMetres", result[DistanceRecord.DISTANCE_TOTAL]?.inMeters)
            put("dataOrigins", stringArray(result.dataOrigins.map { it.packageName }.sorted()))
            put("containsSamsungHealth", result.dataOrigins.any { it.packageName == SAMSUNG_HEALTH_PACKAGE })
        }
    }

    private suspend fun readExerciseSessions(client: HealthConnectClient, start: Instant, end: Instant): JSArray {
        val output = JSArray()
        for (record in readAll(client, ExerciseSessionRecord::class, start, end)) {
            val origin = record.metadata.dataOrigin.packageName
            output.put(JSObject().apply {
                put("id", record.metadata.id)
                put("startTime", record.startTime.toString())
                put("endTime", record.endTime.toString())
                put("exerciseType", record.exerciseType)
                put("title", record.title)
                put("notes", record.notes)
                put("dataOrigin", origin)
                put("isSamsungHealth", origin == SAMSUNG_HEALTH_PACKAGE)
                put("device", deviceObject(record))
            })
        }
        return output
    }

    private suspend fun readBodyComposition(
        client: HealthConnectClient,
        granted: Set<String>,
        start: Instant,
        end: Instant,
    ): JSArray {
        val output = JSArray()
        if (hasPermission(granted, BodyFatRecord::class)) {
            for (record in readAll(client, BodyFatRecord::class, start, end)) {
                output.put(instantRecord(
                    record,
                    "body_fat",
                    record.time,
                    record.percentage.value,
                    "percent",
                ))
            }
        }
        if (hasPermission(granted, BasalMetabolicRateRecord::class)) {
            for (record in readAll(client, BasalMetabolicRateRecord::class, start, end)) {
                output.put(instantRecord(
                    record,
                    "basal_metabolic_rate",
                    record.time,
                    record.basalMetabolicRate.inKilocaloriesPerDay,
                    "kcal_per_day",
                ))
            }
        }
        return output
    }

    private suspend fun readNutrition(client: HealthConnectClient, start: Instant, end: Instant): JSArray {
        val output = JSArray()
        for (record in readAll(client, NutritionRecord::class, start, end)) {
            val origin = record.metadata.dataOrigin.packageName
            output.put(JSObject().apply {
                put("id", record.metadata.id)
                put("type", "nutrition")
                put("startTime", record.startTime.toString())
                put("endTime", record.endTime.toString())
                put("name", record.name)
                put("mealType", record.mealType)
                put("energyKilocalories", record.energy?.inKilocalories)
                put("proteinGrams", record.protein?.inGrams)
                put("carbohydrateGrams", record.totalCarbohydrate?.inGrams)
                put("fatGrams", record.totalFat?.inGrams)
                put("dataOrigin", origin)
                put("isSamsungHealth", origin == SAMSUNG_HEALTH_PACKAGE)
                put("device", deviceObject(record))
            })
        }
        return output
    }

    private suspend fun readSupplementary(
        client: HealthConnectClient,
        granted: Set<String>,
        start: Instant,
        end: Instant,
    ): JSArray {
        val output = JSArray()
        if (hasPermission(granted, OxygenSaturationRecord::class)) {
            for (record in readAll(client, OxygenSaturationRecord::class, start, end)) {
                output.put(instantRecord(record, "oxygen_saturation", record.time, record.percentage.value, "percent"))
            }
        }
        if (hasPermission(granted, BloodGlucoseRecord::class)) {
            for (record in readAll(client, BloodGlucoseRecord::class, start, end)) {
                output.put(instantRecord(record, "blood_glucose", record.time, record.level.inMillimolesPerLiter, "mmol_per_litre").apply {
                    put("relationToMeal", record.relationToMeal)
                    put("mealType", record.mealType)
                    put("specimenSource", record.specimenSource)
                })
            }
        }
        if (hasPermission(granted, Vo2MaxRecord::class)) {
            for (record in readAll(client, Vo2MaxRecord::class, start, end)) {
                output.put(instantRecord(record, "vo2_max", record.time, record.vo2MillilitersPerMinuteKilogram, "ml_per_min_per_kg").apply {
                    put("measurementMethod", record.measurementMethod)
                })
            }
        }
        return output
    }

    private fun instantRecord(record: Record, type: String, time: Instant, value: Double, unit: String): JSObject {
        val origin = record.metadata.dataOrigin.packageName
        return JSObject().apply {
            put("id", record.metadata.id)
            put("type", type)
            put("time", time.toString())
            put("value", value)
            put("unit", unit)
            put("dataOrigin", origin)
            put("isSamsungHealth", origin == SAMSUNG_HEALTH_PACKAGE)
            put("recordingMethod", record.metadata.recordingMethod)
            put("device", deviceObject(record))
        }
    }

    private fun deviceObject(record: Record): JSObject? = record.metadata.device?.let { device ->
        JSObject().apply {
            put("manufacturer", device.manufacturer)
            put("model", device.model)
            put("type", device.type)
        }
    }

    private fun stringArray(values: Collection<String>): JSArray = JSArray().apply {
        values.forEach { put(it) }
    }

    private fun resolve(call: PluginCall, value: JSObject) {
        activity.runOnUiThread { call.resolve(value) }
    }

    private fun reject(call: PluginCall, reason: Throwable) {
        activity.runOnUiThread { call.reject(reason.message ?: "Health Connect operation failed.", reason) }
    }

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }
}
