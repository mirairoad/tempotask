<script setup lang="ts">
import GToast from '@src/components/global/GToast.vue';
import ActionsMenu from '@src/components/parts/ActionsMenu.vue';
import FilterToggle from '@src/components/parts/FilterToggle.vue';
import Sidebar from '@src/components/parts/Sidebar.vue';
import SidePanel from '@src/components/parts/SidePanel.vue';
import { useAppStore } from '@src/stores/app';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const appStore = useAppStore();
const darkMode = ref(false);
const route = useRoute();

// Add this computed property to handle toast messages
const toastMessage = computed(() => appStore.toastMessage);

const updateSearchVisibility = () => {
  // console.log(appStore.menuItems,appStore.currentMenuItem, route?.path)
    const currentMenuItem = appStore.menuItems.find(item => item.title === appStore.currentMenuItem?.title);
    
    appStore.hasSearch = currentMenuItem?.search || false;

    if(currentMenuItem?.path !== route?.path){
      const currentSubmenu = currentMenuItem?.items.find(item => item.path === route?.path);
      if(currentSubmenu?.search){
        appStore.hasSearch = true;
      }
    }

    appStore.setCurrentPage(currentMenuItem.title);
};

// Watch for route changes
watch(
  () => route.path,
  () => {
    updateSearchVisibility();
  },
  { immediate: true }
);

const search = () => {
  appStore.search();
};

const handleFilterChange = (value: 'asc' | 'desc') => {
  appStore.sortDirection = value;
};
</script>

<template>
  <div class="flex min-h-screen bg-surface-50 dark:bg-surface-900">
    <!-- Add GToast component -->
    <GToast :message="toastMessage" />

    <!-- Main Sidebar with highest z-index -->
    <Sidebar class="z-30" />

    <div class="flex-1">
      <!-- Header with high z-index -->
      <header
        class="h-16 border-b border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 relative z-20">
        <div class="flex items-center justify-between h-full px-6">
          <!-- Actions Container -->
          <div class="relative w-72">
            <Transition enter-from-class="translate-y-[-100%] opacity-0"
              enter-active-class="transition-all duration-300 ease-out" enter-to-class="translate-y-0 opacity-100"
              leave-from-class="translate-y-0 opacity-100" leave-active-class="transition-all duration-300 ease-in"
              leave-to-class="translate-y-[-100%] opacity-0">
              <div v-if="appStore.hasSearch" class="w-full">
                <ActionsMenu />
              </div>
            </Transition>
          </div>

          <!-- Filter Container -->
          <div class="relative w-72">
            <Transition enter-from-class="translate-y-[-100%] opacity-0"
              enter-active-class="transition-all duration-300 ease-out" enter-to-class="translate-y-0 opacity-100"
              leave-from-class="translate-y-0 opacity-100" leave-active-class="transition-all duration-300 ease-in"
              leave-to-class="translate-y-[-100%] opacity-0">
              <div v-if="appStore.hasSearch" class="w-full">
                <FilterToggle @change="handleFilterChange" />
              </div>
            </Transition>
          </div>

          <!-- Search Container -->
          <div class="relative w-72">
            <Transition enter-from-class="translate-x-full opacity-0"
              enter-active-class="transition-all duration-300 ease-out" enter-to-class="translate-x-0 opacity-100"
              leave-from-class="translate-x-0 opacity-100" leave-active-class="transition-all duration-300 ease-in"
              leave-to-class="translate-x-full opacity-0">
              <div v-if="appStore.hasSearch" class="w-full">
                <FloatLabel variant="on">
                  <InputText v-model="appStore.searchQuery"
                    class="w-full !border-0 bg-surface-100 dark:!bg-surface-700 dark:!text-surface-0"
                    @keyup.enter="search" />
                  <label for="on_label" class="dark:!bg-surface-700">Search</label>
                </FloatLabel>
              </div>
            </Transition>
          </div>
        </div>
      </header>

      <div class="flex relative">
        <!-- Side Panel (Submenu or Custom Component) -->
        <SidePanel />

        <!-- Main Content with lowest z-index -->
        <main class="flex-1 relative z-0">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure the search container maintains its space */
.relative {
  min-height: 2.5rem;
}
</style>