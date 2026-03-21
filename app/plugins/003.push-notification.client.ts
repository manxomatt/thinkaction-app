import { defineNuxtPlugin } from '#app';
import { Capacitor } from '@capacitor/core';

// Global state for FCM token that can be accessed from anywhere
let _fcmToken: string | null = null;
let _tokenCallbacks: Array<(token: string) => void> = [];

/**
 * Get the current FCM token
 */
export function getFcmToken(): string | null {
  return _fcmToken;
}

/**
 * Subscribe to FCM token updates
 * Returns unsubscribe function
 */
export function onFcmTokenChange(callback: (token: string) => void): () => void {
  _tokenCallbacks.push(callback);
  // If token already exists, call callback immediately
  if (_fcmToken) {
    callback(_fcmToken);
  }
  return () => {
    _tokenCallbacks = _tokenCallbacks.filter(cb => cb !== callback);
  };
}

/**
 * Push Notification Plugin for Capacitor
 *
 * This plugin automatically initializes Firebase Cloud Messaging (FCM) push notifications
 * for Android and APNs for iOS when the app starts.
 *
 * The plugin will:
 * 1. Request notification permissions automatically
 * 2. Register for push notifications
 * 3. Store the FCM token globally
 *
 * SETUP REQUIRED:
 * 1. Add google-services.json to android/app/ (from Firebase Console)
 * 2. Add GoogleService-Info.plist to ios/App/App/ (from Firebase Console)
 * 3. Run `npx cap sync` after adding the files
 *
 * See docs/firebase-push-notification-setup.md for detailed instructions.
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  // Only run on native platforms
  if (!Capacitor.isNativePlatform()) {
    console.log('[PushNotification] Skipping - not running on native platform');
    return {
      provide: {
        pushNotification: {
          fcmToken: null as string | null,
          isSupported: false,
        },
      },
    };
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Set up listeners FIRST before registering
    await PushNotifications.addListener('registration', (token) => {
      console.log('='.repeat(60));
      console.log('[PushNotification] FCM Token received');
      console.log('='.repeat(60));
      console.log('FCM_TOKEN:', token.value);
      console.log('='.repeat(60));
      _fcmToken = token.value;
      // Notify all subscribers
      _tokenCallbacks.forEach(cb => cb(token.value));
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNotification] Registration error:', error.error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushNotification] Notification received in foreground:', notification);
      // Notification received while app is in foreground
      // You can show an in-app notification here
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[PushNotification] Notification action performed:', action);
      // User tapped on the notification
      // Navigate to relevant screen based on notification data
      const data = action.notification.data;
      if (data) {
        console.log('[PushNotification] Notification data:', data);
        // Handle navigation based on notification type
        // Example: if (data.goalId) navigateTo(`/goals/${data.goalId}`);
      }
    });

    // Check current permission status
    let permissionStatus = await PushNotifications.checkPermissions();
    console.log('[PushNotification] Current permission status:', permissionStatus.receive);

    // Request permission if not granted yet
    if (permissionStatus.receive === 'prompt' || permissionStatus.receive === 'prompt-with-rationale') {
      console.log('[PushNotification] Requesting permission...');
      permissionStatus = await PushNotifications.requestPermissions();
      console.log('[PushNotification] Permission result:', permissionStatus.receive);
    }

    // Register for push notifications if permission is granted
    if (permissionStatus.receive === 'granted') {
      console.log('[PushNotification] Permission granted, registering for push notifications...');
      await PushNotifications.register();
      console.log('[PushNotification] Registration initiated');
    } else {
      console.log('[PushNotification] Permission denied:', permissionStatus.receive);
    }

    return {
      provide: {
        pushNotification: {
          get fcmToken() {
            return _fcmToken;
          },
          isSupported: true,
        },
      },
    };
  } catch (error) {
    console.error('[PushNotification] Failed to initialize:', error);
    return {
      provide: {
        pushNotification: {
          fcmToken: null as string | null,
          isSupported: false,
        },
      },
    };
  }
});
