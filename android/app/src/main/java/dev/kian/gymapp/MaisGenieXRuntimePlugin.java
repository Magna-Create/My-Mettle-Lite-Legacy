package dev.kian.gymapp;

import android.os.Debug;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

@CapacitorPlugin(name = "MaisGenieXRuntime")
public final class MaisGenieXRuntimePlugin extends Plugin {
    private static final String MODEL_ID = "qwen.qwen3-4b";
    private static final String RUNTIME_VERSION = "QAIRT 2.45.0.260326154327";
    private static final int CONTEXT_TOKENS = 12_288;
    private static final int READ_BUFFER_BYTES = 64 * 1024;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean RUNNING = new AtomicBoolean(false);
    private static final AtomicLong ACTIVE_HANDLE = new AtomicLong(0L);
    private static final List<String> REQUIRED_MODEL_FILES = Arrays.asList(
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
        "vocab.json"
    );

    @PluginMethod
    public void getStatus(PluginCall call) {
        try {
            call.resolve(status());
        } catch (Exception error) {
            call.reject(rootMessage(error), error);
        }
    }

    @PluginMethod
    public void runBaseline(PluginCall call) {
        final String modelId;
        final String prompt;
        final String systemInstruction;
        try {
            modelId = required(call, "modelId");
            if (!MODEL_ID.equals(modelId)) {
                throw new IllegalArgumentException("The GenieX adapter currently supports Qwen3-4B only.");
            }
            prompt = optional(
                call,
                "prompt",
                "Reply with exactly two short sentences. First confirm that this response was generated locally. Second state that verified evidence should be preferred over an unbounded transcript."
            );
            systemInstruction = optional(
                call,
                "systemInstruction",
                "You are the bounded native Qwen runtime check for My Mettle. Be concise, factual and never claim access to data that was not supplied."
            );
            ensureReady();
            if (!RUNNING.compareAndSet(false, true)) {
                throw new IllegalStateException("A GenieX run is already active.");
            }
        } catch (Exception error) {
            call.reject(rootMessage(error), error);
            return;
        }
        EXECUTOR.execute(() -> executeBaseline(call, modelId, prompt, systemInstruction));
    }

    @PluginMethod
    public void cancelRun(PluginCall call) {
        JSObject result = new JSObject();
        result.put("requested", false);
        result.put("supported", false);
        result.put(
            "reason",
            "The currently integrated Genie C API does not expose a validated cancellation ABI. The bounded probe must finish before another run starts."
        );
        call.resolve(result);
    }

    private void executeBaseline(PluginCall call, String modelId, String prompt, String systemInstruction) {
        final long startedAt = System.currentTimeMillis();
        final long memoryBefore = currentPssBytes();
        long peakPss = memoryBefore;
        long handle = 0L;
        long loadMs = 0L;
        long firstChunkMs = -1L;
        long generationMs = 0L;
        long unloadMs = 0L;
        String rawOutput = "";
        String finalOutput = "";
        String profileJson = "";
        String state = "completed";
        String failure = null;

        emitProgress(modelId, "loading", 0L, 0);
        try {
            MaisGenieXNative.requireLoaded();
            String configJson = buildRuntimeConfig();
            long loadStarted = System.currentTimeMillis();
            handle = MaisGenieXNative.nativeCreate(
                MaisQairtRuntimePlugin.arm64Directory(getContext().getFilesDir()).getAbsolutePath(),
                MaisQairtRuntimePlugin.hexagonDirectory(getContext().getFilesDir()).getAbsolutePath(),
                configJson
            );
            if (handle == 0L) throw new IllegalStateException("Genie returned a null runtime handle.");
            ACTIVE_HANDLE.set(handle);
            loadMs = System.currentTimeMillis() - loadStarted;
            peakPss = Math.max(peakPss, currentPssBytes());

            emitProgress(modelId, "generating", loadMs, 0);
            rawOutput = nullToEmpty(
                MaisGenieXNative.nativeQuery(handle, buildTaggedPrompt(systemInstruction, prompt))
            ).trim();
            generationMs = Math.max(0L, MaisGenieXNative.nativeGetLastQueryMs(handle));
            firstChunkMs = MaisGenieXNative.nativeGetLastFirstChunkMs(handle);
            profileJson = nullToEmpty(MaisGenieXNative.nativeGetLastProfileJson(handle));
            finalOutput = extractFinalOutput(rawOutput);
            if (finalOutput.isEmpty()) {
                throw new IllegalStateException("Qwen completed without returning a final response.");
            }
            peakPss = Math.max(peakPss, currentPssBytes());
        } catch (Throwable error) {
            state = "failed";
            failure = rootMessage(error);
        } finally {
            long unloadStarted = System.currentTimeMillis();
            if (handle != 0L) {
                try {
                    MaisGenieXNative.nativeFree(handle);
                } catch (Throwable closeError) {
                    if (failure == null) {
                        state = "failed";
                        failure = "Qwen generated output but failed to unload cleanly: " + rootMessage(closeError);
                    }
                }
            }
            ACTIVE_HANDLE.set(0L);
            unloadMs = System.currentTimeMillis() - unloadStarted;
            peakPss = Math.max(peakPss, currentPssBytes());
            RUNNING.set(false);
        }

        long completedAt = System.currentTimeMillis();
        try {
            JSObject result = new JSObject();
            result.put("state", state);
            result.put("success", "completed".equals(state));
            result.put("modelId", modelId);
            result.put("runtime", "geniex-qairt");
            result.put("runtimeVersion", RUNTIME_VERSION);
            result.put("backend", "npu");
            result.put("contextTokens", CONTEXT_TOKENS);
            result.put("startedAtEpochMs", startedAt);
            result.put("completedAtEpochMs", completedAt);
            result.put("loadMs", loadMs);
            result.put("firstChunkLatencyMs", firstChunkMs);
            result.put("generationMs", generationMs);
            result.put("unloadMs", unloadMs);
            result.put("totalMs", completedAt - startedAt);
            result.put("memoryBeforeBytes", memoryBefore);
            result.put("peakPssBytes", peakPss);
            result.put("memoryAfterBytes", currentPssBytes());
            result.put("rawOutput", rawOutput);
            result.put("finalOutput", finalOutput);
            result.put("outputChars", finalOutput.length());
            result.put("profile", profileMetrics(profileJson));
            result.put("error", failure == null ? JSONObject.NULL : failure);
            writeLastResult(result);
            emitProgress(modelId, state, loadMs, finalOutput.length());
            call.resolve(result);
        } catch (Exception error) {
            call.reject(rootMessage(error), error);
        }
    }

    private JSObject status() throws Exception {
        JSONArray missingFiles = missingModelFiles();
        File arm64 = MaisQairtRuntimePlugin.arm64Directory(getContext().getFilesDir());
        File hexagon = MaisQairtRuntimePlugin.hexagonDirectory(getContext().getFilesDir());
        boolean runtimeInstalled = new File(arm64, "libGenie.so").isFile()
            && new File(arm64, "libQnnSystem.so").isFile()
            && new File(arm64, "libQnnHtp.so").isFile()
            && new File(arm64, "libQnnHtpPrepare.so").isFile()
            && hasLibrary(arm64, "Stub.so")
            && hasLibrary(hexagon, "Skel.so");

        JSObject result = new JSObject();
        result.put("ready", missingFiles.length() == 0 && runtimeInstalled && MaisGenieXNative.isLoaded());
        result.put("running", RUNNING.get());
        result.put("modelId", MODEL_ID);
        result.put("runtime", "geniex-qairt");
        result.put("runtimeVersion", RUNTIME_VERSION);
        result.put("backend", "npu");
        result.put("contextTokens", CONTEXT_TOKENS);
        result.put("bundleReady", missingFiles.length() == 0);
        result.put("missingModelFiles", missingFiles);
        result.put("runtimeInstalled", runtimeInstalled);
        result.put("bridgeLoaded", MaisGenieXNative.isLoaded());
        result.put(
            "bridgeError",
            MaisGenieXNative.loadError() == null ? JSONObject.NULL : MaisGenieXNative.loadError()
        );
        result.put("lastResult", readLastResult());
        return result;
    }

    private void ensureReady() throws Exception {
        JSObject current = status();
        if (!current.getBool("bundleReady")) {
            throw new IllegalStateException("The complete verified Qwen3-4B 12K model pack is not installed.");
        }
        if (!current.getBool("runtimeInstalled")) {
            throw new IllegalStateException("Import the matching QAIRT 2.45 Android runtime before running Qwen.");
        }
        MaisGenieXNative.requireLoaded();
    }

    private String buildRuntimeConfig() throws Exception {
        File models = modelDirectory();
        JSONObject config = new JSONObject(readText(new File(models, "genie_config.json")));
        JSONObject dialog = config.getJSONObject("dialog");
        dialog.getJSONObject("tokenizer").put(
            "path",
            new File(models, "tokenizer.json").getAbsolutePath()
        );
        JSONObject engine = dialog.getJSONObject("engine");
        engine.getJSONObject("backend").put(
            "extensions",
            new File(models, "htp_backend_ext_config.json").getAbsolutePath()
        );
        JSONArray binaries = engine
            .getJSONObject("model")
            .getJSONObject("binary")
            .getJSONArray("ctx-bins");
        for (int index = 0; index < binaries.length(); index += 1) {
            String name = new File(binaries.getString(index)).getName();
            File binary = new File(models, name);
            if (!binary.isFile()) {
                throw new IllegalStateException("Qwen context binary is missing: " + name + ".");
            }
            binaries.put(index, binary.getAbsolutePath());
        }
        return config.toString();
    }

    private String buildTaggedPrompt(String systemInstruction, String userPrompt) {
        String tagged;
        try {
            JSONObject metadata = new JSONObject(readText(new File(modelDirectory(), "metadata.json")));
            JSONObject template = metadata.getJSONObject("genie").getJSONObject("chat_template");
            tagged = template.getString("system_prefix")
                + systemInstruction
                + template.getString("system_suffix")
                + template.getString("user_prefix")
                + userPrompt
                + template.getString("user_suffix")
                + template.getString("assistant_prefix");
        } catch (Exception ignored) {
            tagged = "<|im_start|>system\n" + systemInstruction + "<|im_end|>\n"
                + "<|im_start|>user\n" + userPrompt + "<|im_end|>\n"
                + "<|im_start|>assistant\n";
        }
        return tagged + "<think>\n\n</think>\n";
    }

    private JSObject profileMetrics(String profileJson) {
        JSObject metrics = new JSObject();
        metrics.put("available", !profileJson.trim().isEmpty());
        metrics.put("timeToFirstTokenMs", JSONObject.NULL);
        metrics.put("tokenGenerationRate", JSONObject.NULL);
        metrics.put("promptProcessingRate", JSONObject.NULL);
        metrics.put("promptTokens", JSONObject.NULL);
        metrics.put("generatedTokens", JSONObject.NULL);
        if (profileJson.trim().isEmpty()) return metrics;
        try {
            JSONObject profile = new JSONObject(profileJson);
            findMetric(profile, "time-to-first-token", metrics, "timeToFirstTokenMs");
            findMetric(profile, "token-generation-rate", metrics, "tokenGenerationRate");
            findMetric(profile, "prompt-processing-rate", metrics, "promptProcessingRate");
            findMetric(profile, "num-prompt-tokens", metrics, "promptTokens");
            findMetric(profile, "num-generated-tokens", metrics, "generatedTokens");
        } catch (Exception error) {
            metrics.put("parseError", rootMessage(error));
        }
        return metrics;
    }

    private boolean findMetric(
        Object node,
        String targetKey,
        JSObject output,
        String outputKey
    ) throws Exception {
        if (node instanceof JSONObject) {
            JSONObject object = (JSONObject) node;
            if (object.has(targetKey)) {
                Object value = object.get(targetKey);
                if (value instanceof JSONObject && ((JSONObject) value).has("value")) {
                    JSONObject wrapped = (JSONObject) value;
                    output.put(outputKey, wrapped.get("value"));
                    if (wrapped.has("unit")) output.put(outputKey + "Unit", wrapped.get("unit"));
                } else {
                    output.put(outputKey, value);
                }
                return true;
            }
            Iterator<String> keys = object.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                if (findMetric(object.get(key), targetKey, output, outputKey)) return true;
            }
        } else if (node instanceof JSONArray) {
            JSONArray array = (JSONArray) node;
            for (int index = 0; index < array.length(); index += 1) {
                if (findMetric(array.get(index), targetKey, output, outputKey)) return true;
            }
        }
        return false;
    }

    private String extractFinalOutput(String raw) {
        String output = nullToEmpty(raw).trim();
        int closingThink = output.lastIndexOf("</think>");
        if (closingThink >= 0) output = output.substring(closingThink + "</think>".length()).trim();
        return output.replace("<|im_end|>", "").trim();
    }

    private JSONArray missingModelFiles() {
        JSONArray missing = new JSONArray();
        File directory = modelDirectory();
        for (String name : REQUIRED_MODEL_FILES) {
            if (!new File(directory, name).isFile()) missing.put(name);
        }
        return missing;
    }

    private boolean hasLibrary(File directory, String suffix) {
        File[] matches = directory.listFiles(
            (parent, name) -> name.startsWith("libQnnHtpV") && name.endsWith(suffix)
        );
        return matches != null && matches.length > 0;
    }

    private void emitProgress(String modelId, String state, long loadMs, int outputChars) {
        JSObject event = new JSObject();
        event.put("modelId", modelId);
        event.put("state", state);
        event.put("backend", "npu");
        event.put("loadMs", loadMs);
        event.put("outputChars", outputChars);
        event.put("capturedAtEpochMs", System.currentTimeMillis());
        notifyListeners("genieXInferenceProgress", event);
    }

    private long currentPssBytes() {
        return Debug.getPss() * 1024L;
    }

    private File modelDirectory() {
        return new File(getContext().getFilesDir(), "mais-models");
    }

    private File runtimeResultDirectory() {
        return new File(getContext().getFilesDir(), "mais-runtime");
    }

    private File lastResultFile() {
        return new File(runtimeResultDirectory(), "last-qwen-qwen3-4b.json");
    }

    private void writeLastResult(JSObject result) throws Exception {
        File directory = runtimeResultDirectory();
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IllegalStateException("Could not create the MAIS runtime directory.");
        }
        try (BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(lastResultFile()))) {
            output.write(result.toString(2).getBytes(StandardCharsets.UTF_8));
        }
    }

    private Object readLastResult() {
        try {
            if (!lastResultFile().isFile()) return JSONObject.NULL;
            return new JSONObject(readText(lastResultFile()));
        } catch (Exception ignored) {
            return JSONObject.NULL;
        }
    }

    private String readText(File file) throws Exception {
        try (
            BufferedInputStream input = new BufferedInputStream(new FileInputStream(file), READ_BUFFER_BYTES);
            ByteArrayOutputStream output = new ByteArrayOutputStream()
        ) {
            byte[] buffer = new byte[READ_BUFFER_BYTES];
            int count;
            while ((count = input.read(buffer)) >= 0) {
                if (count > 0) output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private String required(PluginCall call, String key) {
        String value = call.getString(key);
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(key + " is required.");
        }
        return value.trim();
    }

    private String optional(PluginCall call, String key, String fallback) {
        String value = call.getString(key, fallback);
        if (value == null || value.trim().isEmpty()) return fallback;
        return value.trim();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String rootMessage(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null) current = current.getCause();
        String message = current.getMessage();
        return message == null || message.trim().isEmpty()
            ? current.getClass().getSimpleName()
            : message;
    }

    @Override
    protected void handleOnDestroy() {
        long handle = ACTIVE_HANDLE.getAndSet(0L);
        if (handle != 0L && !RUNNING.get()) {
            try {
                MaisGenieXNative.nativeFree(handle);
            } catch (Throwable ignored) {
                // Android reclaims the process native address space during teardown.
            }
        }
        super.handleOnDestroy();
    }
}
