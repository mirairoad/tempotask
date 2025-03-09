
export interface MenuItem {
  title: string;
  path: string;
  icon: string;
  badge?: string | number;
  items?: Omit<MenuItem, 'icon'>[];
  search?: boolean;
  model?: string;
  sideComponent?: string; // Name of the component to render instead of submenu
  matchPattern?: string;
}

// create a function which generate random menu items with the same number of items
// export const generateRandomMenuItems = (): MenuItem[] => {
//   const queueList = ['cron', 'scheduler'];
//   return queueList.map((queue) => ({
//     title: queue,
//     path: `/admin/queues/${queue}`,
//     icon: 'pi pi-chart-bar',
//     items: [],
//   }));
// };

// https://primevue.org/icons/ - PrimeVue Icons
export const menuItems: MenuItem[] = [
  {
    title: 'Dashboard',
    path: '/admin',
    icon: 'pi pi-th-large',
    search: false,
  },
  {
    title: 'Queues',
    path: '/admin/queues',
    icon: 'pi pi-cloud',
    // sideComponent: 'QueuesFilter',
    search: true,
    items: [],
  },
  {
    title: 'Monitoring',
    path: '/admin/monitor',
    icon: 'pi pi-search',
    search: false,
    items: [
      {
        title: 'Job Status',
        path: '/admin/monitor/job-status',
        search: false,
      },
    ],
  },
  {
    title: 'Metrics',
    path: '/admin/metrics',
    icon: 'pi pi-chart-bar',
    search: false,
    items: [],
  },
];
