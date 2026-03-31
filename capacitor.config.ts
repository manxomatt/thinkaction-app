import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'id.thinkaction.app',
  appName: 'ThinkAction',
  webDir: '.output/public',
  server: {
    // Use https scheme for both platforms to allow cookies
    androidScheme: 'https',
    iosScheme: 'https',
    // Allow navigation to external domains for API calls and storage uploads
    allowNavigation: [
      'api.thinkaction.id',
      '*.thinkaction.id',
      '*.amazonaws.com',
      '*.s3.amazonaws.com',
      '*.cloudflare.com',
      '*.r2.cloudflarestorage.com',
      '*.r2.dev',
      // Local development
      '10.0.2.2',
      'localhost',
    ],
  },
  android: {
    // Allow cookies and mixed content
    allowMixedContent: true,
    // WebView settings for better compatibility
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    CapacitorCookies: {
      enabled: true,
    },
    CapacitorHttp: {
      // Keep enabled for API calls, but we use XMLHttpRequest for binary uploads
      // to bypass the patched fetch which doesn't handle binary data correctly
      enabled: true,
    },
    CapacitorUpdater: {
      // OTA Update Configuration
      // IMPORTANT: autoUpdate must be false for self-hosted S3 manifests
      // because the native plugin sends POST requests, but S3 only accepts GET.
      // The JavaScript plugin (ota.client.ts) handles updates using GET requests.
      autoUpdate: false,
      appReadyTimeout: 10000,
      responseTimeout: 20,
      autoDeleteFailed: true,
      autoDeletePrevious: false,
      // Self-hosted OTA manifest URL - configure via environment variables
      // Note: This URL is used by the JS plugin, not the native auto-update
      updateUrl: process.env.OTA_MANIFEST_URL || 'https://pointhub-s3.s3.ap-southeast-1.amazonaws.com/thinkaction/manifest.json',
      channelUrl: process.env.CAPGO_CHANNEL_URL || '',
      statsUrl: process.env.CAPGO_STATS_URL || '',
      // Security: set publicKey in CI if using encrypted bundles
      publicKey: process.env.CAPGO_PUBLIC_KEY || undefined,
      defaultChannel: 'default',
      // Developer options (disable in production)
      shakeMenu: false,
      allowShakeChannelSelector: false,
    },
    PushNotifications: {
      // Present push notifications when the app is in the foreground
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
