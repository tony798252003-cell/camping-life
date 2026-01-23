<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from './lib/supabase'
import type { CampingTrip, NewCampingTrip } from './types/database'
import type { Session } from '@supabase/supabase-js'

// Components
import CampingForm from './components/CampingForm.vue'
import TripDetailModal from './components/TripDetailModal.vue'
import HomeView from './components/HomeView.vue'
import TripListView from './components/TripListView.vue'
import CalendarView from './components/CalendarView.vue'
import GearROIView from './components/GearROIView.vue'
import LoginView from './components/LoginView.vue'

// Icons
import { Home, List as ListIcon, Calendar as CalendarIcon, Plus, Tent, LogOut } from 'lucide-vue-next'

// State
const isAuthReady = ref(false)
const session = ref<Session | null>(null)
const trips = ref<CampingTrip[]>([])
const loading = ref(true)
// ... (rest of state)

// ...

onMounted(() => {
  // Get initial session
  supabase.auth.getSession().then(({ data }) => {
    session.value = data.session
    if (session.value) {
      fetchTrips()
    }
    isAuthReady.value = true
  })

  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, _session) => {
    session.value = _session
    if (_session) {
      if (isAuthReady.value) fetchTrips() // Only fetch if ready, otherwise the initial fetch handles it
    } else {
      trips.value = []
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
        <!-- Logout Button -->
        <button @click="handleLogout" class="w-8 h-8 flex items-center justify-center text-primary-400 hover:text-primary-600 transition-colors" title="登出">
           <LogOut class="w-5 h-5" />
        </button>
      </header>
  
      <!-- Main Content -->
      <main v-if="!loading" class="pb-24 flex-1 overflow-y-auto">
        <HomeView 
          v-if="activeTab === 'home'" 
          :trips="trips" 
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
  
        <GearROIView 
          v-if="activeTab === 'roi'" 
          :trips="trips"
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
          <span class="text-[10px] font-medium mb-1">列表</span>
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
          @click="activeTab = 'roi'"
          class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
          :class="activeTab === 'roi' ? 'text-primary-600 scale-105' : 'text-primary-400 hover:text-primary-600'"
        >
          <Tent class="w-6 h-6" :class="{'fill-primary-100': activeTab === 'roi'}" />
          <span class="text-[10px] font-medium mb-1">裝備</span>
        </button>
      </nav>
  
      <!-- Modals -->
      <CampingForm
        :is-open="isModalOpen"
        :trip="editingTrip"
        @close="isModalOpen = false"
        @submit="handleSubmit"
      />
  
      <TripDetailModal
        :is-open="isDetailModalOpen"
        :trip="viewingTrip"
        @close="isDetailModalOpen = false"
      />
    </template>
  </div>
</template>

<style>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 20px);
}
</style>
