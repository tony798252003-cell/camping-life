<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MapPin, CloudSun, CloudRain, Sun, Cloud } from 'lucide-vue-next'
import type { CampingTrip } from '../types/database'

interface Props {
  trip: CampingTrip
}

const props = defineProps<Props>()

const weather = ref<any>(null)
const loadingWeather = ref(false)

const daysUntil = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tripDate = new Date(props.trip.trip_date)
  const diffTime = tripDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
})

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('zh-TW', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

// 取得天氣資訊
const fetchWeather = async () => {
  if (!props.trip.latitude || !props.trip.longitude) return

  loadingWeather.value = true
  try {
    // Open-Meteo API
    // 取得未來天氣。如果日期太遠，這裡可能拿不到準確的。預設拿 7 天預報，或是看日期與今天的差距。
    // 這裡簡單抓取目前預報，並嘗試對應日期。
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${props.trip.latitude}&longitude=${props.trip.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
    )
    const data = await response.json()
    
    // 嘗試找對應日期的天氣
    if (data.daily && data.daily.time) {
       const tripDateStr = props.trip.trip_date.split('T')[0] // Assuming YYYY-MM-DD format
       const index = data.daily.time.findIndex((t: string) => t === tripDateStr)
       
       if (index !== -1) {
         weather.value = {
           code: data.daily.weather_code[index],
           max: data.daily.temperature_2m_max[index],
           min: data.daily.temperature_2m_min[index]
         }
       } else {
         // 日期太遠或是過去，顯示「當前預報」作為參考? 不，顯示無法預測或隱藏
         weather.value = null 
       }
    }
  } catch (e) {
    console.error('Weather fetch error', e)
  } finally {
    loadingWeather.value = false
  }
}

// Weather Code mapping simple
const getWeatherIcon = (code: number) => {
  if (code <= 3) return Sun // Clear, Partly Cloudy
  if (code <= 48) return Cloud // Fog
  if (code <= 67) return CloudRain // Rain
  if (code <= 77) return CloudSun // Snow/Grain (rare in TW camp, but...)
  if (code > 80) return CloudRain // Showers
  return CloudSun
}

const getWeatherLabel = (code: number) => {
   if (code === 0) return '晴朗'
   if (code <= 3) return '多雲'
   if (code <= 45) return '有霧'
   if (code <= 65) return '下雨'
   if (code <= 82) return '陣雨'
   return '陰天'
}

watch(() => props.trip, () => {
  fetchWeather()
}, { immediate: true })

</script>

<template>
  <div class="relative overflow-hidden rounded-[2rem] shadow-2xl mb-12 group transition-all hover:shadow-orange-200/50">
    <!-- 活潑背景：動態漸層 + 圖樣 -->
    <div class="absolute inset-0 bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600"></div>
    <div class="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
    
    <!-- 裝飾光暈 -->
    <div class="absolute top-0 right-0 w-80 h-80 bg-yellow-300 rounded-full blur-[100px] opacity-30 -mr-20 -mt-20 animate-pulse"></div>
    <div class="absolute bottom-0 left-0 w-60 h-60 bg-blue-400 rounded-full blur-[80px] opacity-30 -ml-20 -mb-20"></div>

    <div class="relative z-10 p-8 md:p-10 text-white grid md:grid-cols-2 gap-8">
      
      <!-- 左側：主要資訊 -->
      <div class="flex flex-col justify-center">
        <div class="inline-flex self-start items-center px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-sm font-bold mb-6 border border-white/30 shadow-sm">
          <span class="animate-bounce mr-2">🚀</span>
          NEXT ADVENTURE
        </div>
        
        <h2 class="text-4xl md:text-5xl font-black mb-4 leading-tight tracking-tight drop-shadow-md">
          {{ trip.campsite_name }}
        </h2>
        
        <div class="space-y-3 text-lg font-medium text-white/90">
          <div class="flex items-center">
            <Calendar class="w-6 h-6 mr-3 text-yellow-200" />
            {{ formatDate(trip.trip_date) }}
          </div>
          <div v-if="trip.location" class="flex items-center">
            <MapPin class="w-6 h-6 mr-3 text-green-200" />
            {{ trip.location }}
          </div>
        </div>
      </div>

      <!-- 右側：倒數與天氣 -->
      <div class="flex flex-col items-center md:items-end justify-center space-y-6">
        
        <!-- 倒數計時器 -->
        <div class="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 text-center min-w-[180px] transform group-hover:scale-105 transition-transform duration-300">
          <p class="text-white/80 text-sm font-bold uppercase tracking-widest mb-1">倒數計時</p>
          <div class="text-6xl font-black tabular-nums tracking-tighter">
            {{ daysUntil }}
          </div>
          <p class="text-white/80 font-medium">天後出發</p>
        </div>

        <!-- 天氣預報 -->
         <div v-if="weather" class="flex items-center bg-black/20 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/10 text-white">
            <component :is="getWeatherIcon(weather.code)" class="w-8 h-8 mr-4 text-yellow-300" />
            <div class="text-right">
              <p class="text-sm font-bold text-white/80">{{ getWeatherLabel(weather.code) }}</p>
              <p class="text-xl font-bold">{{ weather.min }}° - {{ weather.max }}°C</p>
            </div>
         </div>
         <div v-else-if="loadingWeather" class="text-sm animate-pulse text-white/60">
           正在查詢天氣...
         </div>
         <div v-else-if="trip.latitude" class="text-xs text-white/50 bg-black/10 px-3 py-1 rounded-full">
           (日期太遠，暫無天氣預報)
         </div>
      </div>
    </div>
  </div>
</template>
