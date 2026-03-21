import { ref, readonly, onMounted, onUnmounted } from 'vue';
import { Capacitor } from '@capacitor/core';
import type {
  PushNotificationSchema,
  ActionPerformed,
  Token,
  PermissionStatus,
} from '@capacitor/push-notifications';
import { getFcmToken, onFcmTokenChange } from '~/plugins/003.push-notification.client';

// Reactive state for push notifications
const fcmToken = ref<string | null>(null);
const permissionStatus = ref<PermissionStatus | null>(null);
const isRegistered = ref(false);
const lastNotification = ref<PushNotificationSchema | null>(null);
const lastActionPerformed = ref<ActionPerformed | null>(null);

// Event callbacks that can be set by the app
type NotificationReceivedCallback = (notification: PushNotificationSchema) => void;
type NotificationActionCallback = (action: ActionPerformed) => void;
type TokenReceivedCallback = (token: string) => void;
type RegistrationErrorCallback = (error: Error) => void;

let onNotificationReceived: NotificationReceivedCallback | null = null;
let onNotificationAction: NotificationActionCallback | null = null;
let onTokenReceived: TokenReceivedCallback | null = null;
let onRegistrationError: RegistrationErrorCallback | null = null;

export function usePushNotification() {
  const isNative = Capacitor.isNativePlatform();

  // Subscribe to token changes from the plugin
  let unsubscribe: (() => void) | null = null;

  onMounted(() => {
    // Get initial token from plugin
    const initialToken = getFcmToken();
    if (initialToken) {
      fcmToken.value = initialToken;
      isRegistered.value = true;
    }

    // Subscribe to token updates
    unsubscribe = onFcmTokenChange((token) => {
      fcmToken.value = token;
      isRegistered.value = true;
      if (onTokenReceived) {
        onTokenReceived(token);
      }
    });
  });

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });

  /**
   * Check current permission status
   */
  async function checkPermissions(): Promise<PermissionStatus | null> {
    if (!isNative) {
      console.log('[PushNotification] Not running on native platform');
      return null;
    }

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const status = await PushNotifications.checkPermissions();
      permissionStatus.value = status;
      return status;
    } catch (error) {
      console.error('[PushNotification] Failed to check permissions:', error);
      return null;
    }
  }

  /**
   * Request push notification permissions
   */
  async function requestPermissions(): Promise<PermissionStatus | null> {
    if (!isNative) {
      console.log('[PushNotification] Not running on native platform');
      return null;
    }

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const status = await PushNotifications.requestPermissions();
      permissionStatus.value = status;
      return status;
    } catch (error) {
      console.error('[PushNotification] Failed to request permissions:', error);
      return null;
    }
  }

  /**
   * Register for push notifications
   * This will trigger the registration process and return the FCM token
   * Note: The plugin already auto-registers on app start, this is for manual re-registration
   */
  async function register(): Promise<string | null> {
    if (!isNative) {
      console.log('[PushNotification] Not running on native platform');
      return null;
    }

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      // Check permissions first
      let status = await PushNotifications.checkPermissions();

      if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
        status = await PushNotifications.requestPermissions();
      }

      if (status.receive !== 'granted') {
        console.warn('[PushNotification] Permission not granted:', status.receive);
        permissionStatus.value = status;
        return null;
      }

      permissionStatus.value = status;

      // Set up listeners before registering
      await setupListeners();

      // Register with FCM/APNs
      await PushNotifications.register();
      isRegistered.value = true;

      // Return the token (may be null if not yet received)
      return fcmToken.value;
    } catch (error) {
      console.error('[PushNotification] Failed to register:', error);
      if (onRegistrationError && error instanceof Error) {
        onRegistrationError(error);
      }
      return null;
    }
  }

  /**
   * Set up push notification listeners
   */
  async function setupListeners(): Promise<void> {
    if (!isNative) return;

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      // Remove existing listeners to avoid duplicates
      await PushNotifications.removeAllListeners();

      // Listen for successful registration
      await PushNotifications.addListener('registration', (token: Token) => {
        console.log('[PushNotification] Registration successful, token:', token.value);
        fcmToken.value = token.value;
        if (onTokenReceived) {
          onTokenReceived(token.value);
        }
      });

      // Listen for registration errors
      await PushNotifications.addListener('registrationError', (error) => {
        console.error('[PushNotification] Registration error:', error);
        if (onRegistrationError) {
          onRegistrationError(new Error(error.error));
        }
      });

      // Listen for push notifications received while app is in foreground
      await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('[PushNotification] Notification received:', notification);
        lastNotification.value = notification;
        if (onNotificationReceived) {
          onNotificationReceived(notification);
        }
      });

      // Listen for notification action (user tapped on notification)
      await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('[PushNotification] Notification action performed:', action);
        lastActionPerformed.value = action;
        if (onNotificationAction) {
          onNotificationAction(action);
        }
      });

      console.log('[PushNotification] Listeners set up successfully');
    } catch (error) {
      console.error('[PushNotification] Failed to set up listeners:', error);
    }
  }

  /**
   * Unregister from push notifications
   */
  async function unregister(): Promise<void> {
    if (!isNative) return;

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.removeAllListeners();
      isRegistered.value = false;
      fcmToken.value = null;
      console.log('[PushNotification] Unregistered successfully');
    } catch (error) {
      console.error('[PushNotification] Failed to unregister:', error);
    }
  }

  /**
   * Get delivered notifications (notifications in the notification tray)
   */
  async function getDeliveredNotifications(): Promise<PushNotificationSchema[]> {
    if (!isNative) return [];

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const result = await PushNotifications.getDeliveredNotifications();
      return result.notifications;
    } catch (error) {
      console.error('[PushNotification] Failed to get delivered notifications:', error);
      return [];
    }
  }

  /**
   * Remove specific delivered notifications
   */
  async function removeDeliveredNotifications(notifications: PushNotificationSchema[]): Promise<void> {
    if (!isNative) return;

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.removeDeliveredNotifications({
        notifications,
      });
    } catch (error) {
      console.error('[PushNotification] Failed to remove delivered notifications:', error);
    }
  }

  /**
   * Remove all delivered notifications
   */
  async function removeAllDeliveredNotifications(): Promise<void> {
    if (!isNative) return;

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.removeAllDeliveredNotifications();
    } catch (error) {
      console.error('[PushNotification] Failed to remove all delivered notifications:', error);
    }
  }

  /**
   * Set callback for when a notification is received (foreground)
   */
  function setOnNotificationReceived(callback: NotificationReceivedCallback | null): void {
    onNotificationReceived = callback;
  }

  /**
   * Set callback for when a notification action is performed (user tapped)
   */
  function setOnNotificationAction(callback: NotificationActionCallback | null): void {
    onNotificationAction = callback;
  }

  /**
   * Set callback for when FCM token is received
   */
  function setOnTokenReceived(callback: TokenReceivedCallback | null): void {
    onTokenReceived = callback;
  }

  /**
   * Set callback for registration errors
   */
  function setOnRegistrationError(callback: RegistrationErrorCallback | null): void {
    onRegistrationError = callback;
  }

  /**
   * Get the current FCM token synchronously
   * This is useful when you need the token immediately without waiting
   */
  function getToken(): string | null {
    return fcmToken.value || getFcmToken();
  }

  return {
    // State (readonly)
    fcmToken: readonly(fcmToken),
    permissionStatus: readonly(permissionStatus),
    isRegistered: readonly(isRegistered),
    lastNotification: readonly(lastNotification),
    lastActionPerformed: readonly(lastActionPerformed),
    isNative,

    // Methods
    checkPermissions,
    requestPermissions,
    register,
    unregister,
    setupListeners,
    getDeliveredNotifications,
    removeDeliveredNotifications,
    removeAllDeliveredNotifications,
    getToken,

    // Callback setters
    setOnNotificationReceived,
    setOnNotificationAction,
    setOnTokenReceived,
    setOnRegistrationError,
  };
}

/**
 * Get FCM token directly without using the composable
 * Useful for non-component contexts
 */
export function getPushNotificationToken(): string | null {
  return getFcmToken();
}
