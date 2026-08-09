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

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "BackupFile")
public class BackupFilePlugin extends Plugin {
    @PluginMethod
    public void saveJson(PluginCall call) {
        String filename = call.getString("filename");
        String content = call.getString("content");
        if (filename == null || filename.isBlank()) {
            call.reject("Backup filename is missing.");
            return;
        }
        if (content == null) {
            call.reject("Backup content is missing.");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("application/json")
            .putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "saveJsonResult");
    }

    @ActivityCallback
    private void saveJsonResult(PluginCall call, ActivityResult activityResult) {
        if (activityResult.getResultCode() != Activity.RESULT_OK) {
            JSObject result = new JSObject();
            result.put("saved", false);
            call.resolve(result);
            return;
        }

        Intent data = activityResult.getData();
        Uri uri = data == null ? null : data.getData();
        if (uri == null) {
            call.reject("Android did not return a backup destination.");
            return;
        }

        String content = call.getString("content", "");
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "w")) {
            if (stream == null) {
                call.reject("The selected backup destination could not be opened.");
                return;
            }
            stream.write(content.getBytes(StandardCharsets.UTF_8));
            stream.flush();
            JSObject result = new JSObject();
            result.put("saved", true);
            result.put("uri", uri.toString());
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("The JSON backup could not be written.", exception);
        }
    }
}
