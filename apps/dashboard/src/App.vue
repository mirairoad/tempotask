<script setup lang="ts">
import AppLoading from '@src/components/parts/AppLoading.vue';
import MainLayout from '@src/layouts/MainLayout.vue';
import { useAppStore } from '@src/stores/app';
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';

const appStore = useAppStore();

onMounted(() => {
  appStore.initializeApp();
});
</script>

<template>
  <Transition name="fade-loading">
    <template v-if="appStore.appFirstLoading">
      <AppLoading />
    </template>
    <template v-else>
      <MainLayout class="h-full">
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </MainLayout>
    </template>
  </Transition>
</template>

<style>
/* Loading Screen Transition */
.fade-loading-enter-active,
.fade-loading-leave-active {
  transition: opacity 0.5s ease;
}

.fade-loading-enter-from,
.fade-loading-leave-to {
  opacity: 0;
}

/* Route Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* PrimeVue Input Dark Mode Overrides */
.dark .p-inputtext {
  background-color: var(--surface-900) !important;
  color: var(--surface-0) !important;
  border-color: var(--surface-700) !important;
}

.dark .p-float-label label {
  color: var(--surface-400) !important;
}

.dark .p-inputtext:enabled:focus {
  border-color: var(--primary-500) !important;
  box-shadow: none !important;
}

.dark .p-float-label>.p-inputtext:focus~label,
.dark .p-float-label>.p-inputtext.p-filled~label {
  color: var(--primary-500) !important;
}
</style>
