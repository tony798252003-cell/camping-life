<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import type { CampingTrip } from '../types/database'
import StatsHeader from './StatsHeader.vue'
import NextTripCard from './NextTripCard.vue'
import { Navigation } from 'lucide-vue-next'

const props = defineProps<{
  trips: CampingTrip[]
}>()

const emit = defineEmits<{
  (e: 'view-detail', trip: CampingTrip): void
  (e: 'update-night-rush', payload: { id: number, value: boolean }): void
}>()

// 使用共享的車程計算邏輯
import { useTravelTime } from '../composables/useTravelTime'
const { travelTime, loading: loadingTravelTime, fetchTravelTime: doFetchTravelTime } = useTravelTime()

// 計算下一個行程
const nextTrip = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const futureTrips = props.trips
    .filter(t => new Date(t.trip_date) >= today)
    .sort((a, b) => new Date(a.trip_date).getTime() - new Date(b.trip_date).getTime())
    
  // Support Night Rush: if today is the day before a trip AND night_rush is true, show it!
  const nightRushTrips = props.trips.filter(t => {
     const tripDate = new Date(t.trip_date)
     const yesterday = new Date(tripDate)
     yesterday.setDate(yesterday.getDate() - 1)
     yesterday.setHours(0,0,0,0)
     
     return t.night_rush && yesterday.getTime() === today.getTime()
  })
  
  if (nightRushTrips.length > 0) return nightRushTrips[0]
  
  return futureTrips.length > 0 ? futureTrips[0] : null
})

const navigateToGoogleMaps = () => {
  if (!nextTrip.value) return
  
  const { latitude, longitude, campsite_name, start_latitude, start_longitude } = nextTrip.value
  let url = ''
  
  if (latitude && longitude) {
    // 優先使用座標導航
    const dest = `${latitude},${longitude}`
    const origin = (start_latitude && start_longitude) ? `${start_latitude},${start_longitude}` : ''
    url = `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin ? `&origin=${origin}` : ''}`
  } else {
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(campsite_name)}`
  }
  
  window.open(url, '_blank')
}

const fetchTravelTime = () => {
  if (!nextTrip.value || !nextTrip.value.latitude || !nextTrip.value.longitude) {
    travelTime.value = null
    return
  }

  doFetchTravelTime(
    nextTrip.value.latitude, 
    nextTrip.value.longitude, 
    nextTrip.value.start_latitude ?? undefined, 
    nextTrip.value.start_longitude ?? undefined
  )
}

watch(nextTrip, () => {
  fetchTravelTime()
}, { immediate: true })

onMounted(() => {
  fetchTravelTime()
})
</script>

<template>
  <div class="space-y-2 md:space-y-3 pb-32 md:max-w-4xl md:mx-auto md:pb-8">
    <!-- 統計區塊 -->
    <div class="px-4 mt-4 md:mt-6">
      <StatsHeader :trips="trips" />
    </div>

    <!-- 下次露營 (如果有的話) -->
    <div v-if="nextTrip" class="px-4 space-y-4">
      <NextTripCard 
        :trip="nextTrip" 
        @click="emit('view-detail', nextTrip)" 
        @update-night-rush="payload => emit('update-night-rush', payload)"
      />
      
      <!-- 立即出發按鈕 (Lifted Premium Style) -->
      <button 
        @click.stop="navigateToGoogleMaps"
        class="group relative w-full overflow-hidden rounded-full p-3 md:p-4 flex items-center justify-between transition-all duration-500 active:scale-[0.96] border-2 border-sky-100 shadow-[0_15px_30px_-5px_rgba(14,165,233,0.15)] hover:shadow-[0_20px_40px_-5px_rgba(14,165,233,0.25)] hover:border-sky-300/50 bg-white"
      >
        <!-- Interactive Shine Effect -->
        <div class="absolute inset-0 bg-gradient-to-b from-white via-sky-50/30 to-sky-100/20 group-hover:from-sky-50 transition-colors duration-500"></div>
        <div class="absolute -inset-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] group-hover:left-full transition-all duration-1000 ease-in-out"></div>

        <div class="flex items-center gap-3 md:gap-4 relative z-10 pl-2">
          <!-- Icon Container with Muted Depth -->
          <div class="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-sky-300 to-sky-400 flex items-center justify-center text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),0_4px_10px_rgba(14,165,233,0.15)] group-hover:rotate-[15deg] transition-transform duration-500">
            <Navigation class="w-5 h-5 md:w-6 md:h-6 animate-pulse-slow fill-current" />
          </div>
          
          <div class="text-left flex items-baseline gap-2 md:gap-3">
            <h3 class="text-xl md:text-2xl font-black text-primary-900 tracking-wider leading-none">
              立即出發
            </h3>
            <div v-if="travelTime || loadingTravelTime" class="text-[10px] md:text-xs font-bold text-sky-500/70 tracking-wide bg-sky-50/50 px-2 py-0.5 rounded-lg border border-sky-100">
               <span v-if="travelTime">預估 {{ travelTime }}</span>
               <span v-else class="animate-pulse opacity-60">計算中...</span>
            </div>
          </div>
        </div>

        <!-- Right Side Indicator -->
        <div class="relative z-10 pr-2">
          <div class="w-9 h-9 md:w-11 md:h-11 rounded-full bg-white flex items-center justify-center border border-gray-100 text-sky-500 group-hover:scale-110 group-hover:bg-primary-900 group-hover:text-white transition-all duration-500 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>
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
