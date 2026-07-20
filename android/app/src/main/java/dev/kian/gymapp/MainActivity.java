package dev.kian.gymapp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RestTimerNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        AppVisibility.setForeground(true);
    }

    @Override
    protected void onPause() {
        AppVisibility.setForeground(false);
        super.onPause();
    }
}