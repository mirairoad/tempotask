<script setup lang="ts">
import { useAdminStore } from '@src/stores/admin';
import { useRouter } from 'vue-router';

const adminStore = useAdminStore();
const router = useRouter();

const selectUser = (userId: number) => {
    adminStore.selectChatUser(userId);
    router.push(`/admin/chat/${userId}`);
};

const getStatusColor = (status: 'online' | 'offline' | 'away') => {
    switch (status) {
        case 'online':
            return 'bg-green-500';
        case 'offline':
            return 'bg-gray-500';
        case 'away':
            return 'bg-yellow-500';
    }
};
</script>

<template>
    <div class="p-4 h-full overflow-y-auto">
        <h2 class="text-sm font-medium text-surface-600 dark:text-surface-400 uppercase tracking-wider mb-4">
            Chat
        </h2>
        <div class="flex-1 overflow-y-auto">
            <ul class="space-y-2">
                <li v-for="user in adminStore.dataState.users" :key="user.id">
                    <Button class="w-full !justify-start p-3"
                        :class="{ '!bg-surface-100 dark:!bg-surface-700': adminStore.selectedChatUser === user.id }"
                        text @click="selectUser(user.id)">
                        <div class="flex items-center gap-3 w-full">
                            <div class="relative">
                                <div
                                    class="w-10 h-10 rounded-full bg-surface-100 dark:bg-surface-700 flex items-center justify-center text-xl">
                                    {{ user.avatar }}
                                </div>
                                <div
                                    :class="[getStatusColor(user.status), 'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface-0 dark:border-surface-800']" />
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between">
                                    <span class="font-medium text-surface-900 dark:text-surface-0">{{ user.name
                                        }}</span>
                                    <Badge v-if="user.unread" :value="user.unread" severity="danger" />
                                </div>
                                <p class="text-sm text-surface-500 dark:text-surface-400 truncate">
                                    {{ user.lastMessage }}
                                </p>
                            </div>
                        </div>
                    </Button>
                </li>
            </ul>
        </div>
    </div>
</template>