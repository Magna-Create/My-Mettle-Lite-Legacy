package dev.kian.gymapp;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "MaisReportExport")
public final class MaisReportExportPlugin extends Plugin {
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final int MAX_REPORT_BYTES = 32 * 1024 * 1024;

    @PluginMethod
    public void saveReport(PluginCall call) {
        final String fileName;
        final byte[] content;
        try {
            fileName = safeFileName(required(call, "fileName"));
            content = required(call, "content").getBytes(StandardCharsets.UTF_8);
            if (content.length > MAX_REPORT_BYTES) {
                throw new IllegalArgumentException("The MAIS report is too large to export.");
            }
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
            return;
        }

        EXECUTOR.execute(() -> {
            try {
                JSObject result = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? saveWithMediaStore(fileName, content)
                    : saveToAppDocuments(fileName, content);
                call.resolve(result);
            } catch (Exception error) {
                call.reject(error.getMessage(), error);
            }
        });
    }

    private JSObject saveWithMediaStore(String fileName, byte[] content) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/My Mettle");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IllegalStateException("Android could not create the report file.");

        boolean completed = false;
        try (OutputStream output = resolver.openOutputStream(uri, "w")) {
            if (output == null) throw new IllegalStateException("Android could not open the report file.");
            output.write(content);
            output.flush();
            completed = true;
        } finally {
            if (!completed) resolver.delete(uri, null, null);
        }

        ContentValues published = new ContentValues();
        published.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, published, null, null);

        JSObject result = new JSObject();
        result.put("fileName", fileName);
        result.put("uri", uri.toString());
        result.put("bytes", content.length);
        result.put("location", "Downloads/My Mettle");
        return result;
    }

    private JSObject saveToAppDocuments(String fileName, byte[] content) throws Exception {
        File base = getContext().getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
        if (base == null) throw new IllegalStateException("Android documents storage is unavailable.");
        File directory = new File(base, "My Mettle");
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IllegalStateException("Could not create the report directory.");
        }
        File destination = new File(directory, fileName);
        try (BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(destination))) {
            output.write(content);
        }

        JSObject result = new JSObject();
        result.put("fileName", fileName);
        result.put("uri", destination.toURI().toString());
        result.put("bytes", content.length);
        result.put("location", destination.getAbsolutePath());
        return result;
    }

    private String required(PluginCall call, String key) {
        String value = call.getString(key);
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(key + " is required.");
        return value;
    }

    private String safeFileName(String value) {
        if (!value.matches("[A-Za-z0-9._-]+") || value.contains("..") || !value.endsWith(".json")) {
            throw new IllegalArgumentException("Invalid report filename.");
        }
        return value;
    }
}
