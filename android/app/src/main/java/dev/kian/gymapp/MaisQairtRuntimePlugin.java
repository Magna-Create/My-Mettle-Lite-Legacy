package dev.kian.gymapp;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@CapacitorPlugin(name = "MaisQairtRuntime")
public final class MaisQairtRuntimePlugin extends Plugin {
    static final String QAIRT_VERSION = "2.45.0.260326154327";
    private static final long MAX_RUNTIME_BYTES = 2L * 1024L * 1024L * 1024L;
    private static final int BUFFER_BYTES = 1024 * 1024;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final List<String> REQUIRED_ARM64 = Arrays.asList(
        "libGenie.so",
        "libQnnSystem.so",
        "libQnnHtp.so",
        "libQnnHtpPrepare.so"
    );

    @PluginMethod
    public void getStatus(PluginCall call) {
        try {
            call.resolve(status());
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    @PluginMethod
    public void pickAndImport(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/zip");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
            "application/zip",
            "application/x-zip-compressed",
            "application/octet-stream"
        });
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivityForResult(call, intent, "pickRuntimeResult");
    }

    @ActivityCallback
    private void pickRuntimeResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("QAIRT runtime import cancelled.");
            return;
        }
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        if (uri == null) {
            call.reject("No QAIRT runtime archive was selected.");
            return;
        }

        EXECUTOR.execute(() -> {
            File staging = new File(runtimeRoot(), QAIRT_VERSION + ".importing");
            try {
                deleteRecursively(staging);
                File stagingArm64 = new File(staging, "arm64");
                File stagingHexagon = new File(staging, "hexagon");
                ensureDirectory(stagingArm64);
                ensureDirectory(stagingHexagon);

                ContentResolver resolver = getContext().getContentResolver();
                long extractedBytes = extractRuntime(resolver, uri, stagingArm64, stagingHexagon);
                RuntimeInventory inventory = inventory(stagingArm64, stagingHexagon);
                validateInventory(inventory);
                writeManifest(staging, inventory, extractedBytes);

                File destination = runtimeDirectory();
                deleteRecursively(destination);
                ensureDirectory(runtimeRoot());
                if (!staging.renameTo(destination)) {
                    throw new IOException("Could not atomically install the QAIRT runtime.");
                }
                call.resolve(status());
            } catch (Exception error) {
                try {
                    deleteRecursively(staging);
                } catch (Exception ignored) {
                    // Best-effort cleanup after a failed import.
                }
                call.reject(error.getMessage(), error);
            }
        });
    }

    @PluginMethod
    public void deleteRuntime(PluginCall call) {
        EXECUTOR.execute(() -> {
            try {
                deleteRecursively(runtimeDirectory());
                call.resolve(status());
            } catch (Exception error) {
                call.reject(error.getMessage(), error);
            }
        });
    }

    private long extractRuntime(
        ContentResolver resolver,
        Uri uri,
        File arm64Directory,
        File hexagonDirectory
    ) throws Exception {
        long total = 0L;
        try (
            InputStream raw = resolver.openInputStream(uri);
            ZipInputStream zip = raw == null ? null : new ZipInputStream(new BufferedInputStream(raw, BUFFER_BYTES))
        ) {
            if (zip == null) throw new IOException("The selected QAIRT archive could not be opened.");
            byte[] buffer = new byte[BUFFER_BYTES];
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.isDirectory()) continue;
                String fileName = new File(entry.getName()).getName();
                if (!isAllowedLibrary(fileName)) continue;
                File destination = new File(fileName.contains("Skel") ? hexagonDirectory : arm64Directory, fileName);
                long written = 0L;
                try (BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(destination), BUFFER_BYTES)) {
                    int count;
                    while ((count = zip.read(buffer)) >= 0) {
                        written += count;
                        total += count;
                        if (total > MAX_RUNTIME_BYTES) throw new IOException("The QAIRT runtime archive exceeds the 2 GB safety limit.");
                        output.write(buffer, 0, count);
                    }
                }
                if (written == 0L) throw new IOException(fileName + " was empty in the QAIRT runtime archive.");
                destination.setReadable(true, true);
                destination.setExecutable(true, true);
            }
        }
        return total;
    }

    private boolean isAllowedLibrary(String fileName) {
        if (!fileName.matches("[A-Za-z0-9._-]+\\.so")) return false;
        if (fileName.equals("libGenie.so")) return true;
        return fileName.startsWith("libQnn");
    }

    static File runtimeRoot(File filesDirectory) {
        return new File(filesDirectory, "mais-qairt");
    }

    static File runtimeDirectory(File filesDirectory) {
        return new File(runtimeRoot(filesDirectory), QAIRT_VERSION);
    }

    static File arm64Directory(File filesDirectory) {
        return new File(runtimeDirectory(filesDirectory), "arm64");
    }

    static File hexagonDirectory(File filesDirectory) {
        return new File(runtimeDirectory(filesDirectory), "hexagon");
    }

    private File runtimeRoot() {
        return runtimeRoot(getContext().getFilesDir());
    }

    private File runtimeDirectory() {
        return runtimeDirectory(getContext().getFilesDir());
    }

    private File arm64Directory() {
        return arm64Directory(getContext().getFilesDir());
    }

    private File hexagonDirectory() {
        return hexagonDirectory(getContext().getFilesDir());
    }

    private JSObject status() throws Exception {
        RuntimeInventory inventory = inventory(arm64Directory(), hexagonDirectory());
        List<String> missing = missingLibraries(inventory);
        JSArray arm64 = new JSArray();
        for (String file : inventory.arm64Files) arm64.put(file);
        JSArray hexagon = new JSArray();
        for (String file : inventory.hexagonFiles) hexagon.put(file);
        JSArray missingArray = new JSArray();
        for (String file : missing) missingArray.put(file);

        JSObject result = new JSObject();
        result.put("version", QAIRT_VERSION);
        result.put("installed", runtimeDirectory().isDirectory());
        result.put("ready", missing.isEmpty() && MaisGenieXNative.isLoaded());
        result.put("bridgeLoaded", MaisGenieXNative.isLoaded());
        result.put("bridgeError", MaisGenieXNative.loadError() == null ? JSONObject.NULL : MaisGenieXNative.loadError());
        result.put("arm64Directory", arm64Directory().getAbsolutePath());
        result.put("hexagonDirectory", hexagonDirectory().getAbsolutePath());
        result.put("arm64Files", arm64);
        result.put("hexagonFiles", hexagon);
        result.put("missing", missingArray);
        result.put("bytes", inventory.bytes);
        return result;
    }

    private RuntimeInventory inventory(File arm64Directory, File hexagonDirectory) {
        List<String> arm64 = listLibraries(arm64Directory);
        List<String> hexagon = listLibraries(hexagonDirectory);
        long bytes = directoryBytes(arm64Directory) + directoryBytes(hexagonDirectory);
        return new RuntimeInventory(arm64, hexagon, bytes);
    }

    private List<String> listLibraries(File directory) {
        File[] files = directory.listFiles((parent, name) -> name.endsWith(".so"));
        if (files == null) return Collections.emptyList();
        List<String> names = new ArrayList<>();
        for (File file : files) if (file.isFile()) names.add(file.getName());
        Collections.sort(names);
        return names;
    }

    private long directoryBytes(File directory) {
        File[] files = directory.listFiles();
        if (files == null) return 0L;
        long total = 0L;
        for (File file : files) if (file.isFile()) total += file.length();
        return total;
    }

    private List<String> missingLibraries(RuntimeInventory inventory) {
        List<String> missing = new ArrayList<>();
        for (String required : REQUIRED_ARM64) {
            if (!inventory.arm64Files.contains(required)) missing.add(required);
        }
        boolean hasStub = inventory.arm64Files.stream().anyMatch(name -> name.matches("libQnnHtpV[0-9]+.*Stub\\.so"));
        boolean hasSkel = inventory.hexagonFiles.stream().anyMatch(name -> name.matches("libQnnHtpV[0-9]+.*Skel\\.so"));
        if (!hasStub) missing.add("libQnnHtpVxxStub.so");
        if (!hasSkel) missing.add("libQnnHtpVxxSkel.so");
        return missing;
    }

    private void validateInventory(RuntimeInventory inventory) throws IOException {
        List<String> missing = missingLibraries(inventory);
        if (!missing.isEmpty()) {
            throw new IOException("The QAIRT archive is incomplete. Missing: " + String.join(", ", missing) + ".");
        }
    }

    private void writeManifest(File directory, RuntimeInventory inventory, long extractedBytes) throws Exception {
        JSONObject manifest = new JSONObject();
        manifest.put("qairtVersion", QAIRT_VERSION);
        manifest.put("importedAtEpochMs", System.currentTimeMillis());
        manifest.put("extractedBytes", extractedBytes);
        manifest.put("arm64Files", new JSONArray(inventory.arm64Files));
        manifest.put("hexagonFiles", new JSONArray(inventory.hexagonFiles));
        try (BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(new File(directory, "manifest.json")))) {
            output.write(manifest.toString(2).getBytes(StandardCharsets.UTF_8));
        }
    }

    private void ensureDirectory(File directory) throws IOException {
        if (!directory.exists() && !directory.mkdirs()) throw new IOException("Could not create " + directory.getAbsolutePath() + ".");
    }

    private void deleteRecursively(File file) throws IOException {
        if (!file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteRecursively(child);
        }
        if (!file.delete()) throw new IOException("Could not delete " + file.getAbsolutePath() + ".");
    }

    private static final class RuntimeInventory {
        final List<String> arm64Files;
        final List<String> hexagonFiles;
        final long bytes;

        RuntimeInventory(List<String> arm64Files, List<String> hexagonFiles, long bytes) {
            this.arm64Files = arm64Files;
            this.hexagonFiles = hexagonFiles;
            this.bytes = bytes;
        }
    }
}
