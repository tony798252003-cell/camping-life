<script setup lang="ts">
import { computed, toRef, watch } from 'vue'
import { Moon, Tent, MapPin, Calendar, ChevronLeft, ChevronRight, Snowflake, IceCream, Droplets, Navigation, Users, RotateCcw, LogIn, LogOut } from 'lucide-vue-next'
import type { CampingTripWithCampsite } from '../types/database'
import { useTripWeather } from '../composables/useTripWeather'
import { useTravelTime } from '../composables/useTravelTime'

interface Props {
  trip: CampingTripWithCampsite
  hasPrev?: boolean
  hasNext?: boolean
  showResetButton?: boolean
  userOrigin?: { latitude: number, longitude: number, location_name: string } | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update-night-rush', payload: { id: number, value: boolean }): void
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'reset'): void
}>()

// Use Shared Weather Logic
const tripRef = toRef(props, 'trip')
const { weatherDays, tripSummary, packingStatus, loading: loadingWeather } = useTripWeather(tripRef)

// Travel Time Logic
const { travelTime, fetchTravelTime: doFetchTravelTime } = useTravelTime()

const fetchTravelTimeEffect = () => {
  if (!props.trip) return
  const t = props.trip
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
  const now = new Date()
  
  const tripDate = new Date(props.trip.trip_date)
  tripDate.setHours(0, 0, 0, 0)
  
  const duration = props.trip.duration_days || 1
  const endDate = new Date(tripDate)
  endDate.setDate(endDate.getDate() + duration - 1)
  
  // Set end time to 12:00 PM on the last day
  endDate.setHours(12, 0, 0, 0)
  
  return now.getTime() > endDate.getTime()
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
import { getSmartWeatherIcon } from '../utils/weatherHelpers'

const getWeatherIcon = (code: number) => {
  // Use max_pop from summary if available
  const pop = weatherSummary.value?.summary.max_pop ?? 0
  return getSmartWeatherIcon(code, pop)
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

// Title Font Size Logic (Responsive scaling based on name length)
const titleClass = computed(() => {
  const name = props.trip.campsites?.name || props.trip.campsite_name || ''
  const len = name.length
  // Scale down progressively for longer names
  if (len <= 6) return 'text-4xl md:text-6xl'
  if (len <= 10) return 'text-3xl md:text-5xl'
  if (len <= 15) return 'text-2xl md:text-4xl'
  return 'text-xl md:text-3xl'
})

// Zone Font Size Logic (Dynamic scaling)
const zoneClass = computed(() => {
  const zone = props.trip.zone || ''
  const len = zone.length
  if (len <= 4) return 'text-base sm:text-lg'
  if (len <= 7) return 'text-sm sm:text-base'
  return 'text-xs sm:text-sm'
})

// Companions Font Size Logic (Dynamic scaling)
const companionsClass = computed(() => {
  const companions = props.trip.companions || ''
  const len = companions.length
  if (len <= 4) return 'text-base sm:text-lg'
  if (len <= 7) return 'text-sm sm:text-base'
  return 'text-xs sm:text-sm'
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
  return loc
})

// Dynamic Time Info Logic
const dynamicTimeInfo = computed(() => {
  if (!props.trip || !props.trip.campsites) return null

  const now = new Date()
  const tripDate = new Date(props.trip.trip_date)
  tripDate.setHours(0,0,0,0) // Start of trip day

  const duration = props.trip.duration_days || 1
  const endDate = new Date(tripDate)
  endDate.setDate(endDate.getDate() + duration - 1) // Last day

  // Helper to parse time string "HH:mm" to Date object on a specific day
  const getTimeDate = (baseDate: Date, timeStr?: string) => {
    const d = new Date(baseDate)
    const [h, m] = (timeStr || '12:00').split(':').map(Number)
    d.setHours(h || 0, m || 0, 0, 0)
    return d
  }

  // 1. Determine Arrival Target
  let arrivalTarget: Date
  let isNightRushTarget = false

  if (props.trip.night_rush) {
    // Night rush is usually the evening BEFORE the trip date
    const nightRushDate = new Date(tripDate)
    nightRushDate.setDate(nightRushDate.getDate() - 1)
    arrivalTarget = getTimeDate(nightRushDate, props.trip.campsites.night_rush_time || '18:00')
    isNightRushTarget = true
  } else {
    arrivalTarget = getTimeDate(tripDate, props.trip.campsites.check_in_time || '14:00')
  }

  // 2. Determine Checkout Target
  const checkoutTarget = getTimeDate(endDate, props.trip.campsites.check_out_time || '11:00')

  // Logic Branching
  
  // Case A: Before Arrival (Show Arrival Info)
  // Give a buffer? Or strict? Strict is fine.
  if (now < arrivalTarget) {
     if (isNightRushTarget) {
         if (!props.trip.campsites.night_rush_time) return null
         return {
             label: '夜衝',
             time: props.trip.campsites.night_rush_time,
             icon: Moon,
             iconColor: 'text-indigo-600'
         }
     } else {
         if (!props.trip.campsites.check_in_time) return null
         return {
             label: '進場',
             time: props.trip.campsites.check_in_time,
             icon: LogIn,
             iconColor: 'text-emerald-600'
         }
     }
  }

  // Case B: During Stay
  if (now < checkoutTarget) {
      // If today is the checkout day (endDate), show Checkout Info
      const isCheckoutDay = now.getDate() === endDate.getDate() && 
                            now.getMonth() === endDate.getMonth() && 
                            now.getFullYear() === endDate.getFullYear()
      
      if (isCheckoutDay) {
          if (!props.trip.campsites.check_out_time) return null
          return {
              label: '離場',
              time: props.trip.campsites.check_out_time,
              icon: LogOut,
              iconColor: 'text-orange-600'
          }
      } else {
          // Otherwise (e.g. Day 1 evening, Day 2 of 3), show Hot Water
          if (!props.trip.campsites.shower_restrictions) return null
          return {
              label: '熱水',
              time: props.trip.campsites.shower_restrictions,
              icon: Droplets,
              iconColor: 'text-rose-600'
          }
      }
  }

  // Case C: Post Trip (or late Checkout day)
  // Maybe keep showing checkout time for a bit? Or nothing?
  // Let's just show Checkout time if it's still same day, else nothing
  const isSameDay = now.getDate() === endDate.getDate()
  if (isSameDay) {
       if (!props.trip.campsites.check_out_time) return null
       return {
          label: '離場',
          time: props.trip.campsites.check_out_time,
          icon: LogOut,
          iconColor: 'text-orange-600'
      }
  }

  return null
})


</script>

<template>
  <div v-if="trip" class="flex flex-col gap-5 w-full pb-8 select-none">
    
    <!-- Header -->
    <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-[-0.5rem] px-4">NEXT ADVENTURE</h3>

    <!-- 1. HERO CARD (Visuals + Countdown) -->
    <div class="relative w-full overflow-hidden rounded-[2.5rem] card-organic group min-h-[300px] md:min-h-[320px] shrink-0">
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
        <div class="relative z-10 w-full h-full flex flex-col items-center pt-3 pb-3 px-4">



            <!-- Dynamic Time Info (Top Right) -->
            <div class="absolute top-3 right-4 z-40" v-if="dynamicTimeInfo">
                <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-white/70 text-primary-800 rounded-full backdrop-blur-md border border-white/60 text-xs font-bold shadow-sm animate-in fade-in zoom-in duration-300">
                    <component :is="dynamicTimeInfo.icon" class="w-3.5 h-3.5" :class="dynamicTimeInfo.iconColor || 'text-primary-600'" />
                    <span>{{ dynamicTimeInfo.label }}</span>
                    <span class="font-mono tracking-tight">{{ dynamicTimeInfo.time }}</span>
                </div>
            </div>

            <!-- Location + Title Section -->
            <div class="w-full px-2 mt-0">
                <!-- Location & Time Tags Row -->
                <div class="flex justify-start items-center gap-2 mb-2">
                    <!-- Location Tag -->
                    <div class="inline-flex items-center gap-1 px-3 py-1 bg-white/70 text-primary-800 rounded-full backdrop-blur-md border border-white/60 text-xs font-bold shadow-sm">
                        <MapPin class="w-3 h-3 text-emerald-600" />
                        <span>{{ formattedLocation }}</span>
                    </div>


                </div>
                
                <!-- Title (Centered) - Fixed Height Container -->
                <div class="flex items-center justify-center w-full mb-1 h-14">
                    <h2 :class="titleClass" class="font-black text-primary-900 tracking-tight leading-none text-center drop-shadow-sm whitespace-nowrap overflow-hidden text-ellipsis w-full">
                         {{ trip.campsites?.name || trip.campsite_name }}
                    </h2>
                </div>
            </div>
            <span class="text-lg md:text-xl font-bold text-primary-800 font-mono tracking-tight opacity-80 z-20 mb-2">
                {{ dateRange }}
            </span>

            <!-- Countdown -->
            <div class="flex-1 flex flex-col items-center justify-center relative w-full px-20">
                <div class="leading-none font-black drop-shadow-sm tracking-tighter z-10 font-sans" 
                     :class="isPastTrip ? 'text-4xl md:text-7xl text-primary-400 opacity-60 py-6 md:py-9' : 'text-[5rem] md:text-[7rem] text-accent-sky'">
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

            <!-- Navigation (Explicit Buttons) - Full Height Hit Areas -->
            <div v-if="hasPrev" @click.stop="$emit('prev')" class="absolute left-0 top-0 bottom-0 w-20 z-30 cursor-pointer group/nav flex items-center justify-start pl-4">
                 <div class="p-2 md:p-3 bg-white/30 hover:bg-white/50 backdrop-blur-md rounded-full transition-all text-slate-500 shadow-lg border border-white/50 group-active/nav:scale-95">
                    <ChevronLeft class="w-6 h-6 md:w-10 md:h-10 drop-shadow-sm" />
                 </div>
            </div>
            <div v-if="hasNext" @click.stop="$emit('next')" class="absolute right-0 top-0 bottom-0 w-20 z-30 cursor-pointer group/nav flex items-center justify-end pr-4">
                 <div class="p-2 md:p-3 bg-white/30 hover:bg-white/50 backdrop-blur-md rounded-full transition-all text-slate-500 shadow-lg border border-white/50 group-active/nav:scale-95">
                    <ChevronRight class="w-6 h-6 md:w-10 md:h-10 drop-shadow-sm" />
                 </div>
            </div>
            
            <!-- Bottom Right Controls (Night Rush & Reset) -->
            <div class="absolute bottom-5 right-5 z-40 flex flex-col items-center gap-3 animate-fade-in-up">
                 <!-- Reset Button -->
                 <button 
                  v-if="showResetButton"
                  @click.stop="$emit('reset')"
                  class="group flex items-center justify-center w-10 h-10 rounded-full transition-all bg-white/80 backdrop-blur-md shadow-md border-2 border-white/50 text-primary-300 hover:text-primary-600 hover:scale-105 active:scale-95"
                  title="回本次行程"
                >
                  <RotateCcw class="w-5 h-5 transition-transform duration-500 group-hover:-rotate-180" />
                </button>

                 <!-- Night Rush Button -->
                 <button 
                  :disabled="isPastTrip"
                  @click.stop="toggleNightRush"
                  class="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-white/80 backdrop-blur-md shadow-md border-2 border-white/50 text-primary-300 hover:text-primary-600 hover:scale-105 active:scale-95"
                  :class="{ 'bg-indigo-400/30 border-indigo-300 text-indigo-600': trip.night_rush }"
                >
                  <Moon class="w-5 h-5" :class="{ '-rotate-12 fill-current': trip.night_rush }" />
                </button>
            </div>

            <!-- RPG Gear Slot (Bottom Left) -->
            <div class="absolute bottom-5 left-5 z-40 flex flex-col items-center gap-2 group/gear animate-fade-in-up">
                <!-- Label Tag -->
                <div class="px-2 py-0.5 backdrop-blur-md rounded text-[8px] font-black tracking-widest uppercase border shadow-sm transition-colors duration-300 bg-gray-900/60 text-white/90 border-white/20">
                    {{ trip.tent ? 'EQUIPPED' : 'NO GEAR' }}
                </div>
                
                <!-- Slot Container -->
                <div class="relative w-16 h-16 md:w-20 md:h-20 backdrop-blur-md rounded-xl border-[3px] shadow-xl overflow-hidden group-hover/gear:scale-105 transition-all duration-300 ring-1 bg-gradient-to-br from-black/20 to-black/40 border-white/30 ring-white/10 group-hover/gear:border-white/50">
                    
                    <!-- Rarity Shine -->
                    <div class="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-40"></div>
                    
                    <!-- Tent Image or Placeholder -->
                    <img v-if="trip.tent?.image_url" :src="trip.tent.image_url" class="w-full h-full object-contain p-1.5 drop-shadow-md relative z-10" />
                    <div v-else class="w-full h-full flex items-center justify-center relative z-10 p-4">
                         <Tent class="w-full h-full text-white/20" />
                    </div>

                    <!-- Product Name (In-Slot) -->
                    <div v-if="trip.tent?.name" class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent text-[8px] text-center text-white/95 pb-1 pt-3 font-bold truncate z-20">
                        {{ trip.tent.name }}
                    </div>
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

             <!-- Left: Weather Info or Placeholder -->
             <div class="flex items-center gap-2 sm:gap-4">
                 <template v-if="weatherSummary">
                     <div class="w-10 h-10 rounded-2xl bg-yellow-50 flex items-center justify-center text-yellow-500 shadow-sm border border-yellow-100">
                         <component :is="getWeatherIcon(weatherSummary.summary.code)" class="w-6 h-6" />
                     </div>
                     <div class="flex flex-col justify-center">
                         <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">溫度預測</div>
                         <div class="text-base sm:text-2xl font-black text-gray-800 leading-none whitespace-nowrap">
                             {{ weatherSummary.summary.temp_min }}° - {{ weatherSummary.summary.temp_max }}°
                         </div>
                     </div>
                     <!-- Packing Badge (Text Only) -->
                     <div v-if="packingStatus" class="ml-1 sm:ml-2 mr-auto flex flex-col justify-center">
                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">收帳預測</div>
                        <span class="text-base sm:text-2xl font-black leading-none whitespace-nowrap"
                              :class="{
                                'text-emerald-500': packingStatus.status === 'dry' || packingStatus.status === 'perfect',
                                'text-red-500': packingStatus.status === 'wet',
                                'text-orange-500': packingStatus.status === 'damp' || packingStatus.status === 'risk',
                                'text-yellow-500': packingStatus.status === 'drying' || packingStatus.status === 'chance',
                              }">
                           {{ packingStatus.label }}
                        </span>
                     </div>
                 </template>
                 <template v-else>
                     <div v-if="!isPastTrip" class="flex items-center gap-4">
                         <div class="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300 shadow-sm border border-gray-100">
                             <Calendar class="w-6 h-6" />
                         </div>
                         <div class="flex flex-col">
                             <span class="text-sm font-bold text-gray-400">接近日期顯示天氣</span>
                         </div>
                     </div>
                     <div v-else class="flex items-center gap-4">
                         <div class="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300 shadow-sm border border-gray-100">
                             <Calendar class="w-6 h-6" />
                         </div>
                         <div class="flex flex-col">
                             <span class="text-sm font-bold text-gray-400">過去行程無天氣資料</span>
                         </div>
                     </div>
                 </template>
             </div>

             <!-- Right: Amenities List (Always show if data exists) -->
             <div class="flex items-center gap-2 sm:gap-6 ml-auto pr-1 sm:pr-2" v-if="trip.campsites?.amenities">
                  <!-- Fridge -->
                  <div class="flex flex-col items-center gap-1 min-w-[24px] sm:min-w-[32px]">
                      <div class="relative w-5 h-5 sm:w-8 sm:h-8 flex items-center justify-center">
                          <Snowflake class="w-full h-full transition-opacity" :class="trip.campsites.amenities.has_fridge ? 'text-sky-500' : 'text-slate-300'" />
                          <div v-if="!trip.campsites.amenities.has_fridge" class="absolute w-[140%] h-[2px] bg-red-500/80 rotate-45 rounded-full z-10"></div>
                      </div>
                      <span class="text-[10px] sm:text-xs font-bold mt-0.5" :class="trip.campsites.amenities.has_fridge ? 'text-sky-700' : 'text-slate-400'">冷藏</span>
                  </div>
                  <!-- Freezer -->
                  <div class="flex flex-col items-center gap-1 min-w-[24px] sm:min-w-[32px]">
                      <div class="relative w-5 h-5 sm:w-8 sm:h-8 flex items-center justify-center">
                          <IceCream class="w-full h-full transition-opacity" :class="trip.campsites.amenities.has_freezer ? 'text-indigo-500' : 'text-slate-300'" />
                          <div v-if="!trip.campsites.amenities.has_freezer" class="absolute w-[140%] h-[2px] bg-red-500/80 rotate-45 rounded-full z-10"></div>
                      </div>
                      <span class="text-[10px] sm:text-xs font-bold mt-0.5" :class="trip.campsites.amenities.has_freezer ? 'text-indigo-700' : 'text-slate-400'">冷凍</span>
                  </div>
                  <!-- Water -->
                  <div class="flex flex-col items-center gap-1 min-w-[24px] sm:min-w-[32px]">
                      <div class="relative w-5 h-5 sm:w-8 sm:h-8 flex items-center justify-center">
                          <Droplets class="w-full h-full transition-opacity" :class="trip.campsites.amenities.has_water_dispenser ? 'text-teal-500' : 'text-slate-300'" />
                          <div v-if="!trip.campsites.amenities.has_water_dispenser" class="absolute w-[140%] h-[2px] bg-red-500/80 rotate-45 rounded-full z-10"></div>
                      </div>
                      <span class="text-[10px] sm:text-xs font-bold mt-0.5" :class="trip.campsites.amenities.has_water_dispenser ? 'text-teal-700' : 'text-slate-400'">飲水</span>
                  </div>
             </div>
        </div>
    </div>

    <!-- 3. CAMPSITE INFO (Separate Cards) -->
    <div>
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-4">CAMPSITE INFO</h3>
        <div class="grid grid-cols-2 gap-3">
             <!-- Zone Card -->
             <div class="bg-white rounded-[2rem] p-4 flex items-center gap-3 shadow-sm border border-gray-50 overflow-hidden">
                 <div class="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                     <Tent class="w-6 h-6" />
                 </div>
                 <div class="flex flex-col min-w-0">
                     <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">區域</span>
                     <div :class="zoneClass" class="font-black text-gray-800 truncate leading-tight">{{ trip.zone || '未指定' }}</div>
                 </div>
             </div>
             
             <!-- Companions Card -->
             <div class="bg-white rounded-[2rem] p-4 flex items-center gap-3 shadow-sm border border-gray-50 overflow-hidden">
                 <div class="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                     <Users class="w-6 h-6" />
                 </div>
                 <div class="flex flex-col min-w-0">
                     <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">露友</span>
                     <div :class="companionsClass" class="font-black text-gray-800 truncate leading-tight">{{ trip.companions || '無' }}</div>
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


