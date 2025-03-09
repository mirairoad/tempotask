<script setup lang="ts">
import { ArrowDown, ArrowUp, DollarSign, ShoppingCart, Users } from 'lucide-vue-next';
import { ref } from 'vue';

const stats = ref([
  {
    label: 'Total Users',
    value: '1,234',
    icon: Users,
    change: '+12.5%',
    trend: 'up'
  },
  {
    label: 'Revenue',
    value: '$12,345',
    icon: DollarSign,
    change: '+8.2%',
    trend: 'up'
  },
  {
    label: 'Orders',
    value: '567',
    icon: ShoppingCart,
    change: '-3.1%',
    trend: 'down'
  },
]);

const recentActivity = ref([
  { date: '2024-03-10', user: 'John Doe', action: 'Created new account' },
  { date: '2024-03-09', user: 'Jane Smith', action: 'Updated profile' },
  { date: '2024-03-09', user: 'Mike Johnson', action: 'Placed new order' },
]);
</script>

<template>
  <div class="space-y-6">
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card v-for="stat in stats" :key="stat.label" class="!border-0 !shadow-sm">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm font-medium text-surface-600 dark:text-surface-400">
              {{ stat.label }}
            </p>
            <h3 class="text-2xl font-semibold mt-2">{{ stat.value }}</h3>
            <div class="flex items-center mt-1 gap-1" :class="stat.trend === 'up' ? 'text-green-600' : 'text-red-600'">
              <component :is="stat.trend === 'up' ? ArrowUp : ArrowDown" class="w-4 h-4" />
              <span class="text-sm font-medium">{{ stat.change }}</span>
            </div>
          </div>
          <component :is="stat.icon" class="w-8 h-8 text-primary-500" />
        </div>
      </Card>
    </div>

    <!-- Recent Activity -->
    <Card class="!border-0 !shadow-sm">
      <template #title>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Recent Activity</h2>
          <Button label="View All" text class="!text-primary-600" />
        </div>
      </template>
      <DataTable :value="recentActivity" class="!border-0" stripedRows>
        <Column field="date" header="Date"></Column>
        <Column field="user" header="User"></Column>
        <Column field="action" header="Action"></Column>
      </DataTable>
    </Card>
  </div>
</template>