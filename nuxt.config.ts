import pkg from './package.json';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Enable static site generation for Capacitor
  ssr: false,
  modules: [
    '@unocss/nuxt',
    '@vueuse/nuxt',
    '@nuxt/eslint',
    '@stefanobartoletti/nuxt-social-share',
  ],
  app: {
    head: {
      script: [
        {
          // Store original fetch before Capacitor patches it
          // This runs before any other scripts, including Capacitor
          innerHTML: 'window.__originalFetch = window.fetch.bind(window);',
          type: 'text/javascript',
        },
      ],
    },
  },
  imports: {
    dirs: [
      '~/composables',
      '~/composables/**/index.{ts,js,mjs,mts}',
    ],
  },
  devtools: { enabled: false },
  css: [
    '~/assets/main.css',
    '~/assets/css/font.css',
  ],
  runtimeConfig: {
    public: {
      appBase: process.env.APP_BASE,
      apiBase: process.env.API_BASE,
      // OTA Configuration
      appVersion: pkg.version,
      otaManifestUrl: process.env.OTA_MANIFEST_URL || 'https://pointhub-s3.s3.ap-southeast-1.amazonaws.com/thinkaction/manifest.json',
      otaCheckInterval: Number(process.env.OTA_CHECK_INTERVAL) || 0, // seconds, 0 = disabled
    },
  },
  devServer: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  },
  vite: {
    esbuild: {
      drop: process.env.NODE_ENV === 'production'
        ? ['debugger']
        : [],
      pure: process.env.NODE_ENV === 'production'
        ? ['console.log', 'console.info', 'console.warn']
        : [],
    },
  },
  compatibilityDate: '2025-07-15',
  socialShare: {
    baseUrl: 'https://www.thinkaction.id',
  },
});
