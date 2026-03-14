<script setup lang="ts">
import { nextTick, ref, onBeforeUnmount, useTemplateRef  } from 'vue';
import { useFormGoalCreate } from '~/composables/form/goal/create';

const asideMounted = ref(false);
const { form, formErrors } = useFormGoalCreate();
const { user: myUser } = useAuth();
const isSaving = ref(false);

const formatText = (text: string): string => {
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphs = safe.split(/\n{2,}/).map(p => p.replace(/\n/g, '<br>').trim());
  return paragraphs.map(p => `<p>${p}</p>`).join('');
};

const messages = ref<{ html: string; full: string }[]>([]);
let eventSource: EventSource | null = null;
const activeIntervals = new Set<NodeJS.Timeout>();

const typeTextSequentially = async (msg: { html: string; full: string } | undefined, newText: string): Promise<void> => {
  if (!msg) return;

  const chars = newText.slice(msg?.full.length).split('');

  for (const c of chars) {
    msg.full += c;
    msg.html = formatText(msg.full);

    await nextTick();

    await new Promise(r => setTimeout(r, 5)); // typing speed
  }
};

const config = useRuntimeConfig();
const apiBaseURL = config.public.apiBase;
const { isNative } = useCapacitor();

const postAi = async (code: string) => {
  if (!form.value.specific || !form.value.measurable || !form.value.achievable || !form.value.relevant) {
    toast('Please complete all form before continue.', { color: 'danger' });
    return;
  }

  messages.value = [];
  eventSource?.close();
  activeIntervals.forEach(clearInterval);
  activeIntervals.clear();

  let paragraphBuffer = '';
  let currentPromise = Promise.resolve();

  const queryParams = new URLSearchParams({
    template: code,
    specific: form.value.specific,
    measurable: form.value.measurable,
    achievable: form.value.achievable,
    relevant: form.value.relevant,
  }).toString();

  const urlWithParams = `${apiBaseURL}/ai/send?${queryParams}`;

  const processFinalChunk = async (finalContent: string) => {
    const newMessageIndex = messages.value.length;
    messages.value.push({ full: '', html: '' });
    await nextTick();
    return await typeTextSequentially(messages.value[newMessageIndex], finalContent);
  };

  const processSSEData = async (data: string) => {
    if (data === '[DONE]') {
      currentPromise = currentPromise.then(() => processFinalChunk(paragraphBuffer));
      paragraphBuffer = '';
      return true; // Signal done
    }

    try {
      const chunk = JSON.parse(data);
      const content = chunk?.content ?? data;
      paragraphBuffer += content;

      const paragraphs = paragraphBuffer.split(/\n{2,}/);

      while (paragraphs.length > 1) {
        const complete = paragraphs.shift();
        if (complete?.trim()) {
          const newMessageIndex = messages.value.length;
          messages.value.push({ full: '', html: '' });
          await nextTick();

          currentPromise = currentPromise.then(() =>
            typeTextSequentially(messages.value[newMessageIndex], complete),
          );
        }
      }

      paragraphBuffer = paragraphs[0] ?? '';
    } catch {
      paragraphBuffer += data;
    }
    return false;
  };

  const handleStreamEnd = () => {
    if (paragraphBuffer.trim()) {
      currentPromise = currentPromise.then(() => processFinalChunk(paragraphBuffer));
      paragraphBuffer = '';
    }
  };

  // Use fetch with streaming for both native and web (avoids CORS issues on native)
  if (isNative) {
    // For native apps, use fetch API which Capacitor can intercept
    // Note: Capacitor HTTP plugin doesn't support streaming, so we use a workaround
    // by making a regular fetch request that the native layer can handle
    try {
      const { CapacitorHttp } = await import('@capacitor/core');
      const authToken = await import('~/composables/capacitor').then(m => m.getAuthToken());
      const response = await CapacitorHttp.get({
        url: urlWithParams,
        headers: {
          'Accept': 'text/event-stream',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        connectTimeout: 60000,
        readTimeout: 60000,
      });

      // Process the full response as SSE data
      if (response.data) {
        const lines = (typeof response.data === 'string' ? response.data : JSON.stringify(response.data)).split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data) {
              const isDone = await processSSEData(data);
              if (isDone) break;
            }
          }
        }
        handleStreamEnd();
      }
    } catch (error) {
      console.error('Native SSE fetch error:', error);
      handleStreamEnd();
    }
  } else {
    // For web, use EventSource (standard SSE)
    eventSource = new EventSource(urlWithParams, {
      withCredentials: true,
    });

    eventSource.onmessage = async (event) => {
      const isDone = await processSSEData(event.data);
      if (isDone) {
        eventSource?.close();
      }
    };

    eventSource.onerror = () => {
      eventSource?.close();
      handleStreamEnd();
    };
    eventSource.addEventListener('end', () => {
      eventSource?.close();
      handleStreamEnd();
    });
  }
};

const askAi = async () => {
  if (!form.value.specific || !form.value.measurable || !form.value.achievable || !form.value.relevant) {
    toast('Please complete all form before continue.', { color: 'danger' });
    return;
  }

  asideMounted.value = true;
};

const onNext = () => {
  if (!form.value.specific || !form.value.measurable || !form.value.achievable || !form.value.relevant) {
    toast('Please complete all form before continue.', { color: 'danger' });
    return;
  }

  navigateTo('/goals/create-thumbnail');
};

onMounted(() => {
  if (!myUser.value) {
    navigateTo('/signin');
  }
});

onBeforeUnmount(() => {
  eventSource?.close();
  activeIntervals.forEach(clearInterval);
  activeIntervals.clear();
});
</script>

<template>
  <layouts-with-aside v-model:aside-mounted="asideMounted" aside-title="">
    <div class="max-w-lg mx-auto lg:p-8">
      <div class="p-4 bg-white flex flex-col gap-4 border border-gray-200 shadow-lg lg:rounded-xl">
        <div class="flex items-center gap-2">
          <my-avatar />
          <div>
            <p class="font-semibold">{{ myUser?.username }}</p>
            <p class="text-gray-500 text-xs">{{ myUser?.profile?.status }}</p>
          </div>
        </div>

        <div v-if="myUser?.avatar" class="flex flex-col gap-2">
          <div class="text-sm">
            <p class="text-sm line-height-relaxed space-x-1">
              <span class="font-semibold">Next week, I want to</span>
              <span class="font-light text-xs">(one action to accomplish what you want)</span>
            </p>
            <base-textarea
              id="specific"
              v-model="form.specific"
              autofocus
              :errors="formErrors.specific"
              placeholder="i.e. do my sales presentation deck"
            />
          </div>

          <div class="text-sm">
            <p class="text-sm line-height-relaxed space-x-1">
              <span class="font-semibold">I'll know it's done if</span>
              <span class="font-light text-xs">(in number or clear result)</span>
            </p>
            <base-textarea
              id="measurable"
              v-model="form.measurable"
              :errors="formErrors.measurable"
              placeholder="i.e. I have 10 slides of deck that I am confident enough to present"
            />
          </div>

          <div class="text-sm">
            <p class="text-sm line-height-relaxed space-x-1">
              <span class="font-semibold">This matters to me because</span>
              <span class="font-light text-xs">(explain your why)</span>
            </p>
            <base-textarea
              id="relevant"
              v-model="form.relevant"
              :errors="formErrors.relevant"
              placeholder="i.e. the deck will assist me in achieving my sales target"
            />
          </div>

          <div class="text-sm">
            <p class="text-sm line-height-relaxed space-x-1">
              <span class="font-semibold">Things I need to do to achieve this</span>
            </p>
            <base-textarea
              id="achievable"
              v-model="form.achievable"
              class="text-sm"
              :min-height="155"
              :errors="formErrors.achievable"
              placeholder="i.e.
- I plan to get initial feedback from my manager by Wednesday.
- The final version will be completed and rehearsed by Friday."
            />
          </div>

          <div class="flex items-center justify-between w-full">
            <div class="lg:hidden">
              <base-button size="lg" shape="rounded" :loading="isSaving" variant="filled" color="success" @click="askAi">
                Ask AI <div class="i-octicon:comment-ai-16" />
              </base-button>
            </div>
            <div class="hidden lg:block" />
            <div>
              <base-button size="lg" shape="rounded" :loading="isSaving" variant="filled" color="primary" @click="onNext">
                Next <div class="i-icon-park-solid:right-two" />
              </base-button>
            </div>
          </div>
        </div>

        <div v-else class="flex flex-col gap-2">
          Upload your avatar first so others can easily recognize and support your goal 💙
          <nuxt-link to="/profile" class="bg-blue-400 text-white py-2 px-4 flex items-center gap-2 rounded"> <span class="i-fa-regular:hand-point-right" /> Go to profile</nuxt-link>
        </div>
      </div>
    </div>

    <template #aside>
      <aside-content ref="messageContainerRef">
        <div class="flex-1 w-full text-sm space-y-4">

          <div class="flex justify-start space-x-1 w-90%">
            <div>
              <base-avatar name="AI" src="/images/ai.webp" :size="48" />
            </div>
            <div class="bg-slate-100 text-slate-600 rounded-lg p-3">
              <p>
                Hello! I'm happy to help you create a SMART goal! I'm your assistant here to guide you through the process.
                To get started, please choose 3 options from the list below:
              </p>
            </div>
          </div>

          <div v-if="!messages.length" class="flex flex-col gap-1">
            <div class="flex gap-2 justify-end">
              <base-button shape="rounded" variant="filled" color="warning" class="flex gap-1 items-center px-3!" @click="postAi('make-it-fun')">
                <div class="i-fa:hand-o-right" />
                <p class="uppercase text-xs font-bold">Make it fun</p>
              </base-button>
            </div>
            <div class="flex gap-2 justify-end">
              <base-button shape="rounded" variant="filled" color="warning" class="flex gap-1 items-center px-3!" @click="postAi('improve-my-goal')">
                <div class="i-fa:hand-o-right" />
                <p class="uppercase text-xs font-bold">Improve my goal</p>
              </base-button>
            </div>
            <div class="flex gap-2 justify-end">
              <base-button shape="rounded" variant="filled" color="warning" class="flex gap-1 items-center px-3!" @click="postAi('reach-my-goal-faster')">
                <div class="i-fa:hand-o-right" />
                <p class="uppercase text-xs font-bold">Reach my goal faster</p>
              </base-button>
            </div>
          </div>

          <div v-if="messages.length" class="flex justify-start space-x-1 w-90%">
            <div>
              <base-avatar name="AI" src="/images/ai.webp" :size="48" />
            </div>
            <div class="bg-slate-100 text-slate-600 rounded-lg p-3 prose prose-sm max-w-none">
              <div
                v-for="(msg, i) in messages"
                :key="i"
                class="mb-3 last:mb-0 transition-all duration-200"
              >
                <div v-for="(para, idx) in (msg.full || '').split(/\\n{2,}/)" :key="idx">
                  <p class="whitespace-pre-line text-sm m-0">{{ para.trim() }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside-content>
    </template>
  </layouts-with-aside>
</template>

<style scoped>
.mb-3 { margin-bottom: 0.75rem; }
.last\:mb-0:last-child { margin-bottom: 0; }
</style>
