<script setup lang="ts">
// import { menuItems, type MenuItem } from '@src/config/menu';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import Menu from './Menu.vue';
import { useAppStore } from '@src/stores/app';
import { MenuItem } from 'primevue/menuitem';

const router = useRouter();
const collapsed = ref(false);
const appStore = useAppStore();

const menuItems = computed(() => appStore.menuItems);

const navigateTo = (item: MenuItem) => {
    router.push(item.path);
};

</script>

<template>
    <aside
        class="h-screen flex flex-col bg-surface-0 dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 overflow-hidden"
        :class="{ 'w-72': !collapsed, 'w-20': collapsed }">
        <!-- Header -->
        <div class="flex items-center h-16 px-4 border-b border-surface-200 dark:border-surface-700">
            <transition name="fade" mode="out-in">
                <div v-if="!collapsed" class="flex-1">
                    <span class="text-xl font-semibold text-surface-900 dark:text-surface-0">TempoTask</span>
                </div>
            </transition>
            <transition name="fade" mode="out-in">
                <Button :key="collapsed ? 'right' : 'left'" :icon="collapsed ? 'pi pi-arrow-right' : 'pi pi-arrow-left'"
                    link @click="collapsed = !collapsed" class="p-button-rounded p-button-text !w-8 !h-8 !p-0 !pl-3" />
            </transition>
        </div>

        <!-- Navigation Menu -->
        <transition name="fade" mode="out-in">
            <Menu v-if="!collapsed" />
            <nav v-else class="flex-1 overflow-y-auto py-2">
                <ul class="space-y-1 px-2">
                    <li v-for="item in menuItems" :key="item.path">
                        <Button :class="[
                            'w-full !justify-center !h-10',
                            'hover:!bg-surface-100 dark:hover:!bg-surface-800',
                            {
                                '!bg-primary-50 dark:!bg-primary-900/20': router.currentRoute.value.path === item.path
                            }
                        ]" text v-tooltip.right="item.title" @click="navigateTo(item)">
                            <i :class="[item.icon, 'text-lg', {
                                'text-surface-600 dark:text-surface-400': router.currentRoute.value.path !== item.path,
                                'text-primary-500': router.currentRoute.value.path === item.path
                            }]"></i>
                        </Button>
                    </li>
                </ul>
            </nav>
        </transition>
    </aside>
</template>

<style scoped>
:deep(.p-menu) {
    background: transparent;
    border: none;
    padding: 0;
}

:deep(.p-menu-list) {
    padding: 0;
}

:deep(.p-menuitem) {
    margin: 0.25rem 0;
}

:deep(.p-menuitem-link) {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
}

:deep(.p-dropdown-panel) {
    border-radius: 0.5rem;
}

:deep(.p-tag) {
    padding: 0.25rem 0.75rem;
}

:deep(.p-menuitem-icon) {
    font-size: 1.25rem !important;
}

/* Sidebar width transition */
aside {
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* Slide transition */
.slide-enter-active,
.slide-leave-active {
    transition: transform 0.3s ease;
}

.slide-enter-from {
    transform: translateX(-100%);
}

.slide-leave-to {
    transform: translateX(-100%);
}

/* Ensure content doesn't wrap during transition */
:deep(.p-button-label) {
    white-space: nowrap;
}

:deep(.p-menuitem-text) {
    white-space: nowrap;
}
</style>