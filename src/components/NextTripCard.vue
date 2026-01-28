<script setup lang="ts">
import { computed, toRef, watch } from 'vue'
import { CloudSun, CloudRain, Sun, Cloud, Moon, Tent, MapPin, Calendar, ChevronLeft, ChevronRight, Snowflake, IceCream, Droplets, Navigation, Users } from 'lucide-vue-next'
import type { CampingTripWithCampsite } from '../types/database'
import { useTripWeather } from '../composables/useTripWeather'
import { useTravelTime } from '../composables/useTravelTime'

interface Props {
  trip: CampingTripWithCampsite
  hasPrev?: boolean
  hasNext?: boolean
  userOrigin?: { latitude: number, longitude: number, location_name: string } | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update-night-rush', payload: { id: number, value: boolean }): void
  (e: 'prev'): void
  (e: 'next'): void
}>()

// Use Shared Weather Logic
const tripRef = toRef(props, 'trip')
const { weatherDays, tripSummary, packingStatus, loading: loadingWeather } = useTripWeather(tripRef)

// Travel Time Logic
const { travelTime, fetchTravelTime: doFetchTravelTime } = useTravelTime()

const fetchTravelTimeEffect = () => {
  if (!props.trip) return
  const t = props.trip
  // Use trip start location if set, otherwise user origin
  const startLat = t.start_latitude ?? props.userOrigin?.latitude
  const startLng = t.start_longitude ?? props.userOrigin?.longitude
  
  const destLat = t.campsites?.latitude ?? t.latitude
  const destLng = t.campsites?.longitude ?? t.longitude

  if (startLat && startLng && destLat && destLng) {
      doFetchTravelTime(destLat, destLng, startLat, startLng)
  }
}

watch(() => props.trip, fetchTravelTimeEffect, { immediate: true })
watch(() => props.userOrigin, fetchTravelTimeEffect)


// Derived Weather Summary for Card (Use Overall Trip Summary)
const weatherSummary = computed(() => {
  if (tripSummary.value) return { summary: tripSummary.value }
  // Fallback to first day if summary not ready but days are (should not happen logic wise but safe)
  if (weatherDays.value.length > 0) return weatherDays.value[0]
  return null
})

const isPastTrip = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const tripDate = new Date(props.trip.trip_date)
  tripDate.setHours(0, 0, 0, 0)
  
  const duration = props.trip.duration_days || 1
  const endDate = new Date(tripDate)
  endDate.setDate(endDate.getDate() + duration - 1)
  
  return today.getTime() > endDate.getTime()
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
  if (len <= 8) return 'text-4xl md:text-6xl'
  return 'text-3xl md:text-5xl'
})

const navigateToGoogleMaps = () => {
  const trip = props.trip
  const latitude = trip.campsites?.latitude ?? trip.latitude
  const longitude = trip.campsites?.longitude ?? trip.longitude
  const name = trip.campsites?.name ?? trip.campsite_name
  const start_latitude = trip.start_latitude ?? props.userOrigin?.latitude
  const start_longitude = trip.start_longitude ?? props.userOrigin?.longitude

  let url = ''
  
  if (name) {
    const originParam = (start_latitude && start_longitude) ? `&origin=${start_latitude},${start_longitude}` : ''
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(name)}${originParam}`
  } else if (latitude && longitude) {
    const dest = `${latitude},${longitude}`
    const originParam = (start_latitude && start_longitude) ? `&origin=${start_latitude},${start_longitude}` : ''
    url = `https://www.google.com/maps/dir/?api=1&destination=${dest}${originParam}`
  }
  
  if (url) window.open(url, '_blank')
}

const formattedLocation = computed(() => {
  const trip = props.trip
  let loc = ''
  if (trip.campsites?.city || trip.campsites?.district) {
    loc = (trip.campsites.city || '') + (trip.campsites.district || '')
  } else {
    loc = trip.location || '未設定地點'
  }
  // Remove administrative suffixes for cleaner display
  return loc.replace(/[縣市區鄉鎮]/g, '')
})

</script>

<template>
  <div v-if="trip" class="flex flex-col gap-5 w-full pb-8 select-none">
    
    <!-- Header -->
    <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-[-0.5rem] px-4">NEXT ADVENTURE</h3>

    <!-- 1. HERO CARD (Visuals + Countdown) -->
    <div class="relative w-full overflow-hidden rounded-[2.5rem] card-organic group min-h-[360px] md:min-h-[380px] shrink-0">
        <!-- Background Art (Restored) -->
        <div class="absolute inset-0 z-0 bg-gray-200">
           <img 
             src="/images/card_bg.jpg" 
             alt="Card Background" 
             class="w-full h-full object-cover opacity-60 transition-opacity duration-700"
             loading="eager"
             :class="isPastTrip ? 'grayscale-30' : ''"
           />
           <div class="absolute inset-0 bg-white/40 backdrop-blur-[2px]"></div>
        </div>

        <!-- Main Content -->
        <div class="relative z-10 w-full h-full flex flex-col items-center pt-6 pb-3 px-4">

            <!-- Location Pill (Top Left) -->
            <div class="absolute top-6 left-6 z-30">
                 <div class="inline-flex items-center gap-1 px-3 py-1 bg-white/70 text-primary-800 rounded-full backdrop-blur-md border border-white/60 text-xs font-bold shadow-sm">
                   <MapPin class="w-3 h-3 text-emerald-600" />
                   <span>{{ formattedLocation }}</span>
                 </div>
            </div>

            <!-- Night Rush Toggle (Top Right) -->
            <div class="absolute top-5 right-5 z-40">
                <button 
                  :disabled="isPastTrip"
                  @click.stop="toggleNightRush"
                  class="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-white/80 backdrop-blur-md shadow-md border-2 border-white/50 text-primary-300 hover:text-primary-600 hover:scale-105 active:scale-95"
                  :class="{ 'bg-slate-800/90 border-slate-600 text-yellow-400': trip.night_rush }"
                >
                  <Moon class="w-6 h-6" :class="{ '-rotate-12 fill-current': trip.night_rush }" />
                </button>
            </div>

            <!-- Title (Centered) -->
            <div class="flex items-center justify-center px-4 w-full mt-2 mb-1">
                <h2 :class="titleClass" class="font-black text-primary-900 tracking-tight leading-none text-center drop-shadow-sm whitespace-nowrap overflow-hidden text-ellipsis w-full pb-1">
                     {{ trip.campsites?.name || trip.campsite_name }}
                </h2>
            </div>
            <span class="text-lg md:text-xl font-bold text-primary-800 font-mono tracking-tight opacity-80 z-20 mb-2">
                {{ dateRange }}
            </span>

            <!-- Countdown -->
            <div class="flex-1 flex flex-col items-center justify-center relative w-full">
                <div class="leading-none font-black drop-shadow-sm tracking-tighter z-10 font-sans" 
                     :class="isPastTrip ? 'text-6xl md:text-7xl text-primary-400 opacity-60 py-6 md:py-9' : 'text-[7rem] md:text-[9rem] text-accent-sky scale-110'">
                     {{ isPastTrip ? 'COMPLETE' : countdown }}
                </div>
                <div class="text-primary-600 font-bold tracking-[0.2em] text-xs uppercase mt-1 mb-8">
                    <span v-if="!isPastTrip && countdown !== 'GO!' && countdown !== 'ING'">DAYS TO GO</span>
                    <span v-else class="opacity-0">SPACER</span>
                </div>
            </div>
            
            <!-- Bottom Section: Action Only -->
            <div class="mt-auto z-20 flex flex-col items-center gap-6 w-full">
                 
                 <!-- Start Navigation Button -->
                 <button 
                  @click.stop="navigateToGoogleMaps"
                  class="group relative overflow-hidden rounded-2xl py-2.5 px-6 flex items-center justify-center transition-all active:scale-95 border border-white/50 shadow-sm bg-white/40 hover:bg-white/60 backdrop-blur-md text-primary-900"
                >
                    <div class="flex items-center gap-2.5">
                         <Navigation class="w-5 h-5 fill-current text-sky-600 transition-transform group-hover:rotate-12" />
                         <div class="text-left flex flex-col items-start gap-0.5">
                             <span class="text-sm font-black leading-none tracking-wide">立即出發</span>
                             <span v-if="travelTime" class="text-[10px] font-bold text-sky-700 leading-none opacity-80">預估 {{ travelTime }}</span>
                         </div>
                    </div>
                </button>
            </div>

            <!-- Navigation (Explicit Buttons) -->
            <div v-if="hasPrev" @click.stop="$emit('prev')" class="absolute left-4 top-1/2 -translate-y-1/2 z-30 cursor-pointer group/nav">
                 <div class="p-3 bg-black/10 hover:bg-black/30 backdrop-blur-sm rounded-full transition-all text-white shadow-lg border border-white/20 group-active/nav:scale-95">
                    <ChevronLeft class="w-8 h-8 md:w-10 md:h-10 drop-shadow-md" />
                 </div>
            </div>
            <div v-if="hasNext" @click.stop="$emit('next')" class="absolute right-4 top-1/2 -translate-y-1/2 z-30 cursor-pointer group/nav">
                 <div class="p-3 bg-black/10 hover:bg-black/30 backdrop-blur-sm rounded-full transition-all text-white shadow-lg border border-white/20 group-active/nav:scale-95">
                    <ChevronRight class="w-8 h-8 md:w-10 md:h-10 drop-shadow-md" />
                 </div>
            </div>
        </div>
    </div>

    <!-- 2. WEATHER & FACILITIES -->
    <div>
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-4">WEATHER & FACILITIES</h3>
        <div class="bg-white rounded-[2rem] p-5 flex items-center justify-between shadow-sm border border-gray-50 relative overflow-hidden min-h-[5.5rem]">
             
             <!-- Loading -->
             <div v-if="loadingWeather && !weatherSummary" class="absolute inset-0 bg-white/80 animate-pulse z-20"></div>

             <template v-if="weatherSummary">
                 <!-- Weather Info -->
                 <div class="flex items-center gap-4">
                     <div class="w-14 h-14 rounded-2xl bg-yellow-50 flex items-center justify-center text-yellow-500 shadow-sm border border-yellow-100">
                         <component :is="getWeatherIcon(weatherSummary.summary.code)" class="w-8 h-8" />
                     </div>
                     <div class="flex flex-col">
                         <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">溫度預測</div>
                         <div class="text-2xl font-black text-gray-800 leading-none">
                             {{ weatherSummary.summary.temp_min }}° - {{ weatherSummary.summary.temp_max }}°
                         </div>
                     </div>
                     <!-- Packing Badge (Text Only) -->
                     <div v-if="packingStatus" class="ml-4 flex flex-col">
                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">收帳預測</div>
                        <span class="text-xl font-black"
                              :class="{
                                'text-emerald-500': packingStatus.status === 'dry' || packingStatus.status === 'perfect',
                                'text-red-500': packingStatus.status === 'wet',
                                'text-orange-500': packingStatus.status === 'damp' || packingStatus.status === 'risk',
                                'text-yellow-500 text-shadow-sm': packingStatus.status === 'drying' || packingStatus.status === 'chance',
                              }">
                           {{ packingStatus.label }}
                        </span>
                     </div>
                 </div>

                 <!-- Amenities List (Right) -->
                 <div class="flex items-center gap-4 ml-auto" v-if="trip.campsites?.amenities">
                      <!-- Fridge -->
                      <div class="flex flex-col items-center gap-1 min-w-[30px]">
                          <div class="relative w-6 h-6 flex items-center justify-center">
                              <Snowflake class="w-full h-full transition-opacity" :class="trip.campsites.amenities.has_fridge ? 'text-sky-500' : 'text-slate-300'" />
                              <div v-if="!trip.campsites.amenities.has_fridge" class="absolute w-[140%] h-[2px] bg-red-500/80 rotate-45 rounded-full z-10"></div>
                          </div>
                          <span class="text-[10px] font-bold mt-0.5" :class="trip.campsites.amenities.has_fridge ? 'text-sky-700' : 'text-slate-400'">冷藏</span>
                      </div>
                      <!-- Freezer -->
                      <div class="flex flex-col items-center gap-1 min-w-[30px]">
                          <div class="relative w-6 h-6 flex items-center justify-center">
                              <IceCream class="w-full h-full transition-opacity" :class="trip.campsites.amenities.has_freezer ? 'text-indigo-500' : 'text-slate-300'" />
                              <div v-if="!trip.campsites.amenities.has_freezer" class="absolute w-[140%] h-[2px] bg-red-500/80 rotate-45 rounded-full z-10"></div>
                          </div>
                          <span class="text-[10px] font-bold mt-0.5" :class="trip.campsites.amenities.has_freezer ? 'text-indigo-700' : 'text-slate-400'">冷凍</span>
                      </div>
                      <!-- Water -->
                      <div class="flex flex-col items-center gap-1 min-w-[30px]">
                          <div class="relative w-6 h-6 flex items-center justify-center">
                              <Droplets class="w-full h-full transition-opacity" :class="trip.campsites.amenities.has_water_dispenser ? 'text-teal-500' : 'text-slate-300'" />
                              <div v-if="!trip.campsites.amenities.has_water_dispenser" class="absolute w-[140%] h-[2px] bg-red-500/80 rotate-45 rounded-full z-10"></div>
                          </div>
                          <span class="text-[10px] font-bold mt-0.5" :class="trip.campsites.amenities.has_water_dispenser ? 'text-teal-700' : 'text-slate-400'">飲水</span>
                      </div>
                 </div>
             </template>
             <template v-else>
                  <div class="w-full flex items-center justify-center text-gray-400 gap-2">
                      <Calendar class="w-5 h-5" />
                      <span class="text-sm font-bold">接近日期顯示天氣</span>
                  </div>
             </template>
        </div>
    </div>

    <!-- 3. CAMPSITE INFO (Separate Cards) -->
    <div>
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-4">CAMPSITE INFO</h3>
        <div class="grid grid-cols-2 gap-3">
             <!-- Zone Card -->
             <div class="bg-white rounded-[2rem] p-4 flex items-center gap-3 shadow-sm border border-gray-50 overflow-hidden">
                 <div class="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                     <Tent class="w-6 h-6" />
                 </div>
                 <div class="flex flex-col min-w-0">
                     <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">區域</span>
                     <div class="font-black text-gray-800 text-lg truncate leading-tight">{{ trip.zone || '未指定' }}</div>
                 </div>
             </div>
             
             <!-- Companions Card -->
             <div class="bg-white rounded-[2rem] p-4 flex items-center gap-3 shadow-sm border border-gray-50 overflow-hidden">
                 <div class="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                     <Users class="w-6 h-6" />
                 </div>
                 <div class="flex flex-col min-w-0">
                     <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">露友</span>
                     <div class="font-black text-gray-800 text-lg truncate leading-tight">{{ trip.companions || '無' }}</div>
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
/* Reduce grayscale intensity */
.grayscale-30 {
  filter: grayscale(30%);
}
</style>


