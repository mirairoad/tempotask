import { httpHandler } from '@shared/utils/http/http-handler.ts';
import { type MenuItem, menuItems as menuItemsConfig } from '@src/config/menu.ts';
import { defineStore } from 'pinia';
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

interface Queue {
  name: string;
  stats: {
    total: number;
  };
  paused: boolean;
}

interface DataState {
  queues: Queue[]
}

interface ToastMessage {
  severity: 'success' | 'info' | 'warn' | 'error';
  summary?: string;
  detail: string;
  life?: number;
  group?: string;
}

export const useAppStore = defineStore('app', () => {
  const route = useRoute();
  const appFirstLoading = ref(true);
  const loading = ref(false);
  const hasSearch = ref(false);
  const searchQuery = ref('');
  const sortDirection = ref<'asc' | 'desc'>('asc');
  const activeComponent = ref<string | null>(null);
  const currentPage = ref('Dashboard');
  const currentSubmenu = ref<MenuItem['items']>([]);
  const menuItems = ref<MenuItem[]>([...menuItemsConfig]);
  const lastQueuesPath = ref('');

  // Data State
  const Data = ref<DataState>({
    queues: []
  });

  // Watch for queue changes and update menu items
  watch(() => Data.value.queues, (newQueues) => {
    if (newQueues.length > 0) {
      updateQueueMenuItems(newQueues);
      
      // Update current page and submenu if we're on the queues page
      const currentPath = route.path;
      if (currentPath.startsWith('/admin/queues')) {
        const queuesMenuItem = menuItems.value.find((item:MenuItem) => item.path === '/admin/queues');
        if (queuesMenuItem) {
          currentPage.value = queuesMenuItem.title;
          currentSubmenu.value = queuesMenuItem.items || [];

          // If we're looking at a specific queue, update the page title
          if (route.params.queue) {
            const queueItem = queuesMenuItem.items?.find((item:MenuItem) => item.path === currentPath);
            if (queueItem) {
              currentPage.value = queueItem.title;
            }
          }
        }
      }
    }
  }, { immediate: true });

  // Watch route changes to handle search visibility
  watch(
    () => route.path,
    (path) => {
      // Enable search only for specific queue routes
      const isQueueDetailPath = path.startsWith('/admin/queues/') && path !== '/admin/queues';
      console.log('Route changed, setting hasSearch:', isQueueDetailPath, 'for path:', path);
      hasSearch.value = isQueueDetailPath;
      
      // If this is a queue detail page, ensure the model is set for search
      if (isQueueDetailPath) {
        // Find the corresponding queue menu item
        const queuesMenuItem = menuItems.value.find((item:MenuItem) => item.path === '/admin/queues');
        if (queuesMenuItem && queuesMenuItem.items) {
          const queueItem = queuesMenuItem.items.find((item:MenuItem) => item.path === path);
          if (queueItem) {
            console.log('Found queue item with search:', queueItem.search);
          }
        }
      }
    },
    { immediate: true }
  );

  // initial data loading
  const initializeApp = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const res = await httpHandler.get<Queue[]>('/admin/api/jobs');
      if(res.status === 200) {
        Data.value.queues = res.data;
      }
    } finally {
      appFirstLoading.value = false;
    }
  };

  (async () => {
    await initializeApp();
  })();

  const updateQueueMenuItems = (queues: Queue[]) => {
    menuItems.value = menuItems.value.map((item: MenuItem) => {
      if (item.path === '/admin/queues') {
        item.items = queues.map((queue) => ({
          title: queue.name.slice(0,1).toUpperCase() + queue.name.slice(1),
          path: `/admin/queues/${queue.name}`,
          badge: queue.stats.total.toString(),
          icon: queue.paused ? 'pi pi-times' : 'pi pi-check',
          search: true,
          model: 'tasks',
        }));
      }
      return item;
    });
  };

  // Track current main menu item and its submenu
  const currentMenuItem = computed(() => {
    const path = route.path;
    
    // First, try to find an exact match for the current path
    let exactMatch = menuItems.value.find((item: MenuItem) => item.path === path);
    if (exactMatch) return exactMatch;
    
    // Next, check for submenu items with exact match
    let submenuMatch = menuItems.value.find((item: MenuItem) => 
      item.items?.some((subItem) => subItem.path === path)
    );
    if (submenuMatch) return submenuMatch;
    
    // If no exact matches, look for the most specific parent
    // Sort menu items by path length (longest first) to find the most specific match
    const possibleParents = menuItems.value
      .filter((item: MenuItem) => 
        path.startsWith(item.path) && item.path !== '/' && item.path !== '/admin'
      )
      .sort((a: MenuItem, b: MenuItem) => b.path.length - a.path.length);
    
    if (possibleParents.length > 0) {
      return possibleParents[0]; // Return the most specific parent
    }
    
    // If we're on a queue detail page, find the queues menu item
    if (path.startsWith('/admin/queues/')) {
      const queuesMenuItem = menuItems.value.find((item: MenuItem) => item.path === '/admin/queues');
      if (queuesMenuItem) {
        // Try to find the specific queue submenu item
        const queueItem = queuesMenuItem.items?.find((subItem:MenuItem) => subItem.path === path);
        if (queueItem) {
          return {
            ...queuesMenuItem,
            ...queueItem,
            search: true,
            model: 'tasks'
          };
        }
        return queuesMenuItem;
      }
    }
    
    // Fallback to the dashboard for the home page
    if (path === '/') {
      return menuItems.value.find((item: MenuItem) => item.path === '/');
    }
    
    return null;
  });

  // Remove the route watcher since we'll handle search in currentMenuItem
  watch(
    () => currentMenuItem.value,
    (item) => {
      hasSearch.value = !!item?.search;
    },
    { immediate: true }
  );

  // Update submenu based on current path
  const setCurrentPage = (path: string) => {
    // Find the menu item that matches the path or contains it in submenu
    const menuItem = menuItems.value.find((item:MenuItem) =>
      item.path === path || item.items?.some((subItem) => subItem.path === path)
    );

    if (menuItem) {
      currentPage.value = menuItem.title;
      currentSubmenu.value = menuItem.items || [];

      // If this is a submenu item, highlight it
      if (menuItem.items) {
        const subItem = menuItem.items.find((item:MenuItem) => item.path === path);
        if (subItem) {
          currentPage.value = subItem.title;
        }
      }
    }
  };

  const search = () => {
    console.log('Searching...', {
      query: searchQuery.value,
      sortDirection: sortDirection.value,
      model: currentMenuItem.value?.model,
    });
  };

  const actionMenu = {
    selectAll: () => {
      console.log('Select all items');
    },
    clearSelection: () => {
      console.log('Clear selection');
    },
    exportToCSV: () => {
      console.log('Export to CSV');
    },
    exportToExcel: () => {
      console.log('Export to Excel');
    },
  };

  const openComponent = (componentName: string) => {
    activeComponent.value = componentName;
    console.log(`Opening component: ${componentName}`);
  };


  const toastMessage = ref<ToastMessage | null>(null);

  // Update the showToast function
  const showToast = (message: ToastMessage) => {
    // First clear any existing toast
    toastMessage.value = null;
    // Use nextTick to ensure the DOM has updated
    nextTick(() => {
      toastMessage.value = {
        severity: message.severity,
        summary: message.summary,
        detail: message.detail,
        life: message.life || 3000,
        group: message.group || 'main',
      };
    });
  };

  return {
    appFirstLoading,
    initializeApp,
    loading,
    searchQuery,
    search,
    hasSearch,
    sortDirection,
    actionMenu,
    activeComponent,
    openComponent,
    currentPage,
    currentSubmenu,
    setCurrentPage,
    currentMenuItem,
    Data,
    toastMessage,
    showToast,
    menuItems,
    updateQueueMenuItems,
    lastQueuesPath
  };
});
