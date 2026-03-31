<script setup>
const config = useRuntimeConfig();
</script>

<template>
  <div class="fixed inset-0 bg-[url('/images/home-bg.jpg')] bg-cover bg-center z-0" />
  <div class="min-h-svh bg-gradient-to-b from-[#FAAF61]/10 via-white to-[#6BBB95]/10 text-slate-800 font-open-sans">
    <div class="relative z-10 w-full px-2">
      <div class="max-w-5xl mx-auto">
        <section class="bg-slate-100 max-w-4xl mx-auto px-4 lg:px-8 py-4 lg:py-6 text-center rounded-xl shadow-xl mt-4">
          <nuxt-link to="/about">
            <logo class="font-logo text-4xl lg:text-5xl font-bold flex justify-center items-center gap-2" />
          </nuxt-link>
        </section>

        <slot />

        <section class="max-w-4xl mx-auto mt-4 bg-slate-100 rounded-3xl p-6 shadow-lg">
          <h3 class="text-2xl font-semibold mb-4">
            Ready to make your next move?
          </h3>
          <p class="mb-6">
            Dream big, plan smart, and take action with a community that's got your back.
          </p>
          <div class="flex gap-2">
            <nuxt-link
              to="/signup"
              class="px-5 py-2 lg:px-8 lg:py-3 bg-[#6BBB95] text-white rounded-full text-base font-semibold hover:opacity-90 transition"
            >
              Join Now
            </nuxt-link>
            <nuxt-link
              to="/"
              class="px-5 py-2 lg:px-8 lg:py-3 border border-[#6BBB95] text-[#6BBB95] bg-white rounded-full text-base font-semibold hover:bg-[#6BBB95]/10 transition"
            >
              Explore Goals
            </nuxt-link>
          </div>
        </section>

        <section class="max-w-4xl mx-auto mt-4 bg-slate-100 rounded-t-3xl p-6 shadow-lg flex flex-col lg:flex-row justify-center lg:justify-between text-slate-600">
          <nuxt-link to="/about" class="flex justify-center mb-4 lg:mb-0">
            <logo />
          </nuxt-link>
          <footer>
            <div class="flex justify-center lg:justify-end">
              © 2025 Thinkaction
            </div>
            <div class="flex justify-center lg:justify-end text-sm text-slate-500">
              v{{ config.public.appVersion }}
            </div>
            <div class="mt-2 flex gap-2 items-center justify-center lg:justify-end">
              <nuxt-link to="/about">About</nuxt-link> -
              <nuxt-link to="/privacy">Privacy</nuxt-link> -
              <nuxt-link to="/terms">Terms</nuxt-link>
            </div>
          </footer>
        </section>
      </div>
    </div>
  </div>
</template>

<style></style>
