package dev.kian.gymapp;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.ai.edge.localagents.rag.models.EmbedData;
import com.google.ai.edge.localagents.rag.models.EmbeddingRequest;
import com.google.ai.edge.localagents.rag.models.GemmaEmbeddingModel;
import com.google.common.collect.ImmutableList;

import org.json.JSONException;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "MaisEmbeddingRuntime")
public final class MaisEmbeddingRuntimePlugin extends Plugin {
    private static final String MODEL_FILE = "embeddinggemma-300M_seq512_mixed-precision.qualcomm.sm8750.tflite";
    private static final String TOKENIZER_FILE = "sentencepiece.model";
    private static final int SOURCE_DIMENSIONS = 768;
    private static final int MAX_BATCH = 16;
    private static final int MAX_TEXT_CHARS = 16_384;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final Object MODEL_LOCK = new Object();

    private static GemmaEmbeddingModel model;
    private static long modelStamp = -1L;
    private static long initializedAtMs = 0L;

    @PluginMethod
    public void getStatus(PluginCall call) {
        EXECUTOR.execute(() -> {
            try {
                File modelFile = modelFile();
                File tokenizerFile = tokenizerFile();
                JSObject result = new JSObject();
                result.put("ready", modelFile.isFile() && tokenizerFile.isFile());
                result.put("modelInstalled", modelFile.isFile());
                result.put("tokenizerInstalled", tokenizerFile.isFile());
                result.put("modelBytes", modelFile.isFile() ? modelFile.length() : 0L);
                result.put("tokenizerBytes", tokenizerFile.isFile() ? tokenizerFile.length() : 0L);
                result.put("sourceDimensions", SOURCE_DIMENSIONS);
                result.put("backend", "litert-aot-precompiled");
                result.put("acceleratorClaim", "unverified_until_device_probe");
                result.put("initialized", model != null);
                result.put("initializedAtEpochMs", initializedAtMs);
                call.resolve(result);
            } catch (Exception error) {
                call.reject(error.getMessage(), error);
            }
        });
    }

    @PluginMethod
    public void embed(PluginCall call) {
        EXECUTOR.execute(() -> {
            long startedAt = System.nanoTime();
            try {
                JSArray values = call.getArray("texts");
                String purpose = required(call, "purpose");
                int dimensions = call.getInt("dimensions", 256);
                validateDimensions(dimensions);
                if (values == null || values.length() == 0) throw new IllegalArgumentException("At least one text is required.");
                if (values.length() > MAX_BATCH) throw new IllegalArgumentException("Embedding batch exceeds the 16-text limit.");

                List<EmbedData<String>> inputs = new ArrayList<>();
                EmbedData.TaskType task = "query".equals(purpose)
                    ? EmbedData.TaskType.RETRIEVAL_QUERY
                    : EmbedData.TaskType.RETRIEVAL_DOCUMENT;
                for (int index = 0; index < values.length(); index += 1) {
                    String text = values.getString(index);
                    if (text == null || text.trim().isEmpty()) throw new IllegalArgumentException("Embedding text cannot be empty.");
                    String trimmed = text.trim();
                    if (trimmed.length() > MAX_TEXT_CHARS) throw new IllegalArgumentException("Embedding text exceeds the bounded input limit.");
                    inputs.add(EmbedData.create(trimmed, task));
                }

                long loadStarted = System.nanoTime();
                GemmaEmbeddingModel activeModel = requireModel();
                long loadMs = elapsedMs(loadStarted);
                EmbeddingRequest<String> request = EmbeddingRequest.create(inputs);
                ImmutableList<ImmutableList<Float>> fullVectors = activeModel
                    .getBatchEmbeddings(request)
                    .get(120, TimeUnit.SECONDS);
                if (fullVectors.size() != inputs.size()) throw new IllegalStateException("Embedding runtime returned the wrong number of vectors.");

                JSArray vectors = new JSArray();
                for (ImmutableList<Float> source : fullVectors) {
                    if (source.size() < dimensions) throw new IllegalStateException("Embedding runtime returned a vector smaller than requested.");
                    vectors.put(toNormalisedVector(source, dimensions));
                }

                JSObject result = new JSObject();
                result.put("vectors", vectors);
                result.put("dimensions", dimensions);
                result.put("sourceDimensions", SOURCE_DIMENSIONS);
                result.put("backend", "litert-aot-precompiled");
                result.put("acceleratorClaim", "unverified_until_device_probe");
                result.put("loadMs", loadMs);
                result.put("totalMs", elapsedMs(startedAt));
                result.put("batchSize", inputs.size());
                call.resolve(result);
            } catch (Exception error) {
                call.reject(rootMessage(error), error);
            }
        });
    }

    private GemmaEmbeddingModel requireModel() {
        File modelFile = modelFile();
        File tokenizerFile = tokenizerFile();
        if (!modelFile.isFile()) throw new IllegalStateException("Import the EmbeddingGemma .tflite model before building the semantic index.");
        if (!tokenizerFile.isFile()) throw new IllegalStateException("Import sentencepiece.model before building the semantic index.");
        long stamp = modelFile.lastModified() ^ tokenizerFile.lastModified() ^ modelFile.length() ^ tokenizerFile.length();
        synchronized (MODEL_LOCK) {
            if (model == null || modelStamp != stamp) {
                model = new GemmaEmbeddingModel(modelFile.getAbsolutePath(), tokenizerFile.getAbsolutePath(), false);
                modelStamp = stamp;
                initializedAtMs = System.currentTimeMillis();
            }
            return model;
        }
    }

    private JSArray toNormalisedVector(List<Float> source, int dimensions) throws JSONException {
        double normSquared = 0.0;
        for (int index = 0; index < dimensions; index += 1) {
            float value = source.get(index);
            if (!Float.isFinite(value)) throw new IllegalStateException("Embedding vector contains a non-finite value.");
            normSquared += (double) value * value;
        }
        double scale = normSquared > 0.0 ? 1.0 / Math.sqrt(normSquared) : 1.0;
        JSArray vector = new JSArray();
        for (int index = 0; index < dimensions; index += 1) vector.put(source.get(index) * scale);
        return vector;
    }

    private void validateDimensions(int dimensions) {
        if (dimensions != 128 && dimensions != 256 && dimensions != 512 && dimensions != 768) {
            throw new IllegalArgumentException("Embedding dimensions must be 128, 256, 512 or 768.");
        }
    }

    private File modelDirectory() {
        return new File(getContext().getFilesDir(), "mais-models");
    }

    private File modelFile() {
        return new File(modelDirectory(), MODEL_FILE);
    }

    private File tokenizerFile() {
        return new File(modelDirectory(), TOKENIZER_FILE);
    }

    private String required(PluginCall call, String key) {
        String value = call.getString(key);
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(key + " is required.");
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private long elapsedMs(long startedAtNanos) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAtNanos);
    }

    private String rootMessage(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null) current = current.getCause();
        String message = current.getMessage();
        return message == null || message.isBlank() ? current.getClass().getSimpleName() : message;
    }
}
