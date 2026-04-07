import { defineNuxtPlugin } from '#app';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { useApiClientFetch } from '~/composables/api-client-fetch';
import { getAuthToken } from '~/composables/capacitor';

// Global state for FCM token that can be accessed from anywhere
let _fcmToken: string | null = null;
let _tokenCallbacks: Array<(token: string) => void> = [];

// Retry configuration for FCM registration
const FCM_RETRY_CONFIG = {
  maxRetries: 5,
  initialDelayMs: 2000, // 2 seconds
  maxDelayMs: 60000, // 1 minute max
  backoffMultiplier: 2,
};

// Track retry state
let _registrationRetryCount = 0;
let _registrationRetryTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get or create a unique device ID
 * The device ID is stored in Preferences and persists across app restarts
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const { value } = await Preferences.get({ key: 'device_id' });
  if (value) {
    return value;
  }

  const newDeviceId = generateUUID();
  await Preferences.set({ key: 'device_id', value: newDeviceId });
  return newDeviceId;
}

/**
 * Get the device type based on the platform
 */
export function getDeviceType(): 'ios' | 'android' | 'web' {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return 'ios';
  if (platform === 'android') return 'android';
  return 'web';
}

/**
 * Check if an error is a retryable Firebase/FCM error
 * This includes:
 * - SERVICE_NOT_AVAILABLE: Google Play Services is temporarily unavailable
 * - Firebase Installations Service unavailable: FIS auth token retrieval failed
 * - FIS auth token errors: Firebase Installations authentication issues
 */
function isRetryableFirebaseError(error: unknown): boolean {
  if (!error) return false;

  const errorString = String(error).toLowerCase();
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';

  // Check for SERVICE_NOT_AVAILABLE error
  const isServiceNotAvailable = (
    errorString.includes('service_not_available')
    || errorMessage.includes('service_not_available')
    || errorString.includes('service not available')
    || errorMessage.includes('service not available')
  );

  // Check for Firebase Installations Service errors (FIS)
  const isFisError = (
    errorString.includes('firebase installations service is unavailable')
    || errorMessage.includes('firebase installations service is unavailable')
    || errorString.includes('firebaseinstallationsexception')
    || errorMessage.includes('firebaseinstallationsexception')
    || errorString.includes('fis auth token')
    || errorMessage.includes('fis auth token')
    || errorString.includes('failed to get fis auth token')
    || errorMessage.includes('failed to get fis auth token')
  );

  // Check for general network/connectivity errors that may be transient
  const isNetworkError = (
    errorString.includes('network error')
    || errorMessage.includes('network error')
    || errorString.includes('unable to resolve host')
    || errorMessage.includes('unable to resolve host')
    || errorString.includes('failed to connect')
    || errorMessage.includes('failed to connect')
  );

  return isServiceNotAvailable || isFisError || isNetworkError;
}

/**
 * Calculate delay for exponential backoff
 */
function calculateRetryDelay(retryCount: number): number {
  const delay = FCM_RETRY_CONFIG.initialDelayMs * Math.pow(FCM_RETRY_CONFIG.backoffMultiplier, retryCount);
  return Math.min(delay, FCM_RETRY_CONFIG.maxDelayMs);
}

/**
 * Send FCM token to backend for storage
 * This is called automatically when a token is received or refreshed
 * Only sends if user is authenticated (has auth token)
 */
async function sendFcmTokenToBackend(token: string): Promise<void> {
  try {
    // Check if user is authenticated before sending FCM token
    const authToken = await getAuthToken();
    if (!authToken) {
      console.log('[PushNotification] Skipping FCM token send - user not authenticated');
      console.log('[PushNotification] Token will be synced after login via syncFcmToken()');
      return;
    }

    console.log('[PushNotification] Sending FCM token to backend...');

    const deviceId = await getOrCreateDeviceId();
    const deviceType = getDeviceType();

    await useApiClientFetch('/auth/register-fcm-token', {
      method: 'POST',
      body: {
        token,
        device_id: deviceId,
        device_type: deviceType,
      },
    });

    console.log('[PushNotification] FCM token sent to backend successfully');
  }
  catch (error) {
    // Don't throw - just log the error
    // Token sending failure shouldn't break the app
    console.error('[PushNotification] Failed to send FCM token to backend:', error);
  }
}

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
 * Clear any pending retry timeout
 */
export function clearRegistrationRetry(): void {
  if (_registrationRetryTimeout) {
    clearTimeout(_registrationRetryTimeout);
    _registrationRetryTimeout = null;
  }
  _registrationRetryCount = 0;
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
 * 4. Retry registration with exponential backoff on retryable Firebase errors:
 *    - SERVICE_NOT_AVAILABLE: Google Play Services temporarily unavailable
 *    - Firebase Installations Service unavailable: FIS auth token errors
 *    - Network connectivity errors: Transient network issues
 *
 * SETUP REQUIRED:
 * 1. Add google-services.json to android/app/ (from Firebase Console)
 * 2. Add GoogleService-Info.plist to ios/App/App/ (from Firebase Console)
 * 3. Run `npx cap sync` after adding the files
 *
 * See docs/firebase-push-notification-setup.md for detailed instructions.
 */
export default defineNuxtPlugin(async () => {
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

  // Store PushNotifications reference for retry function
  let PushNotificationsModule: typeof import('@capacitor/push-notifications').PushNotifications | null = null;

  /**
   * Attempt to register for push notifications with retry logic
   */
  async function attemptRegistration(): Promise<void> {
    if (!PushNotificationsModule) {
      console.error('[PushNotification] PushNotifications module not loaded');
      return;
    }

    try {
      console.log('[PushNotification] Attempting registration...');
      await PushNotificationsModule.register();
      console.log('[PushNotification] Registration initiated successfully');
      // Reset retry count on success
      _registrationRetryCount = 0;
    }
    catch (error) {
      console.error('[PushNotification] Registration attempt failed:', error);

      // Check if this is a retryable Firebase error that we should retry
      if (isRetryableFirebaseError(error) && _registrationRetryCount < FCM_RETRY_CONFIG.maxRetries) {
        const delay = calculateRetryDelay(_registrationRetryCount);
        _registrationRetryCount++;

        console.log('[PushNotification] Retryable Firebase error detected');
        console.log(`[PushNotification] Scheduling retry ${_registrationRetryCount}/${FCM_RETRY_CONFIG.maxRetries} in ${delay}ms`);

        // Clear any existing timeout
        if (_registrationRetryTimeout) {
          clearTimeout(_registrationRetryTimeout);
        }

        // Schedule retry with exponential backoff
        _registrationRetryTimeout = setTimeout(() => {
          attemptRegistration();
        }, delay);
      }
      else if (_registrationRetryCount >= FCM_RETRY_CONFIG.maxRetries) {
        console.error(`[PushNotification] Max retries (${FCM_RETRY_CONFIG.maxRetries}) exceeded. Giving up.`);
        console.error('[PushNotification] Push notifications may not work until app restart.');
      }
      else {
        // Non-retryable error
        console.error('[PushNotification] Non-retryable registration error:', error);
      }
    }
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    PushNotificationsModule = PushNotifications;

    // Set up listeners FIRST before registering
    await PushNotifications.addListener('registration', (token) => {
      console.log('='.repeat(60));
      console.log('[PushNotification] FCM Token received');
      console.log('='.repeat(60));
      console.log('FCM_TOKEN:', token.value);
      console.log('='.repeat(60));
      _fcmToken = token.value;
      // Reset retry count on successful token receipt
      _registrationRetryCount = 0;
      if (_registrationRetryTimeout) {
        clearTimeout(_registrationRetryTimeout);
        _registrationRetryTimeout = null;
      }
      // Notify all subscribers
      _tokenCallbacks.forEach(cb => cb(token.value));
      // Send token to backend for storage
      sendFcmTokenToBackend(token.value);
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNotification] Registration error:', error.error);

      // Check if this is a retryable Firebase error that we should retry
      if (isRetryableFirebaseError(error.error) && _registrationRetryCount < FCM_RETRY_CONFIG.maxRetries) {
        const delay = calculateRetryDelay(_registrationRetryCount);
        _registrationRetryCount++;

        console.log('[PushNotification] Retryable Firebase error detected');
        console.log(`[PushNotification] Scheduling retry ${_registrationRetryCount}/${FCM_RETRY_CONFIG.maxRetries} in ${delay}ms`);

        // Clear any existing timeout
        if (_registrationRetryTimeout) {
          clearTimeout(_registrationRetryTimeout);
        }

        // Schedule retry with exponential backoff
        _registrationRetryTimeout = setTimeout(() => {
          attemptRegistration();
        }, delay);
      }
      else if (_registrationRetryCount >= FCM_RETRY_CONFIG.maxRetries) {
        console.error(`[PushNotification] Max retries (${FCM_RETRY_CONFIG.maxRetries}) exceeded. Giving up.`);
        console.error('[PushNotification] Push notifications may not work until app restart.');
      }
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushNotification] Notification received in foreground:', notification);
      // Notification received while app is in foreground
      // You can show an in-app notification here
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', async (action) => {
      console.log('[PushNotification] Notification action performed:', action);
      // User tapped on the notification
      // This brings the app to foreground automatically via the Android intent handling

      const data = action.notification.data;
      if (data) {
        console.log('[PushNotification] Notification data:', data);
        // Handle navigation based on notification type
        // Example: if (data.goalId) navigateTo(`/goals/${data.goalId}`);

        // If there's a deep link or route in the notification data, navigate to it
        if (data.route || data.path || data.url) {
          const targetRoute = data.route || data.path || data.url;
          console.log('[PushNotification] Navigating to:', targetRoute);
          // Use setTimeout to ensure the app is fully in foreground before navigating
          setTimeout(() => {
            window.location.href = targetRoute;
          }, 100);
        }
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
      // Use the retry-enabled registration function
      await attemptRegistration();
    }
    else {
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
  }
  catch (error) {
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
