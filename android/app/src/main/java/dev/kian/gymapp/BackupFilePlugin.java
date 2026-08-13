package dev.kian.gymapp;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@CapacitorPlugin(name = "BackupFile")
public class BackupFilePlugin extends Plugin {
    private static final String STAGING_DIRECTORY = "backup-staging";
    private static final long STAGING_MAX_AGE_MS = 60L * 60L * 1000L;

    @PluginMethod
    public void stageJson(PluginCall call) {
        String content = call.getString("content");
        if (content == null) {
            call.reject("Backup content is missing.");
            return;
        }

        File directory = stagingDirectory();
        if (!directory.exists() && !directory.mkdirs()) {
            call.reject("The backup staging directory could not be created.");
            return;
        }
        cleanOldStagedFiles(directory);

        String token = UUID.randomUUID().toString();
        File staged = new File(directory, token + ".json");
        try (BufferedWriter writer = new BufferedWriter(
            new OutputStreamWriter(new FileOutputStream(staged, false), StandardCharsets.UTF_8)
        )) {
            writer.write(content);
            writer.flush();

            JSObject result = new JSObject();
            result.put("token", token);
            result.put("sizeBytes", staged.length());
            call.resolve(result);
        } catch (Exception exception) {
            staged.delete();
            call.reject("The JSON backup could not be staged.", exception);
        }
    }

    @PluginMethod
    public void saveStaged(PluginCall call) {
        String filename = call.getString("filename");
        String token = call.getString("token");
        if (filename == null || filename.trim().isEmpty()) {
            call.reject("Backup filename is missing.");
            return;
        }
        if (!isValidToken(token)) {
            call.reject("Backup staging token is invalid.");
            return;
        }

        File staged = stagedFile(token);
        if (!staged.isFile()) {
            call.reject("The staged backup is no longer available.");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("application/json")
            .putExtra(Intent.EXTRA_TITLE, filename)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        startActivityForResult(call, intent, "saveStagedResult");
    }

    @ActivityCallback
    private void saveStagedResult(PluginCall call, ActivityResult activityResult) {
        String token = call.getString("token");
        File staged = isValidToken(token) ? stagedFile(token) : null;

        if (activityResult.getResultCode() != Activity.RESULT_OK) {
            deleteStaged(staged);
            JSObject result = new JSObject();
            result.put("saved", false);
            call.resolve(result);
            return;
        }

        Intent data = activityResult.getData();
        Uri uri = data == null ? null : data.getData();
        if (uri == null) {
            deleteStaged(staged);
            call.reject("Android did not return a backup destination.");
            return;
        }
        if (staged == null || !staged.isFile()) {
            call.reject("The staged backup disappeared before it could be saved.");
            return;
        }

        try (
            BufferedInputStream input = new BufferedInputStream(new FileInputStream(staged));
            OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")
        ) {
            if (output == null) {
                call.reject("The selected backup destination could not be opened.");
                return;
            }

            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            output.flush();

            JSObject result = new JSObject();
            result.put("saved", true);
            result.put("uri", uri.toString());
            result.put("sizeBytes", staged.length());
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("The JSON backup could not be written.", exception);
        } finally {
            deleteStaged(staged);
        }
    }

    private File stagingDirectory() {
        return new File(getContext().getCacheDir(), STAGING_DIRECTORY);
    }

    private File stagedFile(String token) {
        return new File(stagingDirectory(), token + ".json");
    }

    private static boolean isValidToken(String token) {
        if (token == null) return false;
        try {
            return UUID.fromString(token).toString().equalsIgnoreCase(token);
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private static void deleteStaged(File staged) {
        if (staged != null && staged.exists()) staged.delete();
    }

    private static void cleanOldStagedFiles(File directory) {
        File[] files = directory.listFiles();
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - STAGING_MAX_AGE_MS;
        for (File file : files) {
            if (file.isFile() && file.lastModified() < cutoff) file.delete();
        }
    }
}
