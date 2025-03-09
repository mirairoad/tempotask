import '@shared/assets/css/global.css';
import PrimeVue from 'primevue/config';
import { createApp } from 'vue';
import { Violet } from '../theme.config.ts';

// components
// import Accordion from 'primevue/accordion';
// import AccordionPanel from 'primevue/accordionpanel';
// import AccordionHeader from 'primevue/accordionheader';
// import AccordionContent from 'primevue/accordioncontent';
// import Button from 'primevue/button';

//@ts-ignore
import App from './App.vue';

const app = createApp(App);
// @ts-ignore
app.use(PrimeVue, {
  theme: {
    preset: Violet,
    options: {
      darkModeSelector: 'system',
      cssLayer: {
        name: 'primevue',
        order: 'tailwind-base, primevue, tailwind-utilities',
      },
    },
  },
});
// app
// .component('Accordion', Accordion)
// .component('AccordionPanel', AccordionPanel)
// .component('AccordionHeader', AccordionHeader)
// .component('AccordionContent', AccordionContent)
// .component('Button', Button);

app.mount('#app');
