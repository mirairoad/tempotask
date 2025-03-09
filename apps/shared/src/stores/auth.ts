import { useAppStore } from '@shared/stores/app.ts';
import { useUserContextStore } from '@shared/stores/client-sync.ts';
import { httpHandler } from '@shared/utils/http/http-handler.ts';
import { defineStore } from 'pinia';
import { ref } from 'vue';

const config = {
  loginPath: '/v1/authentication/signin',
  registerPath: '/v1/authentication/signup',
};
// chane token names
// Helper function to get cookie by name
const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

export const useAuthStore = defineStore('auth', () => {
  //@ts-ignore
  const buildStage = import.meta.env.VITE_BUILD_STAGE;
  // define stores
  const appStore = useAppStore();
  const userContextStore = useUserContextStore();
  // define refs
  const loading = ref(false);
  const isAuthenticated = ref(false);
  const redirectUrl = ref('');
  const hasInvalidCredentials = ref(false);
  // define access token and refresh token
  const accessToken = ref(
    getCookie(`jwt_${buildStage}_access_token`) || '',
  );
  const refreshToken = ref(
    getCookie(`jwt_${buildStage}_refresh_token`) || '',
  );

  // clear redirect url
  const clearRedirectUrl = () => {
    redirectUrl.value = '';
  };

  const login = async (email: string, password: string) => {
    try {
      loading.value = true;
      const response = await httpHandler.post(config.loginPath, {
        email,
        password,
      });
      accessToken.value = response.auth.access_token;
      refreshToken.value = response.auth.refresh_token;
      isAuthenticated.value = !!accessToken.value;

      setTokens(accessToken.value, refreshToken.value);

      return response;
    } catch (error) {
      hasInvalidCredentials.value = true;
      throw error;
    } finally {
      loading.value = false;
    }
  };

  const setTokens = (accessToken: string, refreshToken: string) => {
    // set tokens in cookies
    document.cookie = `jwt_${buildStage}_access_token=${accessToken}; path=/`;
    document.cookie = `jwt_${buildStage}_refresh_token=${refreshToken}; path=/`;
    // isAuthenticated.value = true;
  };

  // Check if user is already authenticated on store initialization
  const initAuth = async () => {
    console.log('running always');
    await userContextStore.syncClient();
    if (userContextStore.state.isAuthenticated) {
      window.location.href = 'http://localhost:1338/';
    }
  };

  // Initialize auth state
  initAuth();

  return {
    loading,
    isAuthenticated,
    redirectUrl,
    login,
    clearRedirectUrl,
    hasInvalidCredentials,
    accessToken,
    refreshToken,
    setTokens,
  };
});
