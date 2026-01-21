<script setup lang="ts">
import { computed } from 'vue'
import type { CampingTrip } from '../types/database'
import StatsHeader from './StatsHeader.vue'
import NextTripCard from './NextTripCard.vue'

const props = defineProps<{
  trips: CampingTrip[]
}>()

const emit = defineEmits<{
  (e: 'view-detail', trip: CampingTrip): void
}>()

// 計算下一個行程
const nextTrip = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const futureTrips = props.trips
    .filter(t => new Date(t.trip_date) >= today)
    .sort((a, b) => new Date(a.trip_date).getTime() - new Date(b.trip_date).getTime())
    
  return futureTrips.length > 0 ? futureTrips[0] : null
})
</script>

<template>
  <div class="space-y-6 pb-24">
    <!-- 統計區塊 -->
    <StatsHeader :trips="trips" />

    <!-- 下次露營 (如果有的話) -->
    <div v-if="nextTrip" class="px-4">
      <h2 class="text-xl font-bold text-gray-900 mb-4 flex items-center">
        <span class="bg-primary-500 w-1.5 h-6 rounded-full mr-3"></span>
        倒數計時
      </h2>
      <NextTripCard :trip="nextTrip" @click="emit('view-detail', nextTrip)" />
    </div>

    <!-- 如果沒有下次露營，顯示空狀態引導 -->
    <div v-else class="px-4 py-8 text-center bg-gray-50 rounded-3xl mx-4 border border-dashed border-gray-200">
      <div class="text-4xl mb-3">🏕️</div>
      <h3 class="text-lg font-bold text-gray-900 mb-1">準備好出發了嗎？</h3>
      <p class="text-sm text-gray-500 mb-4">目前沒有即將到來的行程</p>
    </div>
  </div>
</template>
