<script setup lang="ts">
import { computed, watch, onMounted, ref } from 'vue'
import type { CampingTrip, CampingTripWithCampsite } from '../types/database'
import StatsHeader from './StatsHeader.vue'
import NextTripCard from './NextTripCard.vue'
import { Navigation, RotateCcw } from 'lucide-vue-next'

const props = defineProps<{
  trips: CampingTripWithCampsite[]
  userOrigin?: { latitude: number, longitude: number, location_name: string } | null
}>()

const emit = defineEmits<{
  (e: 'view-detail', trip: CampingTrip): void
  (e: 'update-night-rush', payload: { id: number, value: boolean }): void
}>()

// 使用共享的車程計算邏輯
import { useTravelTime } from '../composables/useTravelTime'
const { travelTime, loading: loadingTravelTime, fetchTravelTime: doFetchTravelTime } = useTravelTime()

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

const navigateToGoogleMaps = () => {
  if (!displayedTrip.value) return
  
  const trip = displayedTrip.value
  const latitude = trip.campsites?.latitude ?? trip.latitude
  const longitude = trip.campsites?.longitude ?? trip.longitude
  const name = trip.campsites?.name ?? trip.campsite_name
  const start_latitude = trip.start_latitude
  const start_longitude = trip.start_longitude

  let url = ''
  
  if (name) {
    // 應使用者要求，改用名稱導航，不送座標
    const originParam = (start_latitude && start_longitude) ? `&origin=${start_latitude},${start_longitude}` : ''
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(name)}${originParam}`
  } else if (latitude && longitude) {
    const dest = `${latitude},${longitude}`
    const originParam = (start_latitude && start_longitude) ? `&origin=${start_latitude},${start_longitude}` : ''
    url = `https://www.google.com/maps/dir/?api=1&destination=${dest}${originParam}`
  }
  
  window.open(url, '_blank')
}

const fetchTravelTime = () => {
  const trip = displayedTrip.value
  if (!trip) {
    travelTime.value = null
    return
  }
  
  const destLat = trip.campsites?.latitude ?? trip.latitude
  const destLng = trip.campsites?.longitude ?? trip.longitude

  if (!destLat || !destLng) {
    travelTime.value = null
    return
  }

  doFetchTravelTime(
    destLat, 
    destLng, 
    trip.start_latitude ?? props.userOrigin?.latitude, 
    trip.start_longitude ?? props.userOrigin?.longitude
  )
}

watch(displayedTrip, () => {
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
    <div v-if="displayedTrip" class="px-4 space-y-4 relative">
      <div class="relative group/card">
        <NextTripCard 
          :trip="displayedTrip" 
          :has-prev="currentIndex > 0"
          :has-next="currentIndex < sortedTrips.length - 1"
          @prev="prevSlide"
          @next="nextSlide"
          @click="emit('view-detail', displayedTrip)" 
          @update-night-rush="payload => emit('update-night-rush', payload)"
        />
        


        <!-- Jump Back Button -->
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
      
      <!-- 立即出發按鈕 (Lifted Premium Style) -->
      <button 
        @click.stop="navigateToGoogleMaps"
        class="group relative w-fit mx-auto overflow-hidden rounded-full py-2 px-5 md:py-3 md:px-6 flex items-center justify-center transition-all duration-500 active:scale-[0.96] border-2 border-sky-100 shadow-[0_15px_30px_-5px_rgba(14,165,233,0.15)] hover:shadow-[0_20px_40px_-5px_rgba(14,165,233,0.25)] hover:border-sky-300/50 bg-white"
      >
        <!-- Interactive Shine Effect -->
        <div class="absolute inset-0 bg-gradient-to-b from-white via-sky-50/30 to-sky-100/20 group-hover:from-sky-50 transition-colors duration-500"></div>
        <div class="absolute -inset-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] group-hover:left-full transition-all duration-1000 ease-in-out"></div>

        <div class="flex items-center gap-3 relative z-10">
          <!-- Icon Container with Muted Depth -->
          <div class="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-sky-300 to-sky-400 flex items-center justify-center text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),0_4px_10px_rgba(14,165,233,0.15)] group-hover:rotate-[15deg] transition-transform duration-500">
            <Navigation class="w-5 h-5 md:w-6 md:h-6 animate-pulse-slow fill-current" />
          </div>
          
          <div class="text-left flex flex-col items-start gap-0.5">
            <h3 class="text-lg md:text-xl font-black text-primary-900 tracking-wider leading-none">
              立即出發
            </h3>
            <div v-if="travelTime || loadingTravelTime" class="text-[10px] font-bold text-sky-500/70 tracking-wide">
               <span v-if="travelTime">預估 {{ travelTime }}</span>
               <span v-else class="animate-pulse opacity-60">計算中...</span>
            </div>
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
