package dev.kian.gymapp

import android.os.Debug
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.LogSeverity
import com.google.ai.edge.litertlm.SamplerConfig
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.concurrent.CancellationException
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import org.json.JSONObject

@CapacitorPlugin(name = "MaisLiteRtRuntime")
class MaisLiteRtRuntimePlugin : Plugin() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private val activeJob = AtomicReference<Job?>(null)
  private val activeEngine = AtomicReference<Engine?>(null)
  private val activeConversation = AtomicReference<Conversation?>(null)

  @PluginMethod
  fun getStatus(call: PluginCall) {
    try {
      val result = JSObject()
      result.put("running", activeJob.get()?.isActive == true)
      result.put("lastResult", readLastResult())
      call.resolve(result)
    } catch (error: Exception) {
      call.reject(error.message, error)
    }
  }

  @PluginMethod
  fun runBaseline(call: PluginCall) {
    val fileName: String
    val backendName: String
    val prompt: String
    try {
      fileName = safeFileName(required(call, "fileName"))
      backendName = required(call, "backend").lowercase()
      prompt = call.getString(
        "prompt",
        "You are the first local MAIS model runtime check. Reply with exactly two short sentences: first confirm you are running locally, then name one reason typed evidence is safer than an endless chat transcript."
      )!!.trim()
      if (prompt.isEmpty()) throw IllegalArgumentException("prompt is required.")
      if (backendName != "cpu" && backendName != "gpu") {
        throw IllegalArgumentException("backend must be cpu or gpu.")
      }
      val model = File(File(context.filesDir, "mais-models"), fileName)
      if (!model.isFile) throw IllegalStateException("The verified model file is not installed.")
      if (activeJob.get()?.isActive == true) throw IllegalStateException("A LiteRT-LM baseline is already running.")
    } catch (error: Exception) {
      call.reject(error.message, error)
      return
    }

    val job = scope.launch {
      val startedAtEpochMs = System.currentTimeMillis()
      val memoryBeforeBytes = currentPssBytes()
      var peakPssBytes = memoryBeforeBytes
      var engine: Engine? = null
      var conversation: Conversation? = null
      var loadMs = 0L
      var firstChunkLatencyMs = -1L
      var generationMs = 0L
      var unloadMs = 0L
      var output = ""
      var completionState = "completed"
      var failure: String? = null

      emitRuntimeProgress("loading", backendName, 0L, null)
      try {
        val model = File(File(context.filesDir, "mais-models"), fileName)
        val cache = File(File(context.cacheDir, "mais-litert-lm"), backendName)
        if (!cache.exists() && !cache.mkdirs()) throw IllegalStateException("Could not create the LiteRT-LM cache directory.")

        val backend = if (backendName == "gpu") Backend.GPU() else Backend.CPU()
        Engine.setNativeMinLogSeverity(LogSeverity.ERROR)
        val loadStarted = System.currentTimeMillis()
        engine = Engine(
          EngineConfig(
            modelPath = model.absolutePath,
            backend = backend,
            maxNumTokens = 4096,
            cacheDir = cache.absolutePath,
          )
        )
        activeEngine.set(engine)
        engine.initialize()
        loadMs = System.currentTimeMillis() - loadStarted
        peakPssBytes = maxOf(peakPssBytes, currentPssBytes())

        conversation = engine.createConversation(
          ConversationConfig(
            systemInstruction = Contents.of(
              "You are a bounded local runtime check for My Mettle. Be concise, factual and do not claim access to any training data."
            ),
            samplerConfig = SamplerConfig(topK = 1, topP = 1.0, temperature = 0.0, seed = 7),
            automaticToolCalling = false,
            channels = emptyList(),
          )
        )
        activeConversation.set(conversation)

        val generationStarted = System.currentTimeMillis()
        emitRuntimeProgress("generating", backendName, loadMs, null)
        val outputBuilder = StringBuilder()
        conversation.sendMessageAsync(prompt).collect { message ->
          val chunk = message.toString()
          if (chunk.isNotEmpty()) {
            if (firstChunkLatencyMs < 0L) {
              firstChunkLatencyMs = System.currentTimeMillis() - generationStarted
            }
            outputBuilder.append(chunk)
            peakPssBytes = maxOf(peakPssBytes, currentPssBytes())
            emitRuntimeProgress("generating", backendName, loadMs, outputBuilder.length)
          }
        }
        generationMs = System.currentTimeMillis() - generationStarted
        output = outputBuilder.toString().trim()
        if (output.isEmpty()) throw IllegalStateException("LiteRT-LM completed without returning text.")
      } catch (error: CancellationException) {
        completionState = "cancelled"
        failure = "Cancelled by user."
      } catch (error: Throwable) {
        completionState = "failed"
        failure = error.message ?: error.javaClass.simpleName
      } finally {
        val unloadStarted = System.currentTimeMillis()
        try {
          conversation?.close()
        } catch (_: Throwable) {
          // Continue releasing the engine.
        }
        activeConversation.set(null)
        try {
          if (engine?.isInitialized() == true) engine.close()
        } catch (_: Throwable) {
          // The process may already have released the native engine after cancellation.
        }
        activeEngine.set(null)
        unloadMs = System.currentTimeMillis() - unloadStarted
        peakPssBytes = maxOf(peakPssBytes, currentPssBytes())

        val completedAtEpochMs = System.currentTimeMillis()
        val result = JSONObject()
        result.put("state", completionState)
        result.put("success", completionState == "completed")
        result.put("modelId", "google.gemma-4-e2b-it")
        result.put("runtime", "litert-lm")
        result.put("runtimeVersion", "0.14.0")
        result.put("backend", backendName)
        result.put("startedAtEpochMs", startedAtEpochMs)
        result.put("completedAtEpochMs", completedAtEpochMs)
        result.put("loadMs", loadMs)
        result.put("firstChunkLatencyMs", firstChunkLatencyMs)
        result.put("generationMs", generationMs)
        result.put("unloadMs", unloadMs)
        result.put("totalMs", completedAtEpochMs - startedAtEpochMs)
        result.put("memoryBeforeBytes", memoryBeforeBytes)
        result.put("peakPssBytes", peakPssBytes)
        result.put("memoryAfterBytes", currentPssBytes())
        result.put("output", output)
        result.put("outputChars", output.length)
        if (failure == null) result.put("error", JSONObject.NULL) else result.put("error", failure)
        writeLastResult(result)
        emitRuntimeProgress(completionState, backendName, loadMs, output.length)

        val response = JSObject.fromJSONObject(result)
        call.resolve(response)
        activeJob.set(null)
      }
    }

    if (!activeJob.compareAndSet(null, job)) {
      job.cancel()
      call.reject("A LiteRT-LM baseline is already running.")
    }
  }

  @PluginMethod
  fun cancelRun(call: PluginCall) {
    val job = activeJob.get()
    if (job?.isActive == true) {
      job.cancel(CancellationException("Cancelled by user."))
      try {
        activeConversation.get()?.close()
      } catch (_: Throwable) {
        // The coroutine finally block completes cleanup.
      }
      val result = JSObject()
      result.put("requested", true)
      call.resolve(result)
    } else {
      val result = JSObject()
      result.put("requested", false)
      call.resolve(result)
    }
  }

  override fun handleOnDestroy() {
    activeJob.getAndSet(null)?.cancel()
    try {
      activeConversation.getAndSet(null)?.close()
    } catch (_: Throwable) {
      // Ignore teardown failures.
    }
    try {
      val engine = activeEngine.getAndSet(null)
      if (engine?.isInitialized() == true) engine.close()
    } catch (_: Throwable) {
      // Ignore teardown failures.
    }
    scope.cancel()
    super.handleOnDestroy()
  }

  private fun emitRuntimeProgress(state: String, backend: String, loadMs: Long, outputChars: Int?) {
    val event = JSObject()
    event.put("state", state)
    event.put("backend", backend)
    event.put("loadMs", loadMs)
    if (outputChars == null) event.put("outputChars", JSONObject.NULL) else event.put("outputChars", outputChars)
    event.put("capturedAtEpochMs", System.currentTimeMillis())
    notifyListeners("modelInferenceProgress", event)
  }

  private fun currentPssBytes(): Long = Debug.getPss().toLong() * 1024L

  private fun runtimeDirectory(): File = File(context.filesDir, "mais-runtime")

  private fun lastResultFile(): File = File(runtimeDirectory(), "last-litert-run.json")

  private fun writeLastResult(result: JSONObject) {
    val directory = runtimeDirectory()
    if (!directory.exists() && !directory.mkdirs()) throw IllegalStateException("Could not create the MAIS runtime directory.")
    lastResultFile().writeText(result.toString(2), StandardCharsets.UTF_8)
  }

  private fun readLastResult(): Any {
    val file = lastResultFile()
    if (!file.isFile) return JSONObject.NULL
    return JSONObject(file.readText(StandardCharsets.UTF_8))
  }

  private fun required(call: PluginCall, key: String): String {
    val value = call.getString(key)?.trim()
    if (value.isNullOrEmpty()) throw IllegalArgumentException("$key is required.")
    return value
  }

  private fun safeFileName(value: String): String {
    if (!value.matches(Regex("[A-Za-z0-9._-]+")) || value.contains("..")) {
      throw IllegalArgumentException("Invalid model filename.")
    }
    return value
  }
}
