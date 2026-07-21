package dev.kian.gymapp;

import android.os.StatFs;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "MaisModelRuntime")
public final class MaisModelRuntimePlugin extends Plugin {
    private static final int BUFFER_BYTES = 1024 * 1024;
    private static final long PROGRESS_INTERVAL_MS = 500L;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final Map<String, AtomicBoolean> CANCELLATIONS = new ConcurrentHashMap<>();

    @PluginMethod
    public void getStatus(PluginCall call) {
        try {
            String artifactId = required(call, "artifactId");
            String fileName = safeFileName(required(call, "fileName"));
            String expectedSha256 = optional(call, "sha256").toLowerCase(Locale.ROOT);
            String integrityMode = integrityMode(call);
            validateIntegrity(integrityMode, expectedSha256);
            call.resolve(statusFor(artifactId, fileName, expectedSha256, integrityMode));
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    @PluginMethod
    public void verifyModel(PluginCall call) {
        final String artifactId;
        final String fileName;
        final String expectedSha256;
        final String integrityMode;
        try {
            artifactId = required(call, "artifactId");
            fileName = safeFileName(required(call, "fileName"));
            expectedSha256 = optional(call, "sha256").toLowerCase(Locale.ROOT);
            integrityMode = integrityMode(call);
            validateIntegrity(integrityMode, expectedSha256);
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
            return;
        }

        EXECUTOR.execute(() -> {
            try {
                File file = finalFile(fileName);
                if (!file.isFile()) throw new IOException("The model file is not installed.");
                emitProgress(artifactId, "verifying", file.length(), file.length());
                String actual = sha256(file);
                verifyExpectedDigest(integrityMode, expectedSha256, actual);
                writeVerification(artifactId, fileName, actual, integrityMode, file);
                call.resolve(statusFor(artifactId, fileName, expectedSha256, integrityMode));
            } catch (Exception error) {
                call.reject(error.getMessage(), error);
            }
        });
    }

    @PluginMethod
    public void downloadModel(PluginCall call) {
        final String artifactId;
        final String fileName;
        final String downloadUrl;
        final String expectedSha256;
        final String integrityMode;
        final long approximateBytes;
        try {
            artifactId = required(call, "artifactId");
            fileName = safeFileName(required(call, "fileName"));
            downloadUrl = required(call, "downloadUrl");
            expectedSha256 = optional(call, "sha256").toLowerCase(Locale.ROOT);
            integrityMode = integrityMode(call);
            approximateBytes = Math.max(0L, call.getLong("approximateBytes", 0L));
            validateIntegrity(integrityMode, expectedSha256);
            if (!downloadUrl.startsWith("https://")) throw new IllegalArgumentException("Model downloads require HTTPS.");
            if ("manual".equals(integrityMode)) throw new IllegalArgumentException("This model requires manual installation.");
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
            return;
        }

        AtomicBoolean cancellation = new AtomicBoolean(false);
        AtomicBoolean existing = CANCELLATIONS.putIfAbsent(artifactId, cancellation);
        if (existing != null) {
            call.reject("This model download is already running.");
            return;
        }

        EXECUTOR.execute(() -> {
            try {
                ensureModelDirectory();
                JSObject current = statusFor(artifactId, fileName, expectedSha256, integrityMode);
                if ("ready".equals(current.getString("state"))) {
                    call.resolve(current);
                    return;
                }

                File part = partialFile(fileName);
                long freeBytes = availableBytes();
                long remainingEstimate = Math.max(0L, approximateBytes - part.length());
                if (remainingEstimate > 0L && freeBytes < remainingEstimate + 256L * 1024L * 1024L) {
                    throw new IOException("Not enough free storage for this model.");
                }

                streamDownload(artifactId, downloadUrl, part, cancellation);
                if (cancellation.get()) {
                    emitProgress(artifactId, "cancelled", part.length(), 0L);
                    JSObject cancelled = statusFor(artifactId, fileName, expectedSha256, integrityMode);
                    cancelled.put("cancelled", true);
                    call.resolve(cancelled);
                    return;
                }

                emitProgress(artifactId, "verifying", part.length(), part.length());
                String actualSha256 = sha256(part);
                verifyExpectedDigest(integrityMode, expectedSha256, actualSha256);

                File destination = finalFile(fileName);
                if (destination.exists() && !destination.delete()) {
                    throw new IOException("Could not replace the existing model file.");
                }
                if (!part.renameTo(destination)) {
                    copyFile(part, destination);
                    if (!part.delete()) part.deleteOnExit();
                }
                writeVerification(artifactId, fileName, actualSha256, integrityMode, destination);
                emitProgress(artifactId, "ready", destination.length(), destination.length());
                call.resolve(statusFor(artifactId, fileName, expectedSha256, integrityMode));
            } catch (Exception error) {
                emitProgress(artifactId, "failed", partialFile(fileName).length(), 0L);
                call.reject(error.getMessage(), error);
            } finally {
                CANCELLATIONS.remove(artifactId);
            }
        });
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String artifactId = call.getString("artifactId", "");
        AtomicBoolean cancellation = CANCELLATIONS.get(artifactId);
        if (cancellation != null) cancellation.set(true);
        JSObject result = new JSObject();
        result.put("requested", cancellation != null);
        call.resolve(result);
    }

    @PluginMethod
    public void deleteModel(PluginCall call) {
        try {
            String artifactId = required(call, "artifactId");
            String fileName = safeFileName(required(call, "fileName"));
            String expectedSha256 = optional(call, "sha256").toLowerCase(Locale.ROOT);
            String integrityMode = integrityMode(call);
            AtomicBoolean cancellation = CANCELLATIONS.get(artifactId);
            if (cancellation != null) cancellation.set(true);
            deleteIfPresent(finalFile(fileName));
            deleteIfPresent(partialFile(fileName));
            deleteIfPresent(verificationFile(fileName));
            call.resolve(statusFor(artifactId, fileName, expectedSha256, integrityMode));
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    private JSObject statusFor(String artifactId, String fileName, String expectedSha256, String integrityMode) throws Exception {
        ensureModelDirectory();
        File finalFile = finalFile(fileName);
        File partialFile = partialFile(fileName);
        boolean downloading = CANCELLATIONS.containsKey(artifactId);
        JSONObject verification = readVerification(fileName);
        boolean verified = finalFile.isFile() && verificationMatches(artifactId, expectedSha256, integrityMode, finalFile, verification);

        String state;
        if (downloading) state = "downloading";
        else if (verified) state = "ready";
        else if (finalFile.isFile()) state = "unverified";
        else if (partialFile.isFile()) state = "partial";
        else state = "absent";

        JSObject result = new JSObject();
        result.put("artifactId", artifactId);
        result.put("state", state);
        result.put("installed", finalFile.isFile());
        result.put("verified", verified);
        result.put("bytes", finalFile.isFile() ? finalFile.length() : 0L);
        result.put("partialBytes", partialFile.isFile() ? partialFile.length() : 0L);
        result.put("availableBytes", availableBytes());
        result.put("modelPath", finalFile.isFile() ? finalFile.getAbsolutePath() : JSONObject.NULL);
        result.put("actualSha256", verification == null ? JSONObject.NULL : verification.optString("sha256", null));
        return result;
    }

    private void streamDownload(String artifactId, String source, File part, AtomicBoolean cancellation) throws Exception {
        long existingBytes = part.isFile() ? part.length() : 0L;
        HttpURLConnection connection = openConnection(source, existingBytes);
        int response = connection.getResponseCode();
        boolean append = existingBytes > 0L && response == HttpURLConnection.HTTP_PARTIAL;
        if (response != HttpURLConnection.HTTP_OK && response != HttpURLConnection.HTTP_PARTIAL) {
            throw new IOException("Model server returned HTTP " + response + ".");
        }
        if (!append) existingBytes = 0L;

        long responseBytes = connection.getContentLengthLong();
        long totalBytes = responseBytes > 0L ? existingBytes + responseBytes : 0L;
        long downloaded = existingBytes;
        long lastProgressAt = 0L;

        try (
            InputStream input = new BufferedInputStream(connection.getInputStream(), BUFFER_BYTES);
            RandomAccessFile output = new RandomAccessFile(part, "rw")
        ) {
            if (append) output.seek(existingBytes);
            else output.setLength(0L);
            byte[] buffer = new byte[BUFFER_BYTES];
            while (!cancellation.get()) {
                int count = input.read(buffer);
                if (count < 0) break;
                output.write(buffer, 0, count);
                downloaded += count;
                long now = System.currentTimeMillis();
                if (now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
                    emitProgress(artifactId, "downloading", downloaded, totalBytes);
                    lastProgressAt = now;
                }
            }
        } finally {
            connection.disconnect();
        }
        emitProgress(artifactId, cancellation.get() ? "cancelled" : "downloaded", downloaded, totalBytes);
    }

    private HttpURLConnection openConnection(String source, long offset) throws Exception {
        URL url = new URL(source);
        for (int redirect = 0; redirect < 6; redirect += 1) {
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(30_000);
            connection.setReadTimeout(60_000);
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("User-Agent", "My-Mettle-MAIS/3B");
            if (offset > 0L) connection.setRequestProperty("Range", "bytes=" + offset + "-");
            connection.setInstanceFollowRedirects(false);
            int response = connection.getResponseCode();
            if (response >= 300 && response < 400) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null) throw new IOException("Model download redirect had no destination.");
                url = new URL(url, location);
                continue;
            }
            return connection;
        }
        throw new IOException("Model download exceeded the redirect limit.");
    }

    private void emitProgress(String artifactId, String state, long downloadedBytes, long totalBytes) {
        JSObject event = new JSObject();
        event.put("artifactId", artifactId);
        event.put("state", state);
        event.put("downloadedBytes", downloadedBytes);
        event.put("totalBytes", totalBytes);
        event.put("percent", totalBytes > 0L ? Math.min(100.0, downloadedBytes * 100.0 / totalBytes) : JSONObject.NULL);
        notifyListeners("modelDownloadProgress", event);
    }

    private File modelDirectory() {
        return new File(getContext().getFilesDir(), "mais-models");
    }

    private void ensureModelDirectory() throws IOException {
        File directory = modelDirectory();
        if (!directory.exists() && !directory.mkdirs()) throw new IOException("Could not create the MAIS model directory.");
    }

    private File finalFile(String fileName) {
        return new File(modelDirectory(), fileName);
    }

    private File partialFile(String fileName) {
        return new File(modelDirectory(), fileName + ".part");
    }

    private File verificationFile(String fileName) {
        return new File(modelDirectory(), fileName + ".verified.json");
    }

    private long availableBytes() {
        StatFs stats = new StatFs(modelDirectory().getAbsolutePath());
        return stats.getAvailableBytes();
    }

    private String required(PluginCall call, String key) {
        String value = call.getString(key);
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(key + " is required.");
        return value.trim();
    }

    private String optional(PluginCall call, String key) {
        String value = call.getString(key, "");
        return value == null ? "" : value.trim();
    }

    private String integrityMode(PluginCall call) {
        String mode = optional(call, "integrityMode").toLowerCase(Locale.ROOT);
        return mode.isEmpty() ? "sha256" : mode;
    }

    private void validateIntegrity(String mode, String expectedSha256) {
        if (!mode.equals("sha256") && !mode.equals("trust_on_first_use") && !mode.equals("manual")) {
            throw new IllegalArgumentException("Unsupported model integrity mode.");
        }
        if (mode.equals("sha256") && !expectedSha256.matches("[a-f0-9]{64}")) {
            throw new IllegalArgumentException("A pinned SHA-256 is required for this model.");
        }
    }

    private void verifyExpectedDigest(String mode, String expectedSha256, String actualSha256) throws IOException {
        if (mode.equals("sha256") && !actualSha256.equalsIgnoreCase(expectedSha256)) {
            throw new IOException("Model checksum verification failed.");
        }
    }

    private String safeFileName(String value) {
        if (!value.matches("[A-Za-z0-9._-]+") || value.contains("..")) {
            throw new IllegalArgumentException("Invalid model filename.");
        }
        return value;
    }

    private String sha256(File file) throws IOException, NoSuchAlgorithmException {
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

    private void writeVerification(String artifactId, String fileName, String sha256, String integrityMode, File model) throws Exception {
        JSONObject metadata = new JSONObject();
        metadata.put("artifactId", artifactId);
        metadata.put("sha256", sha256);
        metadata.put("integrityMode", integrityMode);
        metadata.put("bytes", model.length());
        metadata.put("modifiedAt", model.lastModified());
        metadata.put("verifiedAt", System.currentTimeMillis());
        try (BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(verificationFile(fileName)))) {
            output.write(metadata.toString().getBytes(StandardCharsets.UTF_8));
        }
    }

    private JSONObject readVerification(String fileName) {
        File verification = verificationFile(fileName);
        if (!verification.isFile()) return null;
        try {
            byte[] bytes = new byte[(int) Math.min(verification.length(), 64 * 1024L)];
            int count;
            try (FileInputStream input = new FileInputStream(verification)) {
                count = input.read(bytes);
            }
            if (count <= 0) return null;
            return new JSONObject(new String(bytes, 0, count, StandardCharsets.UTF_8));
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean verificationMatches(String artifactId, String expectedSha256, String integrityMode, File model, JSONObject metadata) {
        if (metadata == null) return false;
        String recordedSha = metadata.optString("sha256", "");
        boolean digestMatches = integrityMode.equals("sha256")
            ? expectedSha256.equalsIgnoreCase(recordedSha)
            : recordedSha.matches("[a-fA-F0-9]{64}");
        return artifactId.equals(metadata.optString("artifactId"))
            && digestMatches
            && model.length() == metadata.optLong("bytes", -1L)
            && model.lastModified() == metadata.optLong("modifiedAt", -1L);
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
}
