package dev.kian.gymapp;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RestTimerNotifications")
public class RestTimerNotificationsPlugin extends Plugin {
    private static final int REQUEST_NOTIFICATIONS = 4931;
    private static final int ALARM_REQUEST_CODE = 2207;

    @PluginMethod
    public void schedule(PluginCall call) {
        long endsAt = call.getLong("endsAt", 0L);
        if (endsAt <= System.currentTimeMillis()) {
            call.reject("Timer deadline must be in the future.");
            return;
        }

        Intent intent = new Intent(getContext(), RestTimerReceiver.class)
            .setAction(RestTimerReceiver.ACTION_REST_COMPLETE)
            .putExtra("exerciseName", call.getString("exerciseName", ""))
            .putExtra("vibrationStrength", call.getString("vibrationStrength", "strong"))
            .putExtra("vibrationEnabled", call.getBoolean("vibrationEnabled", true))
            .putExtra("chimeEnabled", call.getBoolean("chimeEnabled", false));
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            getContext(), ALARM_REQUEST_CODE, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager manager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && manager.canScheduleExactAlarms()) {
                manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pendingIntent);
            } else if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pendingIntent);
            } else {
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pendingIntent);
            }
            call.resolve();
        } catch (SecurityException exception) {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pendingIntent);
            call.resolve();
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Intent intent = new Intent(getContext(), RestTimerReceiver.class)
            .setAction(RestTimerReceiver.ACTION_REST_COMPLETE);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            getContext(), ALARM_REQUEST_CODE, intent, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (pendingIntent != null) {
            AlarmManager manager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            manager.cancel(pendingIntent);
            pendingIntent.cancel();
        }
        NotificationManagerCompat.from(getContext()).cancel(RestTimerReceiver.NOTIFICATION_ID);
        call.resolve();
    }

    @PluginMethod
    public void requestTimerPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && !NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            ActivityCompat.requestPermissions(
                getActivity(), new String[] { Manifest.permission.POST_NOTIFICATIONS }, REQUEST_NOTIFICATIONS
            );
        }

        AlarmManager manager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                .setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
        }

        JSObject result = new JSObject();
        result.put("exactAlarm", Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms());
        result.put("notifications", Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        call.resolve(result);
    }
}