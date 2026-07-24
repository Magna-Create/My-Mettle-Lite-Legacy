package dev.kian.gymapp

import android.os.Debug
import com.geniex.sdk.GenieXSdk
import com.geniex.sdk.LlmWrapper
import com.geniex.sdk.ModelManagerWrapper
import com.geniex.sdk.bean.ChatMessage
import com.geniex.sdk.bean.GenerationConfig
import com.geniex.sdk.bean.HubSource
import com.geniex.sdk.bean.LlmCreateInput
import com.geniex.sdk.bean.LlmStreamResult
import com.geniex.sdk.bean.ModelConfig
import com.geniex.sdk.bean.ModelPaths
import com.geniex.sdk.bean.ModelPullInput
import com.geniex.sdk.bean.ProfilingData
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File
import java.util.ArrayDeque
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.roundToLong

@CapacitorPlugin(name = "MaisGenieXRuntime")
class MaisGenieXRuntimePlugin : Plugin() {
    companion object {
        private const val MODEL_ID = "qwen.qwen3-4b"
        private const val GENIEX_MODEL_KEY = "local/my-mettle-qwen3-4b-12k-v1"
        private const val GENIEX_ANDROID_VERSION = "0.3.5"
        private const val CONTEXT_TOKENS = 12_288
        private const val MAX_OUTPUT_TOKENS = 2_048
        private val REQUIRED_MODEL_FILES = listOf(
            "added_tokens.json",
            "config.json",
            "genie_config.json",
            "htp_backend_ext_config.json",
            "merges.txt",
            "metadata.json",
            "part1_of_4.bin",
            "part2_of_4.bin",
            "part3_of_4.bin",
            "part4_of_4.bin",
            "sample_prompt.txt",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.json",
        )
    }

    private val runtimeScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val running = AtomicBoolean(false)
    private val preparing = AtomicBoolean(false)
    private val cancelRequested = AtomicBoolean(false)
    private val activeWrapper = AtomicReference<LlmWrapper?>(null)
    private val sdkLock = Any()

    @Volatile
    private var sdkReady = false

    @Volatile
    private var sdkError: String? = null

    @PluginMethod
    fun getStatus(call: PluginCall) {
        try {
            call.resolve(status())
        } catch (error: Throwable) {
            call.reject(rootMessage(error), asException(error))
        }
    }

    @PluginMethod
    fun prepareModel(call: PluginCall) {
        val modelId = call.getString("modelId")?.trim().orEmpty()
        if (modelId != MODEL_ID) {
            call.reject("The GenieX adapter currently supports Qwen3-4B only.")
            return
        }
        if (!ensureSdkReady()) {
            call.reject(sdkError ?: "The bundled GenieX runtime could not initialise.")
            return
        }
        val missing = missingModelFiles()
        if (missing.isNotEmpty()) {
            call.reject("The Qwen3-4B 12K pack is incomplete: ${missing.joinToString()}.")
            return
        }
        if (running.get()) {
            call.reject("Qwen inference is active; its GenieX model cache cannot be prepared now.")
            return
        }
        if (!preparing.compareAndSet(false, true)) {
            call.reject("The Qwen model is already being prepared for GenieX.")
            return
        }

        runtimeScope.launch {
            val startedAt = System.currentTimeMillis()
            var imported = false
            var modelPath: String? = null
            var failure: String? = null
            recordStage("prepare-request", "started", "Preparing the verified local Qwen bundle.")
            emitProgress(modelId, "preparing", 0L, 0)
            try {
                val resolved = resolveGenieXModelPaths(modelId, allowImport = true)
                imported = resolved.imported
                modelPath = resolved.paths.model_path
                recordStage(
                    "prepare-complete",
                    "completed",
                    if (imported) "GenieX imported the local bundle." else "Existing GenieX cache is valid.",
                )
            } catch (error: Throwable) {
                failure = rootMessage(error)
                recordStage("prepare-failed", "failed", failure)
            } finally {
                preparing.set(false)
            }

            val result = JSObject().apply {
                put("success", failure == null)
                put("state", if (failure == null) "completed" else "failed")
                put("modelId", modelId)
                put("imported", imported)
                put("totalMs", System.currentTimeMillis() - startedAt)
                put("sourceBundleBytes", directoryBytes(modelDirectory()))
                put("cachedBundleBytes", directoryBytes(genieXDataDirectory()))
                put("modelPath", modelPath ?: JSONObject.NULL)
                put("error", failure ?: JSONObject.NULL)
            }
            emitProgress(modelId, if (failure == null) "completed" else "failed", 0L, 0)
            call.resolve(result)
        }
    }

    @PluginMethod
    fun clearPreparedModel(call: PluginCall) {
        val modelId = call.getString("modelId")?.trim().orEmpty()
        if (modelId != MODEL_ID) {
            call.reject("The GenieX adapter currently supports Qwen3-4B only.")
            return
        }
        if (running.get() || preparing.get()) {
            call.reject("Wait for the active Qwen operation to finish before clearing its GenieX cache.")
            return
        }

        runtimeScope.launch {
            try {
                recordStage("cache-clear", "started", "Removing the prepared GenieX model cache.")
                ModelManagerWrapper.init(genieXDataDirectory().absolutePath).getOrThrow()
                ModelManagerWrapper.remove(GENIEX_MODEL_KEY)
                recordStage("cache-clear", "completed", "Prepared GenieX model cache removed.")
                call.resolve(JSObject().apply { put("cleared", true) })
            } catch (error: Throwable) {
                recordStage("cache-clear", "failed", rootMessage(error))
                call.reject(rootMessage(error), asException(error))
            }
        }
    }

    @PluginMethod
    fun runBaseline(call: PluginCall) {
        val modelId = call.getString("modelId")?.trim().orEmpty()
        if (modelId != MODEL_ID) {
            call.reject("The GenieX adapter currently supports Qwen3-4B only.")
            return
        }
        if (!ensureSdkReady()) {
            call.reject(sdkError ?: "The bundled GenieX runtime could not initialise.")
            return
        }
        val missing = missingModelFiles()
        if (missing.isNotEmpty()) {
            call.reject("The Qwen3-4B 12K pack is incomplete: ${missing.joinToString()}.")
            return
        }
        if (preparing.get()) {
            call.reject("The Qwen model is still being prepared for GenieX.")
            return
        }

        val resolvedPaths = try {
            preparedModelPaths()
        } catch (error: Throwable) {
            call.reject(rootMessage(error), asException(error))
            return
        }
        if (resolvedPaths == null) {
            call.reject("Prepare the verified Qwen pack for GenieX before loading the NPU model.")
            return
        }
        if (!running.compareAndSet(false, true)) {
            call.reject("A GenieX run is already active.")
            return
        }

        cancelRequested.set(false)
        val prompt = call.getString("prompt")?.trim().takeUnless { it.isNullOrEmpty() }
            ?: "Reason carefully, then reply with exactly two short sentences. First confirm that this response was generated locally. Second state that verified evidence should be preferred over an unbounded transcript."
        val systemInstruction = call.getString("systemInstruction")?.trim().takeUnless { it.isNullOrEmpty() }
            ?: "You are the bounded native Qwen runtime check for My Mettle. Use thinking mode before answering. Keep the final response concise, factual and limited to supplied evidence."

        runtimeScope.launch {
            executeBaseline(call, modelId, resolvedPaths, prompt, systemInstruction)
        }
    }

    @PluginMethod
    fun cancelRun(call: PluginCall) {
        if (!running.get()) {
            call.resolve(cancelResult(false, "No GenieX run is active."))
            return
        }

        val wrapper = activeWrapper.get()
        if (wrapper == null) {
            call.resolve(cancelResult(false, "The model is still loading; generation has not started."))
            return
        }

        cancelRequested.set(true)
        recordStage("cancel-request", "started", "User requested supported GenieX stream cancellation.")
        runtimeScope.launch {
            val stopResult = wrapper.stopStream()
            call.resolve(
                cancelResult(
                    stopResult.isSuccess,
                    stopResult.exceptionOrNull()?.let(::rootMessage),
                ),
            )
        }
    }

    private fun cancelResult(requested: Boolean, reason: String?): JSObject = JSObject().apply {
        put("requested", requested)
        put("supported", true)
        put("reason", reason ?: JSONObject.NULL)
    }

    private suspend fun executeBaseline(
        call: PluginCall,
        modelId: String,
        resolvedPaths: ModelPaths,
        prompt: String,
        systemInstruction: String,
    ) {
        val startedAt = System.currentTimeMillis()
        val memoryBefore = currentPssBytes()
        var peakPss = memoryBefore
        var loadMs = 0L
        var firstChunkMs = -1L
        var generationMs = 0L
        var unloadMs = 0L
        var thinkingCharacters = 0
        var finalOutput = ""
        var profile: ProfilingData? = null
        var state = "completed"
        var failure: String? = null
        var wrapper: LlmWrapper? = null

        recordStage("npu-load-request", "started", "Beginning Qwen LlmWrapper construction from the prepared cache.")
        emitProgress(modelId, "initialising", 0L, 0)
        try {
            val loadStarted = System.currentTimeMillis()
            emitProgress(modelId, "loading", 0L, 0)
            wrapper = LlmWrapper
                .builder()
                .llmCreateInput(
                    LlmCreateInput(
                        model_name = resolvedPaths.model_name,
                        model_path = resolvedPaths.model_path,
                        config = ModelConfig(
                            nCtx = 0,
                            max_tokens = MAX_OUTPUT_TOKENS,
                            enable_thinking = true,
                        ),
                        runtime_id = resolvedPaths.runtime_id,
                        compute_unit = null,
                    ),
                )
                .build()
                .getOrThrow()
            activeWrapper.set(wrapper)
            loadMs = System.currentTimeMillis() - loadStarted
            peakPss = maxOf(peakPss, currentPssBytes())
            recordStage("npu-load-complete", "completed", "Qwen LlmWrapper built in ${loadMs} ms.")

            recordStage("chat-template", "started", "Applying the bounded thinking chat template.")
            val template = wrapper
                .applyChatTemplate(
                    arrayOf(
                        ChatMessage("system", systemInstruction),
                        ChatMessage("user", prompt),
                    ),
                    tools = null,
                    enableThinking = true,
                )
                .getOrThrow()
            recordStage("chat-template", "completed", "Prompt template prepared.")

            emitProgress(modelId, "generating", loadMs, 0)
            recordStage("generation", "started", "Beginning supported GenieX token streaming.")
            val output = StringBuilder()
            val generationStarted = System.currentTimeMillis()
            wrapper.generateStreamFlow(
                template.formattedText,
                GenerationConfig(maxTokens = MAX_OUTPUT_TOKENS),
            ).collect { streamResult ->
                when (streamResult) {
                    is LlmStreamResult.Token -> {
                        if (firstChunkMs < 0 && streamResult.text.isNotEmpty()) {
                            firstChunkMs = System.currentTimeMillis() - generationStarted
                            recordStage("first-token", "completed", "First streamed token after ${firstChunkMs} ms.")
                        }
                        output.append(streamResult.text)
                        emitProgress(modelId, "generating", loadMs, output.length)
                    }
                    is LlmStreamResult.Completed -> profile = streamResult.profile
                    is LlmStreamResult.Error -> throw streamResult.throwable
                }
            }
            generationMs = System.currentTimeMillis() - generationStarted

            if (cancelRequested.get()) {
                state = "cancelled"
                recordStage("generation", "cancelled", "Generation stopped through the supported GenieX API.")
            } else {
                val rawOutput = output.toString().trim()
                thinkingCharacters = countThinkingCharacters(rawOutput)
                if (!hasCompletedThinkingSection(rawOutput) || thinkingCharacters <= 0) {
                    throw IllegalStateException(
                        "Qwen did not complete a thinking section before its final response. The output budget may have ended during reasoning.",
                    )
                }
                finalOutput = extractFinalOutput(rawOutput)
                if (finalOutput.isEmpty()) {
                    throw IllegalStateException("Qwen completed thinking without returning a final response.")
                }
                recordStage("generation", "completed", "Thinking and final output completed in ${generationMs} ms.")
            }
            peakPss = maxOf(peakPss, currentPssBytes())
        } catch (error: Throwable) {
            if (cancelRequested.get()) {
                state = "cancelled"
                recordStage("generation", "cancelled", rootMessage(error))
            } else {
                state = "failed"
                failure = rootMessage(error)
                recordStage("runtime-failure", "failed", failure)
            }
        } finally {
            val unloadStarted = System.currentTimeMillis()
            val active = wrapper
            activeWrapper.set(null)
            if (active != null) {
                recordStage("destroy", "started", "Destroying the GenieX wrapper and releasing native resources.")
                val destroyFailure = try {
                    val destroyCode = active.destroy()
                    if (destroyCode == 0) null
                    else IllegalStateException("GenieX destroy returned status $destroyCode.")
                } catch (error: Throwable) {
                    error
                }
                if (destroyFailure != null && failure == null && state == "completed") {
                    state = "failed"
                    failure = "Qwen generated output but failed to unload cleanly: ${rootMessage(destroyFailure)}"
                    recordStage("destroy", "failed", failure)
                } else if (destroyFailure == null) {
                    recordStage("destroy", "completed", "GenieX wrapper destroyed cleanly.")
                }
            }
            unloadMs = System.currentTimeMillis() - unloadStarted
            peakPss = maxOf(peakPss, currentPssBytes())
            running.set(false)
            cancelRequested.set(false)
        }

        val completedAt = System.currentTimeMillis()
        val reportedProfile = profile
        val resolvedFirstChunk = if (reportedProfile != null && reportedProfile.ttftMs >= 0.0) {
            reportedProfile.ttftMs.roundToLong()
        } else {
            firstChunkMs
        }
        val result = JSObject()
        result.put("state", state)
        result.put("success", state == "completed")
        result.put("modelId", modelId)
        result.put("runtime", "geniex-qairt")
        result.put("runtimeVersion", runtimeVersion())
        result.put("sdkVersion", GENIEX_ANDROID_VERSION)
        result.put("distribution", "maven-central")
        result.put("backend", "npu")
        result.put("contextTokens", CONTEXT_TOKENS)
        result.put("thinkingEnabled", true)
        result.put("thinkingObserved", thinkingCharacters > 0)
        result.put("thinkingCharacters", thinkingCharacters)
        result.put("reasoningContentStored", false)
        result.put("startedAtEpochMs", startedAt)
        result.put("completedAtEpochMs", completedAt)
        result.put("loadMs", loadMs)
        result.put("firstChunkLatencyMs", resolvedFirstChunk)
        result.put("generationMs", generationMs)
        result.put("unloadMs", unloadMs)
        result.put("totalMs", completedAt - startedAt)
        result.put("memoryBeforeBytes", memoryBefore)
        result.put("peakPssBytes", peakPss)
        result.put("memoryAfterBytes", currentPssBytes())
        result.put("finalOutput", finalOutput)
        result.put("outputChars", finalOutput.length)
        result.put("profile", profileMetrics(reportedProfile))
        result.put("error", failure ?: JSONObject.NULL)
        writeLastResult(result)
        recordStage("run-result", state, failure ?: "Native Qwen run reached $state.")
        emitProgress(modelId, state, loadMs, finalOutput.length)
        call.resolve(result)
    }

    private suspend fun resolveGenieXModelPaths(modelId: String, allowImport: Boolean): ResolvedModel {
        recordStage("model-manager-init", "started", "Initialising the GenieX model manager.")
        ModelManagerWrapper.init(genieXDataDirectory().absolutePath).getOrThrow()
        recordStage("model-manager-init", "completed", "GenieX model manager initialised.")

        val cached = ModelManagerWrapper.getPaths(GENIEX_MODEL_KEY)
        if (cached != null && validPreparedPaths(cached)) {
            recordStage("cache-check", "completed", "Valid prepared model cache found.")
            return ResolvedModel(cached, imported = false)
        }
        if (cached != null) {
            recordStage("cache-check", "warning", "Stale prepared model entry found; removing it.")
            try {
                ModelManagerWrapper.remove(GENIEX_MODEL_KEY)
            } catch (_: Throwable) {
                // The authoritative local import below can replace a stale entry.
            }
        }
        if (!allowImport) {
            throw IllegalStateException("The verified Qwen pack has not been prepared for GenieX.")
        }

        emitProgress(modelId, "importing", 0L, 0)
        recordStage("local-import", "started", "Importing the 15-file local Qwen bundle into GenieX storage.")
        var completed = false
        var progressEvents = 0
        ModelManagerWrapper.pullFlow(
            ModelPullInput(
                model_name = GENIEX_MODEL_KEY,
                hub = HubSource.LOCALFS,
                local_path = modelDirectory().absolutePath,
            ),
        ).collect { event ->
            when (event) {
                is ModelManagerWrapper.PullEvent.Progress -> {
                    progressEvents += 1
                    emitProgress(modelId, "importing", 0L, 0)
                    if (progressEvents % 8 == 0) {
                        recordStage("local-import", "progress", "GenieX import progress callback $progressEvents.")
                    }
                }
                ModelManagerWrapper.PullEvent.Completed -> completed = true
                is ModelManagerWrapper.PullEvent.Error -> {
                    throw IllegalStateException("GenieX local model import failed: ${event.message} (code ${event.code}).")
                }
            }
        }
        if (!completed) {
            throw IllegalStateException("GenieX local model import ended without completing.")
        }

        val paths = ModelManagerWrapper.getPaths(GENIEX_MODEL_KEY)
            ?: throw IllegalStateException("GenieX imported the Qwen bundle but did not return resolved model paths.")
        if (!validPreparedPaths(paths)) {
            throw IllegalStateException("GenieX reported completion but the prepared Qwen paths are invalid.")
        }
        recordStage("local-import", "completed", "GenieX local import completed after $progressEvents progress callbacks.")
        return ResolvedModel(paths, imported = true)
    }

    private fun preparedModelPaths(): ModelPaths? {
        ModelManagerWrapper.init(genieXDataDirectory().absolutePath).getOrThrow()
        return ModelManagerWrapper.getPaths(GENIEX_MODEL_KEY)?.takeIf(::validPreparedPaths)
    }

    private fun validPreparedPaths(paths: ModelPaths): Boolean =
        File(paths.model_path).exists() && File(paths.model_dir).isDirectory

    private fun status(): JSObject {
        val missing = missingModelFiles()
        val missingArray = JSArray()
        missing.forEach { missingArray.put(it) }
        val runtimeReady = ensureSdkReady()
        val prepared = runCatching { preparedModelPaths() }.getOrNull()
        return JSObject().apply {
            put("ready", missing.isEmpty() && runtimeReady && prepared != null)
            put("running", running.get() || preparing.get())
            put("modelId", MODEL_ID)
            put("runtime", "geniex-qairt")
            put("runtimeVersion", runtimeVersion())
            put("sdkVersion", GENIEX_ANDROID_VERSION)
            put("distribution", "maven-central")
            put("backend", "npu")
            put("contextTokens", CONTEXT_TOKENS)
            put("thinkingEnabled", true)
            put("bundleReady", missing.isEmpty())
            put("modelPrepared", prepared != null)
            put("preparedModelPath", prepared?.model_path ?: JSONObject.NULL)
            put("sourceBundleBytes", directoryBytes(modelDirectory()))
            put("cachedBundleBytes", directoryBytes(genieXDataDirectory()))
            put("missingModelFiles", missingArray)
            put("runtimeInstalled", runtimeReady)
            put("bridgeLoaded", runtimeReady)
            put("bridgeError", sdkError ?: JSONObject.NULL)
            put("lastNativeStage", MaisDiagnosticsStore.last(context) ?: JSONObject.NULL)
            put("lastResult", readLastResult())
        }
    }

    private fun ensureSdkReady(): Boolean = synchronized(sdkLock) {
        if (sdkReady) return@synchronized true
        sdkError = null
        recordStage("sdk-init", "started", "Initialising bundled GenieX Android and QAIRT plugin.")
        try {
            GenieXSdk.getInstance().init(
                context,
                object : GenieXSdk.InitCallback {
                    override fun onSuccess() {
                        sdkReady = true
                        sdkError = null
                        recordStage("sdk-init", "completed", "GenieX Android initialised successfully.")
                    }

                    override fun onFailure(reason: String) {
                        sdkReady = false
                        sdkError = reason.trim().ifEmpty { "GenieX initialisation failed." }
                        recordStage("sdk-init", "failed", sdkError)
                    }
                },
            )
        } catch (error: Throwable) {
            sdkReady = false
            sdkError = rootMessage(error)
            recordStage("sdk-init", "failed", sdkError)
        }
        sdkReady
    }

    private fun runtimeVersion(): String {
        if (!sdkReady) return "GenieX Android $GENIEX_ANDROID_VERSION"
        return runCatching {
            GenieXSdk.getInstance().getPluginVersion(GenieXSdk.PLUGIN_ID_QAIRT)
        }.getOrNull()?.takeIf { it.isNotBlank() }
            ?: "GenieX Android $GENIEX_ANDROID_VERSION"
    }

    private fun profileMetrics(profile: ProfilingData?): JSObject = JSObject().apply {
        put("available", profile != null)
        put("timeToFirstTokenMs", profile?.ttftMs ?: JSONObject.NULL)
        put("promptProcessingTimeMs", profile?.promptTimeMs ?: JSONObject.NULL)
        put("decodeTimeMs", profile?.decodeTimeMs ?: JSONObject.NULL)
        put("tokenGenerationRate", profile?.decodingSpeed ?: JSONObject.NULL)
        put("tokenGenerationRateUnit", if (profile == null) JSONObject.NULL else "tok/s")
        put("promptProcessingRate", profile?.prefillSpeed ?: JSONObject.NULL)
        put("promptProcessingRateUnit", if (profile == null) JSONObject.NULL else "tok/s")
        put("promptTokens", profile?.promptTokens ?: JSONObject.NULL)
        put("generatedTokens", profile?.generatedTokens ?: JSONObject.NULL)
        put("stopReason", profile?.stopReason ?: JSONObject.NULL)
    }

    private fun missingModelFiles(): List<String> {
        val directory = modelDirectory()
        return REQUIRED_MODEL_FILES.filter { !File(directory, it).isFile }
    }

    private fun modelDirectory(): File = File(context.filesDir, "mais-models")

    private fun genieXDataDirectory(): File = File(context.filesDir, "geniex").apply {
        if (!exists() && !mkdirs()) {
            throw IllegalStateException("Could not create the GenieX model-manager directory.")
        }
    }

    private fun directoryBytes(root: File): Long {
        if (!root.exists()) return 0L
        var bytes = 0L
        val pending = ArrayDeque<File>()
        pending.add(root)
        while (pending.isNotEmpty()) {
            val current = pending.removeFirst()
            val children = current.listFiles() ?: continue
            for (child in children) {
                if (child.isDirectory) pending.add(child)
                else if (child.isFile) bytes += child.length()
            }
        }
        return bytes
    }

    private fun hasCompletedThinkingSection(raw: String): Boolean = raw.lastIndexOf("</think>") >= 0

    private fun countThinkingCharacters(raw: String): Int {
        val closing = raw.lastIndexOf("</think>")
        if (closing < 0) return 0
        val opening = raw.indexOf("<think>")
        val start = if (opening >= 0) opening + "<think>".length else 0
        return (closing - start).coerceAtLeast(0)
    }

    private fun extractFinalOutput(raw: String): String {
        val closing = raw.lastIndexOf("</think>")
        if (closing < 0) return ""
        return raw
            .substring(closing + "</think>".length)
            .replace("<|im_end|>", "")
            .trim()
    }

    private fun emitProgress(modelId: String, state: String, loadMs: Long, outputChars: Int) {
        val event = JSObject()
        event.put("modelId", modelId)
        event.put("state", state)
        event.put("backend", "npu")
        event.put("loadMs", loadMs)
        event.put("outputChars", outputChars)
        event.put("capturedAtEpochMs", System.currentTimeMillis())
        notifyListeners("genieXInferenceProgress", event)
    }

    private fun recordStage(stage: String, state: String, detail: String?) {
        runCatching {
            MaisDiagnosticsStore.record(
                context = context,
                component = "qwen-geniex",
                stage = stage,
                state = state,
                detail = detail,
            )
        }
    }

    private fun currentPssBytes(): Long = Debug.getPss() * 1024L

    private fun runtimeResultDirectory(): File = File(context.filesDir, "mais-runtime")

    private fun lastResultFile(): File = File(runtimeResultDirectory(), "last-qwen-qwen3-4b.json")

    private fun writeLastResult(result: JSObject) {
        val directory = runtimeResultDirectory()
        if (!directory.exists() && !directory.mkdirs()) {
            throw IllegalStateException("Could not create the MAIS runtime directory.")
        }
        lastResultFile().writeText(result.toString(2), Charsets.UTF_8)
    }

    private fun readLastResult(): Any {
        return runCatching {
            if (!lastResultFile().isFile) return@runCatching JSONObject.NULL
            JSONObject(lastResultFile().readText(Charsets.UTF_8)).apply {
                remove("rawOutput")
                put("reasoningContentStored", false)
            }
        }.getOrDefault(JSONObject.NULL)
    }

    private fun asException(error: Throwable): Exception =
        error as? Exception ?: RuntimeException(rootMessage(error), error)

    private fun rootMessage(error: Throwable): String {
        var current = error
        while (current.cause != null) current = current.cause!!
        return current.message?.takeIf { it.isNotBlank() } ?: current.javaClass.simpleName
    }

    private data class ResolvedModel(val paths: ModelPaths, val imported: Boolean)
}
