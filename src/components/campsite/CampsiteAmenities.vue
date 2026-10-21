<script setup lang="ts">
import { Snowflake, IceCream, Droplets } from 'lucide-vue-next'
import type { Campsite } from '../../types/database'

const props = defineProps<{
  form: Partial<Campsite>
  isEditable?: boolean
}>()
</script>

<template>
         <!-- Amenities (v2) -->
         <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">營地設施</label>
            
            <div v-if="isEditable" class="grid grid-cols-2 gap-3">
               <!-- Checkboxes for Edit -->
               <div class="flex items-center gap-2">
                  <input type="checkbox" v-model="form.amenities!.has_fridge" class="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
                  <span class="text-sm text-gray-700">冰箱 (冷藏)</span>
               </div>
               <div class="flex items-center gap-2">
                  <input type="checkbox" v-model="form.amenities!.has_freezer" class="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
                  <span class="text-sm text-gray-700">冷凍櫃</span>
               </div>
               <div class="flex items-center gap-2">
                  <input type="checkbox" v-model="form.amenities!.has_water_dispenser" class="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
                  <span class="text-sm text-gray-700">飲水機</span>
               </div>
            </div>
            
            <div v-else class="flex flex-wrap gap-4 py-1">
               <!-- Read-Only Icons -->
               <div :class="{'opacity-100 text-blue-700': form.amenities?.has_fridge, 'opacity-30 text-gray-400': !form.amenities?.has_fridge}" class="flex flex-col items-center gap-1">
                  <div class="p-2 rounded-full bg-gray-100"><Snowflake class="w-5 h-5" /></div>
                  <span class="text-[10px] font-bold">冰箱</span>
               </div>
               <div :class="{'opacity-100 text-blue-700': form.amenities?.has_freezer, 'opacity-30 text-gray-400': !form.amenities?.has_freezer}" class="flex flex-col items-center gap-1">
                  <div class="p-2 rounded-full bg-gray-100"><IceCream class="w-5 h-5" /></div>
                  <span class="text-[10px] font-bold">冷凍</span>
               </div>
               <div :class="{'opacity-100 text-cyan-600': form.amenities?.has_water_dispenser, 'opacity-30 text-gray-400': !form.amenities?.has_water_dispenser}" class="flex flex-col items-center gap-1">
                  <div class="p-2 rounded-full bg-gray-100"><Droplets class="w-5 h-5" /></div>
                  <span class="text-[10px] font-bold">飲水機</span>
               </div>
            </div>
         </div>
</template>
