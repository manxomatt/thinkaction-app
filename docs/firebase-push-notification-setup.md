# Firebase Push Notification Setup

This guide explains how to set up Firebase Cloud Messaging (FCM) for push notifications in the ThinkAction app.

## Prerequisites

- Firebase account
- Access to Firebase Console
- Android Studio (for Android development)
- Xcode (for iOS development)

## Firebase Console Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "ThinkAction")
4. Follow the setup wizard

### 2. Add Android App to Firebase

1. In Firebase Console, click "Add app" and select Android
2. Enter the Android package name: `id.thinkaction.app`
3. Enter app nickname: "ThinkAction Android"
4. (Optional) Enter SHA-1 certificate fingerprint for additional security
5. Click "Register app"
6. Download `google-services.json`
7. Place the file in `android/app/google-services.json`

### 3. Add iOS App to Firebase (Optional)

1. In Firebase Console, click "Add app" and select iOS
2. Enter the iOS bundle ID: `id.thinkaction.app`
3. Enter app nickname: "ThinkAction iOS"
4. Click "Register app"
5. Download `GoogleService-Info.plist`
6. Place the file in `ios/App/App/GoogleService-Info.plist`

## Android Configuration

### Files Already Configured

The following files have been pre-configured:

#### `android/app/build.gradle`
```gradle
// Firebase Cloud Messaging for Push Notifications
implementation platform('com.google.firebase:firebase-bom:33.7.0')
implementation 'com.google.firebase:firebase-messaging'
```

#### `android/build.gradle`
```gradle
dependencies {
    classpath 'com.google.gms:google-services:4.4.4'
}
```

#### `android/app/src/main/AndroidManifest.xml`
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### Required: Add google-services.json

1. Download `google-services.json` from Firebase Console
2. Place it in `android/app/google-services.json`
3. Run `npx cap sync android`

## iOS Configuration (Optional)

### 1. Enable Push Notifications Capability

1. Open `ios/App/App.xcworkspace` in Xcode
2. Select the App target
3. Go to "Signing & Capabilities"
4. Click "+ Capability"
5. Add "Push Notifications"
6. Add "Background Modes" and check "Remote notifications"

### 2. Add GoogleService-Info.plist

1. Download `GoogleService-Info.plist` from Firebase Console
2. Drag and drop it into `ios/App/App/` in Xcode
3. Make sure "Copy items if needed" is checked
4. Run `npx cap sync ios`

### 3. Configure APNs in Firebase

1. Go to Firebase Console > Project Settings > Cloud Messaging
2. Under "Apple app configuration", upload your APNs authentication key or certificate

## Usage in the App

### Basic Usage

```typescript
import { usePushNotification } from '~/composables/push-notification';

const {
  fcmToken,
  permissionStatus,
  isRegistered,
  register,
  unregister,
  setOnNotificationReceived,
  setOnNotificationAction,
  setOnTokenReceived,
} = usePushNotification();

// Register for push notifications
async function enablePushNotifications() {
  const token = await register();
  if (token) {
    console.log('FCM Token:', token);
    // Send token to your backend server
    await sendTokenToServer(token);
  }
}

// Handle foreground notifications
setOnNotificationReceived((notification) => {
  console.log('Notification received:', notification);
  // Show in-app notification or update UI
});

// Handle notification taps
setOnNotificationAction((action) => {
  console.log('Notification tapped:', action);
  // Navigate to relevant screen based on notification data
  const data = action.notification.data;
  if (data.goalId) {
    navigateTo(`/goals/${data.goalId}`);
  }
});

// Handle token refresh (optional - token is automatically sent to backend)
setOnTokenReceived((newToken) => {
  console.log('New FCM Token:', newToken);
  // Token is automatically sent to backend via /auth/update-fcm-token
  // Add any additional custom logic here if needed
});
```

### Sending Token to Backend

The FCM token is **automatically sent to the backend** when it's received or refreshed. The plugin calls the `/auth/update-fcm-token` endpoint automatically.

**Automatic Token Sync:**
- When the app starts and receives an FCM token, it's automatically sent to the backend
- When the token is refreshed by Firebase, the new token is automatically sent
- **After successful login**, the FCM token is automatically synced to associate it with the authenticated user
- No manual intervention is required for basic functionality

**Manual Token Sync (Optional):**
If you need to manually sync the token (e.g., after user login), you can use:

```typescript
const { sendTokenToBackend } = usePushNotification();

// After user login, sync the FCM token
async function onUserLogin() {
  await sendTokenToBackend();
}
```

**Using the Auth Composable:**
You can also use the auth composable directly:

```typescript
const { updateFcmToken } = useAuth();

// Manually update FCM token
await updateFcmToken(token);
```

**API Endpoint:**
```
POST /auth/update-fcm-token
Content-Type: application/json

{
  "fcm_token": "string"
}
```

### Checking Permission Status

```typescript
const { checkPermissions, requestPermissions } = usePushNotification();

// Check current status
const status = await checkPermissions();
console.log('Permission status:', status?.receive);
// 'granted' | 'denied' | 'prompt'

// Request permissions if needed
if (status?.receive === 'prompt') {
  const newStatus = await requestPermissions();
  console.log('New permission status:', newStatus?.receive);
}
```

### Managing Delivered Notifications

```typescript
const {
  getDeliveredNotifications,
  removeDeliveredNotifications,
  removeAllDeliveredNotifications,
} = usePushNotification();

// Get all notifications in the notification tray
const notifications = await getDeliveredNotifications();

// Remove specific notifications
await removeDeliveredNotifications(notifications.filter(n => n.id === 'some-id'));

// Remove all notifications
await removeAllDeliveredNotifications();
```

## Backend Integration

### Sending Push Notifications

To send push notifications from your backend, use the Firebase Admin SDK:

```javascript
// Node.js example
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Send notification to a specific device
async function sendPushNotification(fcmToken, title, body, data = {}) {
  const message = {
    notification: {
      title,
      body,
    },
    data, // Custom data payload
    token: fcmToken,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Example: Send notification for new comment
sendPushNotification(
  userFcmToken,
  'New Comment',
  'John commented on your goal',
  {
    type: 'comment',
    goalId: '123',
    commentId: '456',
  }
);
```

### Notification Payload Structure

```json
{
  "notification": {
    "title": "New Comment",
    "body": "John commented on your goal"
  },
  "data": {
    "type": "comment",
    "goalId": "123",
    "commentId": "456"
  },
  "token": "user_fcm_token"
}
```

## Troubleshooting

### Android

1. **No token received**
   - Check if `google-services.json` is in the correct location
   - Verify the package name matches in Firebase Console
   - Check logcat for Firebase initialization errors

1. **Notifications not appearing (but backend sends successfully)**
   - **Notification Channel**: Android 8.0+ requires notification channels. The app creates a channel called `thinkaction_notifications` on startup.
   - **Check channel settings**: Go to Settings > Apps > ThinkAction > Notifications and ensure the channel is enabled
   - **Verify AndroidManifest.xml**: Ensure the default notification channel is configured:
     ```xml
     <meta-data
         android:name="com.google.firebase.messaging.default_notification_channel_id"
         android:value="thinkaction_notifications" />
     ```
   - **Check MyFirebaseMessagingService**: The service must create and show notifications manually for foreground messages
   - **POST_NOTIFICATIONS permission**: On Android 13+, ensure the permission is granted

2. **SERVICE_NOT_AVAILABLE Error**
   ```
   java.io.IOException: java.util.concurrent.ExecutionException: java.io.IOException: SERVICE_NOT_AVAILABLE
   ```
   This error occurs when Firebase Cloud Messaging cannot connect to Google Play Services. Common causes:
   - **Network connectivity issues**: Check if the device has internet access
   - **Google Play Services unavailable**: Ensure Google Play Services is installed and up-to-date
   - **Emulator without Google Play**: Use an emulator with Google Play Services (Google APIs image)
   - **Temporary Firebase service issues**: Wait and retry
   
   **The app automatically handles this error** with exponential backoff retry logic:
   - Retries up to 5 times
   - Initial delay: 2 seconds, doubling each retry (max 60 seconds)
   - Check logcat for retry messages: `[PushNotification] Scheduling retry X/5 in Yms`
   
   **Manual fixes:**
   - Restart the app
   - Check device network connectivity
   - Update Google Play Services: Settings > Apps > Google Play Services > Update
   - Clear Google Play Services cache: Settings > Apps > Google Play Services > Clear Cache
   - On emulator: Use a system image with Google Play (e.g., "Google APIs" or "Google Play")

3. **Firebase Installations Service (FIS) Error**
   ```
   Failed to get FIS auth token
   java.util.concurrent.ExecutionException: com.google.firebase.installations.FirebaseInstallationsException: Firebase Installations Service is unavailable. Please try again later.
   ```
   This error occurs when Firebase Installations Service cannot authenticate the app. Common causes:
   - **Network connectivity issues**: The device cannot reach Firebase servers
   - **Firebase project misconfiguration**: Check `google-services.json` is correct
   - **Clock synchronization issues**: Device time is significantly off
   - **Temporary Firebase service outage**: Firebase services may be temporarily unavailable
   - **Firewall/proxy blocking**: Corporate networks may block Firebase endpoints
   
   **The app automatically handles this error** with exponential backoff retry logic (same as SERVICE_NOT_AVAILABLE).
   
   **Manual fixes:**
   - Check device network connectivity and try again
   - Verify `google-services.json` is from the correct Firebase project
   - Ensure device date/time is set correctly (preferably automatic)
   - Check [Firebase Status Dashboard](https://status.firebase.google.com/) for outages
   - If on corporate network, ensure Firebase domains are not blocked:
     - `firebaseinstallations.googleapis.com`
     - `fcm.googleapis.com`
     - `fcmregistrations.googleapis.com`
   - Clear app data and restart: Settings > Apps > ThinkAction > Clear Data
   - Uninstall and reinstall the app

4. **Notifications not showing**
   - Ensure `POST_NOTIFICATIONS` permission is granted (Android 13+)
   - Check notification channel settings
   - Verify the app is not in battery optimization mode

5. **Build errors**
   - Run `npx cap sync android` after any configuration changes
   - Clean and rebuild: `cd android && ./gradlew clean`

### iOS

1. **No token received**
   - Verify Push Notifications capability is enabled
   - Check APNs configuration in Firebase Console
   - Ensure provisioning profile includes push notifications

2. **Notifications not showing**
   - Check notification permissions in device settings
   - Verify Background Modes capability is enabled

### General

1. **Token changes frequently**
   - This is normal behavior; always update the token on your backend when it changes

2. **Notifications not received when app is killed**
   - Ensure your backend sends both `notification` and `data` payloads
   - Check device battery optimization settings

## Security Considerations

1. **Never expose Firebase Admin credentials in client code**
2. **Validate FCM tokens on your backend before storing**
3. **Implement token refresh handling to keep tokens up-to-date**
4. **Use topic-based messaging for broadcast notifications**
5. **Implement rate limiting for push notifications**

## Testing

### Using Firebase Console

1. Go to Firebase Console > Cloud Messaging
2. Click "Send your first message"
3. Enter notification title and body
4. Select your app as the target
5. Click "Send test message"
6. Enter your device's FCM token
7. Click "Test"

### Using cURL

```bash
curl -X POST \
  'https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": {
      "token": "DEVICE_FCM_TOKEN",
      "notification": {
        "title": "Test Notification",
        "body": "This is a test message"
      }
    }
  }'
```

## References

- [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
