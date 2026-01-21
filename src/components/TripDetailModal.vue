<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Calendar, MapPin, Mountain, CloudRain, Moon, Tent, X, Wind, CloudSun, Sun, Cloud } from 'lucide-vue-next'
import type { CampingTrip } from '../types/database'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps<{
  isOpen: boolean
  trip: CampingTrip | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null

const isFuture = computed(() => {
  if (!props.trip) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(props.trip.trip_date) >= today
})

const formatDateRange = (dateString: string, duration: number | null = 1) => {
  const start = new Date(dateString)
  const end = new Date(start)
  end.setDate(start.getDate() + Math.max(0, (duration || 1) - 1))
  
  const format = (d: Date) => d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
  const startStr = start.toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' })
  
  if ((duration || 1) <= 1) return startStr
  return `${startStr} - ${format(end)}`
}

// 初始化地圖
const initMap = () => {
  if (!mapContainer.value || !props.trip) return
  if (!props.trip.latitude || !props.trip.longitude) return
  
  if (map) {
    map.remove()
    map = null
  }

  const lat = props.trip.latitude
  const lng = props.trip.longitude

  map = L.map(mapContainer.value).setView([lat, lng], 14)
  
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(map)

  L.marker([lat, lng]).addTo(map)
}

// Weather Logic
interface DayWeather {
  date: string
  dateLabel: string
  day: {
    code: number
    temp_max: number
    temp_min: number
  }
}

const weather = ref<DayWeather[]>([])
const loadingWeather = ref(false)
const weatherError = ref<string | null>(null)

const getMostFrequentCode = (codes: any[]) => {
  if (!codes.length) return 0
  const f: Record<number, number> = {}
  let max = 0
  let res = 0
  
  codes.forEach(c => {
    const code = Number(c)
    if (!isNaN(code)) {
        if (res === 0) res = code
        f[code] = (f[code] || 0) + 1
        if (f[code] > max) { max = f[code]; res = code }
    }
  })
  return res
}

const getWeatherIcon = (code: number) => {
  if (code <= 3) return Sun 
  if (code <= 48) return Cloud 
  if (code <= 67) return CloudRain 
  if (code <= 77) return CloudSun 
  if (code > 80) return CloudRain 
  return CloudSun
}

const fetchWeather = async () => {
  if (!props.trip || !props.trip.latitude || !props.trip.longitude) return
  
  loadingWeather.value = true
  weatherError.value = null
  
  try {
     const tripDate = new Date(props.trip.trip_date)
     const duration = props.trip.duration_days || 1
     
     // 海拔修正
     let elevation = props.trip.altitude
     if (!elevation) {
       try {
         const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${props.trip.latitude}&longitude=${props.trip.longitude}`)
         const d = await r.json()
         if (d.elevation && d.elevation.length > 0) elevation = d.elevation[0]
       } catch {}
     }

     let apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${props.trip.latitude}&longitude=${props.trip.longitude}&hourly=weather_code,temperature_2m&forecast_days=16&past_days=1&models=gem_global`
     if (elevation) apiUrl += `&elevation=${elevation}`

     const response = await fetch(apiUrl)
     const data = await response.json()

     if (!data.hourly) {
        weatherError.value = 'no_data'
        return
     }

     const dailyWeather: DayWeather[] = []
     const startOffset = props.trip.night_rush ? -1 : 0
     
     for (let dayOffset = startOffset; dayOffset < duration; dayOffset++) {
       const currentDate = new Date(tripDate)
       currentDate.setDate(currentDate.getDate() + dayOffset)
       const dateStr = currentDate.toISOString().split('T')[0] || ''
       const dateLabel = `${currentDate.getMonth() + 1}/${currentDate.getDate()}` + (dayOffset === -1 ? ' (夜衝)' : '')
       
       const nextDate = new Date(currentDate)
       nextDate.setDate(nextDate.getDate() + 1)
       const nextDateStr = nextDate.toISOString().split('T')[0]
       
       const dayTemps: number[] = []
       const dayCodes: number[] = []
       
       data.hourly.time.forEach((t: string, i: number) => {
         const utc = new Date(t + 'Z')
         const ly = utc.getFullYear()
         const lm = String(utc.getMonth() + 1).padStart(2, '0')
         const ld = String(utc.getDate()).padStart(2, '0')
         const lds = `${ly}-${lm}-${ld}`
         const lh = utc.getHours()
         
         const temp = data.hourly.temperature_2m[i]
         const code = data.hourly.weather_code[i]
         
         // 收集整天的天氣數據 (包含跨夜到隔天清晨)
         const isTargetDay = lds === dateStr
         const isNextDayEarlyMorning = lds === nextDateStr && lh < 6

         if (isTargetDay || isNextDayEarlyMorning) {
            // 夜衝日特殊處置：只計算 17:00 之後
            if (dayOffset === -1 && isTargetDay && lh < 17) {
               return
            }
            dayTemps.push(temp)
            dayCodes.push(code)
         }
       })
       
       if (dayTemps.length === 0) continue
       
       dailyWeather.push({
         date: dateStr,
         dateLabel,
         day: {
           code: getMostFrequentCode(dayCodes),
           temp_max: Math.round(Math.max(...dayTemps)),
           temp_min: Math.round(Math.min(...dayTemps))
         }
       })
     }
     weather.value = dailyWeather

  } catch (e) {
    console.error(e)
    weatherError.value = 'error'
  } finally {
    loadingWeather.value = false
  }
}

// Watchers
watch(() => props.isOpen, async (val) => {
  if (val && props.trip) {
    await nextTick()
    setTimeout(initMap, 100)
    fetchWeather()
  }
})

watch(() => props.trip, async (val) => {
  if (props.isOpen && val) {
    await nextTick()
    setTimeout(initMap, 100)
    fetchWeather()
  }
})

</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen && trip" class="fixed inset-0 z-50 overflow-y-auto">
        <!-- 背景遮罩 -->
        <div class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>
        
        <!-- Modal 本體 -->
        <div class="flex min-h-full items-center justify-center p-4">
          <div class="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            
            <!-- 頂部圖片 -->
            <div class="h-32 w-full bg-gradient-to-r from-teal-400 to-blue-500 relative overflow-hidden">
               <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl"></div>
               <div class="absolute top-10 left-10 w-20 h-20 bg-white/20 rounded-full blur-xl"></div>
            </div>

            <button @click="emit('close')" class="absolute top-4 right-4 p-2 bg-black/20 text-white hover:bg-black/30 rounded-full backdrop-blur transition-all z-20">
              <X class="w-5 h-5" />
            </button>

            <div class="px-8 py-6 -mt-12 relative z-10">
              <!-- 標題卡片 -->
              <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                   <h2 class="text-3xl font-bold text-gray-900 mb-2">{{ trip.campsite_name }}</h2>
                   <div class="flex items-center text-gray-500 font-medium">
                      <Calendar class="w-4 h-4 mr-2" />
                      {{ formatDateRange(trip.trip_date, trip.duration_days) }}
                      <span class="mx-2">·</span>
                      <span>{{ trip.duration_days || 1 }} 天 {{ (trip.duration_days || 1) - 1 }} 夜</span>
                   </div>
                </div>
                <!-- 標籤 -->
                <div class="flex flex-wrap gap-2">
                   <span v-if="trip.is_rainy" class="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold flex items-center">
                      <CloudRain class="w-4 h-4 mr-1" /> 下雨
                   </span>
                   <span v-if="trip.is_windy" class="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold flex items-center">
                      <Wind class="w-4 h-4 mr-1" /> 大風
                   </span>
                   <span v-if="trip.night_rush" class="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold flex items-center">
                      <Moon class="w-4 h-4 mr-1" /> 夜衝
                   </span>
                   <span v-if="trip.is_wet_tent" class="px-3 py-1 bg-orange-50 text-orange-600 rounded-lg text-sm font-bold flex items-center">
                      <Tent class="w-4 h-4 mr-1" /> 收濕帳
                   </span>
                </div>
              </div>

              <div class="space-y-6">
                
                <!-- 天氣預報區塊 -->
                <div v-if="loadingWeather" class="p-6 text-center text-gray-400 bg-gray-50 rounded-2xl">
                   天氣查詢中...
                </div>
                <div v-else-if="weather.length > 0" class="space-y-3">
                   <h3 class="text-lg font-bold text-gray-900 flex items-center">
                      <CloudSun class="w-5 h-5 mr-2 text-blue-500" />
                      天氣預報
                   </h3>
                   <div class="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                      <div v-for="d in weather" :key="d.date" class="min-w-[140px] bg-white border border-gray-100 rounded-2xl p-4 flex-shrink-0 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col items-center">
                          <div class="text-center font-bold text-gray-600 mb-3 border-b border-gray-100 pb-2 w-full">{{ d.dateLabel }}</div>
                          
                          <!-- Single Day Summary -->
                          <div class="flex flex-col items-center gap-2">
                             <component :is="getWeatherIcon(d.day.code)" class="w-10 h-10 text-yellow-500 drop-shadow-sm" />
                             <div>
                                <div class="text-[10px] text-gray-400 text-center mb-0.5">預報氣溫</div>
                                <div class="font-black text-lg text-gray-800">{{ d.day.temp_min }}° - {{ d.day.temp_max }}°</div>
                             </div>
                          </div>
                      </div>
                   </div>
                </div>

                <!-- 基本資訊 Grid -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div class="p-4 bg-gray-50 rounded-2xl">
                    <p class="text-xs text-gray-500 mb-1">地點</p>
                    <div class="flex items-center font-bold text-gray-800">
                      <MapPin class="w-4 h-4 mr-1.5 text-accent-sky" />
                      {{ trip.location || '未記錄' }}
                    </div>
                  </div>
                  <div class="p-4 bg-gray-50 rounded-2xl">
                    <p class="text-xs text-gray-500 mb-1">海拔</p>
                    <div class="flex items-center font-bold text-gray-800">
                      <Mountain class="w-4 h-4 mr-1.5 text-purple-500" />
                      {{ trip.altitude ? `${trip.altitude}m` : '未記錄' }}
                    </div>
                  </div>
                  <div v-if="!isFuture" class="p-4 bg-gray-50 rounded-2xl">
                     <p class="text-xs text-gray-500 mb-1">總花費</p>
                     <p class="font-bold text-gray-800">NT$ {{ trip.cost?.toLocaleString() || 0 }}</p>
                  </div>
                  <div class="p-4 bg-gray-50 rounded-2xl">
                     <p class="text-xs text-gray-500 mb-1">帳篷</p>
                     <p class="font-bold text-gray-800">{{ trip.tent_type || '未記錄' }}</p>
                  </div>
                </div>

                <!-- 評分 -->
                <div v-if="!isFuture && (trip.scenery || trip.cleanliness || trip.road_condition)" class="bg-white border boundary-gray-100 rounded-2xl p-5">
                   <h3 class="text-lg font-bold text-gray-900 mb-4">營區評分</h3>
                   <div class="grid grid-cols-3 gap-8">
                      <div class="text-center">
                         <div class="text-3xl font-black text-blue-500 mb-1">{{ trip.scenery || '-' }}</div>
                         <div class="text-xs text-gray-500">風景</div>
                      </div>
                      <div class="text-center">
                         <div class="text-3xl font-black text-green-500 mb-1">{{ trip.cleanliness || '-' }}</div>
                         <div class="text-xs text-gray-500">整潔</div>
                      </div>
                      <div class="text-center">
                         <div class="text-3xl font-black text-yellow-500 mb-1">{{ trip.road_condition || '-' }}</div>
                         <div class="text-xs text-gray-500">路況</div>
                      </div>
                   </div>
                </div>

                <!-- 心得備註 -->
                <div v-if="trip.notes" class="bg-white border border-gray-100 rounded-2xl p-5">
                  <h3 class="text-lg font-bold text-gray-900 mb-2">心得筆記</h3>
                  <p class="text-gray-600 leading-relaxed whitespace-pre-wrap">{{ trip.notes }}</p>
                </div>

                <!-- 地圖 -->
                <div v-if="trip.latitude && trip.longitude" class="rounded-2xl overflow-hidden border border-gray-100 h-64 relative z-0">
                   <div ref="mapContainer" class="w-full h-full"></div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
/* Hide scrollbar for Chrome, Safari and Opera */
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
/* Hide scrollbar for IE, Edge and Firefox */
.scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
}
</style>
