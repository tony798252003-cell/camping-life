<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, MapPin, Loader2, Navigation } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { TAIWAN_LOCATIONS } from '../constants/locations'
import { parseTaiwanLocation } from '../utils/googleMaps'
import type { Campsite } from '../types/database'


const props = defineProps<{
  isOpen: boolean
  campsite: Campsite
}>()

const emit = defineEmits(['close', 'saved'])

const form = ref<Partial<Campsite>>({})
const isSaving = ref(false)
const isSearchingCoordinates = ref(false)
const tagsString = ref('') // Edit tags as comma-separated string for simplicity

const availableDistricts = computed(() => {
  if (!form.value.city) return []
  const city = TAIWAN_LOCATIONS.find(c => c.id === form.value.city)
  return city ? city.districts : []
})

// Reset district when city changes (unless it's the initial load)
const handleCityChange = () => {
  form.value.district = ''
}

watch(() => props.campsite, (newVal) => {
  if (newVal) {
    form.value = { ...newVal }
    tagsString.value = newVal.tags ? newVal.tags.join(', ') : ''
  }
}, { immediate: true })

const save = async () => {
  if (!form.value.id) return
  isSaving.value = true
  
  try {
    const updates = {
      ...form.value,
      tags: tagsString.value.split(/[,，]/).map(t => t.trim()).filter(Boolean)
    }
    
    // Remove protected fields
    delete (updates as any).id
    delete (updates as any).created_at
    delete (updates as any).created_by

    console.log('Sending updates:', updates)

    const { data, error } = await (supabase
      .from('campsites') as any)
      .update(updates)
      .eq('id', form.value.id)
      .select()

    if (error) throw error
    
    if (!data || data.length === 0) {
       throw new Error('更新失敗，可能沒有權限或找不到該筆資料 (RLS)')
    }

    console.log('Update success:', data)
    emit('saved')
    emit('close')
  } catch (e: any) {
    console.error('Update failed:', e)
    alert(`儲存失敗：${e.message || e.error_description || '未知錯誤'}`)
  } finally {
    isSaving.value = false
  }
}

const autoFetchCoordinates = () => {
  if (!form.value.name) return
  
  if (!window.google || !window.google.maps || !window.google.maps.places) {
    alert('Google Maps API 尚未載入，請稍後再試')
    return
  }

  isSearchingCoordinates.value = true
  
  // Use current city info to help search if available, otherwise just name
  const query = `${form.value.city || ''}${form.value.district || ''} ${form.value.name}`.trim()
  const service = new google.maps.places.PlacesService(document.createElement('div'))

  service.findPlaceFromQuery({
    query,
    fields: ['place_id', 'name', 'geometry']
  }, (results, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0] && results[0].place_id) {
       // Get Details to search for Address Components (City/District)
       service.getDetails({
         placeId: results[0].place_id,
         fields: ['name', 'geometry', 'address_components']
       }, (place, detailStatus) => {
          isSearchingCoordinates.value = false
          if (detailStatus === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
             const location = place.geometry.location
             form.value.latitude = location.lat()
             form.value.longitude = location.lng()
             
             // Extract City and District from address components
             if (place.address_components) {
                const { cityId, districtId } = parseTaiwanLocation(place.address_components as any)
                
                if (cityId) form.value.city = cityId
                if (districtId) form.value.district = districtId
             }
          } else {
             alert('無法取得詳細地點資訊')
          }
       })
    } else {
       isSearchingCoordinates.value = false
       alert('找不到此地點，請檢查名稱是否正確')
    }
  })
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
      
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <h3 class="font-bold text-gray-800">編輯營地資料</h3>
        <button @click="$emit('close')" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition">
           <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Form -->
      <div class="p-6 space-y-4 overflow-y-auto">
         
         <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">名稱</label>
               <input v-model="form.name" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>

            <div class="col-span-1">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">縣市</label>
               <select 
                  v-model="form.city" 
                  @change="handleCityChange"
                  class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1.5em_1.5em]"
               >
                  <option value="" disabled>請選擇縣市</option>
                  <option v-for="city in TAIWAN_LOCATIONS" :key="city.id" :value="city.id">
                     {{ city.name }}
                  </option>
               </select>
            </div>
             <div class="col-span-1">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">鄉鎮</label>
               <select 
                  v-model="form.district" 
                  :disabled="!form.city"
                  class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')]"
                  :class="{'opacity-50 cursor-not-allowed': !form.city, 'bg-no-repeat bg-[right_0.5rem_center] bg-[length:1.5em_1.5em]': form.city}"
               >
                  <option value="" disabled>請選擇鄉鎮</option>
                   <option v-for="dist in availableDistricts" :key="dist.id" :value="dist.id">
                     {{ dist.name }}
                  </option>
               </select>
            </div>
            
            <div class="col-span-1">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">海拔 (m)</label>
               <input v-model.number="form.altitude" type="number" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div class="col-span-1">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">電話</label>
               <input v-model="form.phone" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
         </div>

         <!-- Coordinates -->
         <div class="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div class="flex items-center justify-between mb-2">
               <h4 class="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1">
                  <MapPin class="w-3 h-3" /> GPS 座標
               </h4>
               <button
                 type="button"
                 @click="autoFetchCoordinates"
                 :disabled="isSearchingCoordinates || !form.name"
                 class="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                 title="根據營地名稱自動搜尋座標"
               >
                 <Navigation v-if="!isSearchingCoordinates" class="w-3.5 h-3.5" />
                 <Loader2 v-else class="w-3.5 h-3.5 animate-spin" />
                 {{ isSearchingCoordinates ? '搜尋中...' : '自動取得' }}
               </button>
            </div>
            <div class="grid grid-cols-2 gap-3">
               <div>
                  <label class="text-xs text-blue-600 block mb-1">緯度</label>
                  <input v-model.number="form.latitude" type="number" step="0.000001" class="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
               </div>
               <div>
                  <label class="text-xs text-blue-600 block mb-1">經度</label>
                  <input v-model.number="form.longitude" type="number" step="0.000001" class="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
               </div>
            </div>
            <p v-if="!form.latitude || !form.longitude" class="text-xs text-orange-600 mt-2 font-bold flex items-center gap-1">
               ⚠️ 尚未設定座標，無法使用地圖導航功能
            </p>
         </div>

         <!-- Tags -->
         <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">標籤 (用逗號分隔)</label>
            <input v-model="tagsString" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="草地, 雲海, 戲水池" />
         </div>

         <!-- Zone Config -->
         <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">營位配置說明</label>
            <textarea v-model="form.zone_config" rows="3" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"></textarea>
         </div>
         
         <!-- Verified -->
         <div class="flex items-center gap-2">
            <input id="verified" v-model="form.is_verified" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <label for="verified" class="text-sm font-medium text-gray-700">已審核確認</label>
         </div>

      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
         <button @click="$emit('close')" class="px-4 py-2 text-gray-600 font-bold hover:bg-white rounded-lg transition">取消</button>
         <button 
           @click="save" 
           :disabled="isSaving"
           class="px-6 py-2 bg-primary-900 text-white font-bold rounded-lg hover:bg-black transition flex items-center gap-2 disabled:opacity-50"
         >
           <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
           儲存變更
         </button>
      </div>

    </div>
  </div>
</template>
