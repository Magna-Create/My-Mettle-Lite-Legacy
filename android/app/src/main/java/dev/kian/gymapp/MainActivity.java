package dev.kian.gymapp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import java.io.File;

public class MainActivity extends BridgeActivity {
    private static final String RETIRED_E4B_FILE = "gemma-4-E4B-it.litertlm";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        removeRetiredGemmaE4B();
        registerPlugin(RestTimerNotificationsPlugin.class);
        registerPlugin(MaisDeviceStatePlugin.class);
        registerPlugin(MaisModelRuntimePlugin.class);
        registerPlugin(MaisModelImportPlugin.class);
        registerPlugin(MaisReportExportPlugin.class);
        registerPlugin(MaisLiteRtRuntimePlugin.class);
        registerPlugin(MaisEmbeddingRuntimePlugin.class);
        super.onCreate(savedInstanceState);
    }

    private void removeRetiredGemmaE4B() {
        File modelDirectory = new File(getFilesDir(), "mais-models");
        deleteIfPresent(new File(modelDirectory, RETIRED_E4B_FILE));
        deleteIfPresent(new File(modelDirectory, RETIRED_E4B_FILE + ".part"));
        deleteIfPresent(new File(modelDirectory, RETIRED_E4B_FILE + ".verified.json"));
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
