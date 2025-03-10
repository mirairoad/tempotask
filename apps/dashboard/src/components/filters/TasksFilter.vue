<template>
    <div class="px-4 py-4 h-full overflow-y-auto">
      <h2 class="text-sm font-medium text-surface-600 dark:text-surface-400 uppercase tracking-wider mb-4">
        Tasks By Status
      </h2>
      <ul class="space-y-1">
        <li v-for="status in statuses" :key="status.key">
          <Button 
            :label="`${status.label} (${status.count})`"
            text
            class="w-full !justify-start"
            :class="[
              'py-2 px-3 !text-surface-700 dark:!text-surface-0 rounded-lg',
              {
                '!bg-surface-100 dark:!bg-surface-700 !text-primary-500':
                  currentStatus === status.key
              }
            ]"
            @click="handleClick(status.key)"
          >
            <template #icon>
              <i :class="status.icon" class="mr-2"></i>
            </template>
          </Button>
        </li>
      </ul>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import Button from 'primevue/button';
  
  interface Status {
    key: string;
    label: string;
    icon: string;
    count: number;
  }
  
  const route = useRoute();
  const router = useRouter();
  const currentStatus = ref(route.params.status as string || 'latest');
  
  const statusCounts = ref<Record<string, number>>({
    latest: 0,
    waiting: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    delayed: 0
  });
  
  const statuses = computed<Status[]>(() => [
    {
      key: 'latest',
      label: 'Latest',
      icon: 'pi pi-clock',
      count: statusCounts.value.latest
    },
    {
      key: 'waiting',
      label: 'Waiting',
      icon: 'pi pi-hourglass',
      count: statusCounts.value.waiting
    },
    {
      key: 'processing',
      label: 'Processing',
      icon: 'pi pi-sync',
      count: statusCounts.value.processing
    },
    {
      key: 'completed',
      label: 'Completed',
      icon: 'pi pi-check-circle',
      count: statusCounts.value.completed
    },
    {
      key: 'failed',
      label: 'Failed',
      icon: 'pi pi-exclamation-circle',
      count: statusCounts.value.failed
    },
    {
      key: 'delayed',
      label: 'Delayed',
      icon: 'pi pi-clock',
      count: statusCounts.value.delayed
    }
  ]);
  
  const fetchStatusCounts = async () => {
    try {
      const response = await fetch('/admin/api/queues');
      const queues = await response.json();
      const queuedata = queues.find((q: any) => q.name === route.params.queue);
      
      if (queuedata) {
        statusCounts.value = {
          latest: Object.values(queuedata.jobs).flat().length,
          waiting: queuedata.jobs.waiting?.length || 0,
          processing: queuedata.jobs.processing?.length || 0,
          completed: queuedata.jobs.completed?.length || 0,
          failed: queuedata.jobs.failed?.length || 0,
          delayed: queuedata.jobs.delayed?.length || 0
        };
      }
    } catch (error) {
      console.error('Failed to fetch status counts:', error);
    }
  };
  
  const handleClick = (status: string) => {
    currentStatus.value = status;
    router.push({
      name: 'jobs',
      params: {
        queue: route.params.queue,
        status
      }
    });
  };
  
  let pollingInterval: number | null = null;
  
  onMounted(() => {
    fetchStatusCounts();
    pollingInterval = window.setInterval(fetchStatusCounts, 200);
  });
  
  onUnmounted(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
  });
  </script> 