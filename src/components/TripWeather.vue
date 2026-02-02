<script setup lang="ts">
import { toRef, ref, computed } from 'vue'
import { X, Calendar, Sun, CloudRain, Wind, List, TrendingUp } from 'lucide-vue-next'
import type { CampingTrip, CampingTripWithCampsite } from '../types/database'
import { useTripWeather } from '../composables/useTripWeather'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

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
import { getSmartWeatherIcon } from '../utils/weatherHelpers'

const getWeatherIcon = (code: number, pop: number = 0) => {
  return getSmartWeatherIcon(code, pop)
}
// Chart Logic
const viewMode = ref<'list' | 'chart'>('list')
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      titleColor: '#1f2937',
      bodyColor: '#4b5563',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      padding: 10,
      displayColors: true,
      callbacks: {
        label: function(context: any) {
            return context.dataset.label + ': ' + context.parsed.y
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        font: {
          size: 10
        },
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 6
      }
    },
    y: {
      display: false,
      grid: {
        display: false
      }
    }
  },
  elements: {
    point: {
      radius: 0,
      hitRadius: 10,
      hoverRadius: 4
    },
    line: {
      tension: 0.4
    }
  }
} as const

const chartDataTemp = computed(() => {
  if (!selectedDay.value) return { labels: [], datasets: [] }
  
  const labels = selectedDay.value.hours.map(h => h.time.split(':')[0])
  const data = selectedDay.value.hours.map(h => h.temp)
  
  return {
    labels,
    datasets: [{
      label: '溫度 (°C)',
      data,
      borderColor: '#f97316', // Orange 500
      backgroundColor: (context: any) => {
        const ctx = context.chart.ctx
        const gradient = ctx.createLinearGradient(0, 0, 0, 200)
        gradient.addColorStop(0, 'rgba(249, 115, 22, 0.4)')
        gradient.addColorStop(1, 'rgba(249, 115, 22, 0.0)')
        return gradient
      },
      fill: true
    }]
  }
})

const chartDataHumRain = computed(() => {
  if (!selectedDay.value) return { labels: [], datasets: [] }
  
  const labels = selectedDay.value.hours.map(h => h.time.split(':')[0])
  
  return {
    labels,
    datasets: [
      {
        label: '濕度 (%)',
        data: selectedDay.value.hours.map(h => h.humidity),
        borderColor: '#3b82f6', // Blue 500
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        yAxisID: 'y'
      },
      {
        label: '降雨機率 (%)',
        data: selectedDay.value.hours.map(h => h.pop),
        borderColor: '#06b6d4', // Cyan 500
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0
      }
    ]
  }
})

const chartDataWind = computed(() => {
  if (!selectedDay.value) return { labels: [], datasets: [] }
  
  const labels = selectedDay.value.hours.map(h => h.time.split(':')[0])
  
  return {
    labels,
    datasets: [{
      label: '風速 (km/h)',
      data: selectedDay.value.hours.map(h => h.windSpeed),
      borderColor: '#64748b', // Slate 500
      backgroundColor: (context: any) => {
        const ctx = context.chart.ctx
        const gradient = ctx.createLinearGradient(0, 0, 0, 200)
        gradient.addColorStop(0, 'rgba(100, 116, 139, 0.4)')
        gradient.addColorStop(1, 'rgba(100, 116, 139, 0.0)')
        return gradient
      },
      fill: true
    }]
  }
})


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
              <component :is="getWeatherIcon(day.summary.code, day.summary.max_pop)" class="w-7 h-7 mb-1 transition-transform group-hover:scale-110" :class="selectedDay?.date === day.date ? 'text-white' : 'text-accent-orange'" />
              
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

    <Teleport to="body">
      <div v-if="showDetailModal && selectedDay" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="closeModal"></div>
          
          <!-- Modal Card -->
          <div class="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh] animate-fade-in-up overflow-hidden">
              
              <!-- Header -->
              <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white z-10">
                  <div>
                      <div class="text-2xl font-black text-primary-900 tracking-tight flex items-baseline gap-2">
                          {{ selectedDay.dateLabel }}
                          <span class="text-base font-bold text-gray-400">{{ selectedDay.fullDateLabel.split(' ')[1] }}</span>
                      </div>
                      <div class="text-xs font-bold text-gray-400 mt-0.5 flex gap-2">
                          <span>最高 {{ selectedDay.summary.temp_max }}°</span>
                          <span>最低 {{ selectedDay.summary.temp_min }}°</span>
                      </div>
                  </div>
                  <button @click="closeModal" class="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                      <X class="w-5 h-5" />
                  </button>
              </div>

              <!-- View Toggles -->
              <div class="px-6 py-2 bg-white flex gap-2 border-b border-gray-50">
                  <button 
                    @click="viewMode = 'list'"
                    class="flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    :class="viewMode === 'list' ? 'bg-primary-50 text-primary-700' : 'bg-transparent text-gray-400 hover:bg-gray-50'"
                  >
                      <List class="w-3.5 h-3.5" /> 列表
                  </button>
                  <button 
                    @click="viewMode = 'chart'"
                    class="flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    :class="viewMode === 'chart' ? 'bg-primary-50 text-primary-700' : 'bg-transparent text-gray-400 hover:bg-gray-50'"
                  >
                      <TrendingUp class="w-3.5 h-3.5" /> 趨勢圖
                  </button>
              </div>

              <!-- Content: List View -->
              <div v-if="viewMode === 'list'" class="flex flex-col flex-1 overflow-hidden">
                <!-- Column Headers -->
                <div class="grid grid-cols-[3.5rem_1fr_1fr_1fr_1fr] px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center z-10">
                    <div class="text-left pl-2">時間</div>
                    <div>溫度</div>
                    <div>降雨</div>
                    <div>濕度</div>
                    <div>風速</div>
                </div>

                <!-- Body: Vertical List -->
                <div class="overflow-y-auto p-4 space-y-2 flex-1 scroll-smooth bg-gray-50/30">
                   <div v-for="hour in selectedDay.hours" :key="hour.timestamp"
                        class="grid grid-cols-[3.5rem_1fr_1fr_1fr_1fr] items-center p-3 rounded-2xl transition-all border group"
                        :class="hour.isValid 
                          ? 'bg-white border-gray-100 shadow-sm' 
                          : 'bg-transparent border-transparent opacity-40 grayscale hover:bg-white hover:opacity-80 hover:shadow-sm'"
                   >
                       <!-- Time -->
                       <div class="flex flex-col items-start gap-0.5 pl-1">
                          <span class="text-sm font-black tracking-tight" :class="hour.isValid ? 'text-primary-900' : 'text-gray-400'">
                             {{ hour.time.split(':')[0] }}<span class="text-[10px] opacity-60 font-bold">:00</span>
                          </span>
                           <!-- Icon -->
                           <component :is="getWeatherIcon(hour.code, hour.pop)" class="w-5 h-5" :class="hour.isValid ? 'text-accent-orange' : 'text-gray-400'" />
                       </div>
                       
                       <!-- Temp -->
                       <div class="flex flex-col items-center justify-center">
                          <span class="text-base font-black tracking-tighter" :class="hour.isValid ? 'text-primary-900' : 'text-gray-500'">
                             {{ Math.round(hour.temp) }}°
                          </span>
                       </div>
                       
                       <!-- Rain -->
                       <div class="flex flex-col items-center justify-center">
                          <div v-if="hour.pop > 0" class="flex flex-col items-center leading-none">
                              <div class="flex items-center gap-0.5 text-xs font-bold text-blue-500">
                                  <CloudRain class="w-3 h-3" />
                                  <span>{{ hour.pop }}%</span>
                              </div>
                              <span v-if="hour.rain > 0" class="text-[9px] text-blue-300 font-mono mt-0.5">{{ hour.rain }}mm</span>
                          </div>
                          <span v-else class="text-[10px] text-gray-300 font-bold">-</span>
                       </div>

                       <!-- Humidity -->
                       <div class="flex flex-col items-center justify-center gap-0.5">
                          <div class="flex items-center gap-1 text-sm font-bold text-gray-600">
                               <span class="text-xs text-blue-400">💧</span>
                               {{ hour.humidity }}
                               <span class="text-[9px] text-gray-400">%</span>
                          </div>
                       </div>

                       <!-- Wind -->
                       <div class="flex flex-col items-center justify-center gap-0.5">
                          <div class="flex items-center gap-1 text-sm font-bold text-gray-600">
                               <Wind class="w-3.5 h-3.5 text-gray-400" />
                               {{ Math.round(hour.windSpeed) }}
                               <span class="text-[9px] text-gray-400">km</span>
                          </div>
                       </div>
                   </div>
                </div>
              </div>

              <!-- Content: Chart View -->
              <div v-else class="flex flex-col flex-1 overflow-y-auto bg-gray-50/30 p-4 gap-6">
                 
                 <!-- Temps Chart -->
                 <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                     <h4 class="text-xs font-bold text-orange-500 mb-3 flex items-center gap-1">
                        <Sun class="w-3.5 h-3.5" /> 氣溫趨勢
                     </h4>
                     <div class="h-32 w-full">
                         <Line :data="chartDataTemp" :options="chartOptions" />
                     </div>
                 </div>

                 <!-- Humidity/Rain Chart -->
                 <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                     <h4 class="text-xs font-bold text-blue-500 mb-3 flex items-center gap-1">
                        <CloudRain class="w-3.5 h-3.5" /> 濕度與降雨
                     </h4>
                     <div class="h-32 w-full">
                         <Line :data="chartDataHumRain" :options="chartOptions" />
                     </div>
                 </div>

                 <!-- Wind Chart -->
                 <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                     <h4 class="text-xs font-bold text-slate-500 mb-3 flex items-center gap-1">
                        <Wind class="w-3.5 h-3.5" /> 風速預測
                     </h4>
                     <div class="h-32 w-full">
                         <Line :data="chartDataWind" :options="chartOptions" />
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
