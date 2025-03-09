<script setup lang="ts">
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { watch } from 'vue';

interface ToastMessage {
    severity: 'success' | 'info' | 'warn' | 'error';
    summary?: string;
    detail: string;
    life?: number;
    group?: string;
}

const props = defineProps<{
    message: ToastMessage | null;
}>();

const toast = useToast();

watch(() => props.message, (newMessage) => {
    if (newMessage) {
        console.log('Showing toast:', newMessage);
        toast.add({
            severity: newMessage.severity,
            summary: newMessage.summary || getDefaultSummary(newMessage.severity),
            detail: newMessage.detail,
            life: newMessage.life || 3000,
            group: newMessage.group || 'main',
        });
    }
}, { immediate: true });

function getDefaultSummary(severity: ToastMessage['severity']): string {
    switch (severity) {
        case 'success':
            return 'Success';
        case 'info':
            return 'Information';
        case 'warn':
            return 'Warning';
        case 'error':
            return 'Error';
        default:
            return '';
    }
}
</script>

<template>
    <Toast position="top-right" />
</template>