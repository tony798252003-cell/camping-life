<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { CloudSun, CloudRain, Sun, Cloud, Tent, Calendar, Clock } from 'lucide-vue-next'
import type { CampingTrip, CampingTripWithCampsite } from '../types/database'

interface Props {
  trip: CampingTripWithCampsite | CampingTrip
}

const props = defineProps<Props>()

interface WeatherHour {
  time: string // HH:00
  timestamp: number
  temp: number
  code: number
  isValid: boolean // In camping range?
}

interface WeatherDay {
  date: string
  dateLabel: string
  fullDateLabel: string // For detail title
  summary: {
    code: number
    temp_max: number
    temp_min: number
  }
  hours: WeatherHour[]
}

const weatherDays = ref<WeatherDay[]>([])
const selectedDay = ref<WeatherDay | null>(null)
const loadingWeather = ref(false)
const weatherError = ref<string | null>(null)
const packingStatus = ref<'dry' | 'wet' | null>(null)
const hourlyContainer = ref<HTMLElement | null>(null)

const isPastTrip = computed(() => {
  if (!props.trip.trip_date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tripDate = new Date(props.trip.trip_date)
  tripDate.setHours(0, 0, 0, 0)
  const duration = props.trip.duration_days || 1
  const endDate = new Date(tripDate)
  endDate.setDate(endDate.getDate() + duration - 1)
  return today.getTime() > endDate.getTime()
})

const scrollToHour = (hour: number) => {
  nextTick(() => {
    if (!hourlyContainer.value) return
    const el = hourlyContainer.value.querySelector(`[data-hour="${hour}"]`) as HTMLElement
    if (el) {
       // Offset slightly to be centered or comfortable
       hourlyContainer.value.scrollTo({ left: el.offsetLeft - 20, behavior: 'smooth' })
    }
  })
}

const selectDay = (day: WeatherDay) => {
  selectedDay.value = day
  
  if (!props.trip.trip_date) return
  
  // Check if this is the Night Rush day (Start Date - 1)
  const tripDate = new Date(props.trip.trip_date)
  tripDate.setHours(0,0,0,0)
  const dayDate = new Date(day.date)
  dayDate.setHours(0,0,0,0)
  
  // Only scroll if it's explicitly the Night Rush Day
  const isNightRushDay = (tripDate.getTime() - dayDate.getTime()) === 24 * 60 * 60 * 1000
  const t = props.trip as any

  if (t.night_rush && isNightRushDay) {
     scrollToHour(17)
  } else {
     // Scroll to start for others
     nextTick(() => {
       if (hourlyContainer.value) hourlyContainer.value.scrollTo({ left: 0, behavior: 'smooth' })
     })
  }
}

const getMostFrequentCode = (codes: number[]) => {
  if (codes.length === 0) return 0
  const map: Record<number, number> = {}
  let max = 0
  let res = codes[0]
  for (const c of codes) {
    map[c] = (map[c] || 0) + 1
    if (map[c] > max) { max = map[c]; res = c; }
  }
  return res || 0
}

const getWeatherIcon = (code: number) => {
  if (code <= 3) return Sun 
  if (code <= 48) return Cloud 
  if (code <= 67) return CloudRain 
  if (code <= 77) return CloudSun 
  if (code > 80) return CloudRain 
  return CloudSun
}

const processWeatherData = (data: any) => {
  // Strict check at the top
  if (!props.trip.trip_date) return
  const tripDateStr = props.trip.trip_date
  
  const t = props.trip as any
  
  // Base Trip Dates
  const tripStart = new Date(tripDateStr)
  tripStart.setHours(0,0,0,0)

  const duration = Number(props.trip.duration_days || 1)
  const tripEnd = new Date(tripStart)
  tripEnd.setDate(tripEnd.getDate() + duration - 1)
  tripEnd.setHours(0,0,0,0)

  // Identify Key Date Strings for Comparisons
  const tripStartStr = tripStart.toISOString().split('T')[0]
  const tripEndStr = tripEnd.toISOString().split('T')[0]
  
  // Calculate Night Rush Date
  const nightRushDate = new Date(tripStart)
  nightRushDate.setDate(nightRushDate.getDate() - 1)
  const nightRushStr = nightRushDate.toISOString().split('T')[0] ?? ''

  // Define Allowed Days Set
  const allowedDays = new Set<string>()
  // Add trip days
  const iter = new Date(tripStart)
  while (iter <= tripEnd) {
     allowedDays.add((iter.toISOString().split('T')[0] ?? ''))
     iter.setDate(iter.getDate() + 1)
  }
  // Add night rush day if active
  if (t.night_rush) {
     allowedDays.add(nightRushStr)
  }

  const daysMap = new Map<string, { hours: WeatherHour[], date: Date }>()

  if (!data || !data.hourly || !data.hourly.time) return

  data.hourly.time.forEach((timeStr: string, index: number) => {
    if (!timeStr) return
    const rawDateStr = timeStr.split('T')[0] ?? ''
    const timePart = timeStr.split('T')[1]
    
    // Safety
    if (!rawDateStr || !timePart) return
    
    const rawHour = parseInt(timePart.split(':')[0] ?? '0', 10)
    
    // STRICT FILTER: Only include days in our allowed set
    if (!allowedDays.has(rawDateStr)) return
    
    // Validity Check (Gray vs Color)
    let isValid = false
    
    if (t.night_rush) {
       if (rawDateStr === nightRushStr) {
          // Night Rush Day: Valid >= 17:00
          isValid = rawHour >= 17
       } else if (rawDateStr === tripStartStr) {
          // Day 1 (Post Night Rush): All Valid
          isValid = true 
       } else if (rawDateStr === tripEndStr) {
          // Last Day: Valid <= 12:00
          isValid = rawHour <= 12
       } else {
          // Middle Days
          isValid = true
       }
    } else {
       // No Night Rush
       if (rawDateStr === tripStartStr) {
          // First Day: Valid >= 10:00
          isValid = rawHour >= 10
       } else if (rawDateStr === tripEndStr) {
          // Last Day: Valid <= 12:00
          isValid = rawHour <= 12
       } else {
          // Middle Days
          isValid = true
       }
    }
    
    if (!daysMap.has(rawDateStr)) {
      daysMap.set(rawDateStr, { hours: [], date: new Date(rawDateStr) })
    }
    
    const hourItem: WeatherHour = {
      time: String(rawHour).padStart(2, '0') + ':00',
      timestamp: index, 
      temp: data.hourly.temperature_2m?.[index] ?? 0,
      code: data.hourly.weather_code?.[index] ?? 0,
      isValid
    }
    
    // Use optional chaining
    daysMap.get(rawDateStr)?.hours.push(hourItem)
  })

  // Convert map to array and Sort by Date
  const finalDays: WeatherDay[] = []
  const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
  
  // Sort allowed days
  const sortedAllowedDays = Array.from(allowedDays).sort()

  sortedAllowedDays.forEach(dStr => {
     const dayData = daysMap.get(dStr)
     if (!dayData) return 
     
     const dDate = new Date(dStr)
     
     if (dayData.hours.length > 0) {
        // Summary uses valid hours if available
        const validHours = dayData.hours.filter(h => h.isValid)
        const calcHours = validHours.length > 0 ? validHours : dayData.hours
        
        const temps = calcHours.map(h => h.temp)
        const codes = calcHours.map(h => h.code)
        
        const max = temps.length ? Math.max(...temps) : 0
        const min = temps.length ? Math.min(...temps) : 0
        const code = codes.length ? getMostFrequentCode(codes) : 0

        finalDays.push({
          date: dStr,
          dateLabel: `${dDate.getMonth()+1}/${dDate.getDate()}`,
          fullDateLabel: `${dDate.getMonth()+1}/${dDate.getDate()} ${weekdays[dDate.getDay()]}`,
          hours: dayData.hours, 
          summary: {
             temp_max: Math.round(max),
             temp_min: Math.round(min),
             code
          }
        })
     }
  })

  weatherDays.value = finalDays
  
  if (finalDays.length > 0) {
    if (!selectedDay.value || !finalDays.find(d => d.date === selectedDay.value?.date)) {
        if (finalDays[0]) selectDay(finalDays[0])
    } else {
        const found = finalDays.find(d => d.date === selectedDay.value?.date)
        if (found) selectDay(found)
    }
  }

  const lastDayDateStr = tripEndStr
  const lastDay = finalDays.find(d => d.date === lastDayDateStr)
  
  if (lastDay) {
     const wetHours = lastDay.hours.filter(h => h.isValid && h.code >= 51)
     packingStatus.value = wetHours.length > 0 ? 'wet' : 'dry'
  }
}

const fetchWeather = async () => {
  if (isPastTrip.value) return
  if (!props.trip.trip_date) return
  
  const tr = props.trip as any
  const lat = tr.campsites?.latitude ?? tr.latitude
  const lng = tr.campsites?.longitude ?? tr.longitude

  if (!lat || !lng) {
    weatherError.value = 'no_coords'
    return
  }

  // Basic check for future limit
  const today = new Date()
  const tripDateStr = props.trip.trip_date
  const tripTime = new Date(tripDateStr).getTime()
  
  // Future check
  if ((tripTime - today.getTime()) / (1000 * 3600 * 24) > 16) {
    loadingWeather.value = false
    return
  }

  loadingWeather.value = true
  weatherError.value = null
  packingStatus.value = null

  try {
    let elevation = tr.campsites?.altitude ?? tr.altitude
    
    // Add timezone=auto to get local time strings
    let apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=weather_code,temperature_2m&forecast_days=16&past_days=2&models=gem_global&timezone=auto`
    if (elevation) apiUrl += `&elevation=${elevation}`

    const response = await fetch(apiUrl)
    let data = null
    try {
       data = await response.json()
    } catch (e) {
       throw new Error('API JSON Parse Error')
    }
    
    if (!data.hourly) throw new Error('API Error')

    // No cache key version bump to invalidate old timezone-less data
    const cacheKey = `weather_daily_v8_${props.trip.id}_${props.trip.trip_date}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          processWeatherData(parsed.data)
          loadingWeather.value = false
          return
        }
      } catch (e) {
        // Cache error, ignore
      }
    }

    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      data
    }))

    processWeatherData(data)

  } catch (e) {
    console.error(e)
    weatherError.value = 'fetch_error'
  } finally {
    loadingWeather.value = false
  }
}

watch(() => props.trip, () => {
  fetchWeather()
}, { immediate: true, deep: true })
</script>

<template>
  <div v-if="!isPastTrip && !weatherError" class="select-none">
    
    <!-- Loading -->
    <div v-if="loadingWeather" class="h-32 flex items-center justify-center bg-surface-50 rounded-2xl border border-dashed border-primary-200">
        <div class="flex flex-col items-center gap-2 text-primary-400">
           <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-current"></div>
           <span class="text-xs font-bold">載入天氣資訊...</span>
        </div>
    </div>

    <div v-else-if="weatherDays.length > 0" class="flex flex-col gap-4">
        
        <!-- Day Selector (Cards) -->
        <div class="flex overflow-x-auto gap-3 pb-2 px-1 snap-x hide-scrollbar">
           <button 
             type="button"
             v-for="day in weatherDays" 
             :key="day.date"
             @click="selectDay(day)"
             class="flex-shrink-0 snap-start flex flex-col items-center justify-center min-w-[5rem] h-[5.5rem] rounded-2xl border transition-all duration-300 relative overflow-hidden"
             :class="selectedDay?.date === day.date ? 'bg-primary-600 text-white shadow-lg scale-105 border-primary-600 ring-2 ring-offset-2 ring-primary-200' : 'bg-white text-primary-900 border-primary-100 hover:border-primary-300 hover:bg-surface-50'"
           >
              <!-- Date -->
              <span class="text-[10px] font-bold mb-1 opacity-80">{{ day.dateLabel }}</span>
              
              <!-- Icon -->
              <component :is="getWeatherIcon(day.summary.code)" class="w-7 h-7 mb-1" :class="selectedDay?.date === day.date ? 'text-white' : 'text-accent-orange'" />
              
              <!-- Temp -->
              <span class="text-xs font-black">{{ day.summary.temp_min }}°-{{ day.summary.temp_max }}°</span>
           </button>
        </div>

        <!-- Hourly Detail View -->
        <div v-if="selectedDay" class="bg-surface-50/50 rounded-3xl border border-primary-100 p-4 transition-all animate-fade-in-up">
           <div class="flex justify-between items-center mb-3 px-1">
              <h4 class="text-sm font-bold text-primary-800 flex items-center gap-1.5">
                 <Clock class="w-4 h-4 text-primary-500" />
                 {{ selectedDay.fullDateLabel }}
              </h4>
              <!-- Legend? -->
              <div class="flex gap-2 text-[10px] text-gray-400">
                 <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-gray-300"></span> 非露營時段</span>
                 <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-primary-500"></span> 露營時段</span>
              </div>
           </div>
           
           <!-- Hourly Scroll -->
           <div ref="hourlyContainer" class="flex overflow-x-auto gap-4 pb-2 hide-scrollbar scroll-smooth">
              <div v-for="hour in selectedDay.hours" :key="hour.timestamp" 
                   class="flex flex-col items-center gap-1.5 min-w-[3rem]"
                   :class="hour.isValid ? 'opacity-100' : 'opacity-40 grayscale'" 
                   :data-hour="hour.time.split(':')[0]"
              >
                  <span class="text-[10px] font-medium text-gray-500">{{ hour.time }}</span>
                  <component :is="getWeatherIcon(hour.code)" class="w-6 h-6" :class="hour.isValid ? 'text-accent-orange' : 'text-gray-400'" />
                  <span class="text-sm font-bold" :class="hour.isValid ? 'text-primary-900' : 'text-gray-500'">{{ Math.round(hour.temp) }}°</span>
              </div>
           </div>
        </div>

        <!-- Packing Status Bar -->
        <div v-if="packingStatus" class="flex items-center rounded-xl px-4 py-2 gap-3 border"
             :class="packingStatus === 'dry' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'"
        >
             <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  :class="packingStatus === 'dry' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'"
             >
                <Tent class="w-4 h-4" />
             </div>
             <div>
                <div class="text-[10px] opacity-70 font-bold mb-0.5" 
                     :class="packingStatus === 'dry' ? 'text-emerald-800' : 'text-red-800'"
                >收帳日天氣預測</div>
                <div class="text-sm font-black"
                     :class="packingStatus === 'dry' ? 'text-emerald-700' : 'text-red-700'"
                >
                   {{ packingStatus === 'dry' ? '乾燥撤收' : '可能有雨' }}
                </div>
             </div>
        </div>

    </div>

    <!-- Too far in future -->
    <div v-else class="flex items-center justify-center bg-surface-50 px-6 py-3 rounded-2xl border border-primary-50 gap-3 w-full h-[4.5rem]">
         <Calendar class="w-5 h-5 text-primary-400 opacity-70" />
         <span class="text-sm font-bold text-primary-400 tracking-wide">接近出發日期時將顯示天氣</span>
    </div>
  </div>
</template>

<style scoped>
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
