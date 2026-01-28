<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import type { CampingTrip, CampingTripWithCampsite } from '../types/database'
import StatsHeader from './StatsHeader.vue'
import NextTripCard from './NextTripCard.vue'
import { RotateCcw } from 'lucide-vue-next'

const props = defineProps<{
  trips: CampingTripWithCampsite[]
  userOrigin?: { latitude: number, longitude: number, location_name: string } | null
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'view-detail', trip: CampingTrip): void
  (e: 'update-night-rush', payload: { id: number, value: boolean }): void
}>()

// 使用共享的車程計算邏輯
// Travel time logic removed from HomeView (moved to NextTripCard)

// 排序後的所有行程
const sortedTrips = computed(() => {
  return [...props.trips].sort((a, b) => new Date(a.trip_date).getTime() - new Date(b.trip_date).getTime())
})

// 當前顯示的行程索引
const currentIndex = ref<number>(-1)
const defaultIndex = ref<number>(-1)

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
watch(() => props.trips, () => {
  if (currentIndex.value === -1 && initialNextTrip.value) {
    const idx = sortedTrips.value.findIndex(t => t.id === initialNextTrip.value?.id)
    if (idx !== -1) {
      currentIndex.value = idx
      defaultIndex.value = idx
    }
  } else if (currentIndex.value === -1 && sortedTrips.value.length > 0) {
    // 如果沒有未來行程，預設顯示最後一個 (最近的過去)
    currentIndex.value = sortedTrips.value.length - 1
    defaultIndex.value = sortedTrips.value.length - 1
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
  }
}

const prevSlide = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

const resetSlide = () => {
  if (defaultIndex.value !== -1) {
    currentIndex.value = defaultIndex.value
  }
}

// navigateToGoogleMaps moved to NextTripCard

// fetchTravelTime moved
</script>

<template>
  <div class="space-y-2 md:space-y-3 pb-32 md:max-w-4xl md:mx-auto md:pb-8">
    <!-- 統計區塊 -->
    <div class="px-4 mt-4 md:mt-6">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-2">STATS OVERVIEW</h3>
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
          :user-origin="userOrigin"
          @prev="prevSlide"
          @next="nextSlide"
          @click="emit('view-detail', displayedTrip)" 
          @update-night-rush="payload => emit('update-night-rush', payload)"
        />
        
        <!-- Jump Back Button -->
        <div v-if="currentIndex !== defaultIndex" class="absolute top-6 left-6 md:top-8 md:left-8 z-30 animate-fade-in">
           <button 
             @click.stop="resetSlide"
             class="group flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full transition-all duration-500 shadow-md border backdrop-blur-md bg-white/60 border-white/60 text-primary-300 hover:bg-white hover:text-primary-600 hover:shadow-lg"
             title="回到最近"
           >
             <RotateCcw class="w-5 h-5 md:w-6 md:h-6 transition-transform duration-500 group-hover:-rotate-180" />
           </button>
        </div>
      </div>
      
    </div>

    <!-- 如果沒有下次露營，顯示空狀態引導 -->
    <div v-else class="px-4 py-12 text-center card-organic rounded-3xl mx-4">
      <div class="text-6xl mb-6 animate-bounce">🏕️</div>
      <h3 class="text-xl font-bold text-primary-900 mb-2">準備好出發了嗎？</h3>
      <p class="text-primary-600 mb-6 font-medium">目前沒有即將到來的行程，開始規劃下一次冒險吧！</p>
      <!-- CTA Button handled by FAB globally, but could add one here if needed -->
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
