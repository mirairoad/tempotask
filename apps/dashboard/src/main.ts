import '@src/assets/css/global.css';
import { createApp } from 'vue';
// import '@shared/assets/css/global.css';
import router from '@src/router/index.ts';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { Violet } from '../theme.config.ts';
// import Aura from '@primevue/themes/aura';
// import { Form } from '@primevue/forms';

import App from '@src/App.vue';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
// @ts-ignore
app.use(PrimeVue, {
  theme: {
    preset: Violet,
    options: {
      prefix: 'p',
      darkModeSelector: 'system',
      cssLayer: {
        name: 'primevue',
        order: 'tailwind-base, primevue, tailwind-utilities',
      },
    },
  },
  ripple: true,
});

// @ts-ignore
app.use(ToastService);

// @ts-ignore
app.mount('#app');
