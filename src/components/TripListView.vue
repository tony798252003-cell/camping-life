<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CampingTrip } from '../types/database'
import CampingCard from './CampingCard.vue'

const props = defineProps<{
  trips: CampingTrip[]
}>()

const emit = defineEmits<{
  (e: 'view-detail', trip: CampingTrip): void
  (e: 'edit', trip: CampingTrip): void
  (e: 'delete', id: number): void
  (e: 'add'): void
}>()

const activeTab = ref<'future' | 'history'>('history')

// 未來的行程 (排除已經顯示在首頁的 nextTrip? 使用者可能希望看到所有，這裡顯示所有)
const futureTripsList = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return props.trips
    .filter(t => new Date(t.trip_date) >= today)
    .sort((a, b) => new Date(a.trip_date).getTime() - new Date(b.trip_date).getTime())
})

// 歷史回憶
const historyTripsList = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return props.trips
    .filter(t => new Date(t.trip_date) < today)
    .sort((a, b) => new Date(b.trip_date).getTime() - new Date(a.trip_date).getTime())
})
</script>

<template>
  <div class="pb-24">
    <!-- 頂部標題與新增按鈕 -->
    <div class="sticky top-0 bg-white/95 backdrop-blur z-20 px-4 py-4 border-b border-gray-100 flex items-center justify-between">
      <h1 class="text-2xl font-black text-gray-900 tracking-tight">露營列表</h1>
      <button 
        @click="emit('add')"
        class="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary-500/30 transition-all active:scale-95 flex items-center"
      >
        <span class="text-lg mr-1">+</span> 紀錄
      </button>
    </div>

    <!-- 分頁切換 -->
    <div class="px-4 py-4">
      <div class="bg-gray-100 p-1 rounded-2xl flex relative">
        <div 
          class="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out"
          :class="activeTab === 'future' ? 'left-1' : 'left-[calc(50%+2px)]'"
        ></div>
        <button 
          @click="activeTab = 'future'"
          class="flex-1 relative z-10 py-2.5 text-sm font-bold transition-colors duration-300"
          :class="activeTab === 'future' ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'"
        >
          即將出發
          <span v-if="futureTripsList.length" class="absolute top-2 right-4 w-2 h-2 rounded-full bg-red-400"></span>
        </button>
        <button 
          @click="activeTab = 'history'"
          class="flex-1 relative z-10 py-2.5 text-sm font-bold transition-colors duration-300"
          :class="activeTab === 'history' ? 'text-gray-800' : 'text-gray-500 hover:text-gray-700'"
        >
          歷史回憶
        </button>
      </div>
    </div>

    <!-- 列表內容 -->
    <div class="px-4 space-y-3 min-h-[50vh]">
      <div v-if="activeTab === 'future'">
        <div v-if="futureTripsList.length === 0" class="flex flex-col items-center justify-center py-16 text-gray-400">
          <div class="text-5xl mb-4 opacity-50">🏔️</div>
          <p>還沒有安排新的冒險</p>
        </div>
        <div v-else class="space-y-3">
          <CampingCard
            v-for="trip in futureTripsList"
            :key="trip.id"
            :trip="trip"
            @click="emit('view-detail', trip)"
            @edit="emit('edit', trip)"
            @delete="emit('delete', trip.id)"
          />
        </div>
      </div>

      <div v-else>
        <div v-if="historyTripsList.length === 0" class="flex flex-col items-center justify-center py-16 text-gray-400">
          <div class="text-5xl mb-4 opacity-50">📜</div>
          <p>還沒有歷史紀錄</p>
        </div>
        <div v-else class="space-y-3">
          <CampingCard
            v-for="trip in historyTripsList"
            :key="trip.id"
            :trip="trip"
            @click="emit('view-detail', trip)"
            @edit="emit('edit', trip)"
            @delete="emit('delete', trip.id)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
