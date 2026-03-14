<script setup lang="ts">
import { ref } from 'vue';
import { useApiGoals } from '~/composables/api/goals';
import { useFormGoalCreate } from '~/composables/form/goal/create';
import { uploadToPresignedUrl } from '~/composables/upload';

const { user: myUser } = useAuth();

const { form, formErrors, resetForm, resetFormErrors } = useFormGoalCreate();

const options = [
  {
    name: 'Everyone (Public)',
    description: 'Visible to the whole internet.',
    icon: 'i-heroicons:share-solid',
    color: 'text-green-600',
    value: 'public',
  },
  {
    name: 'My Supporters',
    description: 'Visible to people who support you.',
    icon: 'i-heroicons:users-solid',
    color: 'text-indigo-600',
    value: 'supporters',
  },
  {
    name: 'Only Me',
    description: 'Only you can view and track this goal.',
    icon: 'i-heroicons:lock-closed-solid',
    color: 'text-gray-500',
    value: 'private',
  },
];

const selected = ref(options[0]);

function getExtensionFromBlob(blob: Blob): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return mimeToExt[blob.type] || '';
}
interface IPresignAvatarResponse {
  public_domain: string
  public_path: string
  upload_url: string
}
const isPosting = ref(false);
const onPost = async () => {
  isPosting.value = true;

  console.log('=== GOAL CREATE POST START ===');
  console.log('Form data:', {
    specific: form.value.specific,
    measurable: form.value.measurable,
    achievable: form.value.achievable,
    relevant: form.value.relevant,
    thumbnail_blob: form.value.thumbnail_blob ? {
      type: form.value.thumbnail_blob.type,
      size: form.value.thumbnail_blob.size,
      sizeKB: (form.value.thumbnail_blob.size / 1024).toFixed(2),
    } : null,
  });

  if (!form.value.specific || !form.value.measurable || !form.value.achievable || !form.value.relevant || !form.value.thumbnail_blob) {
    console.error('Form validation failed - missing required fields');
    toast('Please complete all form before continue.', { color: 'danger' });
    isPosting.value = false;
    return;
  }

  form.value.visibility = selected.value?.value as 'public' | 'supporters' | 'private';
  console.log('Visibility set to:', form.value.visibility);

  try {
    if (form.value.thumbnail_blob) {
      console.log('=== PRESIGN REQUEST START ===');
      console.log('Requesting presigned URL with:', {
        type: form.value.thumbnail_blob.type,
        ext: getExtensionFromBlob(form.value.thumbnail_blob),
        size: form.value.thumbnail_blob.size,
      });

      const res = await useApiClientFetch<IPresignAvatarResponse>('/storages/presign-goal', {
        method: 'POST',
        credentials: 'include',
        body: {
          type: form.value.thumbnail_blob.type,
          ext: getExtensionFromBlob(form.value.thumbnail_blob),
          size: form.value.thumbnail_blob.size,
        },
      });

      console.log('=== PRESIGN RESPONSE ===');
      console.log('Presign response:', JSON.stringify(res, null, 2));
      console.log('Upload URL:', res.upload_url);
      console.log('Public domain:', res.public_domain);
      console.log('Public path:', res.public_path);

      form.value.thumbnail_url = `${res.public_domain}${res.public_path}`;
      console.log('Full thumbnail URL:', form.value.thumbnail_url);

      // Upload to presigned URL (handles both native and web platforms)
      console.log('=== STARTING UPLOAD TO PRESIGNED URL ===');
      await uploadToPresignedUrl(res.upload_url, form.value.thumbnail_blob);
      console.log('=== UPLOAD COMPLETED ===');
    }

    await useApiGoals().create(form.value as IUser);
    toast('Posting success.', { color: 'success' });
    resetForm();
    resetFormErrors();

    // Calculate the number of milliseconds in 7 days
    const sevenDaysInMilliseconds = 7 * 24 * 60 * 60 * 1000;

    // Add 7 days to the current date's timestamp
    const sevenDaysLater = new Date(new Date().getTime() + sevenDaysInMilliseconds);

    form.value.specific = '';
    form.value.measurable = '';
    form.value.relevant = '';
    form.value.achievable = '';
    form.value.time = sevenDaysLater;
    form.value.visibility = 'public';
    form.value.thumbnail_url = '';
    form.value.thumbnail_blob = null;

    navigateTo('/');
  } catch (error) {
    console.error('=== GOAL CREATE ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'N/A');
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2));

    const errors = handleError(error);
    if (errors) {
      toast('Posting error.', { color: 'danger' });
    }
  } finally {
    console.log('=== GOAL CREATE POST END ===');
    isPosting.value = false;
  }
};

const onBack = () => {
  navigateTo('/goals/create-thumbnail');
};
</script>

<template>
  <layouts-with-aside aside-title="">
    <div class="max-w-lg mx-auto lg:p-8">
      <div class="p-4 bg-white flex flex-col gap-4 border border-gray-200 shadow-lg lg:rounded-xl">
        <div class="flex items-center gap-2">
          <my-avatar />
          <div>
            <p class="font-semibold">{{ myUser?.username }}</p>
            <p class="text-gray-500 text-xs">{{ myUser?.profile?.status }}</p>
          </div>
        </div>

        <div>
          <h3 class="text-slate-800 font-semibold">
            Control your privacy
          </h3>
          <p class="text-sm text-slate-500">
            Set your goal's privacy level by choosing who can see your goal.
          </p>
        </div>

        <base-radio v-model="selected" :options="options" options-layout="vertical" class="space-y-3">
          <template #default="{ checked, option }">
            <div
              class="relative w-full cursor-pointer transition-all duration-300 ease-in-out transform"
              :class="{
                'scale-[1.02] shadow rounded-xl': checked,
                'hover:shadow-md rounded-xl': !checked
              }"
            >
              <div
                :class="[
                  checked
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-700 dark:text-white text-slate-900 border border-gray-200 dark:border-slate-600'
                ]"
                class="rounded-xl w-full p-4 transition-all duration-300 flex items-start gap-4"
              >
                <div class="shrink-0 pt-1">
                  <base-icon :icon="option.icon" class="text-2xl" :class="[checked ? 'text-white' : option.color]" />
                </div>

                <div class="flex flex-col flex-1">
                  <div class="text-base font-semibold">{{ option.name }}</div>
                  <div class="text-sm font-light" :class="{ 'text-indigo-200': checked, 'text-gray-500 dark:text-slate-400': !checked }">
                    {{ option.description }}
                  </div>
                </div>

                <div v-if="checked" class="shrink-0 pt-1">
                  <base-icon
                    icon="i-heroicons:check-circle-20-solid"
                    class="text-2xl text-white transition-opacity duration-300"
                  />
                </div>
              </div>
            </div>
          </template>
        </base-radio>

        <div class="flex items-center justify-between w-full">
          <div>
            <base-button size="lg" shape="rounded" variant="filled" color="danger" @click="onBack">
              <div class="i-icon-park-solid:left-two" /> Back
            </base-button>
          </div>
          <div>
            <base-button size="lg" shape="rounded" variant="filled" color="primary" :is-loading="isPosting" @click="onPost">
              Post <div class="i-typcn:upload text-xl" />
            </base-button>
          </div>
        </div>
      </div>
    </div>

    <template #aside>
      <aside-content>
        <div class="flex-1 w-full text-sm space-y-4 overflow-y-auto">
          <div class="flex justify-start space-x-1 w-90%">
            <div>
              <base-avatar name="AI" src="/images/ai.webp" :size="48" />
            </div>
            <div class="bg-slate-100 text-slate-600 rounded-lg p-3">
              <p>
                Please select the post visibility you prefer for your SMART goal:
              </p>
              <p class="mt-4">
                <b>Public:</b> Your goal will be visible to everyone on the platform and may be searchable online. Great for maximum accountability and sharing progress widely.
              </p>
              <p class="mt-4">
                <b>Supporters:</b> Your goal will be visible only to the people you have explicitly designated as supporters (e.g., specific friends, mentors, or team members). Ideal for focused accountability and getting feedback from a small, trusted group.
              </p>
              <p class="mt-4">
                <b>Private:</b> Your goal will be visible only to you. Perfect for highly personal or sensitive goals where you want absolute privacy.
              </p>
            </div>
          </div>
        </div>
      </aside-content>
    </template>
  </layouts-with-aside>
</template>
