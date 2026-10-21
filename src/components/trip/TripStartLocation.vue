<script setup lang="ts">
import { ref } from 'vue'
import { MapPin, ChevronRight } from 'lucide-vue-next'
import type { NewCampingTrip } from '../../types/database'
import PlaceSearchInput from '../settings/PlaceSearchInput.vue'

// 自訂本次出發地（預設收合）
const props = defineProps<{
  form: NewCampingTrip
  userProfile?: any
}>()

const isExpanded = ref(false)
const isEditing = ref(false)

const handlePlaceSelected = (place: any) => {
  // 存地點名稱（例如「台北車站」），不存完整地址
  props.form.start_location = place.name || place.formatted_address || ''
  props.form.start_latitude = place.lat
  props.form.start_longitude = place.lng
}
</script>

<template>
  <div>
                  <!-- Section Header: Basic Info -->
                  <div class="flex items-center justify-between mt-4 px-1 mb-2">
                     <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">CAMPSITE INFO</h3>
                     
                     <!-- Collapsible Start Location Trigger -->
                     <button type="button" @click="isExpanded = !isExpanded" class="flex items-center gap-1 text-[10px] bg-white border border-gray-100 px-2 py-1 rounded-full text-gray-500 hover:text-primary-600 transition-colors">
                        <MapPin class="w-3 h-3" />
                        <span class="max-w-[150px] truncate">
                           {{ form.start_location ? `自訂出發地：${form.start_location}` : '自訂出發地' }}
                        </span>
                        <ChevronRight class="w-3 h-3 transition-transform duration-300" :class="{'rotate-90': isExpanded}" />
                     </button>
                  </div>
                  
                  <!-- Collapsible Start Location Input -->
                  <div v-if="isExpanded" class="px-1 mb-4 animate-in slide-in-from-top-2 fade-in duration-200">
                     <div class="card-organic bg-white p-3 border-l-4 border-l-blue-400">
                        <div class="flex justify-between items-center mb-2">
                           <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">自訂本次出發地</label> 
                           <span v-if="userProfile?.location_name && !form.start_location" class="text-[10px] text-gray-400 truncate max-w-[150px]">
                              預設: {{ userProfile.location_name }}
                           </span>
                        </div>

                        <!-- 1. LOCKED VIEW: Show Selected Address -->
                        <div v-if="form.start_location && !isEditing" class="flex items-center justify-between bg-surface-50 rounded-xl p-2">
                           <div class="flex items-center gap-2 overflow-hidden">
                              <MapPin class="w-4 h-4 text-primary-500 shrink-0" />
                              <span class="text-sm font-bold text-gray-800 truncate">{{ form.start_location }}</span>
                           </div>
                           <div class="flex items-center gap-1 shrink-0">
                               <button type="button" @click="isEditing = true" class="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg text-xs font-medium transition-colors">修改</button>
                               <button 
                                 type="button" 
                                 @click="form.start_location = ''; form.start_latitude = undefined; form.start_longitude = undefined; isEditing = false"
                                 class="p-1.5 text-red-400 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors"
                               >
                                 清除
                               </button>
                           </div>
                        </div>

                        <!-- 2. SEARCH VIEW -->
                        <div v-else>
                           <PlaceSearchInput
                              v-model="form.start_location"
                              @place-selected="(p) => { handlePlaceSelected(p); isEditing = false }"
                              placeholder="輸入地址，轉換為本次出發座標..."
                           />
                           <div class="mt-2 flex justify-end" v-if="isEditing">
                               <button type="button" @click="isEditing = false" class="text-xs text-gray-400 hover:text-gray-600">取消</button>
                           </div>
                        </div>
                        
                        <p class="text-[10px] text-gray-400 mt-2 leading-relaxed">
                           若本次露營出發地非預設出發地，可在此設定。系統將依此計算路程與導航。
                        </p>
                     </div>
                  </div>
  </div>
</template>
