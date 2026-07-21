package dev.kian.gymapp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RestTimerNotificationsPlugin.class);
        registerPlugin(MaisDeviceStatePlugin.class);
        registerPlugin(MaisModelRuntimePlugin.class);
        registerPlugin(MaisModelImportPlugin.class);
        registerPlugin(MaisReportExportPlugin.class);
        registerPlugin(MaisLiteRtRuntimePlugin.class);
        super.onCreate(savedInstanceState);
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
