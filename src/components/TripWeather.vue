<script setup lang="ts">
import { toRef } from 'vue'
import { X, Calendar, Sun, Cloud, CloudRain, CloudSun } from 'lucide-vue-next'
import type { CampingTrip, CampingTripWithCampsite } from '../types/database'
import { useTripWeather } from '../composables/useTripWeather'

interface Props {
  trip: CampingTrip | CampingTripWithCampsite | null
  isOpen: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
}>()

// Use Shared Logic
const tripRef = toRef(props, 'trip')
const { 
  weatherDays, 
  packingStatus, 
  loading: loadingWeather, 
  error: weatherError,
  isPastTrip,
  selectedDay,
  selectDay,
  showDetailModal,
  closeModal
} = useTripWeather(tripRef)

// UI Helpers
const getWeatherIcon = (code: number) => {
  if (code <= 3) return Sun 
  if (code <= 48) return Cloud 
  if (code <= 67) return CloudRain 
  if (code <= 77) return CloudSun 
  if (code > 80) return CloudRain 
  return CloudSun
}


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
             class="flex-shrink-0 snap-start flex flex-col items-center justify-center min-w-[5rem] h-[5.5rem] rounded-2xl border transition-all duration-300 relative overflow-hidden group"
             :class="selectedDay?.date === day.date ? 'bg-primary-600 text-white shadow-lg border-primary-600' : 'bg-white text-primary-900 border-primary-100 hover:border-primary-300 hover:bg-surface-50'"
           >
              <!-- Date -->
              <span class="text-[10px] font-bold mb-1 opacity-80">{{ day.dateLabel }}</span>
              
              <!-- Icon -->
              <component :is="getWeatherIcon(day.summary.code)" class="w-7 h-7 mb-1 transition-transform group-hover:scale-110" :class="selectedDay?.date === day.date ? 'text-white' : 'text-accent-orange'" />
              
              <!-- Temp -->
              <span class="text-xs font-black">{{ day.summary.temp_min }}°-{{ day.summary.temp_max }}°</span>
              
              <!-- Tap Hint Indicator -->
              <div v-if="!showDetailModal" class="absolute bottom-1 w-1 h-1 rounded-full bg-current opacity-30"></div>
           </button>
        </div>

        <!-- Packing Status Bar (Rich Analysis) -->
        <div v-if="packingStatus" 
             class="flex items-center rounded-xl px-4 py-3 gap-3 border transition-colors shadow-sm"
             :class="{
                'bg-emerald-50 border-emerald-100': packingStatus.status === 'dry' || packingStatus.status === 'perfect',
                'bg-red-50 border-red-100': packingStatus.status === 'wet',
                'bg-orange-50 border-orange-100': packingStatus.status === 'damp',
                'bg-yellow-50 border-yellow-100': packingStatus.status === 'drying',
             }"
        >
             <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  :class="{
                     'bg-emerald-100/50 text-emerald-600': packingStatus.status === 'dry' || packingStatus.status === 'perfect',
                'bg-red-100/50 text-red-600': packingStatus.status === 'wet',
                'bg-orange-100/50 text-orange-600': packingStatus.status === 'damp' || packingStatus.status === 'risk',
                'bg-yellow-100/50 text-yellow-600': packingStatus.status === 'drying' || packingStatus.status === 'chance',
                  }"
             >
                <component :is="packingStatus.status === 'wet' || packingStatus.status === 'damp' ? CloudRain : Sun" class="w-5 h-5" />
             </div>
             
             <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                   <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/60 tracking-wide text-gray-600">
                     收帳預測
                   </span>
                   <span class="font-black text-sm tracking-tight"
                         :class="{
                            'text-emerald-800': packingStatus.status === 'dry' || packingStatus.status === 'perfect',
                            'text-red-800': packingStatus.status === 'wet',
                            'text-orange-800': packingStatus.status === 'damp',
                            'text-yellow-800': packingStatus.status === 'drying',
                         }"
                   >
                     {{ packingStatus.label }}
                   </span>
                </div>
                
                <p class="text-[11px] leading-snug font-medium opacity-90"
                   :class="{
                      'text-emerald-700': packingStatus.status === 'dry' || packingStatus.status === 'perfect',
                      'text-red-700': packingStatus.status === 'wet',
                      'text-orange-700': packingStatus.status === 'damp',
                      'text-yellow-700': packingStatus.status === 'drying',
                   }"
                >
                   {{ packingStatus.advice }}
                </p>
             </div>
        </div>

    </div>

    <!-- Too far in future -->
    <div v-else class="flex items-center justify-center bg-surface-50 px-6 py-3 rounded-2xl border border-primary-50 gap-3 w-full h-[4.5rem]">
         <Calendar class="w-5 h-5 text-primary-400 opacity-70" />
         <span class="text-sm font-bold text-primary-400 tracking-wide">接近出發日期時將顯示天氣</span>
    </div>

    <!-- Vertical Detail Modal -->
    <Teleport to="body">
      <div v-if="showDetailModal && selectedDay" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="closeModal"></div>
          
          <!-- Modal Card -->
          <div class="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh] animate-fade-in-up overflow-hidden">
              
              <!-- Header -->
              <div class="flex items-center justify-between p-5 border-b border-gray-100 bg-white z-10">
                  <div class="flex items-center gap-3">
                     <div class="text-2xl font-black text-primary-900">{{ selectedDay.dateLabel }}</div>
                     <div class="text-sm font-medium text-gray-500">{{ selectedDay.fullDateLabel.split(' ')[1] }}</div>
                  </div>
                  <button @click="closeModal" class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
                      <X class="w-5 h-5" />
                  </button>
              </div>

              <!-- Body: Vertical List -->
              <div class="overflow-y-auto p-4 space-y-2 flex-1 scroll-smooth">
                 <div v-for="hour in selectedDay.hours" :key="hour.timestamp"
                      class="flex items-center justify-between p-3 rounded-2xl transition-all"
                      :class="hour.isValid ? 'bg-surface-50 border border-primary-50' : 'bg-gray-50 opacity-60 grayscale'"
                 >
                     <!-- Left: Time -->
                     <div class="flex items-center gap-3">
                        <div class="text-sm font-bold w-12 text-center" :class="hour.isValid ? 'text-primary-800' : 'text-gray-400'">
                           {{ hour.time }}
                        </div>
                        <div v-if="hour.isValid" class="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
                     </div>
                     
                     <!-- Center: Details -->
                     <div class="flex-1 flex flex-col items-center justify-center gap-0.5">
                        <component :is="getWeatherIcon(hour.code)" class="w-8 h-8" :class="hour.isValid ? 'text-accent-orange' : 'text-gray-400'" />
                        <!-- Rain Probability -->
                        <div v-if="hour.pop > 0" class="flex items-center gap-1 text-[10px] font-bold text-blue-500">
                           <CloudRain class="w-3 h-3" />
                           <span>{{ hour.pop }}%</span>
                        </div>
                        <!-- Rain Amount -->
                         <div v-if="hour.rain > 0" class="text-[9px] text-blue-400 font-mono">
                           {{ hour.rain }}mm
                        </div>
                        <!-- Humidity -->
                        <div class="flex items-center gap-1 text-[9px] text-gray-400">
                           <span>💧</span>
                           <span>{{ hour.humidity }}%</span>
                        </div>
                     </div>
                     
                     <!-- Right: Temp -->
                     <div class="text-lg font-black w-12 text-right" :class="hour.isValid ? 'text-primary-900' : 'text-gray-500'">
                        {{ Math.round(hour.temp) }}°
                     </div>
                 </div>
              </div>
          </div>
      </div>
    </Teleport>

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
