<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute, RouterView } from 'vue-router'
import type { CampingTrip, NewCampingTrip, CampingTripWithCampsite } from './types/database'

// Components
import TripModal from './components/TripModal.vue'
import CampsiteEditModal from './components/CampsiteEditModal.vue'
import ToastNotification from './components/ToastNotification.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'

// Composables
import { useAuth } from './composables/useAuth'
import { useUserProfile } from './composables/useUserProfile'
import { useTrips } from './composables/useTrips'

// Router
const router = useRouter()
const route = useRoute()

// Initialize composables
const { session, isAuthReady, initAuth, logout } = useAuth()
const { userProfile, fetchProfile, clearProfile, familyId, isAdmin, userOrigin } = useUserProfile()
const { trips, loading, fetchTrips, createTrip, updateTrip, deleteTrip, updateNightRush, findTripById, clearTrips } = useTrips()

// Modal state
const isModalOpen = ref(false)
const activeTrip = ref<CampingTripWithCampsite | null>(null)
const isCampsiteEditOpen = ref(false)
const editingCampsiteData = ref<any>(null)
const campsiteLibraryKey = ref(0)
const inviteCode = ref('')

// Auto-navigate to settings if invite code exists
watch(() => [isAuthReady.value, session.value], ([ready, sess]) => {
  if (ready && sess && inviteCode.value) {
    router.push('/settings?invite_code=' + inviteCode.value)
  }
})

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

    isModalOpen.value = false
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

const handleCampsiteSaved = () => {
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
  watch([session, isAuthReady], async ([sess, ready]) => {
    if (ready && sess) {
      const pendingCode = localStorage.getItem('pending_invite_code')
      if (pendingCode) {
        inviteCode.value = pendingCode
        localStorage.removeItem('pending_invite_code')
     }
      await fetchProfile(sess.user.id)
      await fetchTrips(sess.user.id, familyId())
    } else if (ready && !sess) {
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
