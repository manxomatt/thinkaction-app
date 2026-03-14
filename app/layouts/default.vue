<script setup>
import { ref, onMounted  } from 'vue';
import { toastRef } from '~/composables/toast';
import { useApiNotifications } from '~/composables/api/notifications';

const { signout, isAuthenticated, user: authUser } = useAuth();
const apiNotifications = useApiNotifications();

const notifications = ref();

const showMenu = ref(false);
const showCreateMenu = ref(false);
const showNotificationPanel = ref(false);
const showSearchPanel = ref(false);
const showCreatePanel = ref(false);

const { unreadCount, clearUnread, incrementUnread } = useNotification();

const toggleNotificationPanel = () => {
  if (!authUser.value) {
    navigateTo('/signin');
  }
  closeAllPanel();
  showNotificationPanel.value = !showNotificationPanel.value;
};

const toggleSearchPanel = () => {
  closeAllPanel();
  showSearchPanel.value = !showSearchPanel.value;
};

const toggleCreatePanel = () => {
  closeAllPanel();
  showCreatePanel.value = !showCreatePanel.value;
};

const closeAllPanel = () => {
  showCreatePanel.value = false;
  showSearchPanel.value = false;
  showNotificationPanel.value = false;
};

const onSignout = async () => {
  closeAllPanel();
  await signout();
  navigateTo('/signin');
};

onMounted(async () => {
  notifications.value = await apiNotifications.retrieveAll({
    filter: {
      recipient_id: authUser.value?._id,
      is_read: false,
    },
    sort: '-created_at',
  });

  if (notifications.value.data.length) {
    incrementUnread();
  }
});
</script>

<template>
  <div class="min-h-svh max-w-screen overflow-x-hidden bg-body flex font-open-sans">
    <!-- Sidebar (Desktop only) -->
    <nav class="hidden lg:flex flex-col w-64 h-screen fixed bg-white border-r border-gray-200 p-4 pt-6 z-20">

      <logo />

      <div class="flex flex-col overflow-y-auto space-y-1 text-lg mt-8">
        <nuxt-link to="/" class="flex items-center space-x-2 px-2 py-2.5 hover:bg-gray-100 rounded-lg" active-class="font-extrabold" @click="closeAllPanel">
          <div class="i-lucide:home text-3xl" />
          <span>Home</span>
        </nuxt-link>

        <button class="flex items-center space-x-2 px-2 py-2.5 hover:bg-gray-100 rounded-lg" active-class="font-extrabold" @click="toggleSearchPanel">
          <div class="i-lucide:search text-3xl" />
          <span>Search</span>
        </button>

        <nuxt-link v-if="isAuthenticated" to="/goals/me" class="flex items-center space-x-2 px-2 py-2.5 hover:bg-gray-100 rounded-lg" active-class="font-extrabold" @click="closeAllPanel">
          <div class="i-mingcute:target-line text-3xl" />
          <span>My Goals</span>
        </nuxt-link>

        <nuxt-link v-if="isAuthenticated" to="/goals/supporting" class="flex items-center space-x-2 px-2 py-2.5 hover:bg-gray-100 rounded-lg" active-class="font-extrabold" @click="closeAllPanel">
          <div class="i-lucide:user-star text-3xl" />
          <span>Supporting</span>
        </nuxt-link>

        <button v-if="isAuthenticated" class="flex items-center space-x-2 px-2 py-2.5 hover:bg-gray-100 rounded-lg" active-class="font-extrabold" @click="toggleNotificationPanel">
          <div class="relative">
            <div class="i-lucide:bell text-3xl" />
            <span
              v-if="unreadCount > 0"
              class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full"
            />
          </div>
          <span>Notifications</span>
        </button>

        <button v-if="isAuthenticated" class="flex items-center space-x-2 px-2 py-2.5 hover:bg-gray-100 rounded-lg" active-class="font-extrabold" @click="toggleCreatePanel">
          <div class="i-proicons:add-square-multiple text-3xl" />
          <span>Create</span>
        </button>

        <nuxt-link v-if="isAuthenticated" to="/profile" class="flex items-center space-x-2 px-2 py-2.5 hover:bg-gray-100 rounded-lg" active-class="font-extrabold" @click="closeAllPanel">
          <my-avatar :size="32" />
          <span>Profile</span>
        </nuxt-link>
      </div>

      <div v-if="isAuthenticated" class="mt-auto pt-6 border-t border-gray-200">
        <button class="flex items-center cursor-pointer w-full space-x-2 px-2 py-2.5 bg-red-500 text-white hover:bg-red-600 rounded-lg font-bold" @click="onSignout">
          <div class="i-stash:signout text-3xl" />
          <span>Sign Out</span>
        </button>
      </div>
      <div v-else class="mt-auto pt-6 border-t border-gray-200 gap-2 flex flex-col">
        <nuxt-link to="/signup">
          <button class="flex items-center cursor-pointer w-full space-x-2 px-2 py-2.5 bg-primary text-white hover:bg-blue-600 rounded-lg font-bold">
            <div class="i-icon-park-outline:doc-add text-3xl" />
            <span>Register</span>
          </button>
        </nuxt-link>
        <nuxt-link to="/signin">
          <button class="flex items-center cursor-pointer w-full space-x-2 px-2 py-2.5 bg-blue-500 text-white hover:bg-blue-600 rounded-lg font-bold">
            <div class="i-stash:signin text-3xl" />
            <span>Sign In</span>
          </button>
        </nuxt-link>
      </div>
    </nav>

    <MenuNotificationPanel v-model:show-sidebar="showNotificationPanel" />
    <MenuSearchPanel v-model:show-sidebar="showSearchPanel" />
    <MenuCreatePanel v-model:show-sidebar="showCreatePanel" />

    <!-- Slide-Up Create Options (Mobile) -->
    <Transition name="slide-up">
      <div v-if="showCreateMenu" class="fixed inset-0 bg-black/50 flex items-end justify-center z-50" @click.self="showCreateMenu = false">
        <div class="menu-panel w-full max-w-xl bg-white rounded-t-2xl pb-[env(safe-area-inset-bottom,0px)]">
          <div class="flex justify-between items-center mb-2 pt-4 px-4">
            <h3 class="text-sm font-semibold" />
            <button @click="showCreateMenu = false">
              <i class="i-lucide-x" />
            </button>
          </div>
          <nuxt-link to="/goals/create" class="w-full p-4 flex flex-col items-center justify-center text-center bg-green-500 text-white" @click="showCreateMenu = false">
            <div class="i-mingcute:target-fill text-3xl mb-1" />
            <span class="font-bold uppercase text-md">Create Goal</span>
            <span class="text-xs font-normal opacity-80 mt-1">Let's make a plan.</span>
          </nuxt-link>

          <nuxt-link to="/progress/create" class="w-full p-4 flex flex-col items-center justify-center text-center bg-blue-400 text-white" @click="showCreateMenu = false">
            <div class="i-solar:camera-bold text-3xl mb-1" />
            <span class="font-bold uppercase text-md">Update Progress</span>
            <span class="text-xs font-normal opacity-80 mt-1">Share your progress now!</span>
          </nuxt-link>
        </div>
      </div>
    </Transition>

    <!-- Slide-Up Menu (Mobile) -->
    <Transition name="slide-up">
      <div v-if="showMenu" class="fixed inset-0 bg-black/50 flex items-end justify-center z-50" @click.self="showMenu = false">
        <div class="menu-panel w-full max-w-xl bg-white rounded-t-2xl pb-[env(safe-area-inset-bottom,0px)]">
          <div class="flex justify-between items-center mb-2 pt-4 px-4">
            <h3 class="text-sm font-semibold">
              More Options
            </h3>
            <button @click="showMenu = false">
              <i class="i-lucide-x" />
            </button>
          </div>
          <nuxt-link v-if="isAuthenticated" to="/goals/me" class="w-full flex px-4 items-center gap-2 py-3 border-b border-blue-100 hover:bg-blue-50" @click="showMenu = false">
            <div class="i-mingcute:target-fill text-2xl text-black" /> My Goals
          </nuxt-link>
          <nuxt-link v-if="isAuthenticated" to="/goals/supporting" class="w-full flex px-4 items-center gap-2 py-3 border-b border-blue-100 hover:bg-blue-50" @click="showMenu = false">
            <div class="i-lucide:user-star text-2xl text-black" /> Supporting
          </nuxt-link>
          <nuxt-link v-if="isAuthenticated" to="/profile" class="w-full flex px-4 items-center gap-2 py-3 border-b border-blue-100 hover:bg-blue-50" @click="showMenu = false">
            <div class="w-7 h-7 rounded-full bg-pink-400" /> Profile
          </nuxt-link>
          <nuxt-link v-if="!isAuthenticated" to="/signin" class="w-full flex px-4 items-center gap-2 py-3 border-b border-blue-100 hover:bg-blue-50" @click="showMenu = false">
            <div class="w-7 h-7 rounded-full bg-pink-400" /> Sign In
          </nuxt-link>
          <button v-if="isAuthenticated" class="w-full flex px-4 items-center gap-2 py-3 border-b border-blue-100 hover:bg-red-50" @click="onSignout">
            <div class="i-stash:signout w-7 h-7  text-3xl" /> Sign Out
          </button>
        </div>
      </div>
    </Transition>

    <!-- Main Content Area -->
    <main class="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-0 lg:ml-64 flex relative max-w-screen">
      <slot />
    </main>

    <!-- Bottom Navigation (Mobile only) -->
    <nav
      class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center lg:hidden shadow-2xl pb-[env(safe-area-inset-bottom,0px)] h-[calc(4rem+env(safe-area-inset-bottom,0px))]"
    >
      <nuxt-link to="/">
        <div class="i-lucide:home text-3xl text-black cursor-pointer" />
      </nuxt-link>
      <button @click="toggleSearchPanel">
        <div class="i-lucide:search text-3xl text-gray-700 cursor-pointer" />
      </button>
      <button @click="showCreateMenu = true">
        <div class="i-proicons:add-square-multiple text-3xl" />
      </button>
      <button @click="toggleNotificationPanel">
        <div class="relative">
          <div class="i-lucide:bell text-3xl text-gray-700 cursor-pointer" />
          <span
            v-if="unreadCount > 0"
            class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full"
          />
        </div>
      </button>
      <button @click="showMenu = true">
        <div class="i-lucide:menu text-3xl text-gray-700 cursor-pointer" />
      </button>
    </nav>
  </div>
  <base-toast ref="toastRef" />
</template>
