<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { ZONE_TYPE_OPTIONS } from '../../constants/campsiteOptions'
import type { Campsite } from '../../types/database'

const props = defineProps<{
  form: Partial<Campsite>
  isEditable?: boolean
}>()
</script>

<template>
    <div class="space-y-5">
         <!-- Zone Config -->
         <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">營位配置說明</label>
            <textarea v-if="isEditable" v-model="form.zone_config" rows="3" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"></textarea>
            <div v-else class="text-gray-800 whitespace-pre-wrap leading-relaxed py-1">{{ form.zone_config || '無說明' }}</div>
         </div>

         <!-- Capacity Zones -->
         <div>
            <div class="flex items-center justify-between mb-2">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider">營區帳數</label>
               <span v-if="(form.capacity_zones?.length ?? 0) > 0" class="text-xs text-gray-400">
                 共 {{ (form.capacity_zones ?? []).reduce((s, z) => s + z.tents, 0) }} 帳
               </span>
            </div>

            <!-- Edit Mode -->
            <div v-if="isEditable" class="space-y-2">
               <div
                 v-for="(zone, idx) in (form.capacity_zones ?? [])"
                 :key="idx"
                 class="flex items-center gap-2"
               >
                 <input
                   v-model="zone.name"
                   placeholder="區域名稱（選填）"
                   class="flex-1 min-w-0 p-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                 />
                 <select
                   v-model="zone.type"
                   class="w-20 p-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                 >
                   <option v-for="t in ZONE_TYPE_OPTIONS" :key="t" :value="t">{{ t }}</option>
                 </select>
                 <input
                   v-model.number="zone.tents"
                   type="number"
                   min="1"
                   placeholder="帳"
                   class="w-16 p-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-center"
                 />
                 <span class="text-xs text-gray-400 flex-shrink-0">帳</span>
                 <button @click="form.capacity_zones!.splice(idx, 1)" class="text-red-400 hover:text-red-600 flex-shrink-0">
                   <Trash2 class="w-4 h-4" />
                 </button>
               </div>
               <button
                 @click="form.capacity_zones = [...(form.capacity_zones ?? []), { name: '', type: '草地', tents: 1 }]"
                 class="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-primary-400 hover:text-primary-500 transition flex items-center justify-center gap-1"
               >
                 <Plus class="w-4 h-4" /> 新增區域
               </button>
            </div>

            <!-- Read-Only Mode -->
            <div v-else>
               <div v-if="(form.capacity_zones?.length ?? 0) === 0" class="text-gray-400 text-sm py-1">未設定</div>
               <div v-else class="flex flex-wrap gap-2 py-1">
                 <span
                   v-for="(zone, idx) in form.capacity_zones"
                   :key="idx"
                   class="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm"
                 >
                   <span v-if="zone.name" class="font-medium">{{ zone.name }} </span>
                   <span class="text-gray-500 text-xs">{{ zone.type }}</span>
                   <span class="font-bold ml-1">{{ zone.tents }}帳</span>
                 </span>
               </div>
            </div>
         </div>
    </div>
</template>
