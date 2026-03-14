<script setup lang="ts">
import { ref } from 'vue';
import { useApiGoals } from '~/composables/api/goals';
import { useFormProgressCreate } from '~/composables/form/progress/create';
import { uploadToPresignedUrl } from '~/composables/upload';

const { user: myUser } = useAuth();

const { form, formErrors, resetForm, resetFormErrors } = useFormProgressCreate();

const route = useRoute();

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

  if (!form.value.caption || !form.value.thumbnail_blob) {
    toast('Please complete all form before continue.', { color: 'danger' });
    isPosting.value = false;
    return;
  }

  try {
    if (form.value.media_blob) {
      const res = await useApiClientFetch<IPresignAvatarResponse>('/storages/presign-progress', {
        method: 'POST',
        credentials: 'include',
        body: {
          type: form.value.media_blob.type,
          ext: getExtensionFromBlob(form.value.media_blob),
          size: form.value.media_blob.size,
        },
        query: {
          goal_id: form.value.goal_id,
        },
      });
      form.value.media_url = `${res.public_domain}${res.public_path}`;

      // Upload to presigned URL (handles both native and web platforms)
      await uploadToPresignedUrl(res.upload_url, form.value.media_blob);

      const res2 = await useApiClientFetch<IPresignAvatarResponse>('/storages/presign-progress', {
        method: 'POST',
        credentials: 'include',
        body: {
          type: form.value.thumbnail_blob.type,
          ext: getExtensionFromBlob(form.value.thumbnail_blob),
          size: form.value.thumbnail_blob.size,
        },
        query: {
          goal_id: form.value.goal_id,
        },
      });
      form.value.thumbnail_url = `${res2.public_domain}${res2.public_path}`;

      // Upload to presigned URL (handles both native and web platforms)
      await uploadToPresignedUrl(res2.upload_url, form.value.thumbnail_blob);
    }

    await useApiGoals().createProgress(form.value.goal_id, form.value as IUser);
    toast('Posting success.', { color: 'success' });
    resetForm();
    resetFormErrors();

    form.value.caption = '';
    form.value.media_url = '';
    form.value.media_blob = null;
    form.value.thumbnail_url = '';
    form.value.thumbnail_blob = null;

    await useApiGoals().update(form.value.goal_id as string, {
      status: 'achieved',
    });

    toast('Congratulations for achieving your goal.', { color: 'success' });

    navigateTo('/');
  } catch (error) {
    const errors = handleError(error);
    if (errors) {
      toast('Posting error.', { color: 'danger' });
    }
  } finally {
    isPosting.value = false;
  }
};

const onBack = () => {
  navigateTo(`/complete/create-thumbnail?goal_id=${route.query.goal_id}`);
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
            Caption
          </h3>
          <p class="text-sm text-slate-500">
            Add a note to explain what you’ve successfully done.
          </p>
        </div>

        <div class="text-sm">
          <base-textarea
            id="caption"
            v-model="form.caption"
            class="text-sm"
            :min-height="155"
            :errors="formErrors.caption"
            placeholder=""
          />
        </div>

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
        <!-- TODO: aside content here -->
      </aside-content>
    </template>
  </layouts-with-aside>
</template>
