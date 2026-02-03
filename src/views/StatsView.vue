<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import type { CampingTripWithCampsite } from '../types/database'
import AltitudeChart from '../components/charts/AltitudeChart.vue'
import FrequencyChart from '../components/charts/FrequencyChart.vue'
import RegionChart from '../components/charts/RegionChart.vue'
import NightRushChart from '../components/charts/NightRushChart.vue'
import TravelTimeChart from '../components/charts/TravelTimeChart.vue'
import StatsHeader from '../components/StatsHeader.vue'
import TaiwanChoroplethMap from '../components/charts/TaiwanChoroplethMap.vue'
import { BarChart3, TrendingUp, CalendarClock, ArrowLeft, ChevronLeft, ChevronRight, MapPin, Moon, Car, Map as MapIcon } from 'lucide-vue-next'

const props = defineProps<{
  trips: CampingTripWithCampsite[]
  userOrigin?: { lat: number; lng: number } | null
}>()

const router = useRouter()

// Filter for valid trips if needed, but showing all is usually better for stats
// unless we want only completed ones. Let's filter for valid dates or specific statuses if requested.
// For now, use all trips as "Footprint" implies history.
// Ideally, maybe exclude 'cancelled'.
const validTrips = computed(() => {
    return props.trips.filter(t => t.status !== 'cancelled')
})

// Year Filter Logic
const availableYears = computed(() => {
  const years = new Set(validTrips.value.map(t => new Date(t.trip_date).getFullYear()))
  return Array.from(years).sort((a, b) => b - a) // Descending
})

const selectedYear = ref<number>(new Date().getFullYear())

// Set default year to latest available if current year has no data, or just keep current
watchEffect(() => {
    if (availableYears.value.length > 0 && !availableYears.value.includes(selectedYear.value)) {
        selectedYear.value = availableYears.value[0] || new Date().getFullYear()
    }
})

const altitudeChartTrips = computed(() => {
    return validTrips.value.filter(t => new Date(t.trip_date).getFullYear() === selectedYear.value)
})

const previousYear = () => {
    const currentIndex = availableYears.value.indexOf(selectedYear.value)
    if (currentIndex < availableYears.value.length - 1) {
        selectedYear.value = availableYears.value[currentIndex + 1] || selectedYear.value
    }
}

const nextYear = () => {
    const currentIndex = availableYears.value.indexOf(selectedYear.value)
    if (currentIndex > 0) {
        selectedYear.value = availableYears.value[currentIndex - 1] || selectedYear.value
    }
}

</script>

<template>
  <div class="min-h-full bg-surface-50 pb-24">
    <!-- Header -->
    <div class="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-primary-100 px-6 py-4 flex items-center gap-3">
       <button @click="router.back()" class="p-1 -ml-2 text-primary-400 hover:text-primary-600 rounded-full hover:bg-primary-50">
          <ArrowLeft class="w-6 h-6" />
       </button>
       <h1 class="text-2xl font-black text-primary-900 flex items-center gap-2">
         <BarChart3 class="w-6 h-6 text-accent-orange" />
         露營數據報表
       </h1>
    </div>

    <!-- No data check -->
    <div v-if="validTrips.length === 0" class="p-12 text-center text-primary-400">
        <div class="mb-4 text-4xl">📊</div>
        <p>尚無露營數據</p>
    </div>

    <div v-else class="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
       <!-- Metric Cards (Replaced with StatsHeader) -->
       <div class="-mx-2 mb-4">
           <StatsHeader :trips="validTrips" />
       </div>

       <!-- Altitude Chart -->
       <div class="bg-white rounded-3xl p-6 shadow-sm border border-primary-50 card-organic">
          <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-primary-900 flex items-center gap-2">
                 <TrendingUp class="w-5 h-5 text-sky-500" />
                 海拔趨勢
              </h2>
              
              <!-- Year Selector -->
              <div class="flex items-center bg-surface-100 rounded-full p-1" v-if="availableYears.length > 0">
                  <button 
                    @click="previousYear" 
                    :disabled="selectedYear === availableYears[availableYears.length - 1]"
                    class="p-1 rounded-full text-primary-400 hover:text-primary-700 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  >
                      <ChevronLeft class="w-4 h-4" />
                  </button>
                  <span class="text-xs font-bold text-primary-600 px-2 min-w-[3rem] text-center">{{ selectedYear }}</span>
                  <button 
                    @click="nextYear"
                    :disabled="selectedYear === availableYears[0]"
                    class="p-1 rounded-full text-primary-400 hover:text-primary-700 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  >
                      <ChevronRight class="w-4 h-4" />
                  </button>
              </div>
          </div>
          <div class="w-full">
             <AltitudeChart :trips="altitudeChartTrips" />
          </div>
       </div>

       <!-- Frequency Chart -->
       <div class="bg-white rounded-3xl p-6 shadow-sm border border-primary-50 card-organic">
          <h2 class="text-lg font-bold text-primary-900 mb-4 flex items-center gap-2">
             <CalendarClock class="w-5 h-5 text-orange-500" />
             熱門月份
          </h2>
          <div class="w-full">
             <FrequencyChart :trips="validTrips" />
          </div>
       </div>

       <!-- TAIWAN CHOROPLETH MAP -->
       <div class="bg-white rounded-3xl p-6 shadow-sm border border-primary-50 card-organic overflow-hidden relative">
           <div class="flex items-center justify-between mb-4 relative z-10 w-full">
              <h2 class="text-lg font-bold flex items-center gap-2 text-primary-900">
                 <MapIcon class="w-5 h-5 text-sky-500" />
                 露營足跡地圖
              </h2>
           </div>
           <div class="w-full relative z-10">
              <TaiwanChoroplethMap :trips="validTrips" />
           </div>
           <div class="text-center text-xs text-gray-400 font-medium relative z-10 mt-2">
              各縣市露營次數 • 顏色越亮次數越多
           </div>
       </div>

       <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
           <!-- Region Chart -->
           <div class="bg-white rounded-3xl p-6 shadow-sm border border-primary-50 card-organic">
              <h2 class="text-lg font-bold text-primary-900 mb-4 flex items-center gap-2">
                 <MapPin class="w-5 h-5 text-emerald-500" />
                 熱門區域
              </h2>
              <div class="w-full">
                 <RegionChart :trips="validTrips" />
              </div>
           </div>

           <!-- Night Rush Chart -->
           <div class="bg-white rounded-3xl p-6 shadow-sm border border-primary-50 card-organic">
              <h2 class="text-lg font-bold text-primary-900 mb-4 flex items-center gap-2">
                 <Moon class="w-5 h-5 text-indigo-500" />
                 夜衝統計
              </h2>
              <div class="w-full">
                 <NightRushChart :trips="validTrips" />
              </div>
           </div>

           <!-- Travel Time Chart -->
           <div class="bg-white rounded-3xl p-6 shadow-sm border border-primary-50 card-organic md:col-span-2">
              <h2 class="text-lg font-bold text-primary-900 mb-4 flex items-center gap-2">
                 <Car class="w-5 h-5 text-violet-500" />
                 車程分佈
              </h2>
              <div class="w-full">
                 <TravelTimeChart :trips="validTrips" :user-origin="userOrigin" />
              </div>
           </div>
       </div>
    </div>
  </div>
</template>
