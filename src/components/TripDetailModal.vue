<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Calendar, MapPin, Mountain, CloudRain, Moon, Tent, X, Wind } from 'lucide-vue-next'
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

watch(() => props.isOpen, async (val) => {
  if (val && props.trip) {
    await nextTick()
    setTimeout(initMap, 100) // 延遲一下確保 DOM 已經 render
  }
})

// 當 trip 改變時也要更新地圖 (如果已經打開)
watch(() => props.trip, async (val) => {
  if (props.isOpen && val) {
    await nextTick()
    setTimeout(initMap, 100)
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
            
            <!-- 頂部圖片或裝飾 (如果有照片可以放，這裡暫時用漸層) -->
            <div class="h-32 w-full bg-gradient-to-r from-teal-400 to-blue-500 relative overflow-hidden">
               <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl"></div>
               <div class="absolute top-10 left-10 w-20 h-20 bg-white/20 rounded-full blur-xl"></div>
            </div>

            <button @click="emit('close')" class="absolute top-4 right-4 p-2 bg-black/20 text-white hover:bg-black/30 rounded-full backdrop-blur transition-all">
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

                <!-- 評分 (如果有的話) -->
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
</style>
