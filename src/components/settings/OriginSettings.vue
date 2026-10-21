<template>
  <div class="p-6 space-y-6">
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
        <MapPin class="w-4 h-4 text-blue-500" />
        位置設定
      </h3>
      
      <div class="space-y-3">
        <div>
           <label class="block text-xs text-gray-500 mb-1">搜尋地點 (輸入地址或地標)</label>
           <PlaceSearchInput
             v-model="formData.location_name"
             @place-selected="handlePlaceSelected"
             placeholder="例如: 台北車站"
           />
           <p v-if="formData.latitude && formData.longitude" class="mt-2 text-xs text-green-600 flex items-center gap-1 font-mono">
              <MapPin class="w-3 h-3" /> 
              已設定座標: {{ formData.latitude.toFixed(4) }}, {{ formData.longitude.toFixed(4) }}
           </p>
        </div>

        <button 
          @click="getCurrentLocation" 
          :disabled="isLoadingLocation"
          class="w-full py-3 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
        >
          <Navigation v-if="!isLoadingLocation" class="w-4 h-4" />
          <Loader2 v-else class="w-4 h-4 animate-spin" />
          {{ isLoadingLocation ? '定位中...' : '使用目前位置' }}
        </button>
      </div>
    </div>
    
    <!-- Save Footer for Location -->
    <div class="mt-8 flex justify-end">
       <button 
          @click="saveSettings" 
          :disabled="isSaving"
          class="w-full py-3 text-base font-bold text-white bg-gray-900 hover:bg-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
          {{ isSaving ? '儲存中...' : '儲存設定' }}
        </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { MapPin, Navigation, Loader2 } from 'lucide-vue-next'
import { profileQueries } from '../../services/db/profile'
import { useUserProfile } from '../../composables/useUserProfile'
import type { PlaceResult } from '../../types/campsiteDraft'
import PlaceSearchInput from './PlaceSearchInput.vue'

const props = defineProps<{ userId: string }>()
const { fetchProfile: refreshUserProfile } = useUserProfile()

const formData = ref({
  location_name: '',
  latitude: null as number | null,
  longitude: null as number | null
})

const isLoadingLocation = ref(false)
const isSaving = ref(false)

const handlePlaceSelected = (place: PlaceResult) => {
  formData.value.location_name = place.name || place.formatted_address || ''
  formData.value.latitude = place.lat
  formData.value.longitude = place.lng
}

const fetchProfile = async () => {
  if (!props.userId) return
  try {
    const data = await profileQueries.get(props.userId)

    if (data) {
      formData.value = {
        location_name: data.location_name || '',
        latitude: data.latitude,
        longitude: data.longitude
      }
    }
  } catch (err) {
    console.error('Error fetching profile:', err)
  }
}

// userId 可能晚一步才從 session 取得，取得後再載入
watch(() => props.userId, fetchProfile, { immediate: true })

const getCurrentLocation = () => {
  if (!navigator.geolocation) {
    alert('您的瀏覽器不支援定位功能')
    return
  }
  
  isLoadingLocation.value = true
  navigator.geolocation.getCurrentPosition(
    (position) => {
      formData.value.latitude = parseFloat(position.coords.latitude.toFixed(6))
      formData.value.longitude = parseFloat(position.coords.longitude.toFixed(6))
      isLoadingLocation.value = false
    },
    (_error) => {
      alert('無法取得目前位置，請確認這是否是安全連線 (HTTPS) 或是已允許定位權限')
      isLoadingLocation.value = false
    }
  )
}

const saveSettings = async () => {
  if (!props.userId) return
  isSaving.value = true
  try {
    const updates = {
      id: props.userId,
      location_name: formData.value.location_name,
      latitude: formData.value.latitude,
      longitude: formData.value.longitude,
      updated_at: new Date().toISOString()
    }

    await profileQueries.upsert(updates)
    // 同步 singleton，NextTripCard 的車程時間不用重新整理就會更新
    await refreshUserProfile(props.userId)
    alert('設定已儲存')
  } catch (error) {
    console.error('Error saving profile:', error)
    alert('儲存失敗，請稍後再試')
  } finally {
    isSaving.value = false
  }
}
</script>
