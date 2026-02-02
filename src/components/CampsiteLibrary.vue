<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Search, MapPin, Plus, CheckCircle, Upload, Phone, Tent, AlertTriangle, XCircle, Trash2 } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import type { Campsite } from '../types/database'
import ImportCampsites from './ImportCampsites.vue'
import CampsiteEditModal from './CampsiteEditModal.vue'

const props = defineProps<{
  isAdmin: boolean
}>()

const campsites = ref<Campsite[]>([])
const usageCounts = ref<Record<number, number>>({}) // campsite_id -> count
const loading = ref(false)
const searchQuery = ref('')
const activeTab = ref<'verified' | 'pending'>('verified')
const isImportModalOpen = ref(false)
const editingCampsite = ref<Campsite | null>(null)
const isEditModalOpen = ref(false)

const handleEdit = (site: Campsite) => {
  // Allow everyone to view details
  editingCampsite.value = site
  isEditModalOpen.value = true
}

const handleEditSaved = () => {
  fetchCampsites() // Refresh list
}

const fetchCampsites = async () => {
  loading.value = true
  try {
    let query = supabase
      .from('campsites')
      .select('*') // This already selects all columns including new ones
      .order('created_at', { ascending: false })

    if (!props.isAdmin) {
      // Non-admins only see verified
      query = query.eq('is_verified', true)
    } else {
      // Admins see based on tab
      if (activeTab.value === 'verified') {
        query = query.eq('is_verified', true)
      } else {
        query = query.eq('is_verified', false)
      }
    }

    const { data, error } = await query
    if (error) throw error
    campsites.value = data || []

    // Fetch usage counts
    const { data: tripData, error: tripError } = await supabase
      .from('camping_trips')
      .select('campsite_id')
    
    if (!tripError && tripData) {
      const counts: Record<number, number> = {}
      ;(tripData as any[]).forEach(t => {
        if (t.campsite_id) {
          counts[t.campsite_id] = (counts[t.campsite_id] || 0) + 1
        }
      })
      usageCounts.value = counts
    }
  } catch (e) {
    console.error('Error fetching campsites:', e)
  } finally {
    loading.value = false
  }
}

const filteredCampsites = computed(() => {
  if (!searchQuery.value) return campsites.value
  const q = searchQuery.value.toLowerCase()
  return campsites.value.filter(c => 
    c.name.toLowerCase().includes(q) || 
    (c.city && c.city.toLowerCase().includes(q)) ||
    (c.district && c.district.toLowerCase().includes(q))
  )
})

const verifyCampsite = async (id: number) => {
  const { useConfirm } = await import('../composables/useConfirm')
  const { confirm: showConfirm } = useConfirm()
  
  const confirmed = await showConfirm({
    title: '確定要審核通過此營地嗎？',
    message: '審核通過後，此營地將可供所有用戶查看。',
    confirmText: '確定審核通過',
    cancelText: '取消',
    type: 'info'
  })
  
  if (!confirmed) return
  
  try {
    const { error } = await (supabase
      .from('campsites') as any)
      .update({ is_verified: true })
      .eq('id', id)
    
    if (error) throw error
    // Refresh list
    campsites.value = campsites.value.filter(c => c.id !== id)
    alert('審核成功！')
  } catch (e) {
    console.error('Verify error:', e)
    alert('操作失敗')
  }
}

const deleteCampsite = async (id: number, isReject = false) => {
  const count = usageCounts.value[id] || 0
  
  if (count > 0) {
    alert(`此營地已被使用 ${count} 次，無法刪除！\n請先移除相關露營行程。`)
    return
  }
  
  const { useConfirm } = await import('../composables/useConfirm')
  const { confirm: showConfirm } = useConfirm()
  
  const actionText = isReject ? '駁回' : '刪除'
  
  const confirmed = await showConfirm({
    title: `確定要${actionText}此營地嗎？`,
    message: isReject 
      ? '駁回並刪除此營地資料，此動作無法復原。'
      : '刪除後將無法復原。',
    confirmText: `確定${actionText}`,
    cancelText: '取消',
    type: 'danger'
  })
  
  if (!confirmed) return
  
  try {
    const { error } = await supabase
      .from('campsites')
      .delete()
      .eq('id', id)
      
    if (error) throw error
    
    campsites.value = campsites.value.filter(c => c.id !== id)
    alert(`${actionText}成功`)
  } catch (e) {
    console.error('Delete error:', e)
    alert(`${actionText}失敗`)
  }
}

onMounted(() => {
  fetchCampsites()
})
</script>

<template>
  <div class="p-6 pb-24 font-sans text-center">
    <div class="mb-6">
      <h2 class="text-2xl font-black text-primary-900 flex items-center justify-center gap-2 mb-2">
        <Search class="w-6 h-6 text-accent-sky" />
        找營地
      </h2>
      <p class="text-primary-500 text-sm">搜尋全台露營區資料庫</p>
    </div>

    <!-- Admin Tabs -->
    <div v-if="isAdmin" class="flex justify-center mb-6">
       <div class="bg-gray-100 p-1 rounded-xl flex gap-1">
          <button 
            @click="activeTab = 'verified'; fetchCampsites()" 
            class="px-4 py-2 rounded-lg text-sm font-bold transition-all"
            :class="activeTab === 'verified' ? 'bg-white text-primary-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
          >
            已發布
          </button>
          <button 
            @click="activeTab = 'pending'; fetchCampsites()" 
            class="px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1"
            :class="activeTab === 'pending' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
          >
            待審核
            <span class="w-2 h-2 rounded-full bg-orange-500" v-if="activeTab !== 'pending'"></span>
          </button>
       </div>
    </div>

    <!-- Search Bar -->
    <div class="mb-6 relative">
       <input 
         v-model="searchQuery" 
         type="text" 
         placeholder="搜尋營地名稱、縣市..." 
         class="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent-sky focus:border-transparent outline-none transition-all shadow-sm"
       />
       <Search class="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
    </div>

    <!-- List -->
    <div v-if="loading" class="py-12">
       <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
    </div>

    <div v-else-if="filteredCampsites.length === 0" class="py-12 text-gray-400">
       <MapPin class="w-12 h-12 mx-auto mb-2 opacity-50" />
       <p>沒有找到相關營地</p>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
       <div 
         v-for="site in filteredCampsites" 
         :key="site.id" 
         @click="handleEdit(site)"
         class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left group relative cursor-pointer"
         :class="{'ring-2 ring-primary-500 ring-offset-2': isAdmin}"
       >
          <div class="flex justify-between items-start mb-2">
             <div class="flex items-center gap-2">
                <h3 class="font-bold text-lg text-primary-900 group-hover:text-accent-sky transition-colors">{{ site.name }}</h3>
                <div v-if="!site.latitude || !site.longitude" class="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1" title="缺少 GPS 座標">
                   <AlertTriangle class="w-3 h-3" />
                   無座標
                </div>
             </div>
             <span v-if="site.altitude" class="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded-md font-medium">
               {{ site.altitude }}m
             </span>
          </div>
          
          <div class="flex items-center text-gray-500 text-sm mb-1">
             <MapPin class="w-4 h-4 mr-1 text-gray-400" />
             {{ site.city }}{{ site.district }}
          </div>



          <!-- Zone Config (Raw) -->
          <div v-if="site.zone_config" class="mb-3 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-500 whitespace-pre-wrap border border-gray-100">
             {{ site.zone_config }}
          </div>

          <!-- Tags -->
          <div v-if="site.tags && site.tags.length > 0" class="flex flex-wrap gap-1.5 mb-3">
             <span v-for="tag in site.tags" :key="tag" class="px-2 py-0.5 bg-gray-50 text-gray-600 text-xs rounded-md border border-gray-100 flex items-center gap-1">
                <Tent v-if="['草地','棧板','碎石','雨棚'].includes(tag)" class="w-3 h-3" />
                {{ tag }}
             </span>
          </div>

          <!-- Phone -->
          <div v-if="site.phone" class="text-xs text-gray-400 flex items-center gap-1 mb-2">
             <Phone class="w-3 h-3" />
             {{ site.phone }}
          </div>

          <!-- Pending Actions (Admin Only) -->
          <div v-if="isAdmin && !site.is_verified" class="mt-4 pt-4 border-t border-gray-100 flex justify-end gap-2">
             <button @click.stop="deleteCampsite(site.id, true)" class="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                <XCircle class="w-3.5 h-3.5" />
                駁回
             </button>
             <button @click.stop="verifyCampsite(site.id)" class="bg-green-50 text-green-600 hover:bg-green-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                <CheckCircle class="w-3.5 h-3.5" />
                通過
             </button>
          </div>
          
          <!-- Usage Count (Admin Only or Verified) -->
          <div v-if="isAdmin && site.is_verified" class="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center">
              <span class="text-[10px] text-gray-400 font-bold">
                  已使用: {{ usageCounts[site.id] || 0 }} 次
              </span>
              <button 
                v-if="usageCounts[site.id] === 0 || !usageCounts[site.id]" 
                @click.stop="deleteCampsite(site.id)"
                class="text-gray-300 hover:text-red-500 transition-colors p-1"
                title="刪除無使用紀錄的營地"
              >
                  <Trash2 class="w-4 h-4" />
              </button>
          </div>
       </div>
    </div>

    <!-- Admin Add Buttons (Floating) -->
    <div v-if="isAdmin" class="fixed bottom-24 right-6 flex flex-col gap-3 z-30">
       <button 
        @click="isImportModalOpen = true"
        class="bg-white text-gray-600 p-3 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all border border-gray-100"
        title="批次匯入 (Excel)"
      >
        <Upload class="w-6 h-6" />
      </button>

      <button 
        class="bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 active:scale-90 transition-all z-40 flex items-center justify-center border-4 border-surface-50 w-14 h-14"
        title="新增營地 (管理員)"
      >
        <Plus class="w-8 h-8" />
      </button>
    </div>

    <!-- Modals -->
    <ImportCampsites 
      v-if="isImportModalOpen" 
      @close="isImportModalOpen = false"
      @imported="fetchCampsites"
    />

    <CampsiteEditModal
      v-if="isEditModalOpen && editingCampsite"
      :is-open="isEditModalOpen"
      :campsite="editingCampsite"
      :is-editable="props.isAdmin"
      @close="isEditModalOpen = false"
      @saved="handleEditSaved"
    />

  </div>
</template>
