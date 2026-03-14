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
  },
};

export default config;
