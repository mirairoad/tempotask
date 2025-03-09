<script setup lang="ts">
import { useAppStore } from '@src/stores/app';
import { ref } from 'vue';

const appStore = useAppStore();

const filters = ref({
    role: null,
    status: null,
    dateRange: null,
    // ... other filter options
});

const applyFilters = () => {
    console.log('Applying filters:', filters.value); // Debug log
    appStore.search();
};
</script>

<template>
    <div class="p-4 h-full overflow-y-auto">
        <h2 class="text-sm font-medium text-surface-600 dark:text-surface-400 uppercase tracking-wider mb-4">
            Filter
        </h2>

        <div class="space-y-4">
            <div class="space-y-2">
                <label class="text-sm text-surface-600 dark:text-surface-400">Role</label>
                <Select v-model="filters.role" :options="['Admin', 'User', 'Guest']" class="w-full" />
            </div>

            <div class="space-y-2">
                <label class="text-sm text-surface-600 dark:text-surface-400">Status</label>
                <MultiSelect v-model="filters.status" :options="['Active', 'Inactive', 'Pending']" class="w-full" />
            </div>

            <div class="space-y-2">
                <label class="text-sm text-surface-600 dark:text-surface-400">Date Range</label>
                <DatePicker v-model="filters.dateRange" selectionMode="range" class="w-full" />
            </div>

            <Button label="Apply Filters" class="w-full" @click="applyFilters" />
        </div>
    </div>
</template>