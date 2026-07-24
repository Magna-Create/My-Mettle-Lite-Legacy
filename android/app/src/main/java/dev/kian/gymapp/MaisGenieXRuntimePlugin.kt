package dev.kian.gymapp

import android.os.Debug
import com.geniex.sdk.GenieXSdk
import com.geniex.sdk.LlmWrapper
import com.geniex.sdk.bean.ChatMessage
import com.geniex.sdk.bean.ComputeUnitValue
import com.geniex.sdk.bean.GenerationConfig
import com.geniex.sdk.bean.LlmCreateInput
import com.geniex.sdk.bean.LlmStreamResult
import com.geniex.sdk.bean.ModelConfig
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
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.roundToLong

@CapacitorPlugin(name = "MaisGenieXRuntime")
class MaisGenieXRuntimePlugin : Plugin() {
    companion object {
        private const val MODEL_ID = "qwen.qwen3-4b"
        private const val MODEL_NAME = "Qwen3-4B"
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
            call.reject(rootMessage(error), error)
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
            executeBaseline(call, modelId, prompt, systemInstruction)
        }
    }

    @PluginMethod
    fun cancelRun(call: PluginCall) {
        val wrapper = activeWrapper.get()
        if (!running.get() || wrapper == null) {
            val result = JSObject()
            result.put("requested", false)
            result.put("supported", true)
            result.put("reason", "No GenieX generation is active.")
            call.resolve(result)
            return
        }

        cancelRequested.set(true)
        runtimeScope.launch {
            val stopResult = wrapper.stopStream()
            val result = JSObject()
            result.put("requested", stopResult.isSuccess)
            result.put("supported", true)
            result.put("reason", stopResult.exceptionOrNull()?.let(::rootMessage) ?: JSONObject.NULL)
            call.resolve(result)
        }
    }

    private suspend fun executeBaseline(
        call: PluginCall,
        modelId: String,
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

        emitProgress(modelId, "loading", 0L, 0)
        try {
            val modelDirectory = modelDirectory()
            val tokenizer = File(modelDirectory, "tokenizer.json")
            val loadStarted = System.currentTimeMillis()
            wrapper = LlmWrapper
                .builder()
                .llmCreateInput(
                    LlmCreateInput(
                        model_name = MODEL_NAME,
                        model_path = modelDirectory.absolutePath,
                        tokenizer_path = tokenizer.absolutePath,
                        config = ModelConfig(
                            nCtx = 0,
                            nGpuLayers = 0,
                            max_tokens = MAX_OUTPUT_TOKENS,
                            enable_thinking = true,
                        ),
                        runtime_id = GenieXSdk.PLUGIN_ID_QAIRT,
                        compute_unit = ComputeUnitValue.NPU.value,
                    ),
                )
                .build()
                .getOrThrow()
            activeWrapper.set(wrapper)
            loadMs = System.currentTimeMillis() - loadStarted
            peakPss = maxOf(peakPss, currentPssBytes())

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

            emitProgress(modelId, "generating", loadMs, 0)
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
            }
            peakPss = maxOf(peakPss, currentPssBytes())
        } catch (error: Throwable) {
            if (cancelRequested.get()) {
                state = "cancelled"
            } else {
                state = "failed"
                failure = rootMessage(error)
            }
        } finally {
            val unloadStarted = System.currentTimeMillis()
            activeWrapper.set(null)
            if (wrapper != null) {
                runCatching { wrapper.stopStream() }
                runCatching { wrapper.destroy() }
                    .onFailure { closeError ->
                        if (failure == null && state == "completed") {
                            state = "failed"
                            failure = "Qwen generated output but failed to unload cleanly: ${rootMessage(closeError)}"
                        }
                    }
            }
            unloadMs = System.currentTimeMillis() - unloadStarted
            peakPss = maxOf(peakPss, currentPssBytes())
            running.set(false)
            cancelRequested.set(false)
        }

        val completedAt = System.currentTimeMillis()
        val resolvedFirstChunk = when {
            profile != null && profile!!.ttftMs >= 0.0 -> profile!!.ttftMs.roundToLong()
            else -> firstChunkMs
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
        result.put("profile", profileMetrics(profile))
        result.put("error", failure ?: JSONObject.NULL)
        writeLastResult(result)
        emitProgress(modelId, state, loadMs, finalOutput.length)
        call.resolve(result)
    }

    private fun status(): JSObject {
        val missing = missingModelFiles()
        val ready = ensureSdkReady()
        val result = JSObject()
        result.put("ready", missing.isEmpty() && ready)
        result.put("running", running.get())
        result.put("modelId", MODEL_ID)
        result.put("runtime", "geniex-qairt")
        result.put("runtimeVersion", runtimeVersion())
        result.put("sdkVersion", GENIEX_ANDROID_VERSION)
        result.put("distribution", "maven-central")
        result.put("backend", "npu")
        result.put("contextTokens", CONTEXT_TOKENS)
        result.put("thinkingEnabled", true)
        result.put("bundleReady", missing.isEmpty())
        result.put("missingModelFiles", JSArray(missing))
        result.put("runtimeInstalled", true)
        result.put("bridgeLoaded", ready)
        result.put("bridgeError", sdkError ?: JSONObject.NULL)
        result.put("lastResult", readLastResult())
        return result
    }

    private fun ensureSdkReady(): Boolean = synchronized(sdkLock) {
        if (sdkReady) return@synchronized true
        sdkError = null
        GenieXSdk.getInstance().init(
            context,
            object : GenieXSdk.InitCallback {
                override fun onSuccess() {
                    sdkReady = true
                    sdkError = null
                }

                override fun onFailure(reason: String) {
                    sdkReady = false
                    sdkError = reason.trim().ifEmpty { "GenieX initialisation failed." }
                }
            },
        )
        sdkReady
    }

    private fun runtimeVersion(): String {
        if (!sdkReady) return "GenieX Android $GENIEX_ANDROID_VERSION"
        return runCatching {
            GenieXSdk.getInstance().getPluginVersion(GenieXSdk.PLUGIN_ID_QAIRT)
        }.getOrNull()?.takeIf { it.isNotBlank() }
            ?: "GenieX Android $GENIEX_ANDROID_VERSION"
    }

    private fun profileMetrics(profile: ProfilingData?): JSObject {
        val metrics = JSObject()
        metrics.put("available", profile != null)
        metrics.put("timeToFirstTokenMs", profile?.ttftMs ?: JSONObject.NULL)
        metrics.put("promptProcessingTimeMs", profile?.promptTimeMs ?: JSONObject.NULL)
        metrics.put("decodeTimeMs", profile?.decodeTimeMs ?: JSONObject.NULL)
        metrics.put("tokenGenerationRate", profile?.decodingSpeed ?: JSONObject.NULL)
        metrics.put("tokenGenerationRateUnit", if (profile == null) JSONObject.NULL else "tok/s")
        metrics.put("promptProcessingRate", profile?.prefillSpeed ?: JSONObject.NULL)
        metrics.put("promptProcessingRateUnit", if (profile == null) JSONObject.NULL else "tok/s")
        metrics.put("promptTokens", profile?.promptTokens ?: JSONObject.NULL)
        metrics.put("generatedTokens", profile?.generatedTokens ?: JSONObject.NULL)
        metrics.put("stopReason", profile?.stopReason ?: JSONObject.NULL)
        return metrics
    }

    private fun missingModelFiles(): List<String> {
        val directory = modelDirectory()
        return REQUIRED_MODEL_FILES.filter { !File(directory, it).isFile }
    }

    private fun modelDirectory(): File = File(context.filesDir, "mais-models")

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

    private fun rootMessage(error: Throwable): String {
        var current = error
        while (current.cause != null) current = current.cause!!
        return current.message?.takeIf { it.isNotBlank() } ?: current.javaClass.simpleName
    }
}
