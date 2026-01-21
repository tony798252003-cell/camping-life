<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MapPin, CloudSun, CloudRain, Sun, Cloud } from 'lucide-vue-next'
import type { CampingTrip } from '../types/database'

interface Props {
  trip: CampingTrip
}

const props = defineProps<Props>()

// 天氣資料結構：支援多天，每天有白天和晚上
interface DayWeather {
  date: string
  dateLabel: string // 格式化的日期顯示，例如 "1/24"
  day: {
    code: number
    temp_max: number
    temp_min: number
  }
  night: {
    code: number
    temp_max: number
    temp_min: number
  }
}

const weather = ref<DayWeather[]>([])
const loadingWeather = ref(false)
const weatherError = ref<string | null>(null)

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
  if (!props.trip.latitude || !props.trip.longitude) {
    weatherError.value = 'no_coords'
    return
  }

  loadingWeather.value = true
  weatherError.value = null
  
  try {
    const tripDate = new Date(props.trip.trip_date)
    const duration = props.trip.duration_days || 1
    
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
          console.log('Auto-detected elevation:', elevation)
        }
      } catch (e) {
        console.warn('Failed to fetch elevation', e)
      }
    }

    // 2. 準備 API 參數
    // 2. 準備 API 參數
    // 經測試 GEM (加拿大) 模型在這個地點最準確
    // 移除 timezone=auto，強制收 UTC 時間，由前端處理時區轉換
    let apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${props.trip.latitude}&longitude=${props.trip.longitude}&hourly=weather_code,temperature_2m&forecast_days=16&models=gem_global`
    
    // 加入海拔參數以校正溫度
    if (elevation) {
      apiUrl += `&elevation=${elevation}`
    }

    const response = await fetch(apiUrl)
    const data = await response.json()
    
    if (!data.hourly || !data.hourly.time) {
      console.error('API Error: No hourly data', data)
      weatherError.value = 'api_error'
      return
    }

    // 解析每天的天氣
    const dailyWeather: DayWeather[] = []
    
    // Debug 收集器
    const debugLog: any[] = []

    for (let dayOffset = 0; dayOffset < duration; dayOffset++) {
      const currentDate = new Date(tripDate)
      currentDate.setDate(currentDate.getDate() + dayOffset)
      const dateStr = currentDate.toISOString().split('T')[0]
      
      // 找到這一天的所有小時資料
      const dayHours: { hour: number; code: number; temp: number; type: 'day' | 'night' }[] = []
      
      // 需要包含跨夜的資料來計算晚上的最低溫 (當天 18:00 到 隔天 06:00)
      const nextDate = new Date(currentDate)
      nextDate.setDate(nextDate.getDate() + 1)
      const nextDateStr = nextDate.toISOString().split('T')[0]
      
      data.hourly.time.forEach((timeStr: string, index: number) => {
        // 強制解析為 UTC
        const utcTime = new Date(timeStr + 'Z')
        
        // 轉為使用者當地時間 (Browser Local Time)
        const localYear = utcTime.getFullYear()
        const localMonth = String(utcTime.getMonth() + 1).padStart(2, '0')
        const localDay = String(utcTime.getDate()).padStart(2, '0')
        const localDateStr = `${localYear}-${localMonth}-${localDay}`
        const localHour = utcTime.getHours()
        
        const temp = data.hourly.temperature_2m[index]
        
        // 收集 "白天" 資料 (當地 06:00 - 18:00)
        if (localDateStr === dateStr && localHour >= 6 && localHour < 18) {
           dayHours.push({ hour: localHour, code: data.hourly.weather_code[index], temp, type: 'day' })
           debugLog.push({ orig: timeStr, local: `${localDateStr} ${localHour}:00`, temp, type: 'Day', matchDate: dateStr })
        }
        
        // 收集 "晚上" 資料 (當地 18:00 - 隔天 06:00)
        if ((localDateStr === dateStr && localHour >= 18) || (localDateStr === nextDateStr && localHour < 6)) {
           dayHours.push({ hour: localHour, code: data.hourly.weather_code[index], temp, type: 'night' })
           debugLog.push({ orig: timeStr, local: `${localDateStr} ${localHour}:00`, temp, type: 'Night', matchDate: dateStr })
        }
      })
      
      if (dayHours.length === 0) continue
      
      const dayData = dayHours.filter(d => d.type === 'day')
      const nightData = dayHours.filter(d => d.type === 'night')
      
      // 白天：使用者最在意 "最高溫" (多熱)
      // 晚上：使用者最在意 "最低溫" (多冷)
      
      const dayTemps = dayData.map(h => h.temp)
      const nightTemps = nightData.map(h => h.temp)
      
      // 如果沒有當天資料，就跳過
      if (dayTemps.length === 0 && nightTemps.length === 0) continue

      dailyWeather.push({
        date: dateStr || '', // Ensure string
        dateLabel: `${currentDate.getMonth() + 1}/${currentDate.getDate()}`,
        day: {
          code: getMostFrequentCode(dayData.map(h => h.code)),
          // 白天顯示：平均 ~ 最高
          temp_max: Math.round(Math.max(...dayTemps)),
          temp_min: Math.round(Math.min(...dayTemps))
        },
        night: {
          code: getMostFrequentCode(nightData.map(h => h.code)),
          // 晚上顯示：最低 ~ 平均
          temp_max: nightTemps.length > 0 ? Math.round(Math.max(...nightTemps)) : 0,
          temp_min: nightTemps.length > 0 ? Math.round(Math.min(...nightTemps)) : 0
        }
      })
    }
    
    // console.log('Weather Debug Log:', debugLog)
    weather.value = dailyWeather
    
  } catch (e) {
    console.error('Weather fetch error', e)
    weatherError.value = 'fetch_error'
  } finally {
    loadingWeather.value = false
  }
}

// 取得最常出現的天氣代碼
const getMostFrequentCode = (codes: number[]): number => {
  if (codes.length === 0) return 0 // Default to clear sky (0) if no codes
  
  const frequency: Record<number, number> = {}
  let maxFreq = 0
  let mostFrequent = codes[0]! // Assert non-undefined since length > 0
  
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
  if (code <= 3) return Sun // Clear, Partly Cloudy
  if (code <= 48) return Cloud // Fog
  if (code <= 67) return CloudRain // Rain
  if (code <= 77) return CloudSun // Snow/Grain (rare in TW camp, but...)
  if (code > 80) return CloudRain // Showers
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

      <!-- 右側：天氣 -->
      <div class="flex flex-col items-center md:items-end justify-center space-y-4 w-full">
         
         <!-- 天氣預報 - 多天顯示 -->
         <div v-if="weather.length > 0" class="w-full">
           <div class="text-xs text-gray-500 mb-2 text-center md:text-right">天氣預報</div>
           <div class="flex gap-3 overflow-x-auto pb-2 justify-center md:justify-end">
             <div 
               v-for="day in weather" 
               :key="day.date"
               class="flex-shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm p-3 min-w-[140px]"
             >
               <!-- 日期 -->
               <div class="text-xs font-bold text-gray-600 mb-2 text-center">{{ day.dateLabel }}</div>
               
               <!-- 白天 -->
               <div class="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                 <div class="flex items-center gap-1 flex-1">
                   <component :is="getWeatherIcon(day.day.code)" class="w-5 h-5 text-yellow-500 flex-shrink-0" />
                   <div class="text-xs">
                     <div class="text-gray-400">白天</div>
                     <div class="font-bold text-gray-900 text-sm">{{ day.day.temp_min }}° - {{ day.day.temp_max }}°</div>
                   </div>
                 </div>
               </div>
               
               <!-- 晚上 -->
               <div class="flex items-center gap-2">
                 <div class="flex items-center gap-1 flex-1">
                   <component :is="getWeatherIcon(day.night.code)" class="w-5 h-5 text-blue-400 flex-shrink-0" />
                   <div class="text-xs">
                     <div class="text-gray-400">晚上</div>
                     <div class="font-bold text-gray-900 text-sm">{{ day.night.temp_min }}° - {{ day.night.temp_max }}°</div>
                   </div>
                 </div>
               </div>
             </div>
           </div>
         </div>
         
         <!-- 載入中 -->
         <div v-else-if="loadingWeather" class="text-sm animate-pulse text-gray-400">
           正在查詢天氣...
         </div>
         
         <!-- 沒有座標提示 -->
         <div v-else-if="weatherError === 'no_coords'" class="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-center">
           <div class="text-sm text-gray-600 mb-1">📍 未設定座標</div>
           <div class="text-xs text-gray-500">請編輯行程以新增座標，即可查看天氣預報</div>
         </div>
         
         <!-- 日期太遠 -->
         <div v-else-if="weatherError === 'api_error'" class="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-3 py-2 rounded-full">
           日期超出預報範圍
         </div>
         
         <!-- 其他錯誤 -->
         <div v-else-if="weatherError === 'fetch_error'" class="text-xs text-gray-400">
           天氣查詢失敗
         </div>
      </div>
    </div>
  </div>
</template>
