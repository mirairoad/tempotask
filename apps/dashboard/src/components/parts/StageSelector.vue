<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

const stages = ref([
    { id: 1, name: 'admin_app', badge: 'local', severity: 'success' },
    { id: 2, name: 'admin_app', badge: 'dev', severity: 'info' },
    { id: 3, name: 'admin_app', badge: 'staging', severity: 'warning' },
    { id: 4, name: 'admin_app', badge: 'prod', severity: 'danger' },
]);

const currentStage = ref(stages.value[0]);
const isVisible = ref(true);
const isHovering = ref(false);
let hideTimeout: number;

const startHideTimer = () => {
    if (!isHovering.value) {
        hideTimeout = setTimeout(() => {
            isVisible.value = false;
        }, 5000);
    }
};

const clearHideTimer = () => {
    if (hideTimeout) {
        clearTimeout(hideTimeout);
    }
};

const handleMouseEnter = () => {
    isHovering.value = true;
    isVisible.value = true;
    clearHideTimer();
};

const handleMouseLeave = () => {
    isHovering.value = false;
    startHideTimer();
};

onMounted(() => {
    startHideTimer();
});

onUnmounted(() => {
    clearHideTimer();
});
</script>

<template>
    <!-- Hover detection area - smaller corner trigger -->
    <div class="fixed bottom-0 right-0 w-32 h-32 z-40 pointer-events-none">
        <!-- Actual corner trigger -->
        <div class="absolute bottom-0 right-0 w-16 h-16 pointer-events-auto" @mouseenter="handleMouseEnter"
            @mouseleave="handleMouseLeave">
        </div>

        <!-- Stage selector -->
        <Transition name="fade">
            <div v-show="isVisible" class="absolute bottom-6 right-6 z-50 pointer-events-auto"
                @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
                <Select v-model="currentStage" :options="stages" optionLabel="name" class="w-68 shadow-lg"
                    :panelClass="'!border-surface-200 dark:!border-surface-700'" @show="handleMouseEnter"
                    @hide="handleMouseLeave">
                    <template #value="{ value }">
                        <div class="flex items-center gap-4">
                            <Tag :value="value.badge" :severity="value.severity" />
                            <span>{{ value.name }}</span>
                        </div>
                    </template>
                    <template #option="{ option }">
                        <div class="flex items-center gap-2">
                            <Tag :value="option.badge" :severity="option.severity" />
                            <span>{{ option.name }}</span>
                        </div>
                    </template>
                </Select>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
/* :deep(.p-dropdown) {
    @apply bg-surface-0 dark:bg-surface-900 border-surface-200 dark:border-surface-700;
}

:deep(.p-dropdown-panel) {
    @apply bg-surface-0 dark:bg-surface-900 border-surface-200 dark:border-surface-700;
} */

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>