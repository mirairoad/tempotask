import { useAppStore } from '@src/stores/app';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/admin',
      component: () => import('../views/dashboard/index.vue'),
    },
    {
      path: '/admin/queues',
      component: () => import('../views/queues/index.vue'),
    },
    {
      path: '/admin/queues/:queue',
      component: () => import('../views/queues/index.vue'),
    },
    {
      path: '/admin/monitor',
      component: () => import('../views/monitor/index.vue'),
    },
    {
      path: '/admin/metrics',
      component: () => import('../views/metrics/index.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/admin',
    },
  ],
});

// Update current page on route change
router.beforeEach((to) => {
  const appStore = useAppStore();
  appStore.setCurrentPage(to.path);
});

export default router;
