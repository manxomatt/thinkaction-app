package id.thinkaction.app;

import android.app.KeyguardManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import androidx.annotation.NonNull;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "FCM_TOKEN";
    private static final String CHANNEL_ID = "thinkaction_notifications";
    private static final String CHANNEL_NAME = "ThinkAction Notifications";
    private static final String CHANNEL_DESCRIPTION = "Notifications from ThinkAction app";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Create notification channel on app startup
        createNotificationChannel();

        // Get FCM token on app startup
        getFcmToken();

        // Enable edge-to-edge display
        // This allows the WebView to extend behind the system bars
        // and use CSS env(safe-area-inset-*) for proper spacing
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Make system bars transparent
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);
            window.setStatusBarColor(android.graphics.Color.TRANSPARENT);

            // Ensure the window draws behind system bars
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        }

        // Set light appearance for system bars (dark icons on light background)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            WindowInsetsControllerCompat windowInsetsController =
                WindowCompat.getInsetsController(window, window.getDecorView());
            if (windowInsetsController != null) {
                // Use dark icons for status bar (light background)
                windowInsetsController.setAppearanceLightStatusBars(true);
                // Use dark icons for navigation bar (light background)
                windowInsetsController.setAppearanceLightNavigationBars(true);
            }
        }

        // Listen for window insets to ensure proper layout
        // IMPORTANT: Do NOT consume the insets - let them propagate to the WebView
        // so that CSS env(safe-area-inset-*) can work properly
        View decorView = window.getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, windowInsets) -> {
            Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            // Log insets for debugging
            android.util.Log.d("SafeArea", "System bar insets - bottom: " + insets.bottom + ", top: " + insets.top);
            // Return the original insets instead of CONSUMED to allow WebView to receive them
            return windowInsets;
        });

        // Handle notification click intent if app was launched from notification
        handleNotificationIntent(getIntent());

        // Log the intent for debugging
        Intent launchIntent = getIntent();
        if (launchIntent != null) {
            Log.d(TAG, "onCreate - Intent action: " + launchIntent.getAction());
            Log.d(TAG, "onCreate - Intent flags: " + launchIntent.getFlags());
            Bundle extras = launchIntent.getExtras();
            if (extras != null) {
                Log.d(TAG, "onCreate - Intent extras:");
                for (String key : extras.keySet()) {
                    Object value = extras.get(key);
                    Log.d(TAG, "  " + key + " = " + (value != null ? value.toString() : "null"));
                }
            }
        }
    }

    /**
     * Called when the activity receives a new intent while already running
     * This handles the case when user clicks notification while app is in background
     */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);

        Log.d(TAG, "onNewIntent - Intent action: " + intent.getAction());
        Log.d(TAG, "onNewIntent - Intent flags: " + intent.getFlags());
        Bundle extras = intent.getExtras();
        if (extras != null) {
            Log.d(TAG, "onNewIntent - Intent extras:");
            for (String key : extras.keySet()) {
                Object value = extras.get(key);
                Log.d(TAG, "  " + key + " = " + (value != null ? value.toString() : "null"));
            }
        }

        handleNotificationIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        Log.d(TAG, "onResume called - app is now in foreground");
    }

    /**
     * Handle notification click intent
     * This brings the app to foreground and processes notification data
     */
    private void handleNotificationIntent(Intent intent) {
        if (intent == null) {
            return;
        }

        String action = intent.getAction();
        Bundle extras = intent.getExtras();

        // Check if this is a notification click (from our custom service or FCM default handling)
        boolean isNotificationClick = "PUSH_NOTIFICATION_CLICK".equals(action)
            || "FCM_PLUGIN_ACTIVITY".equals(action)
            || (extras != null && extras.containsKey("google.message_id"));

        if (isNotificationClick) {
            Log.d(TAG, "App opened from push notification click");
            Log.d(TAG, "Action: " + (action != null ? action : "null"));

            // Bring the app to foreground
            bringAppToForeground();

            // Log all extras from the notification
            if (extras != null) {
                Log.d(TAG, "Notification data:");
                for (String key : extras.keySet()) {
                    Object value = extras.get(key);
                    Log.d(TAG, "  " + key + " = " + (value != null ? value.toString() : "null"));
                }
            }

            // The Capacitor PushNotifications plugin will handle the pushNotificationActionPerformed event
            // which will be triggered automatically when the app processes this intent
        }
    }

    /**
     * Bring the app to foreground
     * This is called when a notification is clicked to ensure the app is visible
     */
    private void bringAppToForeground() {
        Log.d(TAG, "Bringing app to foreground...");

        // Wake up the screen if it's off
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null && !powerManager.isInteractive()) {
            Log.d(TAG, "Screen is off, waking up...");
            PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                PowerManager.FULL_WAKE_LOCK |
                PowerManager.ACQUIRE_CAUSES_WAKEUP |
                PowerManager.ON_AFTER_RELEASE,
                "ThinkAction:NotificationWakeLock"
            );
            wakeLock.acquire(3000); // Hold wake lock for 3 seconds
        }

        // Dismiss keyguard if present (for devices with lock screen)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguardManager != null) {
                keyguardManager.requestDismissKeyguard(this, null);
            }
        }

        // Ensure the window is visible
        Window window = getWindow();
        if (window != null) {
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        Log.d(TAG, "App should now be in foreground");
    }

    /**
     * Create notification channel for Android O and above
     * This ensures the channel exists before any notification is received
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(CHANNEL_DESCRIPTION);
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setShowBadge(true);

            NotificationManager notificationManager = 
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
                Log.d(TAG, "Notification channel created: " + CHANNEL_ID);
            }
        }
    }

    /**
     * Get FCM token and log it to Logcat
     */
    private void getFcmToken() {
        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful()) {
                    Log.w(TAG, "Fetching FCM registration token failed", task.getException());
                    return;
                }

                // Get new FCM registration token
                String token = task.getResult();

                // Log the token
                Log.d(TAG, "============================================================");
                Log.d(TAG, "FCM Token on App Startup");
                Log.d(TAG, "============================================================");
                Log.d(TAG, "FCM_TOKEN: " + token);
                Log.d(TAG, "============================================================");
            });
    }
}
