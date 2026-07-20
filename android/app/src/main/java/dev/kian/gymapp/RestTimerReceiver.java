package dev.kian.gymapp;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class RestTimerReceiver extends BroadcastReceiver {
    public static final String ACTION_REST_COMPLETE = "dev.kian.gymapp.REST_COMPLETE";
    public static final int NOTIFICATION_ID = 2207;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_REST_COMPLETE.equals(intent.getAction()) || AppVisibility.isForeground()) return;

        String exerciseName = intent.getStringExtra("exerciseName");
        String strength = intent.getStringExtra("vibrationStrength");
        boolean vibrationEnabled = intent.getBooleanExtra("vibrationEnabled", true);
        boolean chimeEnabled = intent.getBooleanExtra("chimeEnabled", false);
        String channelId = channelId(strength, vibrationEnabled, chimeEnabled);
        createChannel(context, channelId, strength, vibrationEnabled, chimeEnabled);

        Intent launchIntent = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            context, 2207, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Rest complete")
            .setContentText(exerciseName == null || exerciseName.isEmpty()
                ? "Ready for the next set."
                : exerciseName + " · ready for the next set")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .setTimeoutAfter(120000L);

        if (vibrationEnabled && Build.VERSION.SDK_INT < Build.VERSION_CODES.O) builder.setVibrate(pattern(strength));
        if (chimeEnabled && Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));
        }

        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException ignored) {
            // Notification permission may not yet be granted.
        }
    }

    private static String channelId(String strength, boolean vibration, boolean chime) {
        return "rest_timer_" + (strength == null ? "strong" : strength) + "_" + vibration + "_" + chime;
    }

    private static long[] pattern(String strength) {
        if ("low".equals(strength)) return new long[] {0, 180, 120, 220};
        if ("medium".equals(strength)) return new long[] {0, 300, 120, 350};
        if ("very_strong".equals(strength)) return new long[] {0, 650, 100, 650, 100, 900};
        return new long[] {0, 480, 110, 520, 110, 700};
    }

    private static void createChannel(Context context, String channelId, String strength, boolean vibration, boolean chime) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager.getNotificationChannel(channelId) != null) return;

        NotificationChannel channel = new NotificationChannel(channelId, "Workout rest timers", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Rest completion alerts from My Mettle");
        channel.enableVibration(vibration);
        if (vibration) channel.setVibrationPattern(pattern(strength));
        if (chime) {
            AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), attributes);
        } else {
            channel.setSound(null, null);
        }
        manager.createNotificationChannel(channel);
    }
}