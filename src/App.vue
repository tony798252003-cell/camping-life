<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from './lib/supabase'
import type { CampingTrip, NewCampingTrip } from './types/database'

// Components
import CampingForm from './components/CampingForm.vue'
import TripDetailModal from './components/TripDetailModal.vue'
import HomeView from './components/HomeView.vue'
import TripListView from './components/TripListView.vue'
import MapView from './components/MapView.vue'
import CalendarView from './components/CalendarView.vue'

// Icons
import { Home, List as ListIcon, Map as MapIcon, Calendar as CalendarIcon, Plus } from 'lucide-vue-next'

// State
const trips = ref<CampingTrip[]>([])
const loading = ref(true)
const isModalOpen = ref(false)
const editingTrip = ref<CampingTrip | null>(null)
const viewingTrip = ref<CampingTrip | null>(null)
const isDetailModalOpen = ref(false)

const activeTab = ref<'home' | 'list' | 'map' | 'calendar'>('home')

// Fetch Trips
const fetchTrips = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('camping_trips')
      .select('*')
      .order('trip_date', { ascending: false })

    if (error) throw error
    trips.value = data || []
  } catch (error) {
    console.error('獲取資料失敗:', error)
    alert('無法載入露營記錄，請檢查 Supabase 連線設定')
  } finally {
    loading.value = false
  }
}

// Actions
const handleViewDetail = (trip: CampingTrip) => {
  viewingTrip.value = trip
  isDetailModalOpen.value = true
}

const handleAdd = () => {
  editingTrip.value = null
  isModalOpen.value = true
}

const handleEdit = (trip: CampingTrip) => {
  editingTrip.value = trip
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
  try {
    if (editingTrip.value) {
      // Update
      const { error } = await (supabase
        .from('camping_trips') as any)
        .update(tripData)
        .eq('id', editingTrip.value.id)
      if (error) throw error
      alert('更新成功！')
    } else {
      // Create
      const { error } = await (supabase
        .from('camping_trips') as any)
        .insert([tripData])
      if (error) throw error
      alert('新增成功！')
    }
    await fetchTrips()
    isModalOpen.value = false
    editingTrip.value = null
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

onMounted(() => {
  fetchTrips()
})
</script>

<template>
  <div class="min-h-screen bg-surface-50 flex flex-col">
    <!-- Global Header -->
    <header class="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 px-6 py-4 text-center">
      <h1 class="text-2xl font-black text-gray-900 tracking-tight font-['Outfit']">Camping Life</h1>
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
      <div v-if="activeTab === 'map'" class="h-full relative">
        <MapView :trips="trips" />
      </div>

      <CalendarView 
        v-if="activeTab === 'calendar'" 
        :trips="trips"
        @view-detail="handleViewDetail" 
      />
    </main>

    <!-- Loading State -->
    <div v-else class="flex justify-center items-center h-screen">
       <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
    </div>

    <!-- Bottom Navigation -->
    <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center z-40 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <button 
        @click="activeTab = 'home'"
        class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
        :class="activeTab === 'home' ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'"
      >
        <Home class="w-6 h-6" :class="{'fill-primary-100': activeTab === 'home'}" />
        <span class="text-[10px] font-bold mb-1">首頁</span>
      </button>

      <button 
        @click="activeTab = 'list'"
        class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
        :class="activeTab === 'list' ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'"
      >
        <ListIcon class="w-6 h-6" />
        <span class="text-[10px] font-bold mb-1">列表</span>
      </button>

      <!-- FAB (Floating Action Button) for Add -->
      <button 
        @click="handleAdd"
        class="flex flex-col items-center justify-center -mt-8 bg-gray-900 text-white rounded-full w-14 h-14 shadow-lg shadow-gray-900/30 hover:scale-105 active:scale-95 transition-all duration-300 border-4 border-surface-50"
      >
        <Plus class="w-7 h-7" />
      </button>

      <button 
        @click="activeTab = 'map'"
        class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
        :class="activeTab === 'map' ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'"
      >
        <MapIcon class="w-6 h-6" :class="{'fill-primary-100': activeTab === 'map'}" />
        <span class="text-[10px] font-bold mb-1">地圖</span>
      </button>

      <button 
        @click="activeTab = 'calendar'"
        class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
        :class="activeTab === 'calendar' ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'"
      >
        <CalendarIcon class="w-6 h-6" :class="{'fill-primary-100': activeTab === 'calendar'}" />
        <span class="text-[10px] font-bold mb-1">行事曆</span>
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
  </div>
</template>

<style>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 20px);
}
</style>
