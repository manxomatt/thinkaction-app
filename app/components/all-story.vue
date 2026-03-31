<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useApiGoals, type IGoal, type IGoalProgress } from '~/composables/api/goals';

/* ------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------ */
type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error'

/* ------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------ */
const STORY_DURATION = 5000;

/* ------------------------------------------------------------------
 * Models / Props
 * ------------------------------------------------------------------ */
const goal = defineModel<IGoal>('goal');
const progressList = defineModel<IGoalProgress[]>('progress');
const apiGoals = useApiGoals();

/* ------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------ */
const isModalOpen = ref(false);
const activeIndex = ref(0);
const progressValue = ref(0);
const isWaitingForImage = ref(false);

/* ------------------------------------------------------------------
 * Image Preloading
 * ------------------------------------------------------------------ */
const preloadingPromises: Record<number, Promise<LoadStatus>> = {};
const preloadingStatus = ref<Record<number, LoadStatus>>({});

/* ------------------------------------------------------------------
 * Timer
 * ------------------------------------------------------------------ */
let timer: ReturnType<typeof setInterval> | null = null;

/* ------------------------------------------------------------------
 * Computed
 * ------------------------------------------------------------------ */
const currentStory = computed(
  () => progressList.value?.[activeIndex.value],
);

const { user: myUser } = useAuth();

/* ------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------ */
const getPreloadingStatus = (index: number): LoadStatus =>
  preloadingStatus.value[index] ?? 'idle';

/* ------------------------------------------------------------------
 * Image Loader
 * ------------------------------------------------------------------ */
function loadImage(index: number): Promise<LoadStatus> {
  if (preloadingPromises[index]) {
    return preloadingPromises[index];
  }

  preloadingStatus.value[index] = 'loading';

  const promise: Promise<LoadStatus> = new Promise((resolve) => {
    const img = new Image();
    img.src = progressList.value?.[index]?.media_url ?? '';

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
 * Story Control
 * ------------------------------------------------------------------ */
async function openStory(index: number): Promise<void> {
  const total = progressList.value?.length ?? 0;

  if (index < 0 || index >= total) {
    closeModal();
    return;
  }

  activeIndex.value = index;
  isModalOpen.value = true;
  isWaitingForImage.value = true;

  await loadImage(index);
}

function closeModal(): void {
  isModalOpen.value = false;
  stopTimer();
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
 * Progress Bar
 * ------------------------------------------------------------------ */
function startProgress(): void {
  progressValue.value = 0;
  stopTimer();

  const step = 100;
  const increment = (step / STORY_DURATION) * 100;

  timer = setInterval(() => {
    progressValue.value += increment;
    if (progressValue.value >= 100) {
      stopTimer();
      nextStory();
    }
  }, step);
}

function stopTimer(): void {
  if (timer) clearInterval(timer);
  timer = null;
  progressValue.value = 0;
}

function getSegmentProgress(index: number): { width: string } {
  if (index < activeIndex.value) return { width: '100%' };
  if (index === activeIndex.value) return { width: `${progressValue.value}%` };
  return { width: '0%' };
}

/* ------------------------------------------------------------------
 * Watchers
 * ------------------------------------------------------------------ */
watch(activeIndex, () => {
  if (isModalOpen.value) stopTimer();
});

/* ------------------------------------------------------------------
 * Lifecycle
 * ------------------------------------------------------------------ */
onMounted(async () => {
  const response = await apiGoals.retrieveAllProgress({
    sort: '-created_at',
    page_size: 25,
  });
  progressList.value = response.data;
  progressList.value?.forEach((_, index) => loadImage(index));
});

onUnmounted(stopTimer);
</script>

<template>
  <!-- Story Modal -->
  <div
    v-if="isModalOpen"
    class="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
    @click.self="closeModal"
  >
    <div class="story-modal-container relative w-full h-full sm:w-[400px] sm:h-[90%] bg-black rounded-lg overflow-hidden flex flex-col">
      <!-- Progress Bars -->
      <div class="story-progress-bar absolute top-0 left-0 right-0 p-2 flex gap-1 z-20">
        <div
          v-for="(_, index) in progressList"
          :key="index"
          class="h-1 bg-white bg-opacity-30 rounded flex-1"
        >
          <div
            class="h-full bg-white transition-all duration-100 linear"
            :style="getSegmentProgress(index)"
          />
        </div>
      </div>

      <nuxt-link :to="`/goals/${currentStory?.goal_id}`" class="story-caption z-100 text-center py-1 px-2 absolute bottom-0 w-full bg-slate-600 text-white text-sm line-clamp-5 opacity-75 flex items-center line-height-relaxed">
        {{ currentStory?.caption }}
      </nuxt-link>

      <!-- Image -->
      <img
        v-show="!isWaitingForImage"
        :src="currentStory?.media_url"
        class="flex-1 object-contain w-full h-full"
        @load="handleImageLoad"
        @error="handleImageError"
      >

      <!-- Loader -->
      <div
        v-if="isWaitingForImage"
        class="flex-1 flex items-center justify-center bg-gray-900"
      >
        <svg class="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path
            class="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>

      <!-- Navigation -->
      <div class="absolute inset-0 flex z-10">
        <div class="flex-1" @click="prevStory" />
        <div class="flex-1" @click="nextStory" />
      </div>

      <!-- Close -->
      <button
        class="story-close-btn absolute right-2 text-white text-2xl z-20"
        @click="closeModal"
      >
        &times;
      </button>

      <!-- User -->
      <div class="story-user-info absolute left-2 text-white flex items-center gap-2 z-20">
        <avatar :size="32" :user="currentStory?.created_by" />
        <span class="font-bold text-sm">
          {{ currentStory?.created_by?.username }}
        </span>
      </div>
    </div>
  </div>

  <!-- Story Thumbnails -->
  <div class="flex gap-2 overflow-x-auto scrollbar-hidden py-2 px-4 bg-[#FBFBFB]">
    <!-- Add Progress -->
    <nuxt-link
      v-if="myUser?._id"
      to="/progress/create"
    >
      <div class="flex flex-col items-center cursor-pointer">
        <div class="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center">
          <div class="i-fluent:camera-add-20-filled w-10 h-10 text-slate-500" />
        </div>
        <span class="text-xs text-center mt-1 w-20 truncate font-bold">Progress</span>
      </div>
    </nuxt-link>

    <!-- Progress List -->
    <div
      v-for="(story, index) in progressList"
      :key="story._id"
      class="flex flex-col items-center cursor-pointer"
      @click="openStory(index)"
    >
      <div class="w-20 h-20 rounded-full border border-pink-500 relative">
        <img
          :src="story.thumbnail_url"
          class="rounded-full object-cover w-full h-full"
        >
        <div
          v-if="getPreloadingStatus(index) === 'loading'"
          class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-xl"
        >
          <svg class="animate-spin h-4 w-4 text-white" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="10" stroke="currentColor" stroke-width="4" />
          </svg>
        </div>
      </div>
      <span class="text-xs text-center mt-1 w-20 truncate">
        {{ story.created_by?.username }}
      </span>
    </div>
  </div>
</template>
