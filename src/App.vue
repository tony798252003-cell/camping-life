<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { supabase } from './lib/supabase'
import type { CampingTrip, NewCampingTrip, CampingTripWithCampsite } from './types/database'
import type { Session } from '@supabase/supabase-js'

// Components
import TripModal from './components/TripModal.vue'
import HomeView from './components/HomeView.vue'
import TripListView from './components/TripListView.vue'
import CalendarView from './components/CalendarView.vue'
import LoginView from './components/LoginView.vue'
import SettingsModal from './components/SettingsModal.vue'
import CampsiteLibrary from './components/CampsiteLibrary.vue'
import CampsiteEditModal from './components/CampsiteEditModal.vue'

// Icons
import { Home, List as ListIcon, Calendar as CalendarIcon, Plus, Settings, Search } from 'lucide-vue-next'

// State
const isAuthReady = ref(false)
const session = ref<Session | null>(null)
const trips = ref<CampingTripWithCampsite[]>([])
const loading = ref(true)
const isModalOpen = ref(false)
const activeTrip = ref<CampingTripWithCampsite | null>(null)
const isSettingsModalOpen = ref(false)
const userProfile = ref<{latitude: number, longitude: number, location_name: string, is_admin: boolean, family_id?: string} | null>(null)
const isCampsiteEditOpen = ref(false)
const editingCampsiteData = ref<any>(null)
const campsiteLibraryKey = ref(0) // Used to force refresh CampsiteLibrary
const inviteCode = ref('') // Store invite code from URL

const activeTab = ref<'home' | 'list' | 'calendar' | 'library'>('home')

// Auto-open settings if invite code exists
watch(() => [isAuthReady.value, session.value], ([ready, sess]) => {
  if (ready && sess && inviteCode.value) {
    isSettingsModalOpen.value = true
  }
})

// Fetch Trips

const fetchTrips = async () => {
  if (!session.value) return 
  
  loading.value = true
  try {
    let query = supabase
      .from('camping_trips')
      .select('*, campsites(*)')
      .order('trip_date', { ascending: false })

    // Family Logic
    if (userProfile.value?.family_id) {
       query = query.eq('family_id', userProfile.value.family_id)
    } else {
       query = query.eq('user_id', session.value.user.id)
    }

    const { data, error } = await query

    if (error) throw error
    trips.value = (data as unknown as CampingTripWithCampsite[]) || []
  } catch (error) {
    console.error('獲取資料失敗:', error)
    alert('無法載入露營記錄，請檢查 Supabase 連線設定')
  } finally {
    loading.value = false
  }
}

// Actions
const handleViewDetail = (trip: CampingTrip) => {
  activeTrip.value = trip as CampingTripWithCampsite
  isModalOpen.value = true
}

const handleAdd = () => {
  activeTrip.value = null
  isModalOpen.value = true
}

const handleEdit = (trip: CampingTrip) => {
  activeTrip.value = trip as CampingTripWithCampsite
  isModalOpen.value = true
}

const deleteTrip = async (id: number) => {
  if (!confirm('確定要刪除這筆記錄嗎？')) return

  try {
    const { error } = await supabase
      .from('camping_trips')
      .delete()
      .eq('id', id)

    if (error) throw error
    
    await fetchTrips()
    alert('刪除成功！')
  } catch (error) {
    console.error('刪除失敗:', error)
    alert('刪除失敗，請稍後再試')
  }
}

const handleSubmit = async (tripData: NewCampingTrip) => {
  if (!session.value) return

  try {
    // Attach User ID and Family ID to the new trip data
    const dataToSave = {
      ...tripData,
      user_id: session.value.user.id,
      family_id: userProfile.value?.family_id ?? null
    }

    if (activeTrip.value) {
      // Update
      const { error } = await (supabase
        .from('camping_trips') as any)
        .update(dataToSave)
        .eq('id', activeTrip.value.id)
      if (error) throw error
      alert('更新成功！')
    } else {
      // Create
      const { error } = await (supabase
        .from('camping_trips') as any)
        .insert([dataToSave])
      if (error) throw error
      alert('新增成功！')
    }
    await fetchTrips()
    isModalOpen.value = false
    activeTrip.value = null
  } catch (error) {
    console.error('儲存失敗:', error)
    alert('儲存失敗，請稍後再試')
  }
}

const handleUpdateNightRush = async ({ id, value }: { id: number, value: boolean }) => {
  try {
    const { error } = await (supabase
      .from('camping_trips') as any)
      .update({ night_rush: value })
      .eq('id', id)
      
    if (error) throw error
    
    // Optimistic update or refetch
    await fetchTrips()
  } catch (error) {
    console.error('更新夜衝狀態失敗:', error)
    alert('更新失敗，請檢查網路')
  }
}

const handleEditCampsite = (campsite: any) => {
  editingCampsiteData.value = campsite
  isCampsiteEditOpen.value = true
}

const handleCampsiteSaved = () => {
  isCampsiteEditOpen.value = false
  editingCampsiteData.value = null
  campsiteLibraryKey.value++ // Refresh library
  fetchTrips() // Refresh trips in case campsite data changed
}

const handleSettingsSaved = () => {
  isSettingsModalOpen.value = false
  fetchUserProfile()
}

const handleLogout = async () => {
  await supabase.auth.signOut()
  session.value = null
  trips.value = []
}

const fetchUserProfile = async () => {
  if (!session.value) return
  try {
    console.log('[App] Fetching user profile...')
    const { data, error } = await supabase
      .from('profiles')
      .select('latitude, longitude, location_name, is_admin, family_id')
      .eq('id', session.value.user.id)
      .single()
    
    if (error) {
       // If error is about missing column, we might be in a state where SQL didn't run.
       // We should still proceed.
       console.warn('[App] Profile fetch warning:', error.message)
    }

    if (data) {
      userProfile.value = {
        latitude: (data as any).latitude,
        longitude: (data as any).longitude,
        location_name: (data as any).location_name || '自訂起點',
        is_admin: (data as any).is_admin || false,
        family_id: (data as any).family_id
      }
    }
  } catch (e) {
    console.error('[App] Error loading profile', e)
  }
}

// ... (other functions)

onMounted(() => {
  console.log('[App] Mounted')
  // Check URL params for invite code
  const params = new URLSearchParams(window.location.search)
  const code = params.get('invite_code')
  if (code) {
    inviteCode.value = code
    window.history.replaceState({}, '', window.location.pathname)
  }

  const hasAuthHash = (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token'))) || 
                      (window.location.search && window.location.search.includes('code') && !window.location.search.includes('invite_code'))
  
  // Backup timeout: Force ready state after 4 seconds to avoid infinite loading
  setTimeout(() => {
     if (!isAuthReady.value) {
        console.warn('[App] Auth check timed out, forcing ready state.')
        isAuthReady.value = true
        loading.value = false
     }
  }, 4000)

  // Get initial session
  supabase.auth.getSession().then(async ({ data }) => {
    session.value = data.session
    console.log('[App] Initial session:', !!session.value)
    
    if (session.value) {
      await fetchUserProfile()
      await fetchTrips()
      isAuthReady.value = true
    } else if (!hasAuthHash) {
      isAuthReady.value = true
    }
  })

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (_event, _session) => {
    console.log('[App] Auth Change:', _event)
    if (hasAuthHash && _session) {
      isAuthReady.value = true
    }
    
    session.value = _session
    if (_session) {
      if (isAuthReady.value) {
        await fetchUserProfile()
        await fetchTrips()
      } 
    } else {
      trips.value = []
      if (hasAuthHash) {
         setTimeout(() => { isAuthReady.value = true }, 1000)
      }
    }
  })
})
</script>

<template>
  <div class="min-h-screen bg-surface-50 flex flex-col font-sans text-primary-900">
    
    <!-- Loading State (Initial Auth Check) -->
    <div v-if="!isAuthReady" class="flex-1 flex justify-center items-center h-screen bg-surface-50">
       <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
    </div>

    <!-- Login View -->
    <LoginView v-else-if="!session" />

    <!-- Main App -->
    <template v-else>
      <!-- Global Header -->
      <header class="bg-white/70 backdrop-blur-lg sticky top-0 z-50 border-b border-primary-100 px-6 py-4 supports-[backdrop-filter]:bg-white/60 flex items-center justify-between">
        <div class="w-8"></div> <!-- Spacer for centering -->
        <div class="flex justify-center items-center">
          <img src="/images/title_logo.png" alt="搭帳日誌" class="h-8 md:h-10 w-auto object-contain" />
        </div>
        <!-- Settings Button -->
        <button @click="isSettingsModalOpen = true" class="w-8 h-8 flex items-center justify-center text-primary-400 hover:text-primary-600 transition-colors" title="設定">
           <Settings class="w-5 h-5" />
        </button>
      </header>
  
      <!-- Main Content -->
      <main v-if="!loading" class="pb-24 flex-1 overflow-y-auto">
        <HomeView 
          v-if="activeTab === 'home'" 
          :trips="trips" 
          :user-origin="userProfile"
          :loading="loading"
          @view-detail="handleViewDetail"
          @update-night-rush="handleUpdateNightRush"
        />
  
        <TripListView 
          v-if="activeTab === 'list'" 
          :trips="trips"
          @add="handleAdd"
          @view-detail="handleViewDetail"
          @edit="handleEdit"
          @delete="deleteTrip"
        />
  
        <!-- Map View Container -->
  
        <CalendarView 
          v-if="activeTab === 'calendar'" 
          :trips="trips"
          @view-detail="handleViewDetail" 
        />
  
        <CampsiteLibrary 
          v-if="activeTab === 'library'" 
          :key="campsiteLibraryKey"
          :is-admin="userProfile?.is_admin || false"
          @edit-campsite="handleEditCampsite"
        />
      </main>
  
      <!-- Loading State -->
      <div v-else class="flex justify-center items-center h-screen">
         <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
  
      <!-- Bottom Navigation -->
      <nav class="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-primary-100 px-6 py-3 flex justify-between items-center z-40 pb-safe shadow-[0_-4px_20px_-1px_rgba(14,165,233,0.1)]">
        <button 
          @click="activeTab = 'home'"
          class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
          :class="activeTab === 'home' ? 'text-primary-600 scale-105' : 'text-primary-400 hover:text-primary-600'"
        >
          <Home class="w-6 h-6" :class="{'fill-primary-100': activeTab === 'home'}" />
          <span class="text-[10px] font-medium mb-1">首頁</span>
        </button>
  
        <button 
          @click="activeTab = 'list'"
          class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
          :class="activeTab === 'list' ? 'text-primary-600 scale-105' : 'text-primary-400 hover:text-primary-600'"
        >
          <ListIcon class="w-6 h-6" />
          <span class="text-[10px] font-medium mb-1">足跡</span>
        </button>
  
        <!-- FAB (Floating Action Button) for Add -->
        <button 
          @click="handleAdd"
          class="btn-cta flex flex-col items-center justify-center -mt-10 rounded-full w-14 h-14 shadow-lg shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all duration-300 border-4 border-surface-50 z-50"
        >
          <Plus class="w-7 h-7" />
        </button>
  
        <button 
          @click="activeTab = 'calendar'"
          class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
          :class="activeTab === 'calendar' ? 'text-primary-600 scale-105' : 'text-primary-400 hover:text-primary-600'"
        >
          <CalendarIcon class="w-6 h-6" :class="{'fill-primary-100': activeTab === 'calendar'}" />
          <span class="text-[10px] font-medium mb-1">行事曆</span>
        </button>
  
        <button 
          @click="activeTab = 'library'"
          class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
          :class="activeTab === 'library' ? 'text-primary-600 scale-105' : 'text-primary-400 hover:text-primary-600'"
        >
          <Search class="w-6 h-6" :class="{'fill-primary-100': activeTab === 'library'}" />
          <span class="text-[10px] font-medium mb-1">找營地</span>
        </button>
      </nav>
  
      <!-- Modals -->
      <TripModal
        :is-open="isModalOpen"
        :trip="activeTrip"
        :is-admin="userProfile?.is_admin || false"
        @close="isModalOpen = false"
        @submit="handleSubmit"
        @edit-campsite="handleEditCampsite"
      />

      <SettingsModal
        :is-open="isSettingsModalOpen"
        :user-id="session?.user?.id || ''"
        :trips="trips"
        :initial-invite-code="inviteCode"
        @close="isSettingsModalOpen = false"
        @logout="handleLogout"
        @saved="handleSettingsSaved"
      />

      <CampsiteEditModal
        v-if="isCampsiteEditOpen && editingCampsiteData"
        :is-open="isCampsiteEditOpen"
        :campsite="editingCampsiteData"
        @close="isCampsiteEditOpen = false"
        @saved="handleCampsiteSaved"
      />
    </template>
  </div>
</template>

<style>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 20px);
}
</style>
