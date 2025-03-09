<script setup lang="ts">
import { useAppStore  } from '@src/stores/app';
import TieredMenu from 'primevue/tieredmenu';
import { ref } from 'vue';

const appStore = useAppStore();
const menu = ref();

interface actionMenuItems {
    label: string;
    icon: string;
    component: string;
}

// Each menu item can map to a component
const items = ref([
    // {
    //     label: 'View',
    //     icon: 'pi pi-eye',
    //     component: 'ViewDetails'
    // },
    {
        label: 'Edit',
        icon: 'pi pi-pencil',
        component: 'EditForm'
    },
    {
        label: 'Export',
        icon: 'pi pi-download',
        items: [
            {
                label: 'CSV',
                icon: 'pi pi-file',
                component: 'ExportCSV'
            },
            {
                label: 'Excel',
                icon: 'pi pi-file-excel',
                component: 'ExportExcel'
            }
        ]
    },
    { separator: true },
    {
        label: 'Delete',
        icon: 'pi pi-trash',
        component: 'DeleteConfirm',
        severity: 'danger'
    }
] as actionMenuItems[]);

const toggle = (event: Event) => {
    menu.value.toggle(event);
};

const handleMenuAction = (item: any) => {
    if (item.component) {
        appStore.openComponent(item.component);
    }
};
</script>

<template>
    <div class="relative">
        <Button type="button" icon="pi pi-ellipsis-h" text aria-label="Actions" @click="toggle" :pt="{
            root: { class: 'surface-0' },
            label: { class: 'text-surface-600' }
        }" />

        <TieredMenu ref="menu" :model="items" :popup="true" @item-click="handleMenuAction" />
    </div>
</template>

<style scoped>
/* :deep(.p-menu-list) {
    @apply !p-1;
}

:deep(.p-menuitem) {
    @apply !rounded-lg overflow-hidden;
}

:deep(.p-menuitem-link) {
    @apply !px-3 !py-2 hover: !bg-surface-100 dark:hover: !bg-surface-800;
}

:deep(.p-menuitem-icon) {
    @apply !text-surface-600 dark: !text-surface-400;
}

:deep(.p-submenu-icon) {
    @apply !text-surface-600 dark: !text-surface-400;
} */
</style>