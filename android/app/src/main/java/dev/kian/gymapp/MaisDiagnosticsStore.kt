package dev.kian.gymapp

import android.content.Context
import android.os.Debug
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Small persistent breadcrumb ledger for native development operations.
 *
 * The file intentionally contains stages, resource counters and error summaries
 * only. Prompts, model reasoning and training data are never written here.
 */
object MaisDiagnosticsStore {
    private const val MAX_EVENTS = 160
    private val lock = Any()

    fun record(
        context: Context,
        component: String,
        stage: String,
        state: String,
        detail: String? = null,
        extras: JSONObject? = null,
    ) {
        synchronized(lock) {
            val event = JSONObject().apply {
                put("capturedAtEpochMs", System.currentTimeMillis())
                put("component", component)
                put("stage", stage)
                put("state", state)
                put("detail", detail ?: JSONObject.NULL)
                put("processPssBytes", Debug.getPss() * 1024L)
                put("nativeHeapAllocatedBytes", Debug.getNativeHeapAllocatedSize())
                put("javaHeapUsedBytes", Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory())
                if (extras != null) put("extras", extras)
            }
            val events = readMutable(context)
            events.add(event)
            while (events.size > MAX_EVENTS) events.removeAt(0)
            write(context, events)
        }
    }

    fun read(context: Context, limit: Int = 80): JSONArray = synchronized(lock) {
        val events = readMutable(context)
        val start = (events.size - limit.coerceIn(1, MAX_EVENTS)).coerceAtLeast(0)
        JSONArray().apply {
            for (index in start until events.size) put(events[index])
        }
    }

    fun last(context: Context): JSONObject? = synchronized(lock) {
        readMutable(context).lastOrNull()
    }

    fun clear(context: Context) = synchronized(lock) {
        val file = eventFile(context)
        if (file.exists() && !file.delete()) {
            throw IllegalStateException("Could not clear the native diagnostics ledger.")
        }
    }

    private fun readMutable(context: Context): MutableList<JSONObject> {
        val file = eventFile(context)
        if (!file.isFile) return mutableListOf()
        return runCatching {
            val array = JSONArray(file.readText(Charsets.UTF_8))
            MutableList(array.length()) { index -> array.getJSONObject(index) }
        }.getOrDefault(mutableListOf())
    }

    private fun write(context: Context, events: List<JSONObject>) {
        val directory = diagnosticsDirectory(context)
        val destination = eventFile(context)
        val temporary = File(directory, "runtime-events.tmp")
        val array = JSONArray()
        events.forEach(array::put)
        temporary.writeText(array.toString(), Charsets.UTF_8)
        if (destination.exists() && !destination.delete()) {
            throw IllegalStateException("Could not replace the native diagnostics ledger.")
        }
        if (!temporary.renameTo(destination)) {
            destination.writeText(array.toString(), Charsets.UTF_8)
            temporary.delete()
        }
    }

    private fun diagnosticsDirectory(context: Context): File =
        File(context.filesDir, "mais-diagnostics").apply {
            if (!exists() && !mkdirs()) {
                throw IllegalStateException("Could not create the native diagnostics directory.")
            }
        }

    private fun eventFile(context: Context): File =
        File(diagnosticsDirectory(context), "runtime-events.json")
}
