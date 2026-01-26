<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
const userProfile = ref<{latitude: number, longitude: number, location_name: string, is_admin: boolean} | null>(null)
const isCampsiteEditOpen = ref(false)
const editingCampsiteData = ref<any>(null)
const campsiteLibraryKey = ref(0) // Used to force refresh CampsiteLibrary

const activeTab = ref<'home' | 'list' | 'calendar' | 'library'>('home')

// Fetch Trips
const fetchTrips = async () => {
  if (!session.value) return 
  
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('camping_trips')
      .select('*, campsites(*)')
      .eq('user_id', session.value.user.id) // Filter by User ID
      .order('trip_date', { ascending: false })

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
    // Attach User ID to the new trip data
    const dataToSave = {
      ...tripData,
      user_id: session.value.user.id
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

const handleLogout = async () => {
  await supabase.auth.signOut()
  session.value = null
  trips.value = []
}

const fetchUserProfile = async () => {
  if (!session.value) return
  try {
    const { data } = await supabase
      .from('profiles')
      .select('latitude, longitude, location_name, is_admin')
      .eq('id', session.value.user.id)
      .single()
    
    if (data) {
      userProfile.value = {
        latitude: (data as any).latitude,
        longitude: (data as any).longitude,
        location_name: (data as any).location_name || '自訂起點',
        is_admin: (data as any).is_admin || false
      }
    }
  } catch (e) {
    console.error('Error loading profile', e)
  }
}

const handleSettingsSaved = (profileData: any) => {
  if (profileData.latitude && profileData.longitude) {
    userProfile.value = {
      latitude: profileData.latitude,
      longitude: profileData.longitude,
      location_name: profileData.location_name,
      is_admin: userProfile.value?.is_admin || false
    }
  }
}

const handleEditCampsite = (site: any) => {
  editingCampsiteData.value = site
  isCampsiteEditOpen.value = true
}

const handleCampsiteSaved = async () => {
  // Refresh Trip List (in case campsite name changed in trips)
  await fetchTrips()
  
  // If we are currently editing a trip (CampingForm is open), we need to update the prop
  // with the fresh data from fetchTrips so changes reflect immediately in the modal.
  if (activeTrip.value) {
    const freshTrip = trips.value.find(t => t.id === activeTrip.value?.id)
    if (freshTrip) {
      activeTrip.value = freshTrip
    }
  }

  // Refresh Library (force re-mount to re-fetch)
  campsiteLibraryKey.value++
}

onMounted(() => {
  // Check if we are handling an OAuth redirect
  // Support both Implicit (hash) and PKCE (search param 'code') flows
  const hasAuthHash = (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token'))) || 
                      (window.location.search && window.location.search.includes('code'))
  
  // Get initial session
  supabase.auth.getSession().then(({ data }) => {
    session.value = data.session
    if (session.value) {
      fetchTrips()
      fetchUserProfile()
      isAuthReady.value = true
    } else if (!hasAuthHash) {
      // Only set ready if NO session AND NO auth hash (normal login page load)
      isAuthReady.value = true
    }
    // If hasAuthHash is true, we wait for onAuthStateChange
  })

  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, _session) => {
    // If we have a hash and get a session, now we are ready
    if (hasAuthHash && _session) {
      isAuthReady.value = true
    }
    
    session.value = _session
    if (_session) {
      if (isAuthReady.value) {
        fetchTrips()
        fetchUserProfile()
      } 
    } else {
      trips.value = []
      // If we were waiting but got no session (e.g. error), force ready to show login
      // But give it a small timeout to ensure it's not a race
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
