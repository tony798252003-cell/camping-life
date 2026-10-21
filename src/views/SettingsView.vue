<template>
  <div class="font-sans">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-30">
        <div class="flex items-center gap-2">
           <button v-if="currentView !== 'menu'" @click="currentView = 'menu'" class="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors mr-1">
              <ChevronLeft class="w-6 h-6" />
           </button>
           
           <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
             <span v-if="currentView === 'menu'" class="flex items-center gap-2">
               <Settings class="w-5 h-5 text-blue-600" /> 設定
             </span>
             <span v-else-if="currentView === 'location'" class="flex items-center gap-2">
               <MapPin class="w-5 h-5 text-blue-600" /> 起始地點
             </span>
              <span v-else-if="currentView === 'tent'" class="flex items-center gap-2">
                <TentIcon class="w-5 h-5 text-blue-600" /> 帳篷管理
              </span>
              <span v-else-if="currentView === 'advanced-gear'" class="flex items-center gap-2">
                <TentIcon class="w-5 h-5 text-orange-600" /> 進階裝備設定
              </span>
             <span v-else-if="currentView === 'categories'" class="flex items-center gap-2">
               <Tags class="w-5 h-5 text-blue-600" /> 分類管理
             </span>
             <span v-else-if="currentView === 'admin'" class="flex items-center gap-2">
               <ShieldAlert class="w-5 h-5 text-red-600" /> 管理員專區
             </span>
           </h2>
        </div>
      </div>

      <!-- Content -->
      <div class="p-0 overflow-y-auto">
        
        <!-- MENU VIEW -->
        <div v-if="currentView === 'menu'" class="p-6 space-y-3">
           
           <button @click="currentView = 'location'" class="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl transition-all active:scale-[0.98] shadow-sm">
              <div class="flex items-center gap-3">
                 <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <MapPin class="w-5 h-5" />
                 </div>
                 <div class="text-left">
                    <h3 class="font-bold text-gray-900">預設起始地點</h3>
                    <p class="text-xs text-gray-500">設定經緯度以計算車程</p>
                 </div>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-300" />
           </button>

           <button @click="currentView = 'tent'" class="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl transition-all active:scale-[0.98] shadow-sm">
              <div class="flex items-center gap-3">
                 <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <TentIcon class="w-5 h-5" />
                 </div>
                 <div class="text-left">
                    <h3 class="font-bold text-gray-900">帳篷管理</h3>
                    <p class="text-xs text-gray-500">管理帳篷名稱</p>
                 </div>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-300" />
           </button>

           <button @click="currentView = 'categories'" class="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl transition-all active:scale-[0.98] shadow-sm">
              <div class="flex items-center gap-3">
                 <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Tags class="w-5 h-5" />
                 </div>
                 <div class="text-left">
                    <h3 class="font-bold text-gray-900">分類管理</h3>
                    <p class="text-xs text-gray-500">行事曆事件分類與顏色</p>
                 </div>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-300" />
           </button>

           <button v-if="isAdmin" @click="isAssetManagerOpen = true" class="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl transition-all active:scale-[0.98] shadow-sm">
              <div class="flex items-center gap-3">
                 <div class="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-600">
                    <Images class="w-5 h-5" />
                 </div>
                 <div class="text-left">
                    <h3 class="font-bold text-gray-900">系統圖庫管理</h3>
                    <p class="text-xs text-gray-500">上傳與管理裝備圖片</p>
                 </div>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-300" />
           </button>

           <button v-if="isAdmin" @click="currentView = 'advanced-gear'" class="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl transition-all active:scale-[0.98] shadow-sm">
              <div class="flex items-center gap-3">
                 <div class="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                    <TentIcon class="w-5 h-5" />
                 </div>
                 <div class="text-left">
                    <h3 class="font-bold text-gray-900">進階裝備設定</h3>
                    <p class="text-xs text-gray-500">ROI 計算與詳細管理</p>
                 </div>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-300" />
           </button>

           <button @click="currentView = 'admin'" class="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl transition-all active:scale-[0.98] shadow-sm">
              <div class="flex items-center gap-3">
                 <div class="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                    <ShieldAlert class="w-5 h-5" />
                 </div>
                 <div class="text-left">
                    <h3 class="font-bold text-gray-900">管理員專區</h3>
                    <p class="text-xs text-gray-500">批次數據維護 (隱藏功能)</p>
                 </div>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-300" />
           </button>

           <div class="h-px bg-gray-200 my-4"></div>

           <button @click="handleLogout" class="w-full flex items-center justify-center gap-2 p-4 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all font-bold active:scale-[0.98]">
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

              <div class="hidden">
                <!-- Hidden inputs -->
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

        <!-- TENT VIEW -->
        <div v-else-if="currentView === 'tent'" class="h-full">
          <TentManagement :trips="trips" />
        </div>

        <!-- CATEGORIES VIEW -->
        <CategorySettings v-else-if="currentView === 'categories'" />

        <!-- ADVANCED GEAR VIEW (Admin Only) -->
        <div v-else-if="currentView === 'advanced-gear'" class="h-full">
          <GearROIView :trips="trips" />
        </div>

        <!-- ADMIN VIEW -->
        <div v-else-if="currentView === 'admin'" class="p-6 space-y-6">
           <div class="bg-red-50 border border-red-100 rounded-xl p-4">
              <h3 class="font-bold text-red-800 mb-2 flex items-center gap-2">
                 <ShieldAlert class="w-5 h-5" />
                 危險操作區
              </h3>
              <p class="text-xs text-red-600 mb-4">
                 此區域功能會直接修改資料庫大量數據，請謹慎使用。
              </p>
              
              <div class="space-y-4">
                 <div class="bg-white p-4 rounded-lg border border-blue-200 shadow-sm mt-4">
                    <h4 class="font-bold text-gray-800 mb-1 flex items-center gap-2">
                       同步 CPBL 賽程
                    </h4>
                    <p class="text-xs text-gray-500 mb-3">
                       從中華職棒官網抓取指定年度的賽程並寫入資料庫，供前台行事曆與新增行程時使用。此操作需要一些時間。
                    </p>
                    
                    <div class="flex gap-2 mb-3">
                       <input type="number" v-model="syncYear" class="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm w-32 flex-1" placeholder="年份" />
                    </div>
                    
                    <div class="flex flex-col gap-2">
                        <button 
                           @click="handleSyncCpbl"
                           :disabled="isSyncingCpbl"
                           class="w-full justify-center py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                           <Loader2 v-if="isSyncingCpbl" class="w-4 h-4 animate-spin" />
                           {{ isSyncingCpbl ? '同步中...' : '開始同步賽程' }}
                        </button>
                        <button
                           @click="handleResyncCpbl"
                           :disabled="isSyncingCpbl"
                           class="w-full justify-center py-2 bg-white border border-blue-600 text-blue-700 font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                           重新同步整年
                        </button>
                    </div>
                 </div>
              </div>
           </div>
        </div>

      </div>
      
      <!-- System Asset Manager Modal -->
      <SystemAssetManager 
          :is-open="isAssetManagerOpen" 
          @close="isAssetManagerOpen = false" 
      />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Settings, MapPin, Navigation, LogOut, Loader2, ChevronRight, ChevronLeft, Tent as TentIcon, ShieldAlert, Images, Tags } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import type { CampingTripWithCampsite } from '../types/database'
import GearROIView from '../components/GearROIView.vue'
import TentManagement from '../components/TentManagement.vue'
import PlaceSearchInput from '../components/settings/PlaceSearchInput.vue'
import CategorySettings from '../components/settings/CategorySettings.vue'
import SystemAssetManager from '../components/SystemAssetManager.vue'
import { syncCpblScheduleForYear, resyncCpblYear } from '../services/cpblService'
import { useConfirm } from '../composables/useConfirm'
import { useNotification } from '../composables/useNotification'

// Logic to fetch necessary data if not provided (for standalone view)
const router = useRouter()

// We need to either receive props or fetch data. 
// Since we are moving to a view, we might not get complex props like 'trips' easily unless using a store or passing state.
// For now, we'll try to use props if passed (via <router-view>) or fetch minimal needed data.
// Note: In typical Vue Router setup, passing props is possible but 'trips' is large. 
// However, SettingsView mainly needs user ID and trips for generic stats.
// Let's rely on the parent (App.vue) passing props to <router-view> or we can fetch.
// Given the existing App.vue structure, passing props to router-view is the easiest migration path.

const props = defineProps<{
  userId?: string
  isAdmin?: boolean
  trips?: CampingTripWithCampsite[]
  initialInviteCode?: string
}>()

// Internal state for User ID if prop is missing (e.g. direct access)
const internalUserId = ref<string>('')
const internalIsAdmin = ref(false)

const effectiveUserId = computed(() => props.userId || internalUserId.value)

type ViewState = 'menu' | 'location' | 'tent' | 'advanced-gear' | 'categories' | 'admin'
const currentView = ref<ViewState>('menu')
const isAssetManagerOpen = ref(false)


const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
}


const formData = ref({
  location_name: '',
  latitude: null as number | null,
  longitude: null as number | null
})

const isLoadingLocation = ref(false)
const isSaving = ref(false)
const isLoadingProfile = ref(false)

const handlePlaceSelected = (place: any) => {
  formData.value.location_name = place.name || place.formatted_address || ''
  formData.value.latitude = place.lat
  formData.value.longitude = place.lng
}

// CPBL Sync Logic
const isSyncingCpbl = ref(false)
const syncYear = ref(new Date().getFullYear())

const handleSyncCpbl = async () => {
  if (!confirm(`確定要同步 ${syncYear.value} 年度的 CPBL 賽程嗎？這可能會需要 10~20 秒。`)) {
    return
  }
  isSyncingCpbl.value = true
  try {
    await syncCpblScheduleForYear(syncYear.value)
    alert('✅ CPBL 賽程同步完成！')
  } catch (error: any) {
    console.error('CPBL 同步失敗:', error)
    alert('❌ 同步失敗: ' + error.message)
  } finally {
    isSyncingCpbl.value = false
  }
}

const { confirm: confirmDialog } = useConfirm()
const { success: notifySuccess, error: notifyError } = useNotification()

const handleResyncCpbl = async () => {
  const ok = await confirmDialog({
    title: `重新同步 ${syncYear.value} 年`,
    message: '會刪除官方已取消或改期的舊比賽，已加入你行事曆的比賽不受影響。',
    type: 'warning',
  })
  if (!ok) return
  isSyncingCpbl.value = true
  try {
    const { upserted, deleted } = await resyncCpblYear(syncYear.value)
    notifySuccess(`新增/更新 ${upserted} 場、移除 ${deleted} 場`)
  } catch (error: any) {
    console.error('CPBL 重新同步失敗:', error)
    notifyError('重新同步失敗，未刪除任何比賽：' + error.message)
  } finally {
    isSyncingCpbl.value = false
  }
}

// Fetch Profile Logic
const fetchProfile = async () => {
  const uid = effectiveUserId.value
  if (!uid) return

  isLoadingProfile.value = true
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single()

    if (data) {
      formData.value = {
        location_name: (data as any).location_name || '',
        latitude: (data as any).latitude,
        longitude: (data as any).longitude
      }
      internalIsAdmin.value = (data as any).is_admin || false
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
    (_error) => {
      alert('無法取得目前位置，請確認這是否是安全連線 (HTTPS) 或是已允許定位權限')
      isLoadingLocation.value = false
    }
  )
}

const saveSettings = async () => {
  if (!effectiveUserId.value) return
  isSaving.value = true
  try {
    const updates = {
      id: effectiveUserId.value,
      location_name: formData.value.location_name,
      latitude: formData.value.latitude,
      longitude: formData.value.longitude,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(updates as any)

    if (error) throw error
    alert('設定已儲存')
  } catch (error) {
    console.error('Error saving profile:', error)
    alert('儲存失敗，請稍後再試')
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  // If props.userId is not provided (direct nav), try to get session
  if (!props.userId) {
     const { data: { session } } = await supabase.auth.getSession()
     if (session) {
         internalUserId.value = session.user.id
         fetchProfile()
     } else {
         router.push('/auth')
     }
  } else {
     fetchProfile()
  }
})
</script>
