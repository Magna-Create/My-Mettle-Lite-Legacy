package dev.kian.gymapp;

import android.content.Context;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "MaisQairtRuntime")
public final class MaisQairtRuntimePlugin extends Plugin {
    static final String QAIRT_VERSION = "2.45.0.260326154327";
    private static final String ASSET_MANIFEST = "qairt/qairt-runtime.json";
    private static volatile File cachedNativeDirectory;
    private static final List<String> REQUIRED_HOST_LIBRARIES = Arrays.asList(
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
            call.reject(rootMessage(error), error);
        }
    }

    static File arm64Directory(Context context) {
        String nativeLibraryDirectory = context.getApplicationInfo().nativeLibraryDir;
        File resolved = nativeLibraryDirectory == null ? new File("") : new File(nativeLibraryDirectory);
        cachedNativeDirectory = resolved;
        return resolved;
    }

    static File hexagonDirectory(Context context) {
        // Qualcomm's Android ChatApp packages the HTP skeletons into the same
        // arm64-v8a native source set and enables legacy extraction. The DSP
        // loader receives this extracted filesystem directory through
        // ADSP_LIBRARY_PATH.
        return arm64Directory(context);
    }

    static File hexagonDirectory(File ignoredLegacyFilesDirectory) {
        // Compatibility overload for the first Genie adapter revision. Every
        // native run resolves arm64Directory(Context) immediately before this
        // method, so the same PackageManager-controlled directory is reused.
        File resolved = cachedNativeDirectory;
        if (resolved == null) {
            throw new IllegalStateException("The APK native library directory has not been resolved.");
        }
        return resolved;
    }

    private JSObject status() {
        File nativeDirectory = arm64Directory(getContext());
        RuntimeInventory inventory = inventory(nativeDirectory);
        List<String> missing = missingLibraries(inventory);

        JSArray arm64 = new JSArray();
        for (String file : inventory.hostFiles) arm64.put(file);
        JSArray hexagon = new JSArray();
        for (String file : inventory.skeletonFiles) hexagon.put(file);
        JSArray missingArray = new JSArray();
        for (String file : missing) missingArray.put(file);

        boolean packaged = assetManifestAvailable() || !inventory.hostFiles.isEmpty() || !inventory.skeletonFiles.isEmpty();
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
        result.put("arm64Directory", nativeDirectory.getAbsolutePath());
        result.put("hexagonDirectory", nativeDirectory.getAbsolutePath());
        result.put("arm64Files", arm64);
        result.put("hexagonFiles", hexagon);
        result.put("missing", missingArray);
        result.put("bytes", inventory.bytes);
        return result;
    }

    private RuntimeInventory inventory(File directory) {
        File[] files = directory.listFiles((parent, name) -> name.endsWith(".so"));
        if (files == null) return new RuntimeInventory(Collections.emptyList(), Collections.emptyList(), 0L);

        List<String> host = new ArrayList<>();
        List<String> skeletons = new ArrayList<>();
        long bytes = 0L;
        for (File file : files) {
            if (!file.isFile()) continue;
            String name = file.getName();
            if (name.equals("libGenie.so") || name.startsWith("libQnn")) bytes += file.length();
            if (name.matches("libQnnHtpV[0-9]+.*Skel\\.so")) {
                skeletons.add(name);
            } else if (name.equals("libGenie.so") || name.startsWith("libQnn")) {
                host.add(name);
            }
        }
        Collections.sort(host);
        Collections.sort(skeletons);
        return new RuntimeInventory(host, skeletons, bytes);
    }

    private List<String> missingLibraries(RuntimeInventory inventory) {
        List<String> missing = new ArrayList<>();
        for (String required : REQUIRED_HOST_LIBRARIES) {
            if (!inventory.hostFiles.contains(required)) missing.add(required);
        }

        boolean hasStub = false;
        for (String name : inventory.hostFiles) {
            if (name.matches("libQnnHtpV[0-9]+.*Stub\\.so")) {
                hasStub = true;
                break;
            }
        }
        if (!hasStub) missing.add("libQnnHtpVxxStub.so");
        if (inventory.skeletonFiles.isEmpty()) missing.add("libQnnHtpVxxSkel.so");
        return missing;
    }

    private boolean assetManifestAvailable() {
        try (InputStream ignored = getContext().getAssets().open(ASSET_MANIFEST)) {
            return true;
        } catch (IOException missing) {
            return false;
        }
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
        final List<String> hostFiles;
        final List<String> skeletonFiles;
        final long bytes;

        RuntimeInventory(List<String> hostFiles, List<String> skeletonFiles, long bytes) {
            this.hostFiles = hostFiles;
            this.skeletonFiles = skeletonFiles;
            this.bytes = bytes;
        }
    }
}
