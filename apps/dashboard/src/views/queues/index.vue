<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold mb-4">{{ currentQueue }}</h1>
    <div v-if="queueData" class="space-y-4">
      <!-- Queue stats -->
      <div class="grid grid-cols-4 gap-4">
        <div class="p-4 bg-surface-0 dark:bg-surface-800 rounded-lg shadow">
          <h3 class="text-sm font-medium text-surface-600 dark:text-surface-400">Total Jobs</h3>
          <p class="text-2xl font-bold">{{ queueData.stats.total }}</p>
        </div>
        <div class="p-4 bg-surface-0 dark:bg-surface-800 rounded-lg shadow">
          <h3 class="text-sm font-medium text-surface-600 dark:text-surface-400">Status</h3>
          <p class="text-2xl font-bold">{{ queueData.paused ? 'Paused 🔴' : 'Active 🟢' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@src/stores/app';
import { computed, onMounted, onBeforeMount } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const appStore = useAppStore();
const route = useRoute();
const router = useRouter();

const currentQueue = computed(() => route.params.queue);
const queueData = computed(() => {
  return appStore.Data.queues.find(q => q.name === currentQueue.value);
});

onBeforeMount(() => {
    if(appStore.lastQueuesPath){
        router.push(appStore.lastQueuesPath);
    }
    console.log('lastQueuesPath',appStore.lastQueuesPath);

  // Set the page title
//   console.log(appStore.menuItems[1].items);
//   appStore.setCurrentPage('Queues');
});
</script>
