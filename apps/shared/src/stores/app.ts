import { defineStore } from 'pinia';
import { ref } from 'vue';
interface AppState {
  isDarkMode: boolean;
  isLoading: boolean;
  isSidebarOpen: boolean;
  isMobile: boolean;
  altUser: string | null;
}

export const useAppStore = defineStore('appStore', () => {
  const state = ref<AppState>({
    isDarkMode: false,
    isLoading: false,
    isSidebarOpen: false,
    isMobile: false,
    user: null,
    altUser: null,
  });

  return {
    state,
  };
});
