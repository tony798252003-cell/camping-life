<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Plus, Trash2, Tent, X, Check, Edit2, Search, Library } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import type { CampingGear, NewGearItem, CampingTripWithCampsite, SystemAsset } from '../types/database'
import SystemAssetManager from './SystemAssetManager.vue'

const props = defineProps<{
  trips?: CampingTripWithCampsite[]
}>()

const tents = ref<CampingGear[]>([])
const systemImages = ref<SystemAsset[]>([])
const loading = ref(true) // Start with true to prevent empty state flash
const newTentName = ref('')
const newTentBrand = ref('') // New
const newTentImage = ref('')
const isAddModalOpen = ref(false)
const isLibraryModalOpen = ref(false) // New
const isEditMode = ref(false)
const editingTentId = ref<number | null>(null)
const searchQuery = ref('')
const noImageError = ref(false)

// Check if user is admin (simplified check, ideally from session/profile)
const isAdmin = ref(false)

const startEdit = (tent: CampingGear) => {
  newTentName.value = tent.name
  newTentBrand.value = tent.brand || ''
  newTentImage.value = tent.image_url || ''
  editingTentId.value = tent.id
  isEditMode.value = true
  isAddModalOpen.value = true
  noImageError.value = false
  searchQuery.value = ''
}

const openAddModal = () => {
    newTentName.value = ''
    newTentBrand.value = ''
    newTentImage.value = ''
    editingTentId.value = null
    isEditMode.value = false
    isAddModalOpen.value = true
    noImageError.value = false
    searchQuery.value = ''
}

// Fetch tents only (type: 'tent')
const fetchTents = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  // Check admin status
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
  const profile = data as { is_admin: boolean } | null
  if (profile) isAdmin.value = profile.is_admin || false

  loading.value = true
  try {
    const { data, error } = await supabase
      .from('camping_gear')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('type', 'tent')
      .order('created_at', { ascending: true })

    if (error) throw error
    tents.value = (data as any) || []
  } catch (error) {
    console.error('Error fetching tents:', error)
    alert('無法載入帳篷資料')
  } finally {
    loading.value = false
  }
}

// Fetch System Assets
const fetchSystemImages = async () => {
    const { data } = await (supabase
        .from('system_assets') as any)
        .select('*')
        .eq('type', 'tent_image')
        .order('created_at', { ascending: false })
    
    if (data) systemImages.value = (data as any)
}

// Filtered Images
const filteredImages = computed(() => {
    if (!searchQuery.value.trim()) return systemImages.value
    return systemImages.value.filter(img => 
        (img.name && img.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
    )
})

const handleAssetSelect = (asset: SystemAsset) => {
    newTentName.value = asset.name || ''
    newTentBrand.value = asset.brand || ''
    newTentImage.value = asset.url
    isLibraryModalOpen.value = false
    noImageError.value = false
}

// Add or Update tent
const saveTent = async () => {
  if (!newTentName.value.trim()) {
    alert('請輸入帳篷名稱')
    return
  }

  if (!newTentImage.value) {
      noImageError.value = true
      return
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  try {
    if (isEditMode.value && editingTentId.value) {
        // Update
        const { error } = await (supabase
            .from('camping_gear') as any)
            .update({ 
                name: newTentName.value.trim(),
                brand: newTentBrand.value.trim(),
                image_url: newTentImage.value
            })
            .eq('id', editingTentId.value)

        if (error) throw error
        
        // Update local
        const idx = tents.value.findIndex(t => t.id === editingTentId.value)
        if (idx !== -1 && tents.value[idx]) {
            tents.value[idx].name = newTentName.value.trim()
            tents.value[idx].brand = newTentBrand.value.trim()
            tents.value[idx].image_url = newTentImage.value
        }

    } else {
        // Insert
        const newTent: NewGearItem = {
            name: newTentName.value.trim(),
            brand: newTentBrand.value.trim(),
            base_usage_count: 0,
            cost: 0,
            price: 0,
            rental_price: 0,
            type: 'tent',
            category: 'tent',
            purchase_date: new Date().toISOString(),
            user_id: session.user.id,
            image_url: newTentImage.value || undefined
        }

        
        const { data, error } = await (supabase
            .from('camping_gear') as any)
            .insert([newTent])
            .select()
            .single()

        if (error) throw error
        if (data) {
            tents.value.push(data)
        }
    }

    isAddModalOpen.value = false
    newTentName.value = ''
    newTentImage.value = ''
    editingTentId.value = null
  } catch (error) {
    console.error('Error saving tent:', error)
    alert('儲存失敗')
  }
}

// Remove tent
const removeTent = async (id: number) => {
  const { useConfirm } = await import('../composables/useConfirm')
  const { confirm: showConfirm } = useConfirm()
  
  const confirmed = await showConfirm({
    title: '確定要刪除此帳篷嗎？',
    message: '刪除後將無法復原。',
    confirmText: '確定刪除',
    cancelText: '取消',
    type: 'danger'
  })
  
  if (!confirmed) return
  
  try {
    const { error } = await supabase
      .from('camping_gear')
      .delete()
      .eq('id', id)

    if (error) throw error
    tents.value = tents.value.filter(tent => tent.id !== id)
  } catch (error) {
    console.error('Error deleting tent:', error)
    alert('刪除失敗')
  }
}

// Calculate usage from trips
const getTentUsage = (tentId: number) => {
  if (!props.trips) return 0
  return props.trips.filter(t => t.tent_id === tentId).length
}

onMounted(() => {
  fetchTents()
  fetchSystemImages()
})
</script>

<template>
  <div class="h-full relative font-sans">
    <div class="p-6 pb-24 overflow-y-auto h-full">
      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>

      <!-- Tent List (Compact) -->
      <div v-else-if="tents.length > 0" class="flex flex-col space-y-3">
        <div
          v-for="tent in tents"
          :key="tent.id"
          @click="startEdit(tent)"
          class="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex items-center justify-between hover:shadow-md transition-all cursor-pointer group"
        >
           <!-- Left: Info -->
           <div class="flex items-center gap-4">
             <!-- Image -->
             <div 
               class="w-14 h-14 rounded-lg flex items-center justify-center overflow-hidden shrink-0 border border-gray-100 bg-gray-50"
             >
               <img v-if="tent.image_url" :src="tent.image_url" class="w-full h-full object-contain p-1" />
               <Tent v-else class="w-6 h-6 text-gray-300" />
             </div>
             
             <!-- Text -->
             <div>
                <div class="font-bold text-gray-900">{{ tent.name }}</div>
                <div v-if="tent.brand" class="text-xs text-gray-500 font-medium">{{ tent.brand }}</div>
             </div>
           </div>

           <!-- Right: Stats & Actions -->
           <div class="flex items-center gap-4">
              <!-- Usage Badge -->
              <div class="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full flex items-center gap-1">
                 {{ getTentUsage(tent.id) }} 次
              </div>
              
              <!-- Actions (Hidden by default, visible on hover) -->
              <div class="hidden sm:flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                   <button
                     @click.stop="startEdit(tent)"
                     class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                   >
                     <Edit2 class="w-4 h-4" />
                   </button>
                   <button
                     @click.stop="removeTent(tent.id)"
                     class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                   >
                     <Trash2 class="w-4 h-4" />
                   </button>
              </div>
              
              <ChevronRight class="w-4 h-4 text-gray-300 sm:hidden" />
           </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else-if="loading" class="flex justify-center items-center py-16 h-[60vh]">
        <div class="flex flex-col items-center gap-3 text-primary-400">
          <div class="animate-spin">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </div>
          <span class="text-sm font-medium">載入中...</span>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-16 flex flex-col items-center justify-center h-[60vh]">
        <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
           <Tent class="w-10 h-10 text-gray-300" />
        </div>
        <p class="text-gray-400 font-medium mb-2">還沒有帳篷</p>
        <p class="text-sm text-gray-300">點擊右下角新增按鈕</p>
      </div>
    </div>

    <!-- Floating Action Button -->
    <button
      @click="openAddModal"
      class="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-10"
    >
      <Plus class="w-7 h-7" />
    </button>

    <!-- Add/Edit Tent Modal -->
    <div v-if="isAddModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="isAddModalOpen = false">
      <div class="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
         
         <!-- Header -->
         <div class="p-6 pb-2 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
             <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Tent class="w-5 h-5 text-blue-600" />
                {{ isEditMode ? '編輯帳篷' : '新增帳篷' }}
             </h3>
             <button @click="isAddModalOpen = false" class="p-1 rounded-full hover:bg-gray-100"><X class="w-5 h-5 text-gray-400" /></button>
         </div>

         <!-- Scrollable Content -->
         <div class="p-6 overflow-y-auto">
             <!-- Name Input -->
             <div class="mb-4">
                 <label class="block text-sm font-medium text-gray-700 mb-2">帳篷名稱</label>
                 <input
                   v-model="newTentName"
                   type="text"
                   placeholder="e.g. Amenity Dome"
                   class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base font-bold text-gray-900"
                 />
             </div>

             <!-- Brand Input -->
             <div class="mb-6">
                 <label class="block text-sm font-medium text-gray-700 mb-2">品牌 (選填)</label>
                 <input
                   v-model="newTentBrand"
                   type="text"
                   placeholder="e.g. Snow Peak"
                   class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base"
                 />
             </div>
             
             <!-- Library Selection Button -->
             <div class="mb-6">
                 <div class="flex items-center justify-between mb-2">
                     <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">快速填寫</span>
                 </div>
                 <button 
                   @click="isLibraryModalOpen = true"
                   class="w-full py-3 px-4 bg-indigo-50 text-indigo-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors border border-indigo-100"
                 >
                     <Library class="w-5 h-5" /> 從裝備庫選擇
                 </button>
             </div>
             
             <!-- Image Selection -->
             <div>
                 <div class="flex justify-between items-center mb-3">
                     <label class="block text-sm font-medium text-gray-700">選擇圖示 <span class="text-red-500">*</span></label>
                 </div>
                 
                 <!-- Search Bar -->
                 <div class="relative mb-3">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      v-model="searchQuery" 
                      type="text" 
                      placeholder="搜尋圖片名稱..." 
                      class="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                 </div>
                 
                 <div v-if="noImageError" class="text-xs text-red-500 font-bold mb-2 flex items-center gap-1">
                     <X class="w-3 h-3" /> 請選擇一張代表圖片
                 </div>

                 <!-- Grid -->
                 <div class="grid grid-cols-4 gap-3 max-h-[300px] overflow-y-auto p-1">
                     <div 
                        v-for="img in filteredImages" 
                        :key="img.id"
                        @click="{ newTentImage = img.url; noImageError = false }"
                        class="aspect-square rounded-xl border-2 flex items-center justify-center cursor-pointer relative overflow-hidden transition-all hover:scale-105"
                        :class="newTentImage === img.url ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50' : 'border-gray-100 hover:border-blue-300 bg-white'"
                     >
                         <img :src="img.url" class="w-full h-full object-contain p-2" :title="img.name || ''" />
                         <div v-if="newTentImage === img.url" class="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                             <div class="bg-blue-500 text-white rounded-full p-0.5 shadow-sm">
                                 <Check class="w-3 h-3" />
                             </div>
                         </div>
                     </div>
                     <!-- Empty Search Result -->
                     <div v-if="filteredImages.length === 0" class="col-span-4 text-center py-8 text-gray-400 text-xs">
                         找不到相關圖片
                     </div>
                 </div>
             </div>
         </div>
         
         <!-- Footer -->
         <div class="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
            <button 
              @click="isAddModalOpen = false"
              class="flex-1 py-3 text-gray-500 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl font-bold transition-colors"
            >
              取消
            </button>
            <button
              @click="saveTent"
              :disabled="!newTentName.trim()"
              class="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isEditMode ? '儲存變更' : '新增' }}
            </button>
         </div>
      </div>
    </div>
    
    <!-- Float -->
    
    <!-- System Gear Selector Modal -->
    <SystemAssetManager 
        :is-open="isLibraryModalOpen" 
        mode="select"
        @select="handleAssetSelect"
        @close="isLibraryModalOpen = false" 
    />
  </div>
</template>
