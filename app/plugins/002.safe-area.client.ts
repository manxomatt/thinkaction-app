/**
 * Safe Area Plugin for Capacitor
 *
 * This plugin sets up CSS custom properties for safe area insets
 * to handle Android navigation bar and iOS notch/home indicator.
 *
 * For Android devices with 3-button navigation or gesture navigation,
 * this ensures the bottom menubar is not covered.
 */

import { Capacitor } from '@capacitor/core';

export default defineNuxtPlugin(() => {
  if (!import.meta.client) return;

  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();

  // Add platform-specific class to body for CSS targeting
  if (isNative) {
    document.body.classList.add('capacitor-app');
    document.body.classList.add(`platform-${platform}`);
  }

  // For Android, we need to ensure the WebView respects safe area
  // The CSS env(safe-area-inset-*) should work with viewport-fit=cover
  // but we add a fallback for older Android WebViews
  if (platform === 'android') {
    // Add a minimum bottom padding for Android devices
    // This is a fallback in case env() is not supported
    const style = document.createElement('style');
    style.textContent = `
      /* Fallback for Android devices where env() might not work */
      @supports not (padding-bottom: env(safe-area-inset-bottom)) {
        .platform-android nav[class*="fixed"][class*="bottom-0"] {
          padding-bottom: 16px;
          height: calc(4rem + 16px);
        }
        .platform-android main {
          padding-bottom: calc(4rem + 16px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Log safe area values for debugging (only in development)
  if (import.meta.dev && isNative) {
    const checkSafeArea = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      const safeAreaBottom = computedStyle.getPropertyValue('--safe-area-inset-bottom') ||
                             getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)');
      console.log('[SafeArea] Platform:', platform);
      console.log('[SafeArea] Safe area bottom:', safeAreaBottom);
    };

    // Check after a short delay to ensure CSS is loaded
    setTimeout(checkSafeArea, 1000);
  }
});
