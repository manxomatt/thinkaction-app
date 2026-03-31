<script setup lang="ts">
defineProps<{asideTitle: string}>();

const asideMounted = defineModel<boolean>('asideMounted', { default: false });

const toggleAside = () => {
  asideMounted.value = !asideMounted.value;
};

onBeforeRouteLeave(() => {
  asideMounted.value = false;
});
</script>

<template>
  <div class="relative lg:grid lg:grid-cols-3 w-full">
    <div class="relative lg:col-span-2">
      <!-- Main Content -->
      <section class="overflow-y-auto max-h-svh h-full">
        <div class="relative max-w-full h-full">
          <!-- Main Content Header -->
          <div class="flex lg:hidden items-center justify-between bg-body backdrop-blur-md pt-[env(safe-area-inset-top,0px)] safe-area-top">
            <div class="flex w-full items-center justify-center">
              <logo />
            </div>
            <div>
              <button class="lg:hidden p-4 rounded-full transition-transform hover:scale-105" @click="toggleAside">
                <div class="i-carbon:menu w-8 h-8" />
              </button>
            </div>
          </div>
          <!-- Main Content Body -->
          <slot />
        </div>
      </section>
    </div>

    <aside class="hidden lg:block bg-white shadow w-full h-full max-h-full z-5">
      <div class="lg:max-w-sm w-full h-full flex flex-col">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold text-gray-900 relative pt-6 px-6">
            {{ asideTitle }}
          </h3>
        </div>
        <slot name="aside" />
      </div>
    </aside>

    <Transition enter-active-class="transition-transform duration-300 ease-out" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition-transform duration-300 ease-in" leave-to-class="translate-x-full">
      <aside v-if="asideMounted" class="fixed flex flex-col right-0 top-0 bottom-0 w-full max-h-svh bg-body shadow-2xl z-40 lg:hidden overflow-y-auto">
        <div class="flex items-center justify-between p-6">
          <h3 class="text-xl font-bold text-gray-900 relative">
            {{ asideTitle }}
          </h3>

          <div class="flex justify-end">
            <button class="text-slate-600 hover:text-gray-800" @click="asideMounted = false">
              <div class="i-carbon-close text-2xl" />
            </button>
          </div>
        </div>
        <slot name="aside" />
      </aside>
    </Transition>

    <div v-if="asideMounted" class="fixed inset-0 bg-black/50 z-30 transition-opacity duration-300 lg:hidden" @click="toggleAside" />
  </div>
</template>
