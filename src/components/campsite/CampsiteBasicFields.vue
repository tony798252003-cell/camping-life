<script setup lang="ts">
import { computed } from 'vue'
import { MapPin } from 'lucide-vue-next'
import { TAIWAN_LOCATIONS } from '../../constants/locations'
import type { Campsite } from '../../types/database'

const props = defineProps<{
  form: Partial<Campsite>
  isEditable?: boolean
}>()
const tagsString = defineModel<string>('tagsString', { required: true })

const availableDistricts = computed(() => {
  if (!props.form.city) return []
  const city = TAIWAN_LOCATIONS.find(c => c.id === props.form.city)
  return city ? city.districts : []
})

// Display Helpers
const formCityName = computed(() => {
  const c = TAIWAN_LOCATIONS.find(loc => loc.id === props.form.city)
  return c ? c.name : '未設定'
})

const formDistrictName = computed(() => {
  const c = TAIWAN_LOCATIONS.find(loc => loc.id === props.form.city)
  if (!c) return '未設定'
  const d = c.districts.find(dist => dist.id === props.form.district)
  return d ? d.name : '未設定'
})

// 縣市改變時清掉鄉鎮
const handleCityChange = () => {
  props.form.district = ''
}
</script>

<template>
    <div class="space-y-5">
         <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">名稱</label>
               <input v-if="isEditable" v-model="form.name" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
               <div v-else class="text-lg font-bold text-gray-900 px-1">{{ form.name }}</div>
            </div>

            <div class="col-span-1">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">縣市</label>
               <select 
                  v-if="isEditable"
                  v-model="form.city" 
                  @change="handleCityChange"
                  class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1.5em_1.5em]"
               >
                  <option value="" disabled>請選擇縣市</option>
                  <option v-for="city in TAIWAN_LOCATIONS" :key="city.id" :value="city.id">
                     {{ city.name }}
                  </option>
               </select>
               <div v-else class="text-gray-900 font-medium px-1">{{ formCityName }}</div>
            </div>
             <div class="col-span-1">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">鄉鎮</label>
               <select 
                  v-if="isEditable"
                  v-model="form.district" 
                  :disabled="!form.city"
                  class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-no-repeat bg-[right_0.5rem_center] bg-[length:1.5em_1.5em] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')]"
                  :class="{'opacity-50 cursor-not-allowed': !form.city}"
               >
                  <option value="" disabled>請選擇鄉鎮</option>
                   <option v-for="dist in availableDistricts" :key="dist.id" :value="dist.id">
                     {{ dist.name }}
                  </option>
               </select>
               <div v-else class="text-gray-900 font-medium px-1">{{ formDistrictName }}</div>
            </div>
            
            <div class="col-span-1">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">海拔 (m)</label>
               <input v-if="isEditable" v-model.number="form.altitude" type="number" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
               <div v-else class="text-gray-900 font-medium px-1">{{ form.altitude ? `${form.altitude}m` : '未設定' }}</div>
            </div>
            <div class="col-span-1">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">電話</label>
               <input v-if="isEditable" v-model="form.phone" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
               <div v-else class="text-gray-900 font-medium px-1 font-mono">{{ form.phone || '未設定' }}</div>
            </div>
         </div>

         <!-- Coordinates -->
         <div class="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div class="flex items-center justify-between mb-2">
               <h4 class="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1">
                  <MapPin class="w-3 h-3" /> GPS 座標
               </h4>
            </div>
            <div class="grid grid-cols-2 gap-3" v-if="isEditable">
               <div>
                  <label class="text-xs text-blue-600 block mb-1">緯度</label>
                  <input v-model.number="form.latitude" type="number" step="0.000001" class="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
               </div>
               <div>
                  <label class="text-xs text-blue-600 block mb-1">經度</label>
                  <input v-model.number="form.longitude" type="number" step="0.000001" class="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
               </div>
            </div>
            <div class="grid grid-cols-2 gap-3" v-else>
               <div>
                  <label class="text-xs text-blue-600/70 block mb-1">緯度</label>
                  <div class="text-blue-900 font-mono font-medium">{{ form.latitude || '未設定' }}</div>
               </div>
               <div>
                  <label class="text-xs text-blue-600/70 block mb-1">經度</label>
                  <div class="text-blue-900 font-mono font-medium">{{ form.longitude || '未設定' }}</div>
               </div>
            </div>
            <p v-if="(!form.latitude || !form.longitude) && isEditable" class="text-xs text-orange-600 mt-2 font-bold flex items-center gap-1">
               ⚠️ 尚未設定座標，無法使用地圖導航功能
            </p>
         </div>

         <!-- Tags -->
         <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">標籤</label>
            <input v-if="isEditable" v-model="tagsString" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="草地, 雲海, 戲水池" />
            <div v-else class="flex flex-wrap gap-2 mt-1">
               <span v-for="tag in (form.tags || [])" :key="tag" class="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">
                 {{ tag }}
               </span>
               <span v-if="(!form.tags || form.tags.length === 0)" class="text-gray-400 text-sm">無標籤</span>
            </div>
         </div>

    </div>
</template>
