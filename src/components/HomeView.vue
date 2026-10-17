<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { ArrowRight } from 'lucide-vue-next'
import type { CampingTrip, CampingTripWithCampsite } from '../types/database'
import StatsHeader from './StatsHeader.vue'
import NextTripCard from './NextTripCard.vue'
import TripMemoryWidget from './TripMemoryWidget.vue'


const props = defineProps<{
  trips: CampingTripWithCampsite[]
  userOrigin?: { latitude: number, longitude: number, location_name: string } | null
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'view-detail', trip: CampingTrip): void
  (e: 'update-night-rush', payload: { id: number, value: boolean }): void
  (e: 'add'): void
}>()

// 使用共享的車程計算邏輯
// Travel time logic removed from HomeView (moved to NextTripCard)

// 排序後的所有行程
const sortedTrips = computed(() => {
  return [...props.trips].sort((a, b) => new Date(a.trip_date).getTime() - new Date(b.trip_date).getTime())
})

// 當前顯示的行程索引
// 當前顯示的行程索引
const currentIndex = ref<number>(-1)
const defaultIndex = ref<number>(-1)
const currentTripId = ref<number | null>(null)

// 計算「真正」的下一個行程 (用於初始化)
const initialNextTrip = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const futureTrips = sortedTrips.value.filter(t => new Date(t.trip_date) >= today)
    
  // Support Night Rush: if today is the day before a trip AND night_rush is true, show it!
  const nightRushTrips = sortedTrips.value.filter(t => {
     const tripDate = new Date(t.trip_date)
     const yesterday = new Date(tripDate)
     yesterday.setDate(yesterday.getDate() - 1)
     yesterday.setHours(0,0,0,0)
     
     return t.night_rush && yesterday.getTime() === today.getTime()
  })
  
  if (nightRushTrips.length > 0) return nightRushTrips[0]
  
  return futureTrips.length > 0 ? futureTrips[0] : null
})

// 初始化索引
// Sync currentTripId when index changes (User Navigation)
// Sync currentTripId removed. We update it explicitly in navigation functions.

// 初始化索引 & Data Update Handling
watch(() => props.trips, () => {
  // 1. Try to restore previous selection using ID
  if (currentTripId.value !== null) {
      // Find where our tracked trip went
      const newIndex = sortedTrips.value.findIndex(t => t.id === currentTripId.value)
      if (newIndex !== -1) {
          currentIndex.value = newIndex
          // Verify if default index needs update? 
          // Default index tracks "Upcoming" usually.
          // Let's re-calculate default only if we lost track or on init?
          // Actually, just restoring current index is enough for "Night Rush toggle".
          return 
      }
  }

  // 2. Initialization (if no selection or selection lost)
  if (currentIndex.value === -1 && initialNextTrip.value) {
    const idx = sortedTrips.value.findIndex(t => t.id === initialNextTrip.value?.id)
    if (idx !== -1) {
      currentIndex.value = idx
      defaultIndex.value = idx
      currentTripId.value = initialNextTrip.value.id
    }
  } else if (currentIndex.value === -1 && sortedTrips.value.length > 0) {
    // 如果沒有未來行程，預設顯示最後一個 (最近的過去)
    const idx = sortedTrips.value.length - 1
    currentIndex.value = idx
    defaultIndex.value = idx
    const trip = sortedTrips.value[idx]
    if (trip) {
        currentTripId.value = trip.id
    }
  }
}, { immediate: true })

// 當前顯示的行程
const displayedTrip = computed(() => {
  if (currentIndex.value >= 0 && currentIndex.value < sortedTrips.value.length) {
    return sortedTrips.value[currentIndex.value]
  }
  return null
})

// 切換行程
const nextSlide = () => {
  if (currentIndex.value < sortedTrips.value.length - 1) {
    currentIndex.value++
    // Update ID Tracker
    const trip = sortedTrips.value[currentIndex.value]
    if (trip) {
        currentTripId.value = trip.id
    }
  }
}

const prevSlide = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    // Update ID Tracker
    const trip = sortedTrips.value[currentIndex.value]
    if (trip) {
        currentTripId.value = trip.id
    }
  }
}

const resetSlide = () => {
  if (defaultIndex.value !== -1) {
    currentIndex.value = defaultIndex.value
    // Update ID Tracker to default
    const trip = sortedTrips.value[currentIndex.value]
    if (trip) {
        currentTripId.value = trip.id
    }
  }
}

// navigateToGoogleMaps moved to NextTripCard

// fetchTravelTime moved
</script>

<template>
  <div class="space-y-2 md:space-y-3 pb-32 md:max-w-4xl md:mx-auto md:pb-8">
    <!-- 統計區塊 -->
    <div class="px-4 mt-4 md:mt-6">
       <div class="flex items-center justify-between mb-3 px-2">
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">STATS OVERVIEW</h3>
          <button @click="$router.push('/stats')" class="text-xs font-bold text-primary-500 hover:text-primary-700 flex items-center gap-1 transition-colors">
            查看報表
            <ArrowRight class="w-3 h-3" />
          </button>
       </div>
       <StatsHeader :trips="trips" />
       

     </div>

    <!-- 下次露營 (如果有的話) -->
    <div v-if="loading" class="px-4 relative animate-pulse">
        <!-- Skeleton Card -->
        <div class="relative w-full rounded-[2.5rem] bg-white/50 backdrop-blur-sm border border-white/40 h-[420px]">
           <div class="absolute inset-0 flex flex-col items-center justify-center gap-6">
              <div class="w-24 h-6 bg-white/60 rounded-full"></div>
              <div class="w-3/4 h-16 bg-white/60 rounded-xl"></div>
              <div class="w-1/2 h-8 bg-white/60 rounded-lg"></div>
              <div class="w-40 h-24 bg-white/60 rounded-2xl"></div>
           </div>
        </div>
    </div>

    <div v-else-if="displayedTrip" class="px-4 space-y-4 relative">
      <div class="relative group/card">
        <NextTripCard 
          :trip="displayedTrip" 
          :has-prev="currentIndex > 0"
          :has-next="currentIndex < sortedTrips.length - 1"
          :show-reset-button="currentIndex !== defaultIndex"
          :user-origin="userOrigin"
          @prev="prevSlide"
          @next="nextSlide"
          @reset="resetSlide"
          @click="emit('view-detail', displayedTrip)" 
          @update-night-rush="payload => emit('update-night-rush', payload)"
        />

      </div>

      <!-- Memories Widget -->
      <TripMemoryWidget />
      
    </div>

      <!-- 如果沒有下次露營，顯示空狀態引導 -->
    <div v-else class="px-4 py-12 text-center card-organic rounded-3xl mx-4">
      <div class="text-6xl mb-6 animate-bounce">🏕️</div>
      <h3 class="text-xl font-bold text-primary-900 mb-2">準備好出發了嗎？</h3>
      <p class="text-primary-600 mb-6 font-medium">目前沒有即將到來的行程，開始規劃下一次冒險吧！</p>
    </div>

  </div>
</template>

<style scoped>
@keyframes pulse-slow {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.1); }
}
.animate-pulse-slow {
  animation: pulse-slow 3s ease-in-out infinite;
}
</style>
