<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CloudSun, CloudRain, Sun, Cloud, Moon, Tent, MapPin } from 'lucide-vue-next'
import type { CampingTrip } from '../types/database'

interface Props {
  trip: CampingTrip
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update-night-rush', payload: { id: number, value: boolean }): void
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

// 狀態標籤邏輯
const statusLabel = computed(() => {
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
  emit('update-night-rush', { 
    id: props.trip.id, 
    value: !props.trip.night_rush 
  })
}

const countdown = computed(() => {
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
  if (diffDays < 0) return '已出發'
  if (diffDays === 0) return 'GO!'
  return `${diffDays}`
})

// 取得天氣資訊
const fetchWeather = async () => {
  if (!props.trip.latitude || !props.trip.longitude) {
    weatherError.value = 'no_coords'
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
    let elevation = props.trip.altitude
    if (!elevation) {
      try {
        const elevResponse = await fetch(
          `https://api.open-meteo.com/v1/elevation?latitude=${props.trip.latitude}&longitude=${props.trip.longitude}`
        )
        const elevData = await elevResponse.json()
        if (elevData.elevation && elevData.elevation.length > 0) {
          elevation = elevData.elevation[0]
        }
      } catch (e) {
        console.warn('Failed to fetch elevation', e)
      }
    }

    // 2. 準備 API 參數
    // 加入 past_days=1 以支援「夜衝」需求
    let apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${props.trip.latitude}&longitude=${props.trip.longitude}&hourly=weather_code,temperature_2m&forecast_days=16&past_days=1&models=gem_global`
    
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

watch(() => props.trip, () => {
  fetchWeather()
}, { immediate: true })

</script>

<template>
  <div v-if="trip" class="relative w-full overflow-hidden rounded-[2.5rem] card-organic group">
    
    <!-- Background Art (User Custom Image) -->
    <div class="absolute inset-0 z-0">
       <img 
         src="/images/card_bg.jpg" 
         alt="Card Background" 
         class="w-full h-full object-cover opacity-60"
       />
       <!-- Overlay for better text readability -->
       <div class="absolute inset-0 bg-white/40 backdrop-blur-[2px]"></div>
    </div>
    
    <!-- Illustration Removed as per request -->

    <!-- Main Content Container -->
    <div class="relative z-10 p-8 flex flex-col items-center justify-center min-h-[420px]">
      
      <!-- Top Pill: Status -->
      <div class="mb-4">
         <span class="inline-block px-4 py-1.5 rounded-full text-sm font-bold tracking-wider bg-white/80 backdrop-blur-md text-primary-700 shadow-sm border border-white/50">
           {{ statusLabel }}
         </span>
      </div>

      <!-- Title (Centered) -->
      <h2 class="text-4xl md:text-5xl font-black text-primary-900 tracking-tight leading-tight text-center mb-2 drop-shadow-sm">
           {{ trip.campsite_name }}
      </h2>

      <!-- Date (Centered) -->
      <div class="relative mb-8 w-full flex justify-center">
         <div class="relative text-xl font-bold text-primary-800 font-mono tracking-tight">
           {{ dateRange }}
           
           <div class="absolute left-full top-1/2 -translate-y-1/2 ml-4">
              <button 
                @click.stop="toggleNightRush"
                class="group flex items-center justify-center w-9 h-9 rounded-full transition-all duration-500 shadow-sm border backdrop-blur-md"
                :class="trip.night_rush 
                  ? 'bg-indigo-500/80 border-indigo-400/50 text-yellow-200 shadow-[0_0_15px_rgba(99,102,241,0.4)] scale-110 ring-2 ring-indigo-200/30' 
                  : 'bg-white/60 border-white/60 text-primary-300 hover:bg-white hover:text-primary-600 hover:shadow-md'"
                title="切換夜衝狀態"
              >
                <Moon class="w-4 h-4 transition-transform duration-500" 
                      :class="{ '-rotate-12 fill-current drop-shadow-sm': trip.night_rush, 'group-hover:rotate-12': !trip.night_rush }" />
              </button>
           </div>
         </div>
      </div>

      <!-- Countdown (Big Number) -->
      <div class="flex flex-col items-center mb-10 relative">
          <div class="text-[8rem] leading-none font-black text-accent-sky drop-shadow-sm tracking-tighter relative z-10 font-sans">
               {{ countdown }}
          </div>
          <div v-if="countdown !== 'GO!'" class="text-primary-600 font-bold tracking-[0.2em] text-sm uppercase mt-0">
               {{ (countdown === 'ING' || countdown === '已出發') ? '露營進行中' : '倒數天數' }}
          </div>
      </div>

      <!-- Location (Bottom Center) -->
      <div class="flex items-center gap-2 text-primary-700 bg-white/60 px-4 py-2 rounded-xl backdrop-blur-md border border-white/50 mb-6 shadow-sm">
        <MapPin class="w-4 h-4 text-green-600" />
        <span class="font-bold text-sm">{{ trip.location || '未設定地點' }}</span>
      </div>

      <!-- Weather Card (Compact at bottom, transparent) -->
       <div v-if="weather.length > 0 && weather[0]" class="w-full flex justify-center">
          <!-- 整合卡片: 氣溫 + 撤收狀態 (Original Style) -->
          <div class="flex items-center bg-white/80 backdrop-blur-md px-3 md:px-5 py-3 rounded-2xl shadow-sm border border-white/60 gap-2 md:gap-5 max-w-[95vw] md:max-w-sm mx-auto">
             
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
             
             <!-- 分隔線 (若有撤收狀態才顯示) -->
             <div v-if="packingStatus" class="w-px h-8 md:h-10 bg-primary-100 flex-shrink-0"></div>

             <!-- 撤收狀態部分 (Original Badge Style) -->
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
</style>
