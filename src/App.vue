<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, RouterView } from 'vue-router'
import type { NewCampingTrip, CampingTripWithCampsite } from './types/database'

// Components
import TripModal from './components/TripModal.vue'
import ToastNotification from './components/ToastNotification.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'

// Composables
import { useAuth } from './composables/useAuth'
import { useUserProfile } from './composables/useUserProfile'
import { useTrips } from './composables/useTrips'
import { useTripModal } from './composables/useTripModal'
import { useEventCategories } from './composables/useEventCategories'
import { useCalendarEvents } from './composables/useCalendarEvents'
import { supabase } from './lib/supabase'
import { buildTripSavePayload } from './utils/tripPayload'

// Router
const route = useRoute()

// Initialize composables
const { session, isAuthReady, initAuth } = useAuth()
const { userProfile, fetchProfile, clearProfile, familyId } = useUserProfile()
const { trips, loading, fetchTrips, createTrip, updateTrip, deleteTrip, findTripById, clearTrips } = useTrips()
const categoriesStore = useEventCategories()
const calendarEventsStore = useCalendarEvents()

// Modal state
const { isOpen: isModalOpen, activeTrip, initialDate, close: closeTripModal } = useTripModal()

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

// Actions
const handleSubmit = async (tripData: NewCampingTrip) => {
  if (!session.value) return

  const dataToSave = buildTripSavePayload(tripData, {
    isEdit: !!activeTrip.value,
    userId: session.value.user.id,
    familyId: familyId() ?? null
  })

  let success = false
  if (activeTrip.value) {
    success = await updateTrip(activeTrip.value.id, dataToSave)
  } else {
    success = await createTrip(dataToSave as NewCampingTrip)
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

onMounted(async () => {
  console.log('[App] Mounted')
  
  // 登出（含 SettingsView 直接呼叫 signOut）一律清掉所有 singleton 狀態，避免下一位使用者看到舊資料
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      clearTrips()
      clearProfile()
      categoriesStore.reset()
      calendarEventsStore.reset()
    }
  })

  // Initialize auth - this will set up listeners
  await initAuth()

  // Watch for auth changes to load user data
  // Watch user id (not the session object) so token refresh on tab refocus
  // doesn't retrigger a full refetch and unmount the current view
  watch([() => session.value?.user?.id, isAuthReady], async ([userId, ready]) => {
    if (ready && userId) {
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
            <component :is="Component" />
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
        :initial-date="initialDate"
        :user-profile="userProfile"
        :has-prev="hasPrevTrip"
        :has-next="hasNextTrip"
        @close="closeTripModal"
        @submit="handleSubmit"
        @delete="deleteTrip"
        @prev="navigateTrip('prev')"
        @next="navigateTrip('next')"
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
