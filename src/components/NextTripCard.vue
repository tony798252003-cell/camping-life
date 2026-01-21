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

const countdown = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tripDate = new Date(props.trip.trip_date)
  tripDate.setHours(0,0,0,0)
  const diffTime = tripDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return '已出發'
  if (diffDays === 0) return 'GO!'
  return `${diffDays}`
})

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

const dateRange = computed(() => {
  if (!props.trip) return ''
  const start = new Date(props.trip.trip_date)
  const duration = props.trip.duration_days || 1
  const end = new Date(start.getTime())
  end.setDate(start.getDate() + Math.max(0, duration - 1))
  
  const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  if (duration <= 1) return format(start)
  return `${format(start)} - ${format(end)}`
})

watch(() => props.trip, () => {
  fetchWeather()
}, { immediate: true })

</script>

<template>
  <div v-if="trip" class="relative w-full overflow-hidden rounded-[2.5rem] shadow-2xl transition-all duration-500 hover:shadow-blue-500/20 group">
    <!-- 背景特效 -->
    <!-- 背景特效 (Mobile default, PC adjusted) -->
    <div class="absolute inset-0 bg-blue-50/80 border border-blue-100"></div>
    <div class="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
    
    <!-- 裝飾光暈 -->
    <div class="absolute top-0 right-0 w-80 h-80 bg-yellow-300 rounded-full blur-[100px] opacity-30 -mr-20 -mt-20 animate-pulse"></div>
    <div class="absolute bottom-0 left-0 w-60 h-60 bg-blue-400 rounded-full blur-[80px] opacity-30 -ml-20 -mb-20"></div>

    <div class="relative z-10 p-6 md:p-10 text-gray-900 grid md:grid-cols-1 gap-4 md:gap-4 md:place-items-center">
      
      <!-- 左側：主要資訊 -->
      <div class="flex flex-col justify-center">
        <!-- 標題與日期 -->
        <div class="relative z-10 flex flex-col items-center text-center mb-4">
           <div class="mb-4">
             <span class="px-3 py-1 rounded-full bg-blue-100/50 border border-blue-200 text-blue-600 text-sm font-bold tracking-wider uppercase shadow-sm">
               即將出發
             </span>
           </div>
           
           <h2 class="text-5xl font-black text-gray-800 tracking-tight mb-4 leading-tight">
             {{ trip.campsite_name }}
           </h2>

           <div class="text-gray-600 text-2xl font-bold px-4 py-2 rounded-xl">
             {{ dateRange }}
           </div>
        </div>
        
        <div class="flex justify-center mb-3">
           <div class="text-center">
              <div class="text-8xl font-black text-blue-500 leading-none tracking-tighter font-['Outfit']">
                 {{ countdown }}
              </div>
              <div class="text-gray-400 text-lg font-medium tracking-widest mt-1">倒數</div>
           </div>
        </div>

        <div class="space-y-3 text-lg font-medium text-gray-600 flex flex-col items-center">
          <div v-if="trip.location" class="flex items-center">
            <MapPin class="w-6 h-6 mr-3 text-green-500" />
            {{ trip.location }}
          </div>
        </div>
      </div>

      <!-- 右側：倒數與天氣 -->
      <div class="flex flex-col items-center md:items-end justify-center space-y-6">
        
         <!-- 天氣預報 -->
         <div v-if="weather" class="flex items-center bg-white shadow-sm px-6 py-3 rounded-2xl border border-gray-100 text-gray-900 mt-4">
            <component :is="getWeatherIcon(weather.code)" class="w-8 h-8 mr-4 text-yellow-500" />
            <div class="text-right">
              <p class="text-sm font-bold text-gray-500">{{ getWeatherLabel(weather.code) }}</p>
              <p class="text-xl font-bold">{{ weather.min }}° - {{ weather.max }}°C</p>
            </div>
         </div>
         <div v-else-if="loadingWeather" class="text-sm animate-pulse text-gray-400 mt-4">
           正在查詢天氣...
         </div>
         <div v-else-if="trip.latitude" class="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full mt-4">
           (日期太遠，暫無天氣預報)
         </div>
      </div>
    </div>
  </div>
</template>
