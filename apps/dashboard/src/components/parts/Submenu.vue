<script setup lang="ts">
import type { MenuItem } from '@src/config/menu';
import { useAppStore } from '@src/stores/app';
import { useRouter } from 'vue-router';

const appStore = useAppStore();
const router = useRouter();

const handleClick = (item: Omit<MenuItem, 'icon'>) => {
    router.push(item.path);
    appStore.setCurrentPage(item.title);
};
</script>

<template>
    <Transition enter-from-class="translate-x-[-100%]" enter-active-class="transition-transform duration-300 ease-out"
        enter-to-class="translate-x-0" leave-from-class="translate-x-0"
        leave-active-class="transition-transform duration-300 ease-in" leave-to-class="translate-x-[-100%]">
        <div v-if="appStore.currentSubmenu.length > 0"
            class="w-64 h-[calc(100vh-4rem)] bg-surface-0 dark:bg-surface-800 border-r border-surface-200 dark:border-surface-700 z-10">
            <div class="sticky top-0 px-4 py-4 h-full overflow-y-auto">
                <h2 class="text-sm font-medium text-surface-600 dark:text-surface-400 uppercase tracking-wider mb-4">
                    {{ appStore.currentPage }}
                </h2>
                <ul class="space-y-1">
                    <li v-for="item in appStore.currentSubmenu" :key="item.path">
                        <Button :label="item.title" text class="w-full !justify-start" :class="[
                            'py-2 px-3 !text-surface-700 dark:!text-surface-0 rounded-lg',
                            {
                                '!bg-surface-100 dark:!bg-surface-700 !text-primary-500':
                                    $route.path === item.path
                            }
                        ]" @click="handleClick(item)" />
                    </li>
                </ul>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.v-enter-from,
.v-leave-to {
    transform: translateX(-100%);
}

.v-enter-active,
.v-leave-active {
    transition: transform 0.3s ease;
}

.v-enter-to,
.v-leave-from {
    transform: translateX(0);
}
</style>