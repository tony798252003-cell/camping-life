<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
        <div class="flex items-center gap-2">
           <button v-if="currentView !== 'menu'" @click="currentView = 'menu'" class="p-1 rounded-full hover:bg-white text-gray-500 transition-colors mr-1">
              <ChevronLeft class="w-5 h-5" />
           </button>
           <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
             <span v-if="currentView === 'menu'">
               <Settings class="w-5 h-5 text-blue-600" /> 設定
             </span>
             <span v-else-if="currentView === 'location'">
               <MapPin class="w-5 h-5 text-blue-600" /> 起始地點
             </span>
             <span v-else-if="currentView === 'gear'">
               <Tent class="w-5 h-5 text-accent-orange" /> 裝備管理
             </span>
           </h2>
        </div>
        <button @click="$emit('close')" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-full transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-0 overflow-y-auto max-h-[70vh]">
        
        <!-- MENU VIEW -->
        <div v-if="currentView === 'menu'" class="p-6 space-y-3">
           <button @click="currentView = 'location'" class="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-white border border-gray-200 hover:border-blue-200 rounded-xl transition-all group">
              <div class="flex items-center gap-3">
                 <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                    <MapPin class="w-5 h-5" />
                 </div>
                 <div class="text-left">
                    <h3 class="font-bold text-gray-900">預設起始地點</h3>
                    <p class="text-xs text-gray-500">設定經緯度以計算車程</p>
                 </div>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
           </button>

           <button @click="currentView = 'gear'" class="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-white border border-gray-200 hover:border-orange-200 rounded-xl transition-all group">
              <div class="flex items-center gap-3">
                 <div class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                    <Tent class="w-5 h-5" />
                 </div>
                 <div class="text-left">
                    <h3 class="font-bold text-gray-900">裝備管理</h3>
                    <p class="text-xs text-gray-500">管理露營裝備與 ROI 計算</p>
                 </div>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-400 group-hover:text-orange-500" />
           </button>

           <div class="h-px bg-gray-100 my-2"></div>

           <button @click="handleLogout" class="w-full flex items-center gap-3 p-4 text-red-600 hover:bg-red-50 rounded-xl transition-all font-bold">
              <LogOut class="w-5 h-5" />
              登出帳號
           </button>
        </div>

        <!-- LOCATION VIEW -->
        <div v-else-if="currentView === 'location'" class="p-6 space-y-6">
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <MapPin class="w-4 h-4 text-blue-500" />
              位置設定
            </h3>
            
            <div class="space-y-3">
              <div>
                <label class="block text-xs text-gray-500 mb-1">地點名稱 (例如: 家)</label>
                <input 
                  v-model="formData.location_name" 
                  type="text" 
                  class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                  placeholder="輸入名稱..."
                >
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">緯度 (Lat)</label>
                  <input 
                    v-model.number="formData.latitude" 
                    type="number" 
                    step="0.000001"
                    class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="25.033..."
                  >
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">經度 (Lng)</label>
                  <input 
                    v-model.number="formData.longitude" 
                    type="number" 
                    step="0.000001"
                    class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="121.565..."
                  >
                </div>
              </div>

              <button 
                @click="getCurrentLocation" 
                :disabled="isLoadingLocation"
                class="w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
              >
                <Navigation v-if="!isLoadingLocation" class="w-4 h-4" />
                <Loader2 v-else class="w-4 h-4 animate-spin" />
                {{ isLoadingLocation ? '定位中...' : '使用目前位置' }}
              </button>
            </div>
          </div>
          
          <!-- Save Footer for Location -->
          <div class="pt-4 mt-4 border-t border-gray-100 flex justify-end">
             <button 
                @click="saveSettings" 
                :disabled="isSaving"
                class="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-black rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
                {{ isSaving ? '儲存設定' : '儲存設定' }}
              </button>
          </div>
        </div>

        <!-- GEAR VIEW -->
        <div v-else-if="currentView === 'gear'" class="h-full">
           <GearROIView :trips="trips" />
        </div>

      </div>

      <!-- Footer (Removed unified footer, moved save button to Location View) -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Settings, X, MapPin, Navigation, LogOut, Loader2, User, ChevronRight, ChevronLeft, Tent } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import type { CampingTripWithCampsite } from '../types/database'
import GearROIView from './GearROIView.vue'

const props = defineProps<{
  isOpen: boolean
  userId: string
  trips?: CampingTripWithCampsite[]
}>()

type ViewState = 'menu' | 'location' | 'gear'
const currentView = ref<ViewState>('menu')

// Reset view on open
watch(() => props.isOpen, (v) => {
  if (v) currentView.value = 'menu'
})

const emit = defineEmits(['close', 'logout', 'saved'])

const formData = ref({
  location_name: '',
  latitude: null as number | null,
  longitude: null as number | null
})

const isLoadingLocation = ref(false)
const isSaving = ref(false)
const isLoadingProfile = ref(false)

// Fetch profile when modal opens
watch(() => props.isOpen, async (newVal) => {
  if (newVal && props.userId) {
    await fetchProfile()
  }
})

const fetchProfile = async () => {
  isLoadingProfile.value = true
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', props.userId)
      .single()

    if (data) {
      formData.value = {
        location_name: (data as any).location_name || '',
        latitude: (data as any).latitude,
        longitude: (data as any).longitude
      }
    } else if (error && error.code === 'PGRST116') {
      // Profile doesn't exist yet, that's fine
      console.log('No profile found, ready to create one')
    }
  } catch (err) {
    console.error('Error fetching profile:', err)
  } finally {
    isLoadingProfile.value = false
  }
}

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
    (error) => {
      console.error(error)
      alert('無法取得目前位置，請確認這是否是安全連線 (HTTPS) 或是已允許定位權限')
      isLoadingLocation.value = false
    }
  )
}

const saveSettings = async () => {
  isSaving.value = true
  try {
    const updates = {
      id: props.userId,
      location_name: formData.value.location_name,
      latitude: formData.value.latitude,
      longitude: formData.value.longitude,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(updates as any)

    if (error) throw error

    emit('saved', updates)
    emit('close')
  } catch (error) {
    console.error('Error saving profile:', error)
    alert('儲存失敗，請稍後再試')
  } finally {
    isSaving.value = false
  }
}

const handleLogout = () => {
  emit('logout')
  emit('close') // Optional, but good practice
}
</script>
