package dev.kian.gymapp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import java.io.File;

public class MainActivity extends BridgeActivity {
    private static final String RETIRED_E4B_FILE = "gemma-4-E4B-it.litertlm";
    private static final String RETIRED_EMBEDDING_AOT_FILE = "embeddinggemma-300M_seq512_mixed-precision.qualcomm.sm8750.tflite";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        removeRetiredModelFiles();
        registerPlugin(RestTimerNotificationsPlugin.class);
        registerPlugin(MaisDeviceStatePlugin.class);
        registerPlugin(MaisHealthConnectPlugin.class);
        registerPlugin(MaisModelRuntimePlugin.class);
        registerPlugin(MaisModelImportPlugin.class);
        registerPlugin(MaisReportExportPlugin.class);
        registerPlugin(MaisLiteRtRuntimePlugin.class);
        registerPlugin(MaisEmbeddingRuntimePlugin.class);
        registerPlugin(MaisQairtRuntimePlugin.class);
        registerPlugin(MaisGenieXRuntimePlugin.class);
        super.onCreate(savedInstanceState);
    }

    private void removeRetiredModelFiles() {
        File modelDirectory = new File(getFilesDir(), "mais-models");
        removeArtifactFiles(modelDirectory, RETIRED_E4B_FILE);
        removeArtifactFiles(modelDirectory, RETIRED_EMBEDDING_AOT_FILE);
    }

    private void removeArtifactFiles(File modelDirectory, String fileName) {
        deleteIfPresent(new File(modelDirectory, fileName));
        deleteIfPresent(new File(modelDirectory, fileName + ".part"));
        deleteIfPresent(new File(modelDirectory, fileName + ".verified.json"));
    }

    private void deleteIfPresent(File file) {
        if (file.exists() && !file.delete()) file.deleteOnExit();
    }

    @Override
    public void onResume() {
        super.onResume();
        AppVisibility.setForeground(true);
        MaisDeviceStatePlugin.notifyVisibilityChanged();
    }

    @Override
    public void onPause() {
        AppVisibility.setForeground(false);
        MaisDeviceStatePlugin.notifyVisibilityChanged();
        super.onPause();
    }
}
