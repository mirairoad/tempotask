<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

const darkMode = ref(false);

const toggleTheme = () => {
    darkMode.value = !darkMode.value;
    if (darkMode.value) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
    } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
    }
};

// Initialize theme based on system preference
watch(darkMode, () => {
    localStorage.setItem('theme', darkMode.value ? 'dark' : 'light');
}, { immediate: true });

// Check for saved theme preference or system preference
onMounted(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        darkMode.value = savedTheme === 'dark';
    } else {
        darkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    // Apply theme immediately
    if (darkMode.value) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
    }
});
</script>

<template>
    <div class="flex items-center">
        <InputSwitch v-model="darkMode" @change="toggleTheme" class="theme-switch">
            <template #on>
                <i class="pi pi-moon text-surface-0" />
            </template>
            <template #off>
                <i class="pi pi-sun text-surface-900" />
            </template>
        </InputSwitch>
    </div>
</template>

<!-- <style scoped>
:deep(.p-inputswitch) {
    @apply !w-14 !h-8;
}

:deep(.p-inputswitch.p-inputswitch-checked .p-inputswitch-slider) {
    @apply !bg-surface-800 dark: !bg-surface-700;
}

:deep(.p-inputswitch .p-inputswitch-slider) {
    @apply !bg-surface-200 dark: !bg-surface-600;
}

:deep(.p-inputswitch.p-inputswitch-checked .p-inputswitch-slider::before) {
    @apply !translate-x-6;
}

:deep(.p-inputswitch .p-inputswitch-slider::before) {
    @apply !w-6 !h-6 !shadow-md !bg-surface-0 dark: !bg-surface-900;
}

/* Icon positioning */
:deep(.pi) {
    @apply absolute top-1/2 -translate-y-1/2 text-xs;
}

:deep(.pi-sun) {
    @apply left-2 text-surface-600 dark:text-surface-400;
}

:deep(.pi-moon) {
    @apply right-2 text-surface-0;
}
</style> -->