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

  async function checkForUpdate() {
    try {
      // Prefer native plugin API when available
      let updater: CapacitorUpdaterPlugin | null = null;
      try {
        const mod = await import('@capgo/capacitor-updater');
        updater = mod.CapacitorUpdater as CapacitorUpdaterPlugin;
      }
      catch {
        updater = null;
      }

      if (updater && typeof updater.getLatest === 'function') {
        try {
          const latest = await updater.getLatest();
          // If getLatest returns without throwing, an update is available
          const want = confirm(`Update ${latest.version} available. Download now?`);
          if (!want) return;
          const downloaded = await updater.download({ version: latest.version, url: latest.url || '' });
          // queue for next app background or set immediately
          await updater.next({ id: downloaded.id });
          alert('Update downloaded; it will be applied on next app background/restart.');
          return;
        }
        catch (err: unknown) {
          const error = err as Error;
          if (error && error.message && error.message.includes('No new version')) {
            // No update - nothing to do
            return;
          }
          console.error('Updater plugin check failed', err);
        }
      }

      // Fallback: check a simple manifest.json hosted on your server
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
            alert('Failed to download update. Please try again later.');
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
    }
  }

  // run check on app start and on focus, optionally periodic
  checkForUpdate();
  window.addEventListener('focus', checkForUpdate);
  if (updateCheckInterval > 0) setInterval(checkForUpdate, updateCheckInterval * 1000);
});
