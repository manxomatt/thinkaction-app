import { defineNuxtPlugin, useRuntimeConfig } from '#app';
import type { CapacitorUpdaterPlugin } from '@capgo/capacitor-updater';

interface OTAManifest {
  version: string;
  url?: string;
  zipUrl?: string;
  baseUrl?: string;
}

export default defineNuxtPlugin(() => {
  // Note: This is a .client.ts plugin, so it only runs on the client side.
  // No need for server-side check.

  const config = useRuntimeConfig();
  const manifestUrl = config.public.otaManifestUrl as string | undefined;
  const updateCheckInterval = Number(config.public.otaCheckInterval) || 0;
  if (!manifestUrl) return;

  // Store manifestUrl in a const that TypeScript knows is definitely a string
  const manifestUrlString: string = manifestUrl;

  // Notify native plugin as early as possible to avoid rollback
  (async () => {
    try {
      const mod = await import('@capgo/capacitor-updater');
      const { CapacitorUpdater } = mod;
      if (CapacitorUpdater && typeof CapacitorUpdater.notifyAppReady === 'function') {
        try { await CapacitorUpdater.notifyAppReady(); } catch { /* ignore */ }
      }
    }
    catch {
      // plugin not installed or running in browser - ignore
    }
  })();

  // Setup Capacitor App plugin listener for app resume events
  // This is more reliable than window 'focus' event on native platforms
  (async () => {
    try {
      const { App } = await import('@capacitor/app');
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          console.log('[OTA] App resumed, checking for updates...');
          checkForUpdate();
        }
      });
    }
    catch {
      // Capacitor App plugin not available - will fall back to window focus event
      console.log('[OTA] Capacitor App plugin not available, using window focus event');
    }
  })();

  async function checkForUpdate() {
    try {
      // Get the native updater plugin if available (for download/set operations)
      // Note: We do NOT use getLatest() because it sends POST requests,
      // but S3-hosted manifests only accept GET requests (HTTP 405 error).
      let updater: CapacitorUpdaterPlugin | null = null;
      try {
        const mod = await import('@capgo/capacitor-updater');
        updater = mod.CapacitorUpdater as CapacitorUpdaterPlugin;
      }
      catch {
        updater = null;
      }

      // Check manifest.json hosted on S3 using GET request
      const res = await fetch(manifestUrlString, { cache: 'no-store' });
      if (!res.ok) return;
      const manifest = await res.json() as OTAManifest;

      // Get current package version from package.json (injected at build time via runtimeConfig)
      const currentVersion = config.public.appVersion as string || '0.0.0';

      if (manifest.version !== currentVersion) {
        // Version mismatch - download and apply update using CapacitorUpdater
        if (updater && typeof updater.download === 'function' && typeof updater.set === 'function') {
          const apply = confirm(`Update ${manifest.version} available (current: ${currentVersion}). Download and install now?`);
          if (!apply) return;

          try {
            const zipUrl = manifest.url || manifest.zipUrl;
            if (!zipUrl) {
              console.error('No zip URL found in manifest');
              return;
            }

            // Download the update bundle
            const downloaded = await updater.download({
              version: manifest.version,
              url: zipUrl,
            });

            // Apply the update immediately using set
            await updater.set({ id: downloaded.id });

            alert('Update installed! The app will now reload.');
          }
          catch (downloadErr) {
            console.error('Failed to download/install update', downloadErr);
            // Check for SSL-related errors
            const errorMessage = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
            if (errorMessage.includes('SSL') || errorMessage.includes('Certificate') || errorMessage.includes('Chain validation')) {
              console.error('[OTA] SSL/Certificate error detected. This may be due to:');
              console.error('  1. Device date/time is incorrect');
              console.error('  2. Server SSL certificate chain is incomplete');
              console.error('  3. Network security config needs updating');
              alert('Failed to download update due to a security certificate issue. Please check your device date/time settings and try again.');
            }
            else {
              alert('Failed to download update. Please try again later.');
            }
          }
        }
        else {
          // No updater available - fallback to opening URL in browser
          const apply = confirm('An update is available. Open update URL?');
          if (!apply) return;
          const base = manifest.baseUrl || manifest.url;
          if (!base) return;
          // attempt to open via Capacitor Browser plugin if present
          const capacitor = (window as { Capacitor?: { Plugins?: { Browser?: { open: (opts: { url: string }) => Promise<void> } } } }).Capacitor;
          if (capacitor?.Plugins?.Browser?.open) {
            try { await capacitor.Plugins.Browser.open({ url: base }); return; } catch { /* fallthrough */ }
          }
          location.href = base;
        }
      }
    }
    catch (e) {
      console.error('OTA check failed', e);
      // Check for SSL-related errors in the main catch block (e.g., from fetch)
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.includes('SSL') || errorMessage.includes('Certificate') || errorMessage.includes('Chain validation') || errorMessage.includes('CERT')) {
        console.error('[OTA] SSL/Certificate error during manifest fetch. This may be due to:');
        console.error('  1. Device date/time is incorrect');
        console.error('  2. Server SSL certificate chain is incomplete');
        console.error('  3. Network security config needs updating');
      }
    }
  }

  // run check on app start
  checkForUpdate();

  // Use window focus event as fallback for browser environments
  // (Capacitor App plugin listener handles native app resume above)
  window.addEventListener('focus', checkForUpdate);

  // Optionally run periodic checks
  if (updateCheckInterval > 0) setInterval(checkForUpdate, updateCheckInterval * 1000);
});
