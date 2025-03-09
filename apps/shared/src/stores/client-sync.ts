import { UserContext } from '@server/types/user-context.ts';
import { httpHandler } from '@shared/utils/http/http-handler.ts';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useAuthStore } from './auth.ts';

export const useUserContextStore = defineStore('userContextStore', () => {
  const authStore = useAuthStore();
  const state = ref<UserContext>({
    user: {},
    loggedUser: {},
    isAdmin: false,
    isSuperAdmin: false,
    isOwner: false,
    isImpersonating: false,
    isAuthenticated: false,
    accessToken: {
      key: '',
      value: '',
    },
    refreshToken: {
      key: '',
      value: '',
    },
    buildStage: '',
  });

  const syncClient = async () => {
    console.log('syncing client');
    try {
      const data = []
      state.value = data;
      console.log('synced client');
      return data;
    } catch (error) {
      console.error('Error syncing client:', error);
      throw error;
    }
  };

  return {
    state,
    syncClient,
  };
});
