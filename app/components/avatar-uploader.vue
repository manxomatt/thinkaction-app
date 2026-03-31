<script setup lang="ts">
import { CircleStencil, Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import { uploadToPresignedUrl } from '~/composables/upload';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

const { user, updateUser } = useAuth();

const imageCurrent = ref<string>('');
const imagePreview = ref<string>('');
const cropper = ref();
const uploading = ref(false);
const isEditing = ref(false);
const fileInput = ref<HTMLInputElement>();
const showSourcePicker = ref(false);
const isNativePlatform = ref(false);

onMounted(() => {
  // Check platform after component is mounted to ensure Capacitor is ready
  const platform = Capacitor.getPlatform();
  isNativePlatform.value = Capacitor.isNativePlatform();

  // Debug logging (will be stripped in production, but useful for development)
  if (typeof window !== 'undefined') {

    console.debug('[AvatarUploader] Platform:', platform, 'isNative:', isNativePlatform.value);
  }

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

// Handle avatar click - show source picker on native, use file input on web
const handleAvatarClick = () => {
  if (isNativePlatform.value) {
    showSourcePicker.value = true;
  } else {
    fileInput.value?.click();
  }
};

// Pick image from camera using Capacitor Camera plugin
const pickFromCamera = async () => {
  showSourcePicker.value = false;
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    });

    if (image.dataUrl) {
      imagePreview.value = image.dataUrl;
      isEditing.value = true;
    }
  } catch (error) {
    console.error('Camera error:', error);
  }
};

// Pick image from gallery using Capacitor Camera plugin
const pickFromGallery = async () => {
  showSourcePicker.value = false;
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
    });

    if (image.dataUrl) {
      imagePreview.value = image.dataUrl;
      isEditing.value = true;
    }
  } catch (error) {
    console.error('Gallery error:', error);
  }
};

const closeSourcePicker = () => {
  showSourcePicker.value = false;
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
      @click="handleAvatarClick"
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

    <!-- Source Picker Modal (Native only) -->
    <transition name="fade">
      <div
        v-if="showSourcePicker"
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center"
        @click.self="closeSourcePicker"
      >
        <div class="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-2xl p-4 pb-8 safe-area-inset-bottom">
          <div class="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
          <h3 class="text-lg font-semibold text-center mb-4 text-gray-900 dark:text-white">
            Choose Photo Source
          </h3>
          <div class="space-y-2">
            <button
              class="w-full py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
              @click="pickFromCamera"
            >
              <i class="i-ph-camera-bold text-xl" />
              Take Photo
            </button>
            <button
              class="w-full py-3 px-4 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-2"
              @click="pickFromGallery"
            >
              <i class="i-ph-images-bold text-xl" />
              Choose from Gallery
            </button>
            <button
              class="w-full py-3 px-4 rounded-xl text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
              @click="closeSourcePicker"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.safe-area-inset-bottom {
  padding-bottom: max(2rem, env(safe-area-inset-bottom));
}
</style>
