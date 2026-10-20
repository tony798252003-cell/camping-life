<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute, RouterView } from 'vue-router'
import type { CampingTrip, NewCampingTrip, CampingTripWithCampsite, Campsite } from './types/database'

// Components
import TripModal from './components/TripModal.vue'
import CampsiteEditModal from './components/CampsiteEditModal.vue'
import ToastNotification from './components/ToastNotification.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'

// Composables
import { useAuth } from './composables/useAuth'
import { useUserProfile } from './composables/useUserProfile'
import { useTrips } from './composables/useTrips'
import { useTripModal } from './composables/useTripModal'

// Router
const router = useRouter()
const route = useRoute()

// Initialize composables
const { session, isAuthReady, initAuth, logout } = useAuth()
const { userProfile, fetchProfile, clearProfile, familyId, isAdmin, userOrigin } = useUserProfile()
const { trips, loading, fetchTrips, createTrip, updateTrip, deleteTrip, updateNightRush, findTripById, clearTrips } = useTrips()

// Modal state
const { isOpen: isModalOpen, activeTrip, initialDate, openNew, openEdit, close: closeTripModal } = useTripModal()
const tripModalRef = ref<InstanceType<typeof TripModal> | null>(null)
const isCampsiteEditOpen = ref(false)
const editingCampsiteData = ref<any>(null)
const campsiteLibraryKey = ref(0)

const inviteCode = ref('')

// Navigation
const sortedTrips = computed(() => {
  return [...trips.value].sort((a, b) => new Date(b.trip_date).getTime() - new Date(a.trip_date).getTime())
})

const currentTripIndex = computed(() => {
  if (!activeTrip.value) return -1
  return sortedTrips.value.findIndex(t => t.id === activeTrip.value?.id)
})

const hasPrevTrip = computed(() => currentTripIndex.value !== -1 && currentTripIndex.value < sortedTrips.value.length - 1)
const hasNextTrip = computed(() => currentTripIndex.value > 0)

const navigateTrip = (direction: 'prev' | 'next') => {
  if (currentTripIndex.value === -1) return
  
  // Prev (Left) -> Older (Higher Index)
  // Next (Right) -> Newer (Lower Index)
  const newIndex = direction === 'prev' ? currentTripIndex.value + 1 : currentTripIndex.value - 1
  if (newIndex >= 0 && newIndex < sortedTrips.value.length) {
    activeTrip.value = sortedTrips.value[newIndex] as CampingTripWithCampsite
  }
}

// Auto-navigate to settings if invite code exists
watch(() => [isAuthReady.value, session.value], ([ready, sess]) => {
  if (ready && sess && inviteCode.value) {
    router.push('/settings?invite_code=' + inviteCode.value)
  }
})

// Actions
const handleViewDetail = (trip: CampingTrip) => {
  openEdit(trip as CampingTripWithCampsite)
}

const handleAdd = () => {
  openNew()
}

const handleEdit = (trip: CampingTrip) => {
  openEdit(trip as CampingTripWithCampsite)
}

const handleDeleteTrip = async (id: number) => {
  const success = await deleteTrip(id)
  if (success) {
    await fetchTrips(session.value!.user.id, familyId())
  }
}

const handleSubmit = async (tripData: NewCampingTrip) => {
  if (!session.value) return

  const dataToSave = {
    ...tripData,
    user_id: session.value.user.id,
    family_id: familyId() ?? null
  }

  let success = false
  if (activeTrip.value) {
    success = await updateTrip(activeTrip.value.id, dataToSave)
  } else {
    success = await createTrip(dataToSave)
  }

  if (success) {
    await fetchTrips(session.value.user.id, familyId())
    
    if (activeTrip.value) {
      const updatedTrip = findTripById(activeTrip.value.id)
      if (updatedTrip) {
        activeTrip.value = updatedTrip
        return
      }
    }

    closeTripModal()
    activeTrip.value = null
  }
}

const handleUpdateNightRush = async ({ id, value }: { id: number, value: boolean }) => {
  const success = await updateNightRush(id, value)
  if (success && session.value) {
    await fetchTrips(session.value.user.id, familyId())
  }
}

const handleEditCampsite = (campsite: any) => {
  editingCampsiteData.value = campsite
  isCampsiteEditOpen.value = true
}

// TripModal 內「＋新增營區」：在其上疊開新增模式，TripModal 不卸載、表單保留
const handleAddCampsiteFromTrip = (prefill: { name: string; latitude?: number | null; longitude?: number | null; altitude?: number | null }) => {
  // 營區圖鑑新增流程共用 draft key，清掉舊草稿才不會蓋掉預填的名稱
  localStorage.removeItem('campsite-draft-0')
  editingCampsiteData.value = {
    id: 0,
    name: prefill.name,
    city: '',
    district: '',
    altitude: prefill.altitude ?? null,
    latitude: prefill.latitude ?? null,
    longitude: prefill.longitude ?? null,
    phone: null,
    tags: [],
    amenities: { has_fridge: false, has_freezer: false, has_water_dispenser: false },
    is_verified: false,
    created_at: new Date().toISOString(),
    playground_features: [],
    water_features: [],
    scenery_features: [],
    spot_types: [],
    booking_method: [],
    booking_difficulty: 'normal',
  }
  isCampsiteEditOpen.value = true
}

const handleCampsiteSaved = (saved?: Campsite) => {
  if (editingCampsiteData.value?.id === 0 && saved) {
    tripModalRef.value?.selectCampsite(saved)
  }
  isCampsiteEditOpen.value = false
  editingCampsiteData.value = null
  campsiteLibraryKey.value++
  if (session.value) {
    fetchTrips(session.value.user.id, familyId())
  }
}

const handleSettingsSaved = () => {
  if (session.value) {
    fetchProfile(session.value.user.id)
  }
}

const handleLogout = async () => {
  await logout()
  clearTrips()
  clearProfile()
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

  // Initialize auth - this will set up listeners
  await initAuth()

  // Watch for auth changes to load user data
  // Watch user id (not the session object) so token refresh on tab refocus
  // doesn't retrigger a full refetch and unmount the current view
  watch([() => session.value?.user?.id, isAuthReady], async ([userId, ready]) => {
    if (ready && userId) {
      const pendingCode = localStorage.getItem('pending_invite_code')
      if (pendingCode) {
        inviteCode.value = pendingCode
        localStorage.removeItem('pending_invite_code')
     }
      await fetchProfile(userId)
      await fetchTrips(userId, familyId())
    } else if (ready && !userId) {
      clearProfile()
      clearTrips()
    }
  }, { immediate: true })
})
</script>

<template>
  <div class="h-screen overflow-hidden bg-surface-50 flex flex-col font-sans text-primary-900">
    
    <!-- Loading State (Initial Auth Check) -->
    <div v-if="!isAuthReady" class="flex-1 flex justify-center items-center h-screen bg-surface-50">
       <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
    </div>

    <!-- Login View (handled by Router View for auth path, or if no session and strictly forcing it, but here we use RouterView mostly) -->
    <!-- However, if we want to force LoginView when !session and route is not auth, we have a guard. 
         So we can just rely on <router-view> for everything. -->
    
    <template v-else>
      <!-- Main Content -->
      <main v-if="!loading || route.name === 'auth'" class="flex-1 overflow-hidden relative bg-surface-50">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" 
              :trips="trips"
              :user-origin="userOrigin()"
              :loading="loading"
              :user-id="session?.user?.id"
              :session="session"
              :is-admin="isAdmin()"
              @view-detail="handleViewDetail"
              @update-night-rush="handleUpdateNightRush"
              @add="handleAdd"
              @edit="handleEdit"
              @delete="handleDeleteTrip"
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
        ref="tripModalRef"
        :is-open="isModalOpen"
        :trip="activeTrip"
        :initial-date="initialDate"
        :is-admin="userProfile?.is_admin || false"
        :user-profile="userProfile"
        :has-prev="hasPrevTrip"
        :has-next="hasNextTrip"
        @close="closeTripModal"
        @submit="handleSubmit"
        @edit-campsite="handleEditCampsite"
        @add-campsite="handleAddCampsiteFromTrip"
        @delete="deleteTrip"
        @prev="navigateTrip('prev')"
        @next="navigateTrip('next')"
      />

      <CampsiteEditModal
        v-if="isCampsiteEditOpen && editingCampsiteData"
        :is-open="isCampsiteEditOpen"
        :campsite="editingCampsiteData"
        :is-editable="editingCampsiteData.id === 0"
        @close="isCampsiteEditOpen = false"
        @saved="handleCampsiteSaved"
      />
      
      <!-- Global Components -->
      <ToastNotification />
      <ConfirmDialog />
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
