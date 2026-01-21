<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CloudSun, CloudRain, Sun, Cloud, Moon, Tent } from 'lucide-vue-next'
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

const statusColor = computed(() => {
  const status = statusLabel.value
  if (status.includes('夜衝')) return 'bg-indigo-100 text-indigo-700 border-indigo-200'
  if (status.includes('收帳')) return 'bg-orange-100 text-orange-700 border-orange-200'
  if (status.includes('露營中')) return 'bg-green-100 text-green-700 border-green-200'
  return 'bg-blue-100/50 text-blue-600 border-blue-200'
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
  <div v-if="trip" class="relative w-full overflow-hidden rounded-[2.5rem] shadow-2xl transition-all duration-500 hover:shadow-blue-500/20 group">
    <!-- 背景特效 -->
    <div class="absolute inset-0 bg-blue-50/80 border border-blue-100"></div>
    <div class="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
    
    <!-- 裝飾光暈 -->
    <div class="absolute top-0 right-0 w-80 h-80 bg-yellow-300 rounded-full blur-[100px] opacity-30 -mr-20 -mt-20 animate-pulse"></div>
    <div class="absolute bottom-0 left-0 w-60 h-60 bg-blue-400 rounded-full blur-[80px] opacity-30 -ml-20 -mb-20"></div>

    <div class="relative z-10 p-6 md:p-10 text-gray-900 grid md:grid-cols-1 gap-4 md:gap-4 md:place-items-center">
      
      <!-- 主要資訊 -->
      <div class="flex flex-col justify-center items-center w-full">
        <!-- 狀態標籤 -->
        <div class="relative z-10 text-center mb-6">
           <span class="px-4 py-1.5 rounded-full text-sm font-bold tracking-wider uppercase shadow-sm transition-all"
               :class="statusColor">
               {{ statusLabel }}
           </span>
        </div>
        
        <!-- 名稱 -->
        <h2 class="text-4xl md:text-5xl font-black text-gray-800 tracking-tight mb-4 leading-tight text-center">
             {{ trip.campsite_name }}
        </h2>

        <!-- 日期與夜衝開關 -->
        <!-- 日期與夜衝開關 -->
        <!-- 日期與夜衝開關 -->
        <!-- 日期與夜衝開關 -->
        <div class="relative w-full flex justify-center mb-6">
           <!-- 使用 inline-flex 讓容器大小隨內容改變，並保持在正中央 -->
           <div class="relative inline-flex items-center">
              <div class="text-gray-700 text-xl font-bold tracking-tight">
                {{ dateRange }}
              </div>
              
              <!-- 夜衝按鈕: 絕對定位於日期右側，不影響父容器置中 -->
              <button 
                  @click.stop="toggleNightRush"
                  class="absolute left-full ml-3 p-2 rounded-full transition-all duration-300 transform hover:scale-110 top-1/2 -translate-y-1/2"
                  :class="trip.night_rush 
                    ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 shadow-sm' 
                    : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'"
                  title="切換夜衝狀態"
                >
                  <component :is="Moon" class="w-5 h-5" :class="{ 'fill-current': trip.night_rush }" />
              </button>
           </div>
        </div>
        
        <!-- 倒數 -->
        <div class="flex flex-col items-center mb-6">
            <div class="text-8xl font-black text-blue-500 leading-none tracking-tighter font-['Outfit'] drop-shadow-sm">
                 {{ countdown }}
            </div>
            <div class="text-gray-400 text-lg font-medium tracking-widest mt-1">倒數天數</div>
        </div>

        <!-- 天氣摘要 -->
         <div v-if="loadingWeather" class="h-16 flex items-center text-gray-400 text-sm animate-pulse">
            <Cloud class="w-5 h-5 mr-2" />
            更新天氣中...
         </div>
         <div v-else-if="weather.length > 0 && weather[0]" class="w-full flex flex-col items-center gap-3">
            <!-- 氣溫卡片 -->
            <div class="flex items-center bg-gradient-to-br from-white to-blue-50 px-6 py-4 rounded-2xl shadow-sm border border-blue-100/50">
               <div class="flex items-center gap-3">
                  <component :is="getWeatherIcon(weather[0].day.code)" class="w-10 h-10 text-yellow-500 drop-shadow-sm" />
                  <div class="text-left">
                     <div class="text-xs text-gray-500 mb-0.5">預報氣溫</div>
                     <div class="text-2xl font-black text-gray-800">
                       {{ weather[0].day.temp_min }}° - {{ weather[0].day.temp_max }}°
                     </div>
                  </div>
               </div>
            </div>

            <!-- 撤收狀態標籤 -->
            <div v-if="packingStatus" 
                 class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold shadow-sm border"
                 :class="packingStatus === 'dry' 
                    ? 'bg-green-50 text-green-700 border-green-200' 
                    : 'bg-red-50 text-red-700 border-red-200'"
            >
                <Tent class="w-4 h-4" />
                {{ packingStatus === 'dry' ? '乾燥撤收' : '濕帳撤收' }}
                <span class="text-xs font-normal opacity-75 ml-1">(預測)</span>
            </div>
         </div>
         <div v-else-if="weatherError" class="text-sm text-gray-400 flex items-center">
            <CloudRain class="w-4 h-4 mr-2" />
            {{ weatherError === 'no_coords' ? '尚未設定座標' : '暫無天氣資料' }}
         </div>

      </div>
    </div>
  </div>
</template>
