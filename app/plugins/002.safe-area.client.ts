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
import { SafeArea } from 'capacitor-plugin-safe-area';

export default defineNuxtPlugin(async () => {
  if (!import.meta.client) return;

  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();

  // Add platform-specific class to body for CSS targeting
  if (isNative) {
    document.body.classList.add('capacitor-app');
    document.body.classList.add(`platform-${platform}`);
  }

  // For native platforms, use the SafeArea plugin to get accurate insets
  if (isNative) {
    try {
      // Get safe area insets from native plugin
      const safeAreaData = await SafeArea.getSafeAreaInsets();
      const { insets } = safeAreaData;

      console.log('[SafeArea] Native insets:', insets);

      // Set CSS custom properties with the actual inset values
      const root = document.documentElement;
      root.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
      root.style.setProperty('--safe-area-inset-right', `${insets.right}px`);
      root.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
      root.style.setProperty('--safe-area-inset-left', `${insets.left}px`);

      // Add dynamic styles that use the custom properties
      const style = document.createElement('style');
      style.id = 'safe-area-styles';
      style.textContent = `
        /* Override env() with actual values from native plugin */
        .capacitor-app nav[class*="fixed"][class*="bottom-0"] {
          padding-bottom: var(--safe-area-inset-bottom, 0px) !important;
          height: calc(4rem + var(--safe-area-inset-bottom, 0px)) !important;
        }
        .capacitor-app main {
          padding-bottom: calc(4rem + var(--safe-area-inset-bottom, 0px)) !important;
        }
        /* For slide-up menus */
        .capacitor-app .menu-panel {
          padding-bottom: var(--safe-area-inset-bottom, 0px) !important;
        }
        /* Top safe area for status bar */
        .capacitor-app .safe-area-top {
          padding-top: var(--safe-area-inset-top, 0px) !important;
        }
      `;
      document.head.appendChild(style);

      // Listen for safe area changes (e.g., when keyboard appears/disappears)
      SafeArea.addListener('safeAreaChanged', (data: { insets: { top: number; right: number; bottom: number; left: number } }) => {
        const newInsets = data.insets;
        console.log('[SafeArea] Insets changed:', newInsets);

        root.style.setProperty('--safe-area-inset-top', `${newInsets.top}px`);
        root.style.setProperty('--safe-area-inset-right', `${newInsets.right}px`);
        root.style.setProperty('--safe-area-inset-bottom', `${newInsets.bottom}px`);
        root.style.setProperty('--safe-area-inset-left', `${newInsets.left}px`);
      });

    } catch (error) {
      console.warn('[SafeArea] Failed to get safe area insets:', error);

      // Fallback for Android devices where plugin might not work
      if (platform === 'android') {
        const style = document.createElement('style');
        style.id = 'safe-area-fallback-styles';
        style.textContent = `
          /* Fallback for Android devices - use a reasonable default */
          .platform-android nav[class*="fixed"][class*="bottom-0"] {
            padding-bottom: 48px !important;
            height: calc(4rem + 48px) !important;
          }
          .platform-android main {
            padding-bottom: calc(4rem + 48px) !important;
          }
          .platform-android .menu-panel {
            padding-bottom: 48px !important;
          }
          /* Top safe area fallback for status bar (typically 24-32dp on Android) */
          .platform-android .safe-area-top {
            padding-top: 32px !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }

  // Log safe area values for debugging (only in development)
  if (import.meta.dev && isNative) {
    const checkSafeArea = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      const safeAreaBottom = computedStyle.getPropertyValue('--safe-area-inset-bottom');
      console.log('[SafeArea] Platform:', platform);
      console.log('[SafeArea] CSS --safe-area-inset-bottom:', safeAreaBottom);
    };

    // Check after a short delay to ensure CSS is loaded
    setTimeout(checkSafeArea, 1000);
  }
});
