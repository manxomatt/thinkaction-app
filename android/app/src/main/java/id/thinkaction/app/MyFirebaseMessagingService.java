package id.thinkaction.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "FCM_TOKEN";
    private static final String CHANNEL_ID = "thinkaction_notifications";
    private static final String CHANNEL_NAME = "ThinkAction Notifications";
    private static final String CHANNEL_DESCRIPTION = "Notifications from ThinkAction app";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "============================================================");
        Log.d(TAG, "FCM Token received");
        Log.d(TAG, "============================================================");
        Log.d(TAG, "FCM_TOKEN: " + token);
        Log.d(TAG, "============================================================");
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "Message received from: " + remoteMessage.getFrom());
        
        if (remoteMessage.getData().size() > 0) {
            Log.d(TAG, "Message data payload: " + remoteMessage.getData());
        }

        if (remoteMessage.getNotification() != null) {
            Log.d(TAG, "Message notification body: " + remoteMessage.getNotification().getBody());
        }

        // Show notification when app is in foreground
        // Note: When app is in background, FCM automatically shows notification
        // if the message contains a "notification" payload
        String title = null;
        String body = null;

        // Get notification content from notification payload
        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }

        // If no notification payload, try to get from data payload
        if (title == null && remoteMessage.getData().containsKey("title")) {
            title = remoteMessage.getData().get("title");
        }
        if (body == null && remoteMessage.getData().containsKey("body")) {
            body = remoteMessage.getData().get("body");
        }

        // Show notification if we have content
        if (title != null || body != null) {
            sendNotification(title, body, remoteMessage.getData());
        }
    }

    /**
     * Create and show a notification
     */
    private void sendNotification(String title, String messageBody, java.util.Map<String, String> data) {
        // Create intent to open the app when notification is tapped
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        // Pass data payload to the intent
        if (data != null) {
            for (java.util.Map.Entry<String, String> entry : data.entrySet()) {
                intent.putExtra(entry.getKey(), entry.getValue());
            }
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            intent,
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        // Default notification sound
        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        // Build the notification
        NotificationCompat.Builder notificationBuilder =
            new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher) // Use app icon
                .setContentTitle(title != null ? title : "ThinkAction")
                .setContentText(messageBody != null ? messageBody : "")
                .setAutoCancel(true)
                .setSound(defaultSoundUri)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent);

        NotificationManager notificationManager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        // Create notification channel for Android O and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(CHANNEL_DESCRIPTION);
            channel.enableLights(true);
            channel.enableVibration(true);
            notificationManager.createNotificationChannel(channel);
        }

        // Show the notification with a unique ID based on current time
        int notificationId = (int) System.currentTimeMillis();
        notificationManager.notify(notificationId, notificationBuilder.build());
        
        Log.d(TAG, "Notification displayed with ID: " + notificationId);
    }
}
