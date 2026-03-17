<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { IGoal } from '~/composables/api/goals';

/* ------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------ */
type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error'

/* ------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------ */
const STORY_DURATION = 5000; // 5 seconds

/* ------------------------------------------------------------------
 * Models
 * ------------------------------------------------------------------ */
const goal = defineModel<IGoal>('goal');

/* ------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------ */
const isModalOpen = ref(false);
const activeIndex = ref(0);
const progress = ref(0); // 0–100 progress bar
const isWaitingForImage = ref(false);

/** Image preloading */
const preloadingPromises: Record<number, Promise<LoadStatus>> = {};
const preloadingStatus = ref<Record<number, LoadStatus>>({});

/** Timer */
let timer: ReturnType<typeof setInterval> | null = null;

/* ------------------------------------------------------------------
 * Computed
 * ------------------------------------------------------------------ */
const currentStory = computed(() => goal.value?.progress?.[activeIndex.value]);
const { user: myUser } = useAuth();

/* ------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------ */
const getPreloadingStatus = (index: number): LoadStatus =>
  preloadingStatus.value[index] ?? 'idle';

/* ------------------------------------------------------------------
 * Image Preloader
 * ------------------------------------------------------------------ */
function loadImage(index: number): Promise<LoadStatus> {
  if (preloadingPromises[index]) {
    return preloadingPromises[index];
  }

  preloadingStatus.value[index] = 'loading';

  const promise: Promise<LoadStatus> = new Promise((resolve) => {
    const img = new Image();
    img.src = goal.value?.progress?.[index]?.media_url ?? '';

    img.onload = () => {
      preloadingStatus.value[index] = 'loaded';
      resolve('loaded');
    };

    img.onerror = () => {
      preloadingStatus.value[index] = 'error';
      resolve('error');
    };
  });

  preloadingPromises[index] = promise;
  return promise;
}

/* ------------------------------------------------------------------
 * Story Navigation
 * ------------------------------------------------------------------ */
async function openStory(index: number): Promise<void> {
  const total = goal.value?.progress?.length ?? 0;

  if (index < 0 || index >= total) {
    closeModal();
    return;
  }

  activeIndex.value = index;
  isModalOpen.value = true;
  isWaitingForImage.value = true;

  await loadImage(index);
}

function handleStoryClick(index: number): void {
  openStory(index);
}

function closeModal(): void {
  isModalOpen.value = false;
  if (timer) clearInterval(timer);
  timer = null;
  progress.value = 0;
}

/* ------------------------------------------------------------------
 * Image Events
 * ------------------------------------------------------------------ */
function handleImageLoad(): void {
  isWaitingForImage.value = false;
  startProgress();
}

function handleImageError(): void {
  isWaitingForImage.value = false;
  startProgress();
}

/* ------------------------------------------------------------------
 * Navigation
 * ------------------------------------------------------------------ */
function nextStory(): void {
  openStory(activeIndex.value + 1);
}

function prevStory(): void {
  openStory(activeIndex.value - 1);
}

/* ------------------------------------------------------------------
 * Progress Bar Logic
 * ------------------------------------------------------------------ */
function startProgress(): void {
  progress.value = 0;
  if (timer) clearInterval(timer);

  const step = 100;
  const increment = (step / STORY_DURATION) * 100;

  timer = setInterval(() => {
    progress.value += increment;
    if (progress.value >= 100) {
      if (timer) clearInterval(timer);
      timer = null;
      nextStory();
    }
  }, step);
}

function getSegmentProgress(index: number): { width: string } {
  if (index < activeIndex.value) {
    return { width: '100%' };
  }
  if (index === activeIndex.value) {
    return { width: `${progress.value}%` };
  }
  return { width: '0%' };
}

/* ------------------------------------------------------------------
 * Watchers
 * ------------------------------------------------------------------ */
watch(activeIndex, () => {
  if (isModalOpen.value) {
    if (timer) clearInterval(timer);
    timer = null;
    progress.value = 0;
  }
});

/* ------------------------------------------------------------------
 * Lifecycle
 * ------------------------------------------------------------------ */
onMounted(() => {
  goal.value?.progress?.forEach((_, index) => {
    loadImage(index);
  });
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const isWithin7Days = (createdAt: string | Date) => {
  const created = new Date(createdAt);
  const now = new Date();

  const diffInDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

  return diffInDays <= 7;
};
</script>

<template>
  <div
    v-if="isModalOpen"
    class="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
    @click.self="closeModal"
  >
    <div class="story-modal-container relative w-full h-full sm:w-[400px] sm:h-[90%] bg-black rounded-lg overflow-hidden flex flex-col">
      <div class="story-progress-bar absolute top-0 left-0 right-0 p-2 flex gap-1 z-20">
        <div
          v-for="(story, index) in goal?.progress"
          :key="'bar-' + index"
          class="h-1 bg-white bg-opacity-30 rounded flex-1"
        >
          <div
            class="h-full bg-white transition-all ease-linear duration-100"
            :style="getSegmentProgress(index)"
          />
        </div>
      </div>

      <nuxt-link :to="`/goals/${currentStory?.goal_id}`" class="story-caption z-100 text-center py-1 px-2 absolute bottom-0 w-full bg-slate-600 text-white text-sm line-clamp-5 opacity-75 flex items-center line-height-relaxed">
        {{ currentStory?.caption }}
      </nuxt-link>

      <img
        v-show="!isWaitingForImage"
        :src="currentStory?.media_url"
        class="flex-1 object-contain w-full h-full"
        @load="handleImageLoad"
        @error="handleImageError"
      >

      <div
        v-if="isWaitingForImage"
        class="flex-1 flex items-center justify-center bg-gray-900"
      >
        <svg
          class="animate-spin h-8 w-8 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>

      <div class="absolute inset-0 flex z-10">
        <div
          class="flex-1"
          @click="prevStory"
        />
        <div
          class="flex-1"
          @click="nextStory"
        />
      </div>

      <button
        class="story-close-btn absolute right-2 text-white text-2xl z-20 opacity-70 hover:opacity-100"
        @click="closeModal"
      >
        &times;
      </button>

      <div class="story-user-info absolute left-2 text-white flex items-center gap-2 z-20">
        <avatar :size="32" :user="goal?.created_by" />
        <span class="font-bold text-sm">{{ goal?.created_by?.username }}</span>
      </div>
    </div>
  </div>

  <!-- Story Progress -->
  <div class="flex shadow overflow-x-auto scrollbar-hidden gap-2 border-t border-gray-100 py-2 px-4 bg-[#FBFBFB]">
    <!-- Add Progress -->
    <nuxt-link v-if="goal?.status === 'in-progress' && goal?.created_at && isWithin7Days(goal?.created_at)" :to="`/progress/create-thumbnail?goal_id=${goal?._id}`">
      <div v-if="myUser && myUser._id === goal?.created_by?._id" class="flex flex-col items-center cursor-pointer">
        <div class="w-12 h-12 rounded-xl bg-slate-200 relative flex items-center justify-center">
          <div class="i-fluent:camera-add-20-filled w-10 h-10 rounded-xl text-slate-500" />
        </div>
        <span class="text-xs mt-1 text-gray-700 font-bold">Progress</span>
      </div>
    </nuxt-link>
    <!-- List Progress -->
    <div
      v-for="(story, index) in goal?.progress"
      :key="index"
      class="flex flex-col items-center cursor-pointer"
      @click="handleStoryClick(index)"
    >
      <div class="w-12 h-12 rounded-xl border-1 border-pink-500 relative">
        <img
          :src="story.thumbnail_url"
          class="rounded-xl object-cover w-full h-full"
        >
        <div
          v-if="getPreloadingStatus(index) === 'loading'"
          class="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-30 rounded-xl"
        >
          <svg
            class="animate-spin h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </div>
      <span class="text-xs mt-1 text-gray-700">{{ dateProgress(story.created_at) }}</span>
    </div>
  </div>
</template>
