package dev.kian.gymapp;

import android.content.Context;
import android.content.res.AssetManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "MaisQairtRuntime")
public final class MaisQairtRuntimePlugin extends Plugin {
    static final String QAIRT_VERSION = "2.45.0.260326154327";
    private static final String ASSET_ROOT = "qairt";
    private static final String HEXAGON_ASSET_DIRECTORY = ASSET_ROOT + "/hexagon";
    private static final String ASSET_MANIFEST = ASSET_ROOT + "/qairt-runtime.json";
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
        EXECUTOR.execute(() -> {
            try {
                ensurePackagedHexagonAssets();
                call.resolve(status());
            } catch (Exception error) {
                call.reject(rootMessage(error), error);
            }
        });
    }

    static File arm64Directory(Context context) {
        String nativeLibraryDirectory = context.getApplicationInfo().nativeLibraryDir;
        return nativeLibraryDirectory == null ? new File("") : new File(nativeLibraryDirectory);
    }

    static File runtimeRoot(File filesDirectory) {
        return new File(filesDirectory, "mais-qairt");
    }

    static File runtimeDirectory(File filesDirectory) {
        return new File(runtimeRoot(filesDirectory), QAIRT_VERSION);
    }

    static File hexagonDirectory(File filesDirectory) {
        return new File(runtimeDirectory(filesDirectory), "hexagon");
    }

    private File arm64Directory() {
        return arm64Directory(getContext());
    }

    private File runtimeDirectory() {
        return runtimeDirectory(getContext().getFilesDir());
    }

    private File hexagonDirectory() {
        return hexagonDirectory(getContext().getFilesDir());
    }

    private File privateManifestFile() {
        return new File(runtimeDirectory(), "qairt-runtime.json");
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

        boolean packaged = new File(arm64Directory(), "libGenie.so").isFile() || assetManifestAvailable();
        JSObject result = new JSObject();
        result.put("version", QAIRT_VERSION);
        result.put("source", "apk-build-assets");
        result.put("installed", packaged);
        result.put("ready", missing.isEmpty() && MaisGenieXNative.isLoaded());
        result.put("bridgeLoaded", MaisGenieXNative.isLoaded());
        result.put(
            "bridgeError",
            MaisGenieXNative.loadError() == null ? JSONObject.NULL : MaisGenieXNative.loadError()
        );
        result.put("arm64Directory", arm64Directory().getAbsolutePath());
        result.put("hexagonDirectory", hexagonDirectory().getAbsolutePath());
        result.put("arm64Files", arm64);
        result.put("hexagonFiles", hexagon);
        result.put("missing", missingArray);
        result.put("bytes", inventory.bytes);
        return result;
    }

    private void ensurePackagedHexagonAssets() throws Exception {
        String manifest = readAssetText(ASSET_MANIFEST);
        if (manifest == null) return;

        File runtime = runtimeDirectory();
        File destination = hexagonDirectory();
        File privateManifest = privateManifestFile();
        String existingManifest = privateManifest.isFile() ? readFileText(privateManifest) : null;
        if (manifest.equals(existingManifest) && containsHexagonSkeleton(destination)) return;

        // Migrate away from the earlier runtime-import prototype. ARM64 executable
        // code now comes exclusively from the APK native library directory.
        deleteRecursively(new File(runtime, "arm64"));
        deleteRecursively(destination);
        ensureDirectory(destination);

        AssetManager assets = getContext().getAssets();
        String[] names = assets.list(HEXAGON_ASSET_DIRECTORY);
        if (names == null || names.length == 0) {
            throw new IOException("The APK contains a QAIRT manifest but no Hexagon runtime assets.");
        }
        Arrays.sort(names);
        for (String name : names) {
            if (!name.matches("libQnn[A-Za-z0-9._-]+\\.so")) continue;
            File output = new File(destination, name);
            try (
                InputStream input = new BufferedInputStream(
                    assets.open(HEXAGON_ASSET_DIRECTORY + "/" + name),
                    BUFFER_BYTES
                );
                BufferedOutputStream target = new BufferedOutputStream(
                    new FileOutputStream(output),
                    BUFFER_BYTES
                )
            ) {
                byte[] buffer = new byte[BUFFER_BYTES];
                int count;
                long written = 0L;
                while ((count = input.read(buffer)) >= 0) {
                    if (count == 0) continue;
                    target.write(buffer, 0, count);
                    written += count;
                }
                if (written == 0L) throw new IOException(name + " is empty in the APK assets.");
            }
            output.setReadable(true, true);
        }
        if (!containsHexagonSkeleton(destination)) {
            throw new IOException("The APK does not contain a Hexagon HTP skeleton for Snapdragon 8 Elite.");
        }
        ensureDirectory(runtime);
        writeText(privateManifest, manifest);
    }

    private boolean assetManifestAvailable() {
        try {
            return readAssetText(ASSET_MANIFEST) != null;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean containsHexagonSkeleton(File directory) {
        File[] matches = directory.listFiles(
            (parent, name) -> name.matches("libQnnHtpV[0-9]+.*Skel\\.so")
        );
        return matches != null && matches.length > 0;
    }

    private RuntimeInventory inventory(File arm64Directory, File hexagonDirectory) {
        List<String> arm64 = listLibraries(arm64Directory);
        List<String> hexagon = listLibraries(hexagonDirectory);
        long bytes = selectedArm64Bytes(arm64Directory) + directoryBytes(hexagonDirectory);
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

    private long selectedArm64Bytes(File directory) {
        File[] files = directory.listFiles(
            (parent, name) -> name.equals("libGenie.so") || name.startsWith("libQnn")
        );
        if (files == null) return 0L;
        long total = 0L;
        for (File file : files) if (file.isFile()) total += file.length();
        return total;
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
        boolean hasStub = false;
        for (String name : inventory.arm64Files) {
            if (name.matches("libQnnHtpV[0-9]+.*Stub\\.so")) {
                hasStub = true;
                break;
            }
        }
        boolean hasSkel = false;
        for (String name : inventory.hexagonFiles) {
            if (name.matches("libQnnHtpV[0-9]+.*Skel\\.so")) {
                hasSkel = true;
                break;
            }
        }
        if (!hasStub) missing.add("libQnnHtpVxxStub.so");
        if (!hasSkel) missing.add("libQnnHtpVxxSkel.so");
        return missing;
    }

    private String readAssetText(String path) throws Exception {
        try (
            InputStream input = new BufferedInputStream(getContext().getAssets().open(path));
            ByteArrayOutputStream output = new ByteArrayOutputStream()
        ) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) >= 0) {
                if (count > 0) output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        } catch (IOException missing) {
            return null;
        }
    }

    private String readFileText(File file) throws Exception {
        try (
            InputStream input = new BufferedInputStream(new FileInputStream(file));
            ByteArrayOutputStream output = new ByteArrayOutputStream()
        ) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) >= 0) {
                if (count > 0) output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private void writeText(File file, String value) throws Exception {
        try (BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(file))) {
            output.write(value.getBytes(StandardCharsets.UTF_8));
        }
    }

    private void ensureDirectory(File directory) throws IOException {
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("Could not create " + directory.getAbsolutePath() + ".");
        }
    }

    private void deleteRecursively(File file) throws IOException {
        if (!file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) deleteRecursively(child);
            }
        }
        if (!file.delete()) throw new IOException("Could not delete " + file.getAbsolutePath() + ".");
    }

    private String rootMessage(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null) current = current.getCause();
        String message = current.getMessage();
        return message == null || message.trim().isEmpty()
            ? current.getClass().getSimpleName()
            : message;
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
