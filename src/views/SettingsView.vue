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
             <span v-else-if="currentView === 'family'" class="flex items-center gap-2">
               <Users class="w-5 h-5 text-blue-600" /> 家庭成員
             </span>
             <span v-else-if="currentView === 'notifications'" class="flex items-center gap-2">
               <Bell class="w-5 h-5 text-blue-600" /> 提醒通知
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

           <button @click="currentView = 'family'" class="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl transition-all active:scale-[0.98] shadow-sm">
              <div class="flex items-center gap-3">
                 <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Users class="w-5 h-5" />
                 </div>
                 <div class="text-left">
                    <h3 class="font-bold text-gray-900">家庭成員</h3>
                    <p class="text-xs text-gray-500">邀請碼與共用行事曆</p>
                 </div>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-300" />
           </button>

           <button @click="currentView = 'notifications'" class="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl transition-all active:scale-[0.98] shadow-sm">
              <div class="flex items-center gap-3">
                 <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Bell class="w-5 h-5" />
                 </div>
                 <div class="text-left">
                    <h3 class="font-bold text-gray-900">提醒通知</h3>
                    <p class="text-xs text-gray-500">前一晚提醒明天的事</p>
                 </div>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-300" />
           </button>

           <button v-if="isAdmin()" @click="isAssetManagerOpen = true" class="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl transition-all active:scale-[0.98] shadow-sm">
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

           <button v-if="isAdmin()" @click="currentView = 'advanced-gear'" class="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl transition-all active:scale-[0.98] shadow-sm">
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

        <OriginSettings v-else-if="currentView === 'location'" :user-id="effectiveUserId" />

        <GearSettings v-else-if="currentView === 'tent'" mode="tent" :trips="trips" />

        <CategorySettings v-else-if="currentView === 'categories'" />

        <FamilySettings v-else-if="currentView === 'family'" />

        <NotificationSettings v-else-if="currentView === 'notifications'" />

        <!-- ADVANCED GEAR VIEW (Admin Only) -->
        <GearSettings v-else-if="currentView === 'advanced-gear'" mode="advanced-gear" :trips="trips" />

        <CpblSettings v-else-if="currentView === 'admin'" />

      </div>
      
      <!-- System Asset Manager Modal -->
      <SystemAssetManager 
          v-if="isAdmin()"
          :is-open="isAssetManagerOpen" 
          @close="isAssetManagerOpen = false" 
      />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Settings, MapPin, LogOut, ChevronRight, ChevronLeft, Tent as TentIcon, ShieldAlert, Images, Tags, Users, Bell } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { pushSubscriptionQueries } from '../services/db/pushSubscriptions'
import { useAuth } from '../composables/useAuth'
import { useTrips } from '../composables/useTrips'
import { useUserProfile } from '../composables/useUserProfile'
import OriginSettings from '../components/settings/OriginSettings.vue'
import GearSettings from '../components/settings/GearSettings.vue'
import CpblSettings from '../components/settings/CpblSettings.vue'
import CategorySettings from '../components/settings/CategorySettings.vue'
import FamilySettings from '../components/settings/FamilySettings.vue'
import NotificationSettings from '../components/settings/NotificationSettings.vue'
import SystemAssetManager from '../components/SystemAssetManager.vue'

const router = useRouter()
const route = useRoute()

// session 來自 singleton；直接進入頁面、尚未初始化時 userId 會退回由 getSession 取得
const { session: authSession } = useAuth()
const { trips } = useTrips()
const { isAdmin } = useUserProfile()

const internalUserId = ref<string>('')
const effectiveUserId = computed(() => authSession.value?.user?.id || internalUserId.value)

type ViewState = 'menu' | 'location' | 'tent' | 'advanced-gear' | 'categories' | 'family' | 'notifications' | 'admin'
// 從清單頁「先建立或加入家庭」連過來：/settings?view=family 直接開家庭成員
const currentView = ref<ViewState>(route.query.view === 'family' ? 'family' : 'menu')
const isAssetManagerOpen = ref(false)

const handleLogout = async () => {
    await pushSubscriptionQueries.releaseThisDevice()
    await supabase.auth.signOut()
    router.push('/auth')
}

onMounted(async () => {
  if (authSession.value?.user?.id) return
  const { data: { session } } = await supabase.auth.getSession()
  if (session) internalUserId.value = session.user.id
  else router.push('/auth')
})
</script>
