<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, MapPin, Loader2, Navigation, Snowflake, IceCream, Droplets } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { TAIWAN_LOCATIONS } from '../constants/locations'
import { parseTaiwanLocation } from '../utils/googleMaps'
import type { Campsite } from '../types/database'


const props = defineProps<{
  isOpen: boolean
  campsite: Campsite
  isEditable?: boolean
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

// Display Helpers
const formCityName = computed(() => {
  const c = TAIWAN_LOCATIONS.find(loc => loc.id === form.value.city)
  return c ? c.name : '未設定'
})

const formDistrictName = computed(() => {
  const c = TAIWAN_LOCATIONS.find(loc => loc.id === form.value.city)
  if (!c) return '未設定'
  const d = c.districts.find(dist => dist.id === form.value.district)
  return d ? d.name : '未設定'
})

// Reset district when city changes (unless it's the initial load)
const handleCityChange = () => {
  form.value.district = ''
}

watch(() => props.campsite, (newVal) => {
  if (newVal) {
    form.value = { 
      ...newVal,
      amenities: newVal.amenities || { // Ensure amenities object exists
         has_fridge: false,
         has_freezer: false,
         has_water_dispenser: false
      }
    }
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
        <h3 class="font-bold text-gray-800">{{ isEditable ? '編輯營地資料' : '營地詳細資訊' }}</h3>
        <button @click="$emit('close')" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition">
           <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Form -->
      <div class="p-6 space-y-5 overflow-y-auto">
         
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
                  class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')]"
                  :class="{'opacity-50 cursor-not-allowed': !form.city, 'bg-no-repeat bg-[right_0.5rem_center] bg-[length:1.5em_1.5em]': form.city}"
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
               <button
                 v-if="isEditable"
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

         <!-- Rules & Timings (v2) -->
         <div>
             <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">時間與規範</label>
             <div class="grid grid-cols-2 gap-4">
                 <!-- Check In -->
                 <div>
                     <label class="text-xs text-gray-400 block mb-1">一般進場</label>
                     <input v-if="isEditable" v-model="form.check_in_time" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" placeholder="ex: 10:00" />
                     <div v-else class="text-sm font-bold text-gray-900">{{ form.check_in_time || '--:--' }}</div>
                 </div>
                 <!-- Check Out -->
                 <div>
                     <label class="text-xs text-gray-400 block mb-1">一般離場</label>
                     <input v-if="isEditable" v-model="form.check_out_time" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" placeholder="ex: 12:00" />
                     <div v-else class="text-sm font-bold text-gray-900">{{ form.check_out_time || '--:--' }}</div>
                 </div>
                 <!-- Night Rush -->
                 <div>
                     <label class="text-xs text-gray-400 block mb-1">夜衝時段</label>
                     <input v-if="isEditable" v-model="form.night_rush_time" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" placeholder="ex: 18:00 - 22:00" />
                     <div v-else class="text-sm font-bold text-indigo-700">{{ form.night_rush_time || '未提供' }}</div>
                 </div>
                 <!-- Shower -->
                 <div>
                     <label class="text-xs text-gray-400 block mb-1">熱水供應</label>
                     <input v-if="isEditable" v-model="form.shower_restrictions" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" placeholder="ex: 24H 或 17:00-23:00" />
                     <div v-else class="text-sm font-bold text-gray-900">{{ form.shower_restrictions || '未提供' }}</div>
                 </div>
             </div>
         </div>

         <!-- Zone Config -->
         <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">營位配置說明</label>
            <textarea v-if="isEditable" v-model="form.zone_config" rows="3" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"></textarea>
            <div v-else class="text-gray-800 whitespace-pre-wrap leading-relaxed py-1">{{ form.zone_config || '無說明' }}</div>
         </div>
         
         <!-- Verified -->
         <div class="flex items-center gap-2">
            <template v-if="isEditable">
               <input id="verified" v-model="form.is_verified" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
               <label for="verified" class="text-sm font-medium text-gray-700">已審核確認</label>
            </template>
            <template v-else>
               <div v-if="form.is_verified" class="px-2 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-lg flex items-center gap-1">
                  ✓ 已審核
               </div>
               <div v-else class="px-2 py-1 bg-orange-50 text-orange-700 text-xs font-bold rounded-lg flex items-center gap-1">
                  ⚠ 待審核
               </div>
            </template>
         </div>

      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
         <button @click="$emit('close')" class="px-4 py-2 text-gray-600 font-bold hover:bg-white rounded-lg transition">{{ isEditable ? '取消' : '關閉' }}</button>
         <button 
           v-if="isEditable"
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
