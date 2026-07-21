package dev.kian.gymapp;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.StatFs;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "MaisModelImport")
public final class MaisModelImportPlugin extends Plugin {
    private static final int BUFFER_BYTES = 1024 * 1024;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void pickAndImport(PluginCall call) {
        try {
            required(call, "artifactId");
            safeFileName(required(call, "fileName"));
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
                "application/octet-stream",
                "application/x-tflite",
                "application/vnd.tensorflow.lite"
            });
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(call, intent, "pickAndImportResult");
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    @ActivityCallback
    private void pickAndImportResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("Model import cancelled.");
            return;
        }
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        if (uri == null) {
            call.reject("No model file was selected.");
            return;
        }

        final String artifactId;
        final String fileName;
        final long minimumBytes;
        final long maximumBytes;
        try {
            artifactId = required(call, "artifactId");
            fileName = safeFileName(required(call, "fileName"));
            minimumBytes = Math.max(1L, call.getLong("minimumBytes", 1L));
            maximumBytes = Math.max(minimumBytes, call.getLong("maximumBytes", Long.MAX_VALUE));
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
            return;
        }

        EXECUTOR.execute(() -> {
            File importing = null;
            try {
                ensureModelDirectory();
                ContentResolver resolver = getContext().getContentResolver();
                DocumentMetadata metadata = readMetadata(resolver, uri);
                if (!metadata.displayName.toLowerCase(Locale.ROOT).endsWith(".tflite")) {
                    throw new IOException("Select the Qualcomm EmbeddingGemma .tflite file.");
                }
                if (metadata.sizeBytes >= 0L && (metadata.sizeBytes < minimumBytes || metadata.sizeBytes > maximumBytes)) {
                    throw new IOException("The selected file size does not match the expected EmbeddingGemma artefact.");
                }
                long sourceBytes = Math.max(0L, metadata.sizeBytes);
                if (sourceBytes > 0L && availableBytes() < sourceBytes + 64L * 1024L * 1024L) {
                    throw new IOException("Not enough free storage to import this model.");
                }

                importing = new File(modelDirectory(), fileName + ".importing");
                deleteIfPresent(importing);
                long copied = copyUri(resolver, uri, importing);
                if (copied < minimumBytes || copied > maximumBytes) {
                    throw new IOException("The imported file size does not match the expected EmbeddingGemma artefact.");
                }

                String actualSha256 = sha256(importing);
                File destination = new File(modelDirectory(), fileName);
                File verification = new File(modelDirectory(), fileName + ".verified.json");
                deleteIfPresent(destination);
                deleteIfPresent(verification);
                if (!importing.renameTo(destination)) {
                    copyFile(importing, destination);
                    deleteIfPresent(importing);
                }
                writeVerification(artifactId, fileName, actualSha256, destination);

                JSObject response = new JSObject();
                response.put("artifactId", artifactId);
                response.put("state", "ready");
                response.put("installed", true);
                response.put("verified", true);
                response.put("bytes", destination.length());
                response.put("partialBytes", 0L);
                response.put("availableBytes", availableBytes());
                response.put("modelPath", destination.getAbsolutePath());
                response.put("actualSha256", actualSha256);
                response.put("sourceFileName", metadata.displayName);
                call.resolve(response);
            } catch (Exception error) {
                if (importing != null) {
                    try {
                        deleteIfPresent(importing);
                    } catch (Exception ignored) {
                        // Best-effort cleanup after failed import.
                    }
                }
                call.reject(error.getMessage(), error);
            }
        });
    }

    private DocumentMetadata readMetadata(ContentResolver resolver, Uri uri) {
        String displayName = "selected-model.tflite";
        long size = -1L;
        try (Cursor cursor = resolver.query(uri, new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (nameIndex >= 0 && !cursor.isNull(nameIndex)) displayName = cursor.getString(nameIndex);
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex);
            }
        } catch (Exception ignored) {
            // The stream itself remains authoritative when metadata is unavailable.
        }
        return new DocumentMetadata(displayName == null ? "selected-model.tflite" : displayName, size);
    }

    private long copyUri(ContentResolver resolver, Uri uri, File destination) throws IOException {
        try (
            InputStream raw = resolver.openInputStream(uri);
            BufferedInputStream input = raw == null ? null : new BufferedInputStream(raw, BUFFER_BYTES);
            BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(destination), BUFFER_BYTES)
        ) {
            if (input == null) throw new IOException("The selected model file could not be opened.");
            byte[] buffer = new byte[BUFFER_BYTES];
            long copied = 0L;
            int count;
            while ((count = input.read(buffer)) >= 0) {
                output.write(buffer, 0, count);
                copied += count;
            }
            output.flush();
            return copied;
        }
    }

    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (DigestInputStream input = new DigestInputStream(new BufferedInputStream(new FileInputStream(file), BUFFER_BYTES), digest)) {
            byte[] buffer = new byte[BUFFER_BYTES];
            while (input.read(buffer) >= 0) {
                // DigestInputStream updates the digest.
            }
        }
        StringBuilder result = new StringBuilder(64);
        for (byte value : digest.digest()) result.append(String.format(Locale.ROOT, "%02x", value));
        return result.toString();
    }

    private void writeVerification(String artifactId, String fileName, String sha256, File model) throws Exception {
        JSONObject metadata = new JSONObject();
        metadata.put("artifactId", artifactId);
        metadata.put("sha256", sha256);
        metadata.put("integrityMode", "manual");
        metadata.put("bytes", model.length());
        metadata.put("modifiedAt", model.lastModified());
        metadata.put("verifiedAt", System.currentTimeMillis());
        try (BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(new File(modelDirectory(), fileName + ".verified.json")))) {
            output.write(metadata.toString().getBytes(StandardCharsets.UTF_8));
        }
    }

    private File modelDirectory() {
        return new File(getContext().getFilesDir(), "mais-models");
    }

    private void ensureModelDirectory() throws IOException {
        File directory = modelDirectory();
        if (!directory.exists() && !directory.mkdirs()) throw new IOException("Could not create the MAIS model directory.");
    }

    private long availableBytes() {
        return new StatFs(modelDirectory().getAbsolutePath()).getAvailableBytes();
    }

    private String required(PluginCall call, String key) {
        String value = call.getString(key);
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(key + " is required.");
        return value.trim();
    }

    private String safeFileName(String value) {
        if (!value.matches("[A-Za-z0-9._-]+") || value.contains("..")) throw new IllegalArgumentException("Invalid model filename.");
        return value;
    }

    private void deleteIfPresent(File file) throws IOException {
        if (file.exists() && !file.delete()) throw new IOException("Could not delete " + file.getName() + ".");
    }

    private void copyFile(File source, File destination) throws IOException {
        try (
            BufferedInputStream input = new BufferedInputStream(new FileInputStream(source), BUFFER_BYTES);
            BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(destination), BUFFER_BYTES)
        ) {
            byte[] buffer = new byte[BUFFER_BYTES];
            int count;
            while ((count = input.read(buffer)) >= 0) output.write(buffer, 0, count);
        }
    }

    private static final class DocumentMetadata {
        final String displayName;
        final long sizeBytes;

        DocumentMetadata(String displayName, long sizeBytes) {
            this.displayName = displayName;
            this.sizeBytes = sizeBytes;
        }
    }
}
