<script setup lang="ts">
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const props = defineProps<{
  isOpen: boolean
  goalLink: string // Prop for the actual link to the goal post
}>();

const emit = defineEmits(['close']);

const isNative = Capacitor.isNativePlatform();

function copyLink() {
  navigator.clipboard.writeText(props.goalLink);
  emit('close'); // Close after copying
}

function closePopup() {
  emit('close');
}

// Social share URLs
const socialShareUrls: Record<string, (url: string) => string> = {
  telegram: (url) => `https://t.me/share/url?url=${encodeURIComponent(url)}`,
  linkedin: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  threads: (url) => `https://www.threads.net/intent/post?text=${encodeURIComponent(url)}`,
  line: (url) => `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`,
  facebook: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  x: (url) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`,
  whatsapp: (url) => `https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`,
};

async function shareToNetwork(network: string) {
  const shareUrl = socialShareUrls[network]?.(props.goalLink);
  if (!shareUrl) return;

  if (isNative) {
    // Use Capacitor Browser for native apps
    await Browser.open({ url: shareUrl });
  } else {
    // Use window.open for web
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  }
  emit('close');
}

const currentUrl = props.goalLink;
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
    @click.self="closePopup"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-xl p-4 relative">
      <h3 class="text-xl text-center font-bold mb-10">
        Share
      </h3>
      <button
        class="absolute top-3 right-3 text-gray-600 text-2xl hover:text-gray-900"
        @click="closePopup"
      >
        &times;
      </button>

      <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4 lg:gap-6">
        <button
          class="flex flex-col items-center flex-shrink-0 w-16"
          @click="copyLink"
        >
          <div class="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <span class="i-mdi-content-copy text-2xl text-gray-700" />
          </div>
          <span class="text-xs mt-1 text-gray-700">Copy Link</span>
        </button>

        <template v-for="network in ['telegram', 'linkedin', 'threads', 'line', 'facebook', 'x', 'whatsapp']" :key="network">
          <!-- Native app: use custom share function with Capacitor Browser -->
          <button
            v-if="isNative"
            class="flex flex-col items-center flex-shrink-0 w-16"
            @click="shareToNetwork(network)"
          >
            <div class="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
              <span :class="`i-fa7-brands:${network === 'x' ? 'x-twitter' : network} text-2xl text-gray-700`" />
            </div>
            <span class="text-xs mt-1 text-gray-700 capitalize">{{ network }}</span>
          </button>

          <!-- Web: use SocialShare component -->
          <SocialShare
            v-else
            :network="network"
            :url="currentUrl"
            :label="false"
            @click="closePopup"
          >
            <template #icon>
              <button class="flex flex-col items-center flex-shrink-0 w-16">
                <div class="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
                  <span :class="`i-fa7-brands:${network === 'x' ? 'x-twitter' : network} text-2xl text-gray-700`" />
                </div>
                <span class="text-xs mt-1 text-gray-700 capitalize">{{ network }}</span>
              </button>
            </template>
          </SocialShare>
        </template>
      </div>
    </div>
  </div>
</template>
