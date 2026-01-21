<script setup lang="ts">
import { computed } from 'vue'
import { MapPin, Edit, Trash2 } from 'lucide-vue-next'
import type { CampingTrip } from '../types/database'

const props = defineProps<{
  trip: CampingTrip
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'edit', trip: CampingTrip): void
  (e: 'delete', id: number): void
}>()

const isFuture = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(props.trip.trip_date as string) >= today
})

</script>

<template>
  <div 
    class="group bg-white rounded-2xl border border-gray-200 border-l-4 hover:border-l-primary-500 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden mb-3"
    :class="[isFuture ? 'border-l-primary-400' : 'border-l-gray-300']"
    @click="$emit('click')"
  >
    <div class="flex items-center p-4 gap-4">
      
      <!-- 左側：日期區塊 -->
      <div class="flex-shrink-0 flex flex-col items-center justify-center bg-gray-50 rounded-xl w-16 h-16 border border-gray-100 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
        <span class="text-xs font-bold tracking-wider text-gray-400 group-hover:text-primary-400">
           {{ new Date(trip.trip_date).getMonth() + 1 }}月
        </span>
        <span class="text-2xl font-black text-gray-800 leading-none group-hover:text-primary-700">
           {{ new Date(trip.trip_date).getDate() }}
        </span>
      </div>

      <!-- 中間：資訊區塊 -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
           <h3 class="text-lg font-bold text-gray-900 truncate">{{ trip.campsite_name }}</h3>
           
           <!-- 標籤小圓點 (如果有特殊屬性) -->
           <div class="flex gap-1" v-if="trip.is_rainy || trip.is_windy || trip.night_rush">
              <span v-if="trip.is_rainy" class="w-2 h-2 rounded-full bg-blue-400" title="下雨"></span>
              <span v-if="trip.night_rush" class="w-2 h-2 rounded-full bg-indigo-400" title="夜衝"></span>
              <span v-if="trip.is_wet_tent" class="w-2 h-2 rounded-full bg-orange-400" title="收濕帳"></span>
           </div>
        </div>
        
        <div class="flex items-center text-sm text-gray-500 gap-4">
          <div v-if="trip.location" class="flex items-center">
            <MapPin class="w-3.5 h-3.5 mr-1" />
            {{ trip.location }}
          </div>
          <div v-if="trip.altitude" class="flex items-center">
            <Mountain class="w-3.5 h-3.5 mr-1" />
            {{ trip.altitude }}m
          </div>
          <div class="text-gray-400">
             {{ trip.duration_days }} 天
          </div>
        </div>
      </div>

      <!-- 右側：操作按鈕 (Hover 顯示) -->
      <div class="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          @click.stop="emit('edit', trip)"
          class="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          title="編輯"
        >
          <Edit class="w-4 h-4" />
        </button>
        <button 
          @click.stop="emit('delete', trip.id)"
          class="p-2 text-gray-400 hover:text-accent-rose hover:bg-red-50 rounded-lg transition-colors"
          title="刪除"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>

    </div>
  </div>
</template>
