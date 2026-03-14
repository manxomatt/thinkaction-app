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
