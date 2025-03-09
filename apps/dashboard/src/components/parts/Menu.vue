<script setup lang="ts">
import { type MenuItem } from '@src/config/menu';
import { useAppStore } from '@src/stores/app';
import { useRouter } from 'vue-router';
import { ref } from 'vue';
const router = useRouter();
const appStore = useAppStore();
const menuItems = ref<MenuItem[]>(appStore.menuItems);
const navigateTo = (item: MenuItem) => {
    router.push(item.path);
};

const isActive = (path: string) => {
    return appStore.currentMenuItem.path === path;
};
</script>

<template>
    <nav class="flex-1 overflow-y-auto py-2 ">
        <ul class="space-y-1 px-2">
            <li v-for="item in menuItems" :key="item.path">
                <Button :class="[
                    'w-full !justify-start gap-3 !px-3 !py-2.5',
                    'hover:!bg-surface-100 dark:hover:!bg-surface-800',
                    {
                        '!bg-primary-50 dark:!bg-primary-900/20 !text-primary-700 dark:!text-primary-300':
                            isActive(item.path)
                    }
                ]" :text="true" @click="navigateTo(item)">
                    <i :class="[item.icon, 'text-lg', {
                        'text-surface-600 dark:text-surface-400': !isActive(item.path),
                        'text-primary-500': isActive(item.path)
                    }]"></i>
                    <span class="font-medium" :class="{
                        'text-surface-700 dark:text-surface-300': !isActive(item.path)
                    }">{{ item.title }}</span>
                    <Badge v-if="item.badge" :value="item.badge" severity="danger" class="ml-auto" />
                </Button>
            </li>
        </ul>
    </nav>
</template>

<style scoped>
:deep(.p-button.p-button-text) {
    padding: 0.75rem 1rem;
}

:deep(.p-button.p-button-text:enabled:hover) {
    background: var(--surface-100);
}

:deep(.p-badge) {
    min-width: 1.5rem;
    height: 1.5rem;
    line-height: 1.5rem;
}
</style>