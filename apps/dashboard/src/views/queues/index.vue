<script setup lang="ts">
import App from '@src/App.vue';
import { useAppStore } from '@src/stores/app';
import { computed, onMounted, onBeforeMount, watch, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import dataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';

const appStore = useAppStore();
const route = useRoute();
const router = useRouter();

const currentQueue = computed(() => route.params.queue);
const queuedata = computed(() => {
  return appStore.data.queues.find(q => q.name === currentQueue.value);
});

// Jobs data
const jobs = ref([]);
const loading = ref(false);

// Job detail dialog
const jobDetailDialog = ref(false);
const selectedJob = ref(null);

// Polling control
const pollingInterval = ref<number | null>(null);
const POLL_FREQUENCY = 1000; // 1 second

// Function to fetch latest queue data
const fetchQueuedata = async () => {
  try {
    console.log(appStore.data.queues[1].stats.total)
    // Set loading only on initial fetch
    if (jobs.value.length === 0) {
      loading.value = true;
    }
    
    await appStore.fetchdata();
    
    if (currentQueue.value && appStore.data.queues) {
      const queue = appStore.data.queues.find(q => q.name === currentQueue.value);
      if (queue && queue.jobs) {
        // Get all jobs across all statuses
        const allJobs = Object.values(queue.jobs || {}).flat();
        
        // Create a map of existing jobs for quick lookup
        const existingJobsMap = new Map(jobs.value.map(job => [job.id, job]));
        
        // Update existing jobs and add new ones
        allJobs.forEach(newJob => {
          existingJobsMap.set(newJob.id, newJob);
        });
        
        // Convert back to array and sort by lastRun/addedAt
        jobs.value = Array.from(existingJobsMap.values())
          .sort((a, b) => {
            const timeA = a.lastRun || a.addedAt || 0;
            const timeB = b.lastRun || b.addedAt || 0;
            return timeB - timeA;
          });
        
        // Update selected job if dialog is open
        if (selectedJob.value && jobDetailDialog.value) {
          const updatedJob = jobs.value.find(j => j.id === selectedJob.value.id);
          if (updatedJob) {
            selectedJob.value = updatedJob;
          }
        }
      }
    }
  } finally {
    loading.value = false;
  }
};

// Show job details
const showJobDetails = (job: any) => {
  selectedJob.value = job;
  jobDetailDialog.value = true;
};

// Format date for display
const formatDate = (timestamp: number | undefined) => {
  if (!timestamp) return 'Never';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleString();
};

// Get severity for status tag
const getStatusSeverity = (status: string) => {
  const statusMap: Record<string, string> = {
    'waiting': 'info',
    'processing': 'warning',
    'completed': 'success',
    'failed': 'danger',
    'delayed': 'secondary'
  };
  return statusMap[status.toLowerCase()] || 'info';
};

// Job actions
const runJob = async (job: any) => {
  try {
    loading.value = true;
    await fetch(`/admin/api/queues/${job.id}/run`, { method: 'POST' });
    // await fetchQueuedata(); // Refresh data
    appStore.showToast({
      severity: 'success',
      detail: `Job ${job.state.name} started successfully`
    });
  } catch (error) {
    console.error('Error running job:', error);
    appStore.showToast({
      severity: 'error',
      detail: 'Failed to run job'
    });
  } finally {
    loading.value = false;
  }
};

const deleteJob = async (job: any) => {
  try {
    loading.value = true;
    await fetch(`/admin/api/queues/${job.id}`, { method: 'DELETE' });
    // await fetchQueuedata(); // Refresh data
    appStore.showToast({
      severity: 'success',
      detail: `Job ${job.state.name} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    appStore.showToast({
      severity: 'error',
      detail: 'Failed to delete job'
    });
  } finally {
    loading.value = false;
  }
};

onBeforeMount(() => {
  if(appStore.lastQueuesPath){
    router.push(appStore.lastQueuesPath);
  }
});

onMounted(async() => {
  // Start polling when component is mounted
  await fetchQueuedata(); // Initial fetch
  
  // Set up polling interval
  pollingInterval.value = window.setInterval(async () => {
    await fetchQueuedata();
  }, POLL_FREQUENCY);
});

// Clean up polling when leaving the route
onBeforeRouteLeave(() => {
  if (pollingInterval.value !== null) {
    window.clearInterval(pollingInterval.value);
    pollingInterval.value = null;
  }
});
</script>


<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold mb-4">{{ currentQueue }}</h1>
    <div v-if="queuedata" class="space-y-4">
      <!-- Queue stats -->
      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="p-4 bg-surface-0 dark:bg-surface-800 rounded-lg shadow">
          <h3 class="text-sm font-medium text-surface-600 dark:text-surface-400">Total Jobs</h3>
          <p class="text-2xl font-bold">{{ appStore.data.queues.find(q => q.name === currentQueue)?.stats.total }}</p>
        </div>
        <div class="p-4 bg-surface-0 dark:bg-surface-800 rounded-lg shadow">
          <h3 class="text-sm font-medium text-surface-600 dark:text-surface-400">Status</h3>
          <p class="text-2xl font-bold">{{ queuedata.paused ? 'Paused 🔴' : 'Active 🟢' }}</p>
        </div>
      </div>

      <!-- Jobs table -->
      <dataTable 
        :value="jobs" 
        :loading="loading"
        paginator 
        :rows="10" 
        :rowsPerPageOptions="[10, 25, 50]"
        dataKey="id"
        stripedRows
        class="p-datatable-sm"
        sortField="lastRun"
        :sortOrder="-1"
        responsiveLayout="scroll"
        @row-click="showJobDetails"
        v-tooltip.top="'Click row to view details'"
      >
        <template #empty>
          No jobs found for this queue.
        </template>
        <template #loading>
          Loading jobs data...
        </template>
        <Column field="state.name" header="Name" sortable></Column>
        <Column field="status" header="Status" sortable>
          <template #body="slotProps">
            <Tag :value="slotProps.data.status" :severity="getStatusSeverity(slotProps.data.status)" />
          </template>
        </Column>
        <Column field="addedAt" header="Added At" sortable>
          <template #body="slotProps">
            {{ formatDate(slotProps.data.addedAt) }}
          </template>
        </Column>
        <Column field="lastRun" header="Last Run" sortable>
          <template #body="slotProps">
            {{ formatDate(slotProps.data.lastRun) }}
          </template>
        </Column>
        <Column header="Actions">
          <template #body="slotProps">
            <Button icon="pi pi-play" outlined rounded class="mr-2" aria-label="Run" @click="runJob(slotProps.data)" />
            <Button icon="pi pi-trash" outlined rounded severity="danger" aria-label="Delete" @click="deleteJob(slotProps.data)" />
          </template>
        </Column>
      </dataTable>
    </div>
    
    <!-- Job Detail Dialog -->
    <Dialog 
      v-model:visible="jobDetailDialog" 
      :header="selectedJob?.state?.name || 'Job Details'" 
      :style="{ width: '80vw' }" 
      :modal="true"
      :maximizable="true"
    >
      <div v-if="selectedJob">
        <TabView>
          <TabPanel header="Information" value="info">
            <div class="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg overflow-auto max-h-96">
              <pre class="whitespace-pre-wrap">{{ JSON.stringify(selectedJob, null, 2) }}</pre>
            </div>
          </TabPanel>
          <TabPanel header="Logs" value="logs">
            <div v-if="selectedJob.logs && selectedJob.logs.length > 0" class="space-y-4">
              <div v-for="(log, index) in selectedJob.logs" :key="index" class="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
                <div class="text-sm text-surface-600 dark:text-surface-400 mb-2">
                  {{ formatDate(log.timestamp) }}
                </div>
                <pre class="whitespace-pre-wrap">{{ log.message }}</pre>
              </div>
            </div>
            <div v-else class="p-4 text-center text-surface-600 dark:text-surface-400">
              No logs available for this job.
            </div>
          </TabPanel>
          <TabPanel header="Errors" value="errors">
            <div v-if="selectedJob.errors && selectedJob.errors.length > 0" class="space-y-4">
              <div v-for="(error, index) in selectedJob.errors" :key="index" class="p-4 bg-red-50 dark:bg-red-900 rounded-lg">
                <div class="text-sm text-red-600 dark:text-red-400 mb-2">
                  {{ formatDate(error.timestamp) }}
                </div>
                <pre class="whitespace-pre-wrap text-red-700 dark:text-red-300">{{ error.message }}</pre>
                <pre v-if="error.stack" class="whitespace-pre-wrap text-red-600 dark:text-red-400 mt-2 text-sm">{{ error.stack }}</pre>
              </div>
            </div>
            <div v-else class="p-4 text-center text-surface-600 dark:text-surface-400">
              No errors reported for this job.
            </div>
          </TabPanel>
        </TabView>
      </div>
    </Dialog>
  </div>
</template>
