<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute, RouterView } from 'vue-router'
import { supabase } from './lib/supabase'
import type { CampingTrip, NewCampingTrip, CampingTripWithCampsite } from './types/database'
import type { Session } from '@supabase/supabase-js'

// Components
import TripModal from './components/TripModal.vue'
import CampsiteEditModal from './components/CampsiteEditModal.vue'

// Icons
import { Plus, Home, Calendar as CalendarIcon, List as ListIcon, Search } from 'lucide-vue-next'

// State
const router = useRouter()
const route = useRoute()
const isAuthReady = ref(false)
const session = ref<Session | null>(null)
const trips = ref<CampingTripWithCampsite[]>([])
const loading = ref(true)
const isModalOpen = ref(false)
const activeTrip = ref<CampingTripWithCampsite | null>(null)
const userProfile = ref<{latitude: number, longitude: number, location_name: string, is_admin: boolean, family_id?: string} | null>(null)
const isCampsiteEditOpen = ref(false)
const editingCampsiteData = ref<any>(null)
const campsiteLibraryKey = ref(0) // Used to force refresh CampsiteLibrary
const inviteCode = ref('') // Store invite code from URL

// Auto-navigate to settings if invite code exists
watch(() => [isAuthReady.value, session.value], ([ready, sess]) => {
  if (ready && sess && inviteCode.value) {
    router.push('/settings?invite_code=' + inviteCode.value)
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
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
       console.log('[App] Fetch cancelled')
       return
    }
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
    
    // If it was an edit (activeTrip exists), refresh the activeTrip data and keep modal open
    if (activeTrip.value) {
      const updatedTrip = trips.value.find(t => t.id === activeTrip.value!.id)
      if (updatedTrip) {
        activeTrip.value = updatedTrip
        return // Exit without closing modal
      }
    }

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
  } catch (e: any) {
    if (e.name === 'AbortError' || e.message?.includes('AbortError')) return
    console.error('[App] Error loading profile', e)
  }
}

onMounted(async () => {
  console.log('[App] Mounted')
  
  // Check URL params for invite code
  const params = new URLSearchParams(window.location.search)
  let code = params.get('invite_code')
  
  if (!code && window.location.hash.includes('invite_code')) {
     const hashParts = window.location.hash.split('?')
     if (hashParts.length > 1) {
        const hashParams = new URLSearchParams(hashParts[1])
        code = hashParams.get('invite_code')
     }
  }

  if (code) {
    inviteCode.value = code
    localStorage.setItem('pending_invite_code', code)
  }

  // Set up auth state listener first
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, _session) => {
    console.log('[App] Auth Change:', event)
    session.value = _session

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || (event === 'INITIAL_SESSION' && _session)) {
        if (_session) {
            const pendingCode = localStorage.getItem('pending_invite_code')
            if (pendingCode) {
                inviteCode.value = pendingCode
                localStorage.removeItem('pending_invite_code')
            }
            await fetchUserProfile()
            await fetchTrips()
        }
    } else if (event === 'SIGNED_OUT') {
        trips.value = []
        userProfile.value = null
    }

    // Always mark auth as ready after first event or session load
    isAuthReady.value = true
  })

  // Initial Check (can be redundant if onAuthStateChange fires immediately, but safe for cold start)
  try {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        session.value = data.session
        await fetchUserProfile()
        await fetchTrips()
      }
  } catch (e) {
      console.error('Initial session check failed', e)
  } finally {
      isAuthReady.value = true
  }
})
</script>

<template>
  <div class="min-h-screen bg-surface-50 flex flex-col font-sans text-primary-900">
    
    <!-- Loading State (Initial Auth Check) -->
    <div v-if="!isAuthReady" class="flex-1 flex justify-center items-center h-screen bg-surface-50">
       <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
    </div>

    <!-- Login View (handled by Router View for auth path, or if no session and strictly forcing it, but here we use RouterView mostly) -->
    <!-- However, if we want to force LoginView when !session and route is not auth, we have a guard. 
         So we can just rely on <router-view> for everything. -->
    
    <template v-else>
      <!-- Main Content -->
      <main v-if="!loading || route.name === 'auth'" class="flex-1 overflow-y-auto bg-surface-50">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" 
              :trips="trips"
              :user-origin="userProfile"
              :loading="loading"
              :user-id="session?.user?.id"
              :session="session"
              :is-admin="userProfile?.is_admin || false"
              @view-detail="handleViewDetail"
              @update-night-rush="handleUpdateNightRush"
              @add="handleAdd"
              @edit="handleEdit"
              @delete="deleteTrip"
              @edit-campsite="handleEditCampsite"
              @saved="handleSettingsSaved"
              @logout="handleLogout"
            />
          </transition>
        </router-view>
      </main>
  
      <!-- Loading State -->
      <div v-else class="flex justify-center items-center h-screen">
         <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
  
      <!-- Modals -->
      <TripModal
        :is-open="isModalOpen"
        :trip="activeTrip"
        :is-admin="userProfile?.is_admin || false"
        :user-profile="userProfile"
        @close="isModalOpen = false"
        @submit="handleSubmit"
        @edit-campsite="handleEditCampsite"
        @delete="deleteTrip"
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
