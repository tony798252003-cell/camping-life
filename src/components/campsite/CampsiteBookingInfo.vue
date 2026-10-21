<script setup lang="ts">
import { ref } from 'vue'
import {
  PLAYGROUND_OPTIONS,
  WATER_OPTIONS,
  SCENERY_OPTIONS,
  SPOT_TYPE_OPTIONS,
  BOOKING_METHOD_OPTIONS,
} from '../../constants/campsiteOptions'
import type { Campsite } from '../../types/database'

const props = defineProps<{
  form: Partial<Campsite>
  isEditable?: boolean
}>()

const isFacilityOpen = ref(true)
</script>

<template>
         <!-- 設施與訂位資訊 Accordion -->
         <div class="border border-gray-200 rounded-xl overflow-hidden mb-4">
           <button
             type="button"
             @click="isFacilityOpen = !isFacilityOpen"
             class="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
           >
             <span class="font-bold text-primary-900 text-sm">設施與訂位資訊</span>
             <svg
               class="w-4 h-4 text-gray-500 transition-transform"
               :class="{ 'rotate-180': isFacilityOpen }"
               fill="none" viewBox="0 0 24 24" stroke="currentColor"
             >
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
             </svg>
           </button>

           <div v-show="isFacilityOpen" class="p-4 space-y-5">
            <template v-if="isEditable">

             <!-- 遊樂設施 -->
             <div>
               <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">遊樂設施</p>
               <div class="flex flex-wrap gap-2">
                 <label
                   v-for="opt in PLAYGROUND_OPTIONS"
                   :key="opt"
                   class="flex items-center gap-1.5 cursor-pointer"
                 >
                   <input
                     type="checkbox"
                     :value="opt"
                     v-model="form.playground_features"
                     class="w-4 h-4 rounded accent-sky-500"
                   />
                   <span class="text-sm text-gray-700">{{ opt }}</span>
                 </label>
               </div>
             </div>

             <!-- 水域設施 -->
             <div>
               <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">水域設施</p>
               <div class="flex flex-wrap gap-2">
                 <label
                   v-for="opt in WATER_OPTIONS"
                   :key="opt"
                   class="flex items-center gap-1.5 cursor-pointer"
                 >
                   <input
                     type="checkbox"
                     :value="opt"
                     v-model="form.water_features"
                     class="w-4 h-4 rounded accent-sky-500"
                   />
                   <span class="text-sm text-gray-700">{{ opt }}</span>
                 </label>
               </div>
             </div>

             <!-- 自然景觀 -->
             <div>
               <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">自然景觀</p>
               <div class="flex flex-wrap gap-2">
                 <label
                   v-for="opt in SCENERY_OPTIONS"
                   :key="opt"
                   class="flex items-center gap-1.5 cursor-pointer"
                 >
                   <input
                     type="checkbox"
                     :value="opt"
                     v-model="form.scenery_features"
                     class="w-4 h-4 rounded accent-sky-500"
                   />
                   <span class="text-sm text-gray-700">{{ opt }}</span>
                 </label>
               </div>
             </div>

             <!-- 營位類型 -->
             <div>
               <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">營位類型</p>
               <div class="flex flex-wrap gap-2">
                 <label
                   v-for="opt in SPOT_TYPE_OPTIONS"
                   :key="opt"
                   class="flex items-center gap-1.5 cursor-pointer"
                 >
                   <input
                     type="checkbox"
                     :value="opt"
                     v-model="form.spot_types"
                     class="w-4 h-4 rounded accent-sky-500"
                   />
                   <span class="text-sm text-gray-700">{{ opt }}</span>
                 </label>
               </div>
             </div>

             <hr class="border-gray-100" />

             <!-- 訂位資訊 -->
             <div class="space-y-3">
               <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">訂位資訊</p>

               <!-- 訂位方式 -->
               <div>
                 <p class="text-sm text-gray-600 mb-1.5">訂位方式</p>
                 <div class="flex flex-wrap gap-3">
                   <label
                     v-for="opt in BOOKING_METHOD_OPTIONS"
                     :key="opt"
                     class="flex items-center gap-1.5 cursor-pointer"
                   >
                     <input
                       type="checkbox"
                       :value="opt"
                       v-model="form.booking_method"
                       class="w-4 h-4 rounded accent-sky-500"
                     />
                     <span class="text-sm text-gray-700">{{ opt }}</span>
                   </label>
                 </div>
               </div>

               <!-- 可訂到期日 + 訂位規則 -->
               <div class="grid grid-cols-2 gap-3">
                 <div>
                   <label class="block text-sm text-gray-600 mb-1">可訂到期日</label>
                   <input
                     v-model="form.booking_available_until"
                     type="date"
                     class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent-sky outline-none"
                   />
                 </div>
                 <div>
                   <label class="block text-sm text-gray-600 mb-1">訂位規則說明</label>
                   <input
                     v-model="form.booking_timing"
                     type="text"
                     placeholder="例：每月1號、年底"
                     class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent-sky outline-none"
                   />
                 </div>
               </div>

               <!-- 搶位難度 -->
               <div>
                 <label class="block text-sm text-gray-600 mb-1.5">搶位難度</label>
                 <div class="flex gap-4">
                   <label class="flex items-center gap-1.5 cursor-pointer">
                     <input type="radio" value="normal" v-model="form.booking_difficulty" class="accent-sky-500" />
                     <span class="text-sm text-gray-700">不難</span>
                   </label>
                   <label class="flex items-center gap-1.5 cursor-pointer">
                     <input type="radio" value="moderate" v-model="form.booking_difficulty" class="accent-orange-500" />
                     <span class="text-sm text-gray-700">稍難搶</span>
                   </label>
                   <label class="flex items-center gap-1.5 cursor-pointer">
                     <input type="radio" value="hard" v-model="form.booking_difficulty" class="accent-red-500" />
                     <span class="text-sm text-gray-700">需要搶</span>
                   </label>
                 </div>
               </div>

               <!-- 推薦營位 -->
               <div>
                 <label class="block text-sm text-gray-600 mb-1">推薦營位</label>
                 <input
                   v-model="form.recommended_spots"
                   type="text"
                   placeholder="例：A1、B2~B5"
                   class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent-sky outline-none"
                 />
               </div>

               <!-- 其他備注 -->
               <div>
                 <label class="block text-sm text-gray-600 mb-1">其他備注</label>
                 <textarea
                   v-model="form.campsite_notes"
                   rows="3"
                   placeholder="其他資訊..."
                   class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent-sky outline-none resize-none"
                 />
               </div>
             </div>
            </template>
            <template v-else>
              <div class="space-y-3 text-sm text-gray-700">
                <div v-if="form.scenery_features?.length">
                  <span class="text-xs text-gray-400 font-bold uppercase tracking-wide">景觀　</span>
                  <span v-for="t in form.scenery_features" :key="t" class="inline-block bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full text-xs mr-1 mb-1">{{ t }}</span>
                </div>
                <div v-if="form.water_features?.length">
                  <span class="text-xs text-gray-400 font-bold uppercase tracking-wide">水域　</span>
                  <span v-for="t in form.water_features" :key="t" class="inline-block bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full text-xs mr-1 mb-1">{{ t }}</span>
                </div>
                <div v-if="form.playground_features?.length">
                  <span class="text-xs text-gray-400 font-bold uppercase tracking-wide">遊樂　</span>
                  <span v-for="t in form.playground_features" :key="t" class="inline-block bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded-full text-xs mr-1 mb-1">{{ t }}</span>
                </div>
                <div v-if="form.spot_types?.length">
                  <span class="text-xs text-gray-400 font-bold uppercase tracking-wide">營位　</span>
                  <span v-for="t in form.spot_types" :key="t" class="inline-block bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-xs mr-1 mb-1">{{ t }}</span>
                </div>
                <div v-if="form.booking_method?.length || form.booking_timing">
                  <span class="text-xs text-gray-400 font-bold uppercase tracking-wide block mb-1">訂位</span>
                  <div class="text-xs text-gray-600 space-y-0.5">
                    <div v-if="form.booking_method?.length">訂位方式：{{ form.booking_method.join('、') }}</div>
                    <div v-if="form.booking_timing">規則：{{ form.booking_timing }}</div>
                    <div v-if="form.booking_available_until">可訂到：{{ form.booking_available_until }}</div>
                    <div v-if="form.booking_difficulty && form.booking_difficulty !== 'normal'">
                      難度：<span :class="form.booking_difficulty === 'hard' ? 'text-red-600 font-bold' : 'text-orange-500'">
                        {{ form.booking_difficulty === 'hard' ? '需要搶' : '稍難搶' }}
                      </span>
                    </div>
                  </div>
                </div>
                <div v-if="form.recommended_spots">
                  <span class="text-xs text-gray-400 font-bold uppercase tracking-wide">推薦營位　</span>{{ form.recommended_spots }}
                </div>
                <div v-if="form.campsite_notes">
                  <span class="text-xs text-gray-400 font-bold uppercase tracking-wide">備注　</span>{{ form.campsite_notes }}
                </div>
                <p v-if="!form.scenery_features?.length && !form.water_features?.length && !form.playground_features?.length && !form.spot_types?.length && !form.recommended_spots && !form.campsite_notes" class="text-gray-400 text-xs">尚無設施資訊</p>
              </div>
            </template>

           </div>
         </div>
</template>
