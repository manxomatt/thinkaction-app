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

// Handle token refresh
setOnTokenReceived((newToken) => {
  console.log('New FCM Token:', newToken);
  // Update token on your backend server
  await updateTokenOnServer(newToken);
});
```

### Sending Token to Backend

When you receive an FCM token, you should send it to your backend server to store it for sending push notifications later:

```typescript
async function sendTokenToServer(token: string) {
  const { apiFetch } = useApiFetch();
  
  await apiFetch('/users/me/push-token', {
    method: 'POST',
    body: {
      token,
      platform: Capacitor.getPlatform(), // 'android' or 'ios'
    },
  });
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

2. **Notifications not showing**
   - Ensure `POST_NOTIFICATIONS` permission is granted (Android 13+)
   - Check notification channel settings
   - Verify the app is not in battery optimization mode

3. **Build errors**
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
