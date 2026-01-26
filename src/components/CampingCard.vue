<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { MapPin, Trash2, AlertCircle, Clock } from 'lucide-vue-next'
import type { CampingTrip, CampingTripWithCampsite } from '../types/database'
import { useTravelTime } from '../composables/useTravelTime'

const props = defineProps<{
  trip: CampingTripWithCampsite
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'edit', trip: CampingTrip): void
  (e: 'delete', id: number): void
}>()

const { travelTime, fetchTravelTime } = useTravelTime()

const isFuture = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(props.trip.trip_date as string) >= today
})

const isMissingCoords = computed(() => {
  return !(props.trip.campsites?.latitude ?? props.trip.latitude) || !(props.trip.campsites?.longitude ?? props.trip.longitude)
})

onMounted(() => {
  const lat = props.trip.campsites?.latitude ?? props.trip.latitude
  const lng = props.trip.campsites?.longitude ?? props.trip.longitude
  
  if (lat && lng) {
    fetchTravelTime(
      lat, 
      lng, 
      props.trip.start_latitude ?? undefined, 
      props.trip.start_longitude ?? undefined
    )
  }
})

</script>

<template>
  <div 
    class="group card-organic mb-4 cursor-pointer overflow-hidden border-l-4 relative"
    :class="[
      isFuture ? 'border-l-accent-orange' : 'border-l-primary-200 opacity-80 hover:opacity-100',
      isMissingCoords ? 'ring-1 ring-red-100' : ''
    ]"
    @click="$emit('click')"
  >
    <!-- Missing Coords Flag -->
    <div 
      v-if="isMissingCoords" 
      class="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-bl-lg shadow-sm z-20 flex items-center gap-1 animate-pulse"
    >
      <AlertCircle class="w-2.5 h-2.5" />
      無經緯度
    </div>

    <div class="flex items-center p-3 md:p-5 gap-3 md:gap-5">
      
      <!-- 左側：日期區塊 -->
      <div class="flex-shrink-0 flex flex-col items-center justify-center bg-surface-50 rounded-2xl w-14 h-14 md:w-16 md:h-16 border border-primary-100 group-hover:bg-white group-hover:scale-105 transition-all duration-300 shadow-sm">
        <span class="text-[10px] md:text-xs font-bold tracking-wider text-primary-400 group-hover:text-primary-500">
           {{ new Date(trip.trip_date).getMonth() + 1 }}月
        </span>
        <span class="text-xl md:text-2xl font-black text-primary-800 leading-none group-hover:text-primary-600 font-sans">
           {{ new Date(trip.trip_date).getDate() }}
        </span>
      </div>

      <!-- 中間：資訊區塊 -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
           <h3 class="text-base md:text-lg font-bold text-primary-900 truncate tracking-tight">{{ trip.campsites?.name || trip.campsite_name }}</h3>
           
           <!-- 標籤小圓點 -->
           <div class="flex gap-1 flex-shrink-0" v-if="trip.is_rainy || trip.is_windy || trip.night_rush">
              <span v-if="trip.is_rainy" class="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-400 shadow-sm" title="下雨"></span>
              <span v-if="trip.night_rush" class="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-indigo-400 shadow-sm" title="夜衝"></span>
              <span v-if="trip.is_wet_tent" class="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-orange-400 shadow-sm" title="收濕帳"></span>
           </div>
        </div>
        
        <div class="flex flex-wrap items-center text-xs md:text-sm text-primary-500 gap-x-3 gap-y-1 font-medium">
          <div class="flex items-center whitespace-nowrap">
            <MapPin class="w-3 h-3 md:w-3.5 md:h-3.5 mr-0.5 md:mr-1 text-primary-400" />
            <span class="truncate max-w-[80px] md:max-w-none">{{ trip.campsites?.city ? (trip.campsites.city + (trip.campsites.district || '')) : (trip.location || '未設定') }}</span>
          </div>

          <!-- Travel Time Estimate (LIST VIEW) -->
          <div v-if="travelTime" class="flex items-center whitespace-nowrap text-blue-500 font-bold">
            <Clock class="w-3 h-3 md:w-3.5 md:h-3.5 mr-0.5 md:mr-1" />
            {{ travelTime }}
          </div>

          <div v-if="(trip.campsites?.altitude ?? trip.altitude)" class="flex items-center whitespace-nowrap">
            <span class="mr-0.5 md:mr-1 text-primary-400">⛰</span>
            {{ (trip.campsites?.altitude ?? trip.altitude) }}m
          </div>
          <div class="text-primary-400 whitespace-nowrap">
             {{ trip.duration_days }} 天
          </div>
          <!-- 經緯度狀態小圖示 -->
          <div v-if="isMissingCoords" class="flex items-center text-red-400 font-bold">
            <AlertCircle class="w-3 h-3 mr-0.5" />
            缺GPS
          </div>
        </div>
      </div>

      <!-- 右側：操作按鈕 -->
      <div class="flex gap-1 md:gap-2 flex-shrink-0 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-0 md:translate-x-2 group-hover:translate-x-0">

        <button 
          @click.stop="$emit('delete', trip.id)"
          class="p-1.5 md:p-2 text-primary-400 hover:text-white hover:bg-red-500 rounded-lg md:rounded-xl transition-all shadow-sm hover:shadow-md"
          title="刪除"
        >
          <Trash2 class="w-3.5 h-3.5 md:w-4 md:h-4" />
        </button>
      </div>

    </div>
  </div>
</template>
