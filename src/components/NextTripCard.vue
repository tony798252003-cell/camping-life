<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CloudSun, CloudRain, Sun, Cloud, Moon, Tent, MapPin, Calendar, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { CampingTripWithCampsite } from '../types/database'

interface Props {
  trip: CampingTripWithCampsite
  hasPrev?: boolean
  hasNext?: boolean
}
// ... (keep start of script)


const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update-night-rush', payload: { id: number, value: boolean }): void
  (e: 'prev'): void
  (e: 'next'): void
}>()

// 天氣資料結構：僅需保存摘要
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
const packingStatus = ref<'dry' | 'wet' | null>(null) // 新增：收帳狀態

const isPastTrip = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const tripDate = new Date(props.trip.trip_date)
  tripDate.setHours(0, 0, 0, 0)
  
  const duration = props.trip.duration_days || 1
  const endDate = new Date(tripDate)
  endDate.setDate(endDate.getDate() + duration - 1)
  
  // 如果今天已經過了結束日期，就是過去的行程
  return today.getTime() > endDate.getTime()
})

// 狀態標籤邏輯
const statusLabel = computed(() => {
  if (isPastTrip.value) return '已完成'

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  
  const tripDate = new Date(props.trip.trip_date)
  tripDate.setHours(0, 0, 0, 0)
  
  const duration = props.trip.duration_days || 1
  const endDate = new Date(tripDate)
  endDate.setDate(endDate.getDate() + duration - 1) // 最後一天
  
  const nightRushDate = new Date(tripDate)
  nightRushDate.setDate(nightRushDate.getDate() - 1)
  
  // 1. 夜衝當天傍晚 (17:00 後)
  if (props.trip.night_rush && now.getTime() >= nightRushDate.getTime() && now.getTime() < tripDate.getTime()) {
     if (now.getHours() >= 17) return '🌙 夜衝出發'
  }
  
  // 2. 露營期間
  if (now.getTime() >= tripDate.getTime() && now.getTime() <= endDate.getTime()) {
    // 如果是最後一天中午前 (12:00 前) -> 收帳撤收
    if (now.getDate() === endDate.getDate() && now.getMonth() === endDate.getMonth()) {
      if (now.getHours() < 12) return '⛺ 收帳撤收'
    } else {
      return '🏕️ 露營中'
    }
    // 如果是第一天或是中間天 -> 露營中
    return '🏕️ 露營中'
  }
  
  return '即將出發'
})

const toggleNightRush = () => {
  if (isPastTrip.value) return
  emit('update-night-rush', { id: props.trip.id, value: !props.trip.night_rush })
}

const countdown = computed(() => {
  if (isPastTrip.value) return 'COMPLETE'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tripDate = new Date(props.trip.trip_date)
  tripDate.setHours(0,0,0,0)
  
  // 若有夜衝，目標日期提早一天
  if (props.trip.night_rush) {
    tripDate.setDate(tripDate.getDate() - 1)
  }
  
  const diffTime = tripDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  // start date passed, but not past trip (checked at top) -> Ongoing
  if (diffDays < 0) return 'ING' 
  
  if (diffDays === 0) return 'GO!'
  return `${diffDays}`
})

// 取得天氣資訊
const fetchWeather = async () => {
  // 過去的行程不抓天氣
  if (isPastTrip.value) return
  
  const lat = props.trip.campsites?.latitude ?? props.trip.latitude
  const lng = props.trip.campsites?.longitude ?? props.trip.longitude

  if (!lat || !lng) {
    weatherError.value = 'no_coords'
    return
  }
  // ... (rest of logic)
  
  weather.value = []
  
  // Open-Meteo only provides ~16 days forecast. 
  // If trip is too far in the future, don't fetch to avoid weird default data (like 0-15 degrees).
  const today = new Date()
  const tripTime = new Date(props.trip.trip_date).getTime()
  const diffTime = tripTime - today.getTime()
  const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (daysUntil > 16) {
    loadingWeather.value = false
    return
  }

  loadingWeather.value = true
  weatherError.value = null
  packingStatus.value = null

  try {
    const tripDate = new Date(props.trip.trip_date)
    const duration = props.trip.duration_days || 1
    
    // 計算結束日期 (最後一天)
    const endDate = new Date(tripDate)
    endDate.setDate(endDate.getDate() + duration - 1)
    const endDateStr = endDate.toISOString().split('T')[0]

    // 1. 取得精確海拔 (如果行程沒有設定)
    let elevation = props.trip.campsites?.altitude ?? props.trip.altitude
    const lat = props.trip.campsites?.latitude ?? props.trip.latitude
    const lng = props.trip.campsites?.longitude ?? props.trip.longitude

    if (!elevation && lat && lng) {
      try {
        const elevResponse = await fetch(
          `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`
        )
        const elevData = await elevResponse.json()
        if (elevData.elevation && elevData.elevation.length > 0) {
          elevation = elevData.elevation[0]
        }
      } catch (e) {
        console.warn('Failed to fetch elevation', e)
      }
    }

    // 緩存 Key (每小時更新一次)
    const cacheKey = `weather_v2_${props.trip.id}_${tripDate.toDateString()}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const { data, timestamp } = JSON.parse(cached)
      // 60 分鐘緩存
      if (Date.now() - timestamp < 60 * 60 * 1000) {
        weather.value = data.weather
        packingStatus.value = data.packingStatus
        loadingWeather.value = false
        return
      }
    }

    // 2. 準備 API 參數
    // 加入 past_days=1 以支援「夜衝」需求
    // Wait, lat/lng must be defined here due to check at top, but TS might complain
    if (!lat || !lng) return 

    let apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=weather_code,temperature_2m&forecast_days=16&past_days=1&models=gem_global`
    
    // 加入海拔參數以校正溫度
    if (elevation) {
      apiUrl += `&elevation=${elevation}`
    }

    const response = await fetch(apiUrl)
    const data = await response.json()
    
    if (!data.hourly || !data.hourly.time) {
      weatherError.value = 'api_error'
      return
    }

    // 解析資料以產生 "摘要"
    const allCodes: number[] = []
    const allTemps: number[] = []
    let lastDayRainCodes: number[] = []

    // 如果有夜衝，從前一天開始
    const startOffset = props.trip.night_rush ? -1 : 0

    for (let dayOffset = startOffset; dayOffset < duration; dayOffset++) {
      const currentDate = new Date(tripDate)
      currentDate.setDate(currentDate.getDate() + dayOffset)
      const dateStr = currentDate.toISOString().split('T')[0]
      
      const nextDate = new Date(currentDate)
      nextDate.setDate(nextDate.getDate() + 1)
      const nextDateStr = nextDate.toISOString().split('T')[0]

      data.hourly.time.forEach((timeStr: string, index: number) => {
        // 時區轉換
        const utcTime = new Date(timeStr + 'Z')
        const localYear = utcTime.getFullYear()
        const localMonth = String(utcTime.getMonth() + 1).padStart(2, '0')
        const localDay = String(utcTime.getDate()).padStart(2, '0')
        const localDateStr = `${localYear}-${localMonth}-${localDay}`
        const localHour = utcTime.getHours()
        
        const temp = data.hourly.temperature_2m[index]
        const code = data.hourly.weather_code[index]
        
        // 收集所有相關時段的溫度與天氣代碼 (包含夜衝那晚 ~ 收帳那天中午)
        // 簡單邏輯：只要是旅程日期範圍內的都算
        const isTargetDay = localDateStr === dateStr
        // 或者是跨夜的晚上 (算在前一天)
        const isNextDayEarlyMorning = localDateStr === nextDateStr && localHour < 6

        if (isTargetDay || isNextDayEarlyMorning) {
           // 夜衝日特殊處置：只計算 17:00 之後
           if (dayOffset === -1 && isTargetDay && localHour < 17) {
             return
           }
           allTemps.push(temp)
           allCodes.push(code)
        }

        // 檢查收帳日 (最後一天) 上午 08:00 - 12:00 的天氣
        if (localDateStr === endDateStr && localHour >= 8 && localHour <= 12) {
          lastDayRainCodes.push(code)
        }
      })
    }
    
    if (allTemps.length > 0) {
      // 計算摘要數據
      const daySummary: DayWeather = {
        date: '', 
        dateLabel: 'Summary',
        day: {
          code: getMostFrequentCode(allCodes),
          temp_max: Math.round(Math.max(...allTemps)),
          temp_min: Math.round(Math.min(...allTemps))
        }
      }
      weather.value = [daySummary]
    }

    // 判斷撤收狀態
    if (lastDayRainCodes.length > 0) {
      // 檢查是否有雨 (代碼 > 50 通常為降雨相關)
      const hasRain = lastDayRainCodes.some(code => code >= 51)
      packingStatus.value = hasRain ? 'wet' : 'dry'
    } else {
       // 如果資料還沒覆蓋到最後一天(例如行程在很久以後)，就不顯示狀態
       packingStatus.value = null
    }

    // Save to Cache
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      data: {
        weather: weather.value,
        packingStatus: packingStatus.value
      }
    }))
    
  } catch (e) {
    console.error('Weather fetch error', e)
    weatherError.value = 'fetch_error'
  } finally {
    loadingWeather.value = false
  }
}

// 取得最常出現的天氣代碼
const getMostFrequentCode = (codes: number[]): number => {
  if (codes.length === 0) return 0
  const frequency: Record<number, number> = {}
  let maxFreq = 0
  let mostFrequent = codes[0]!
  
  codes.forEach(code => {
    frequency[code] = (frequency[code] || 0) + 1
    if (frequency[code] > maxFreq) {
      maxFreq = frequency[code]
      mostFrequent = code
    }
  })
  return mostFrequent
}

// Weather Code mapping simple
const getWeatherIcon = (code: number) => {
  if (code <= 3) return Sun 
  if (code <= 48) return Cloud 
  if (code <= 67) return CloudRain 
  if (code <= 77) return CloudSun 
  if (code > 80) return CloudRain 
  return CloudSun
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

// Title Font Size Logic (Binary: Normal vs Small)
const titleClass = computed(() => {
  const name = props.trip.campsites?.name || props.trip.campsite_name || ''
  const len = name.length
  // Regular size for most names, smaller for long ones
  if (len <= 8) return 'text-3xl md:text-5xl'
  return 'text-2xl md:text-4xl'
})

watch(() => props.trip, () => {
  fetchWeather()
}, { immediate: true })

</script>

<template>
  <div v-if="trip" class="relative w-full overflow-hidden rounded-[2.5rem] card-organic group">
    
    <!-- Background Art (User Custom Image) -->
    <div class="absolute inset-0 z-0 bg-gray-200">
       <img 
         src="/images/card_bg.jpg" 
         alt="Card Background" 
         class="w-full h-full object-cover opacity-60 transition-opacity duration-700"
         loading="eager"
         :class="isPastTrip ? 'grayscale-30' : ''"
       />
       <!-- Overlay for better text readability -->
       <div class="absolute inset-0 bg-white/40 backdrop-blur-[2px]"></div>
    </div>
    
    <!-- Illustration Removed as per request -->

    <!-- Main Content Container with optimized spacing -->
    <div class="relative z-10 p-4 pb-10 md:p-8 md:pb-14 flex flex-col items-center justify-center min-h-[300px] md:min-h-[420px]">
      
      <!-- Top Pill: Status -->
      <div class="mb-2 md:mb-4">
         <span class="inline-block px-3 py-1 md:px-4 md:py-1.5 rounded-full text-xs md:text-sm font-bold tracking-wider bg-white/80 backdrop-blur-md text-primary-700 shadow-sm border border-white/50">
           {{ statusLabel }}
         </span>
      </div>

      <!-- Title (Centered) with Fixed Height -->
      <div class="h-10 md:h-16 flex items-center justify-center mb-0.5 md:mb-2 px-4 w-full">
        <h2 :class="titleClass" class="font-black text-primary-900 tracking-tight leading-none text-center drop-shadow-sm whitespace-nowrap overflow-hidden text-ellipsis w-full">
             {{ trip.campsites?.name || trip.campsite_name }}
        </h2>
      </div>





      <!-- Date (Centered) -->
      <div class="relative mb-2 md:mb-6 w-full flex justify-center">
         <div class="relative text-lg md:text-xl font-bold text-primary-800 font-mono tracking-tight">
           {{ dateRange }}
         </div>
      </div>

      <!-- Top Right Actions (Night Rush) -->
      <div class="absolute top-4 right-4 md:top-8 md:right-8 z-40">
          <button 
            :disabled="isPastTrip"
            @click.stop="toggleNightRush"
            class="group flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full transition-all duration-500 shadow-md border backdrop-blur-md"
            :class="[
              trip.night_rush 
                ? 'bg-slate-700/80 border-slate-500/40 text-yellow-100 shadow-[0_0_15px_rgba(71,85,105,0.3)] scale-110 ring-2 ring-slate-400/20' 
                : 'bg-white/60 border-white/60 text-primary-300',
              !isPastTrip ? 'hover:bg-white hover:text-primary-600 hover:shadow-lg' : 'cursor-default opacity-80'
            ]"
            title="切換夜衝狀態"
          >
            <Moon class="w-5 h-5 md:w-6 md:h-6 transition-transform duration-500" 
                  :class="{ '-rotate-12 fill-current drop-shadow-sm': trip.night_rush, 'group-hover:rotate-12': !isPastTrip && !trip.night_rush }" />
          </button>
      </div>

      <!-- Countdown (Big Number) -->
      <div class="flex flex-col items-center mb-4 md:mb-8 relative h-[6rem] md:h-[11rem] justify-center w-full">
          <div v-if="isPastTrip" class="text-[3rem] md:text-[5rem] leading-none font-black text-primary-400 drop-shadow-sm tracking-tighter z-10 font-sans uppercase opacity-80 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap">
              COMPLETE
          </div>
          <div v-else class="text-[4.5rem] md:text-[8rem] leading-none font-black text-accent-sky drop-shadow-sm tracking-tighter z-10 font-sans absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
               {{ countdown }}
          </div>
          
          <div v-if="!isPastTrip && countdown !== 'GO!' && countdown !== 'ING'" class="text-primary-600 font-bold tracking-[0.2em] text-[9px] md:text-sm uppercase absolute bottom-0 md:bottom-2">
              DAYS TO GO
          </div>
      </div>








      <!-- Location (Standalone Line) -->
      <div class="mb-3 md:mb-8">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-white/50 text-primary-700 rounded-lg backdrop-blur-sm border border-white/40 text-sm md:text-base font-bold shadow-sm hover:bg-white/70 transition-colors">
          <MapPin class="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-600" />
          <span>{{ trip.campsites?.city ? (trip.campsites.city + (trip.campsites.district || '')) : (trip.location || '未設定地點') }}</span>
        </div>
      </div>

      <!-- Content Area with Fixed Height to prevent jumping -->
      <div class="w-full flex justify-center min-h-[5rem] items-center mt-auto">
        
         <!-- Rating Card for Past Trips (Detail Modal Style) -->
         <div v-if="isPastTrip" class="relative z-40 w-full max-w-sm bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-sm border border-white/60">
             <div class="grid grid-cols-3 gap-2">
                 <div class="flex flex-col items-center justify-center">
                    <div class="text-2xl font-black text-blue-500 mb-0.5 leading-none">{{ trip.scenery || '-' }}</div>
                    <div class="text-[10px] text-primary-500 font-bold">風景</div>
                 </div>
                 <div class="flex flex-col items-center justify-center border-l border-r border-primary-100/50">
                    <div class="text-2xl font-black text-emerald-500 mb-0.5 leading-none">{{ trip.cleanliness || '-' }}</div>
                    <div class="text-[10px] text-primary-500 font-bold">整潔</div>
                 </div>
                 <div class="flex flex-col items-center justify-center">
                    <div class="text-2xl font-black text-yellow-500 mb-0.5 leading-none">{{ trip.road_condition || '-' }}</div>
                    <div class="text-[10px] text-primary-500 font-bold">路況</div>
                 </div>
             </div>
         </div>

         <!-- Loading Skeleton -->
         <div v-else-if="loadingWeather && (!weather || weather.length === 0)" 
               class="relative z-40 flex items-center bg-white/40 backdrop-blur-sm px-3 md:px-5 py-3 rounded-2xl border border-white/30 gap-2 md:gap-5 w-full md:max-w-sm mx-auto animate-pulse h-[4.5rem]">
              <div class="flex items-center gap-3 w-full">
                  <div class="w-10 h-10 rounded-full bg-white/50"></div>
                  <div class="flex-1 space-y-2">
                      <div class="h-2 bg-white/50 rounded w-12"></div>
                      <div class="h-4 bg-white/50 rounded w-24"></div>
                  </div>
              </div>
          </div>

         <!-- Formatting Weather Card -->
         <div v-else-if="weather.length > 0 && weather[0]" class="relative z-40 flex items-center bg-white/80 backdrop-blur-md px-3 md:px-5 py-3 rounded-2xl shadow-sm border border-white/60 gap-2 md:gap-5 max-w-[95vw] md:max-w-sm mx-auto animate-fade-in-up h-[4.5rem]">
             
             <!-- 氣溫部分 -->
             <div class="flex items-center gap-2 md:gap-3 min-w-0">
                <component :is="getWeatherIcon(weather[0].day.code)" class="w-8 h-8 md:w-10 md:h-10 text-accent-orange drop-shadow-sm flex-shrink-0" />
                <div class="text-left min-w-0">
                   <div class="text-[10px] md:text-xs text-primary-500 mb-0.5 whitespace-nowrap">預報氣溫</div>
                   <div class="text-lg md:text-2xl font-black text-primary-900 leading-none whitespace-nowrap">
                     {{ weather[0].day.temp_min }}° - {{ weather[0].day.temp_max }}°
                   </div>
                </div>
             </div>
              
              <!-- 分隔線 -->
              <div v-if="packingStatus" class="w-px h-8 md:h-10 bg-primary-100 flex-shrink-0"></div>

              <!-- 撤收狀態 -->
              <div v-if="packingStatus" class="flex items-center gap-2 md:gap-3 min-w-0">
                  <div class="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full flex-shrink-0"
                       :class="packingStatus === 'dry' ? 'bg-emerald-100/50 text-emerald-600' : 'bg-red-100/50 text-red-600'"
                  >
                     <Tent class="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div class="text-left min-w-0">
                      <div class="text-[10px] md:text-xs text-primary-500 mb-0.5 whitespace-nowrap">收帳預測</div>
                      <div class="text-lg md:text-xl font-black leading-none whitespace-nowrap"
                           :class="packingStatus === 'dry' ? 'text-emerald-700' : 'text-red-700'"
                      >
                          {{ packingStatus === 'dry' ? '乾燥撤收' : '濕帳撤收' }}
                      </div>
                  </div>
              </div>
             </div>

          
          <!-- Future No Weather State -->
          <div v-else class="relative z-40 flex items-center justify-center bg-white/60 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/40 gap-3 w-full max-w-sm h-[4.5rem]">
              <div class="flex items-center gap-3 text-primary-600">
                  <Calendar class="w-5 h-5 opacity-70" />
                  <span class="text-sm font-bold tracking-wide">接近出發日期時將顯示天氣</span>
              </div>
          </div>
          
      </div>

      <!-- Zone & Companions (Bottom Right Corner) -->
      <div v-if="trip.zone || trip.companions" class="absolute bottom-2 right-3 md:bottom-4 md:right-6 flex flex-row items-center gap-2 z-20">
        <!-- Zone -->
        <div v-if="trip.zone" class="flex items-center gap-1.5 bg-white/40 backdrop-blur-md rounded-lg border border-white/30 py-1 px-2.5 text-primary-800 shadow-sm">
           <Tent class="w-3 h-3 md:w-3.5 md:h-3.5 text-orange-600" />
           <span class="font-bold text-[10px] md:text-xs whitespace-nowrap">{{ trip.zone }}</span>
        </div>

        <!-- Companions -->
        <div v-if="trip.companions" class="flex items-center gap-1.5 bg-white/40 backdrop-blur-md rounded-lg border border-white/30 py-1 px-2.5 text-primary-800 shadow-sm">
          <span class="text-[10px] md:text-xs">👥</span>
          <span class="font-bold text-[10px] md:text-xs max-w-[100px] truncate">{{ trip.companions }}</span>
        </div>
      </div>

      <!-- Navigation Zones (1/3 Width) -->
      <div 
        v-if="hasPrev"
        @click.stop="$emit('prev')"
        class="absolute left-0 top-0 w-1/3 h-full z-30 flex items-center justify-start pl-1 md:pl-2 cursor-pointer group"
      >
         <div class="p-2 text-white/50 group-hover:text-white transition-all duration-300 drop-shadow-xl group-hover:scale-110 group-active:scale-95">
            <ChevronLeft class="w-10 h-10 md:w-12 md:h-12 drop-shadow-md" />
         </div>
      </div>

      <div 
        v-if="hasNext"
        @click.stop="$emit('next')"
        class="absolute right-0 top-0 w-1/3 h-full z-30 flex items-center justify-end pr-1 md:pr-2 cursor-pointer group"
      >
         <div class="p-2 text-white/50 group-hover:text-white transition-all duration-300 drop-shadow-xl group-hover:scale-110 group-active:scale-95">
            <ChevronRight class="w-10 h-10 md:w-12 md:h-12 drop-shadow-md" />
         </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
@keyframes pulse-slow {
  0%, 100% { opacity: 0.2; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(1.05); }
}
.animate-pulse-slow {
  animation: pulse-slow 6s ease-in-out infinite;
}
/* Reduce grayscale intensity */
.grayscale-30 {
  filter: grayscale(30%);
}
</style>


