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
           
           <!-- Family Button -->
           <button @click="currentView = 'family'" class="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-white border border-gray-200 hover:border-indigo-200 rounded-xl transition-all group">
              <div class="flex items-center gap-3">
                 <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                    <User class="w-5 h-5" />
                 </div>
                 <div class="text-left">
                    <h3 class="font-bold text-gray-900">家庭共享</h3>
                    <p class="text-xs text-gray-500">邀請家人加入，同步行程裝備</p>
                 </div>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-400 group-hover:text-indigo-500" />
           </button>

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

        <!-- FAMILY VIEW -->
        <div v-else-if="currentView === 'family'" class="p-6 space-y-6">
           <div v-if="userFamily" class="text-center space-y-6">
              <div class="w-20 h-20 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-full mx-auto flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                 {{ userFamily.name.charAt(0) }}
              </div>
              <div>
                 <h3 class="text-2xl font-bold text-gray-900">{{ userFamily.name }}</h3>
                 <p class="text-gray-500 text-sm">已加入家庭共享</p>
              </div>

              <div class="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
                 <p class="text-xs text-gray-500 mb-2 uppercase tracking-wide">邀請代碼</p>
                 <div class="text-3xl font-mono font-bold text-indigo-600 tracking-widest select-all">
                    {{ userFamily.invite_code }}
                 </div>
                 <p class="text-xs text-gray-400 mt-2">將此代碼分享給您的另一半</p>
              </div>

              <button 
                @click="shareInviteLink"
                class="w-full py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
              >
                 <Share2 class="w-5 h-5" />
                 分享加入連結
              </button>

              <div class="pt-4 border-t border-gray-100">
                <button 
                  @click="handleManualMigration"
                  :disabled="isProcessingFamily"
                  class="w-full py-2 text-sm text-gray-500 hover:text-gray-700 underline flex items-center justify-center"
                >
                   匯入我的舊資料到此家庭
                </button>
                <p class="text-[10px] text-gray-400 text-center mt-1">
                  若您發現加入家庭後找不到舊行程，請點選此處
                </p>
              </div>
           </div>

           <div v-else class="space-y-8">
              <!-- Create -->
              <div class="space-y-4">
                 <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span class="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs">1</span>
                    建立新家庭
                 </h3>
                 <div class="flex gap-2">
                    <input 
                      v-model="newFamilyName"
                      type="text" 
                      placeholder="輸入家庭名稱 (例如: 王小明的家)"
                      class="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                    <button 
                      @click="createFamily"
                      :disabled="isProcessingFamily || !newFamilyName"
                      class="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      建立
                    </button>
                 </div>
              </div>

              <div class="h-px bg-gray-100"></div>

              <!-- Join -->
              <div class="space-y-4">
                 <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span class="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs">2</span>
                    加入現有家庭
                 </h3>
                 <div class="flex gap-2">
                    <input 
                      v-model="inviteCodeInput"
                      type="text" 
                      placeholder="輸入 6 位數邀請碼"
                      class="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none uppercase font-mono placeholder:font-sans"
                      maxlength="6"
                    />
                    <button 
                      @click="joinFamily"
                      :disabled="isProcessingFamily || !inviteCodeInput"
                      class="px-4 py-2 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      加入
                    </button>
                 </div>
              </div>
           </div>
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
  // New prop for auto-filling from URL
  initialInviteCode?: string
}>()

type ViewState = 'menu' | 'location' | 'gear' | 'family'
const currentView = ref<ViewState>('menu')

// Reset view on open
watch(() => props.isOpen, (v) => {
  if (v) {
    if (props.initialInviteCode && !userFamily.value) {
      currentView.value = 'family'
      inviteCodeInput.value = props.initialInviteCode
    } else {
      currentView.value = 'menu'
    }
  }
})

// Auto-switch if family joined successfully or code provided later
watch(() => props.initialInviteCode, (newCode) => {
  if (newCode && props.isOpen && !userFamily.value) {
     currentView.value = 'family'
     inviteCodeInput.value = newCode
  }
})

const emit = defineEmits(['close', 'logout', 'saved'])
// ... (rest of existing code)

// --- Added Share Logic ---
import { Share2 } from 'lucide-vue-next' // Add icons to imports if needed

const shareInviteLink = async () => {
  if (!userFamily.value) return
  
  const url = `${window.location.origin}?invite_code=${userFamily.value.invite_code}`
  const text = `加入我的露營家庭「${userFamily.value.name}」！點擊連結加入：\n${url}`
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: '加入露營家庭',
        text: text,
        url: url
      })
    } catch (e) {
      console.log('Share cancelled')
    }
  } else {
    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(text)
      alert('已複製邀請連結！')
    } catch (e) {
      alert('複製失敗，請手動複製代碼')
    }
  }
}

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
      .select('*, families(*)') // Fetch linked family
      .eq('id', props.userId)
      .single()

    if (data) {
      formData.value = {
        location_name: (data as any).location_name || '',
        latitude: (data as any).latitude,
        longitude: (data as any).longitude
      }
      
      if ((data as any).families) {
        userFamily.value = (data as any).families
      }
    } else if (error && error.code === 'PGRST116') {
      console.log('No profile found, ready to create one')
    }
  } catch (err) {
    console.error('Error fetching profile:', err)
  } finally {
    isLoadingProfile.value = false
  }
}

// --- Family Logic ---
const userFamily = ref<any>(null)
const inviteCodeInput = ref('')
const newFamilyName = ref('')
const isProcessingFamily = ref(false)

const createFamily = async () => {
  if (!newFamilyName.value) return alert('請輸入家庭名稱')
  isProcessingFamily.value = true
  try {
    // Generate simple 6-char code
    const list = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let code = ""
    for(let i=0; i<6; i++) {
      code += list.charAt(Math.floor(Math.random() * list.length))
    }

    const { data: family, error } = await supabase
      .from('families')
      .insert([{
        name: newFamilyName.value,
        invite_code: code,
        created_by: props.userId
      }] as any)
      .select()
      .single()

    if (error) throw error
    if (!family) throw new Error('Family creation failed')

    // Link User to Family
    await linkUserToFamily((family as any).id)
    
    // Migrate Data (Backfill)
    await migrateUserDataToFamily((family as any).id)
    
    // Refresh
    userFamily.value = family
    newFamilyName.value = ''
    alert('家庭建立成功！已將既有行程匯入家庭。')
  } catch(e: any) {
    console.error(e)
    alert('建立失敗: ' + e.message)
  } finally {
    isProcessingFamily.value = false
  }
}

const handleManualMigration = async () => {
  if (!userFamily.value) return
  if (!confirm('確定要將所有尚未歸戶的個人行程匯入此家庭嗎？')) return
  
  isProcessingFamily.value = true
  try {
    await migrateUserDataToFamily(userFamily.value.id)
    alert('匯入完成！')
    // Emit saved to trigger refresh in parent
    emit('saved', {}) 
  } catch (e) {
    console.error(e)
    alert('匯入失敗')
  } finally {
    isProcessingFamily.value = false
  }
}

const joinFamily = async () => {
  if (!inviteCodeInput.value) return alert('請輸入邀請碼')
  isProcessingFamily.value = true
  try {
    // Find family
    const { data: family, error } = await supabase
      .from('families')
      .select('*')
      .eq('invite_code', inviteCodeInput.value.toUpperCase())
      .single()
      
    if (error || !family) throw new Error('找不到此邀請碼的家庭')
    
    // Link User
    await linkUserToFamily((family as any).id)
    
    // Migrate Data (Backfill)
    await migrateUserDataToFamily((family as any).id)
    
    // Refresh
    userFamily.value = family
    inviteCodeInput.value = ''
    alert(`成功加入 ${(family as any).name}！`)
  } catch(e: any) {
    console.error(e)
    alert('加入失敗: ' + e.message)
  } finally {
    isProcessingFamily.value = false
  }
}

const linkUserToFamily = async (familyId: string) => {
  const { error } = await (supabase
    .from('profiles') as any)
    .update({ family_id: familyId })
    .eq('id', props.userId)
  if (error) throw error
}

const migrateUserDataToFamily = async (familyId: string) => {
  // Update all my trips that don't have a family_id yet
  const { error: tripError } = await (supabase
    .from('camping_trips') as any)
    .update({ family_id: familyId })
    .eq('user_id', props.userId)
    .is('family_id', null)
    
  if (tripError) console.error('Trip migration failed', tripError)
  
  // Update gear
  const { error: gearError } = await (supabase
    .from('camping_gear') as any)
    .update({ family_id: familyId })
    .eq('user_id', props.userId)
    .is('family_id', null)

  if (gearError) console.error('Gear migration failed', gearError)
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
