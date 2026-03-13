<script setup lang="ts">
import { CircleStencil, Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import { uploadToPresignedUrl } from '~/composables/upload';

const { user, updateUser } = useAuth();

const imageCurrent = ref<string>('');
const imagePreview = ref<string>('');
const cropper = ref();
const uploading = ref(false);
const isEditing = ref(false);
const fileInput = ref<HTMLInputElement>();

onMounted(() => {
  if (user.value?.avatar?.public_domain && user.value?.avatar?.public_path) {
    imageCurrent.value = `${user.value.avatar.public_domain}${user.value.avatar.public_path}`;
  }
});

function getExtensionFromBlob(blob: Blob): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return mimeToExt[blob.type] || '';
}

// handle file pick or drop
const handleFile = (file: File) => {
  if (!file.type.startsWith('image/')) return;
  imagePreview.value = URL.createObjectURL(file);
  isEditing.value = true;
};

// drop event
const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  if (e.dataTransfer?.files?.[0]) handleFile(e.dataTransfer.files[0]);
};

// choose from file input
const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) handleFile(target.files[0]);
};

// crop & upload
const upload = async () => {
  if (!cropper.value) return;
  const { canvas } = cropper.value.getResult();
  if (!canvas) return alert('Nothing to crop');

  uploading.value = true;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.95),
  );
  if (!blob) return;

  interface IPresignAvatarResponse {
    public_domain: string
    public_path: string
    upload_url: string
  }

  try {
    const res = await useApiClientFetch<IPresignAvatarResponse>('/storages/presign-avatar', {
      method: 'POST',
      credentials: 'include',
      body: {
        type: blob.type,
        ext: getExtensionFromBlob(blob),
        size: blob.size,
      },
    });

    // Upload to presigned URL (handles both native and web platforms)
    await uploadToPresignedUrl(res.upload_url, blob);

    await useApiClientFetch(`/users/${user.value?._id}`, {
      method: 'PATCH',
      credentials: 'include',
      body: {
        avatar: {
          public_domain: res.public_domain,
          public_path: res.public_path,
        },
      },
    });

    // Update current avatar in UI & store
    imageCurrent.value = `${res.public_domain}${res.public_path}`;
    updateUser({
      ...user.value,
      avatar: {
        public_domain: res.public_domain,
        public_path: res.public_path,
      },
    });

    // reset editor
    isEditing.value = false;
    imagePreview.value = '';
  } catch (err) {
    console.error('Upload failed:', err);
  } finally {
    uploading.value = false;
  }
};

const cancelEdit = () => {
  isEditing.value = false;
  imagePreview.value = '';
};
</script>

<template>
  <div
    class="flex flex-col items-center space-y-4"
    @dragover.prevent
    @drop="handleDrop"
  >
    <!-- Avatar -->
    <div
      class="relative group cursor-pointer flex flex-col items-center"
      @click="fileInput?.click()"
    >
      <!-- Avatar Image -->
      <my-avatar :src="imageCurrent ?? ''" :size="128" />

      <!-- Hover Overlay -->
      <div class="absolute inset-0 flex items-center justify-center bg-black/40 text-white font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full">
        Click to Edit
      </div>

      <div v-if="!user?.avatar" class="absolute inset-0 flex items-center justify-center bg-black/40 text-white font-semibold text-sm rounded-full">
        Click to Edit
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleFileChange"
    >

    <!-- Backdrop + Modal Crop Editor -->
    <transition name="fade">
      <div
        v-if="isEditing"
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center mx-auto"
      >
        <div class="h-[50%] w-full lg:w-[50%] flex items-center justify-center">
          <Cropper
            ref="cropper"
            :src="imagePreview"
            :canvas="{
              minHeight: 128,
              minWidth: 128,
              maxHeight: 512,
              maxWidth: 512,
            }"
            :stencil-props="{ aspectRatio: 1, movable: true, resizable: true }"
            :stencil-component="CircleStencil"
          />
        </div>

        <div class="flex items-center justify-center gap-3 mt-6">
          <button
            class="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
            @click="cancelEdit"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            @click="upload"
          >
            {{ uploading ? 'Uploading…' : 'Upload' }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
