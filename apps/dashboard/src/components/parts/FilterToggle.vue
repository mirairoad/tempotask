<script setup lang="ts">
import { useAppStore } from '@src/stores/app';
import { computed, ref } from 'vue';

interface FilterOption {
    name: string;
    code: 'asc' | 'desc';
    icon: string;
}

const appStore = useAppStore();

const options = ref<FilterOption[]>([
    { name: 'Ascending', code: 'asc', icon: 'pi pi-sort-amount-up' },
    { name: 'Descending', code: 'desc', icon: 'pi pi-sort-amount-down' }
]);

// Use computed for two-way binding with store
const selectedOption = computed({
    get: () => appStore.sortDirection,
    set: (value: 'asc' | 'desc') => {
        appStore.sortDirection = value;
        appStore.search();
    }
});
</script>

<template>
    <div class="w-full">
        <SelectButton v-model="selectedOption" :options="options" optionLabel="name" optionValue="code" class="w-full"
            :pt="{
                button: ({ context }) => ({
                    class: [
                        'flex-1 !px-4 !py-2 !border-surface-200 dark:!border-surface-700',
                        {
                            '!bg-surface-100 dark:!bg-surface-700': context.active,
                            'hover:!bg-surface-50 ': !context.active
                        }
                    ]
                })
            }">
            <template #option="{ option }">
                <div class="flex items-center gap-2">
                    <i :class="option.icon"></i>
                    <span>{{ option.name }}</span>
                </div>
            </template>
        </SelectButton>
    </div>
</template>

<style scoped>
/* :deep(.p-selectbutton) {
    @apply flex w-full;
} */
</style>