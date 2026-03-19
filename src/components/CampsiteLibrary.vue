<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Search, MapPin, Plus, CheckCircle, Upload, AlertTriangle, XCircle, SlidersHorizontal, ChevronRight, Settings2 } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import type { Campsite } from '../types/database'
import ImportCampsites from './ImportCampsites.vue'
import CampsiteEditModal from './CampsiteEditModal.vue'
import CampsiteFilterSheet, { type CampsiteFilters } from './CampsiteFilterSheet.vue'

const props = defineProps<{
  isAdmin: boolean
}>()

const campsites = ref<Campsite[]>([])
const usageCounts = ref<Record<number, number>>({}) // campsite_id -> count
const visitedIds = ref<Set<number>>(new Set()) // completed or booked campsite_ids
const hideVisited = ref(true)
const loading = ref(false)
const searchQuery = ref('')
const activeTab = ref<'verified' | 'pending'>('verified')
const isImportModalOpen = ref(false)
const editingCampsite = ref<Campsite | null>(null)
const isEditModalOpen = ref(false)
const isFilterOpen = ref(false)
const filters = ref<CampsiteFilters>({
  city: '',
  district: '',
  playgroundFeatures: [],
  waterFeatures: [],
  sceneryFeatures: [],
  spotTypes: [],
  altitudeMin: null,
  altitudeMax: null,
  capacityMin: null,
})

const activeFilterCount = computed(() => {
  const f = filters.value
  let count = 0
  if (f.city) count++
  if (f.district) count++
  if (f.playgroundFeatures.length) count++
  if (f.waterFeatures.length) count++
  if (f.sceneryFeatures.length) count++
  if (f.spotTypes.length) count++
  if (f.altitudeMin !== null || f.altitudeMax !== null) count++
  if (f.capacityMin !== null) count++
  return count
})

function applyFilters(newFilters: CampsiteFilters) {
  filters.value = newFilters
}

// Quick chips
interface QuickChip {
  key: string
  label: string
  apply: (f: CampsiteFilters) => void
  isActive: (f: CampsiteFilters) => boolean
}

const QUICK_CHIPS: QuickChip[] = [
  { key: 'alt800', label: '800m+', apply: f => { f.altitudeMin = 800 }, isActive: f => f.altitudeMin === 800 },
  { key: 'alt1000', label: '1000m+', apply: f => { f.altitudeMin = 1000 }, isActive: f => f.altitudeMin === 1000 },
  { key: 'shelter', label: '有雨棚', apply: f => { if (!f.spotTypes.includes('雨棚')) f.spotTypes.push('雨棚') }, isActive: f => f.spotTypes.includes('雨棚') },
  { key: 'forest', label: '森林', apply: f => { if (!f.sceneryFeatures.includes('森林')) f.sceneryFeatures.push('森林') }, isActive: f => f.sceneryFeatures.includes('森林') },
  { key: 'water', label: '有戲水', apply: f => { if (!f.waterFeatures.includes('溪流')) f.waterFeatures.push('溪流') }, isActive: f => f.waterFeatures.includes('溪流') },
  { key: 'playground', label: '有遊樂', apply: f => { if (!f.playgroundFeatures.includes('溜滑梯')) f.playgroundFeatures.push('溜滑梯') }, isActive: f => f.playgroundFeatures.length > 0 },
  { key: 'cap15', label: '15帳+', apply: f => { f.capacityMin = 15 }, isActive: f => f.capacityMin === 15 },
  { key: 'cap20', label: '20帳+', apply: f => { f.capacityMin = 20 }, isActive: f => f.capacityMin === 20 },
  { key: 'cap30', label: '30帳+', apply: f => { f.capacityMin = 30 }, isActive: f => f.capacityMin === 30 },
]

function isChipActive(chip: QuickChip) {
  return chip.isActive(filters.value)
}

function toggleQuickChip(chip: QuickChip) {
  const f = { ...filters.value, spotTypes: [...filters.value.spotTypes], sceneryFeatures: [...filters.value.sceneryFeatures], waterFeatures: [...filters.value.waterFeatures], playgroundFeatures: [...filters.value.playgroundFeatures] }
  if (chip.isActive(f)) {
    // 取消
    if (chip.key === 'alt800' || chip.key === 'alt1000') f.altitudeMin = null
    else if (chip.key === 'shelter') f.spotTypes = f.spotTypes.filter(t => t !== '雨棚')
    else if (chip.key === 'forest') f.sceneryFeatures = f.sceneryFeatures.filter(t => t !== '森林')
    else if (chip.key === 'water') f.waterFeatures = f.waterFeatures.filter(t => t !== '溪流')
    else if (chip.key === 'playground') f.playgroundFeatures = []
    else if (chip.key.startsWith('cap')) f.capacityMin = null
  } else {
    chip.apply(f)
  }
  filters.value = f
}

const handleEdit = (site: Campsite) => {
  editingCampsite.value = site
  isEditModalOpen.value = true
}

const handleAddNew = () => {
  editingCampsite.value = {
    id: 0,
    name: '',
    city: '',
    district: '',
    altitude: null,
    latitude: null,
    longitude: null,
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
  } as any
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

    // Fetch usage counts + visited/booked ids
    const { data: tripData, error: tripError } = await supabase
      .from('camping_trips')
      .select('campsite_id, status')

    if (!tripError && tripData) {
      const counts: Record<number, number> = {}
      const visited = new Set<number>()
      ;(tripData as any[]).forEach(t => {
        if (t.campsite_id) {
          counts[t.campsite_id] = (counts[t.campsite_id] || 0) + 1
          if (t.status === 'completed' || t.status === 'booked') {
            visited.add(t.campsite_id)
          }
        }
      })
      usageCounts.value = counts
      visitedIds.value = visited
    }
  } catch (e) {
    console.error('Error fetching campsites:', e)
  } finally {
    loading.value = false
  }
}

const filteredCampsites = computed(() => {
  let result = campsites.value

  // 文字搜尋
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.district && c.district.toLowerCase().includes(q))
    )
  }

  const f = filters.value

  if (f.city) result = result.filter(c => c.city === f.city)

  if (f.district) result = result.filter(c => c.district === f.district)

  if (f.playgroundFeatures.length)
    result = result.filter(c => f.playgroundFeatures.some(tag => c.playground_features?.includes(tag)))

  if (f.waterFeatures.length)
    result = result.filter(c => f.waterFeatures.some(tag => c.water_features?.includes(tag)))

  if (f.sceneryFeatures.length)
    result = result.filter(c => f.sceneryFeatures.some(tag => c.scenery_features?.includes(tag)))

  if (f.spotTypes.length)
    result = result.filter(c => f.spotTypes.some(tag => c.spot_types?.includes(tag)))

  if (f.altitudeMin !== null)
    result = result.filter(c => c.altitude !== null && c.altitude !== undefined && c.altitude >= f.altitudeMin!)

  if (f.altitudeMax !== null)
    result = result.filter(c => c.altitude !== null && c.altitude !== undefined && c.altitude <= f.altitudeMax!)

  if (f.capacityMin !== null)
    result = result.filter(c => (c.total_capacity ?? 0) >= f.capacityMin!)

  if (hideVisited.value)
    result = result.filter(c => !visitedIds.value.has(c.id))

  return result
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

// Quick chip preferences
const enabledChipKeys = ref<string[]>(QUICK_CHIPS.map(c => c.key)) // 預設全開
const isChipConfigOpen = ref(false)
const userId = ref<string | null>(null)

const visibleChips = computed(() => QUICK_CHIPS.filter(c => enabledChipKeys.value.includes(c.key)))

async function loadChipPrefs() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  userId.value = session.user.id
  const { data } = await supabase
    .from('profiles')
    .select('campsite_quick_chips')
    .eq('id', session.user.id)
    .single()
  if (data?.campsite_quick_chips?.length) {
    enabledChipKeys.value = data.campsite_quick_chips
  }
}

async function saveChipPrefs() {
  if (!userId.value) return
  await supabase
    .from('profiles')
    .update({ campsite_quick_chips: enabledChipKeys.value } as any)
    .eq('id', userId.value)
}

function toggleChipKey(key: string) {
  if (enabledChipKeys.value.includes(key)) {
    enabledChipKeys.value = enabledChipKeys.value.filter(k => k !== key)
  } else {
    enabledChipKeys.value = [...enabledChipKeys.value, key]
  }
  saveChipPrefs()
}

const isNewlyOpened = (lastAvailableDate: string | null | undefined, scrapedAt: string | null | undefined) => {
  if (!lastAvailableDate || !scrapedAt) return false
  const scraped = new Date(scrapedAt)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return scraped > sevenDaysAgo
}

const isExpiringSoon = (availableUntil: string | null | undefined) => {
  if (!availableUntil) return false
  const deadline = new Date(availableUntil)
  const thirtyDaysLater = new Date()
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)
  return deadline <= thirtyDaysLater && deadline >= new Date()
}

onMounted(() => {
  fetchCampsites()
  loadChipPrefs()
})
</script>

<template>
  <div class="pb-24 font-sans text-center">
    <!-- Sticky Header -->
    <div class="sticky top-0 z-20 bg-gray-50 px-3 pt-3 pb-1 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-xl font-black text-primary-900 flex items-center gap-2">
          <Search class="w-5 h-5 text-accent-sky" />
          找營地
        </h2>
        <!-- Admin Tabs -->
        <div v-if="isAdmin" class="bg-gray-100 p-0.5 rounded-lg flex gap-0.5">
          <button
            @click="activeTab = 'verified'; fetchCampsites()"
            class="px-3 py-1 rounded-md text-xs font-bold transition-all"
            :class="activeTab === 'verified' ? 'bg-white text-primary-900 shadow-sm' : 'text-gray-500'"
          >已發布</button>
          <button
            @click="activeTab = 'pending'; fetchCampsites()"
            class="px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1"
            :class="activeTab === 'pending' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'"
          >
            待審核
            <span class="w-1.5 h-1.5 rounded-full bg-orange-500" v-if="activeTab !== 'pending'"></span>
          </button>
        </div>
      </div>

      <!-- Search Bar + Filter Button -->
      <div class="mb-2 flex gap-2 items-center">
        <div class="relative flex-1">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜尋營地名稱、縣市..."
            class="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent-sky focus:border-transparent outline-none transition-all shadow-sm"
          />
          <Search class="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
        </div>
        <button
          @click="isFilterOpen = true"
          class="relative flex-shrink-0 flex items-center gap-1.5 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm font-semibold text-sm transition-all hover:border-primary-400"
          :class="activeFilterCount > 0 ? 'text-primary-600 border-primary-400' : 'text-gray-600'"
        >
          <SlidersHorizontal class="w-4 h-4" />
          篩選
          <span
            v-if="activeFilterCount > 0"
            class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center"
          >{{ activeFilterCount }}</span>
        </button>
      </div>

      <!-- Quick Filter Chips -->
      <div class="mb-1 flex gap-2 overflow-x-auto pb-2 scrollbar-hide items-center">
        <button
          v-for="chip in visibleChips"
          :key="chip.key"
          @click="toggleQuickChip(chip)"
          class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
          :class="isChipActive(chip) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200'"
        >{{ chip.label }}</button>
        <button
          @click="hideVisited = !hideVisited"
          class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
          :class="hideVisited ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-200'"
        >隱藏去過</button>
        <button
          @click="isChipConfigOpen = true"
          class="flex-shrink-0 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          title="自訂快捷篩選"
        ><Settings2 class="w-4 h-4" /></button>
      </div>
    </div><!-- end sticky -->

    <!-- Chip 設定 Modal -->
    <Teleport to="body">
      <div v-if="isChipConfigOpen" class="fixed inset-0 bg-black/40 z-50 flex items-end" @click.self="isChipConfigOpen = false">
        <div class="bg-white w-full rounded-t-2xl p-5">
          <div class="flex items-center justify-between mb-4">
            <span class="font-bold text-gray-800">自訂快捷篩選</span>
            <button @click="isChipConfigOpen = false" class="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="chip in QUICK_CHIPS"
              :key="chip.key"
              @click="toggleChipKey(chip.key)"
              class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
              :class="enabledChipKeys.includes(chip.key) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-400 border-gray-200'"
            >{{ chip.label }}</button>
          </div>
          <p class="text-xs text-gray-400 mt-3">點選開啟或關閉，會自動儲存</p>
        </div>
      </div>
    </Teleport>

    <!-- List -->
    <div v-if="loading" class="px-3 py-12">
       <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
    </div>

    <div v-else-if="filteredCampsites.length === 0" class="px-3 py-12 text-gray-400">
       <MapPin class="w-12 h-12 mx-auto mb-2 opacity-50" />
       <p>沒有找到相關營地</p>
    </div>

    <div v-else class="flex flex-col gap-2 px-3">
       <div
         v-for="site in filteredCampsites"
         :key="site.id"
         @click="handleEdit(site)"
         class="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
       >
          <!-- 左：名稱 + 地點 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="font-semibold text-sm text-primary-900 group-hover:text-accent-sky transition-colors truncate">{{ site.name }}</span>
              <span v-if="site.booking_difficulty === 'hard'" class="flex-shrink-0 text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-bold">需搶</span>
              <span v-else-if="site.booking_difficulty === 'moderate'" class="flex-shrink-0 text-[10px] bg-orange-50 text-orange-400 px-1.5 py-0.5 rounded-full">稍難</span>
              <span v-if="site.booking_last_available_date && isNewlyOpened(site.booking_last_available_date, site.booking_scraped_at)" class="flex-shrink-0 text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse">剛開放</span>
            </div>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-xs text-gray-400 truncate">{{ site.city }}{{ site.district }}</span>
              <span v-if="site.scenery_features?.length" class="text-[10px] text-green-600">{{ site.scenery_features[0] }}</span>
              <span v-if="site.water_features?.length" class="text-[10px]">💧</span>
              <span v-if="site.playground_features?.length" class="text-[10px]">🎠</span>
            </div>
          </div>

          <!-- 右：海拔 + 帳數 + pending admin actions -->
          <div class="flex-shrink-0 flex items-center gap-2">
            <span v-if="site.altitude" class="text-[10px] text-purple-500 font-medium">{{ site.altitude }}m</span>
            <span
              v-if="site.total_capacity"
              class="text-[10px] text-indigo-500 font-medium"
            >{{ site.total_capacity }}帳</span>
            <span
              v-else-if="isAdmin"
              class="text-[10px] text-gray-300 font-medium"
            >?帳</span>
            <template v-if="isAdmin && !site.is_verified">
              <button @click.stop="deleteCampsite(site.id, true)" class="text-red-400 hover:text-red-600 p-1 transition-colors" title="駁回">
                <XCircle class="w-4 h-4" />
              </button>
              <button @click.stop="verifyCampsite(site.id)" class="text-green-500 hover:text-green-700 p-1 transition-colors" title="通過">
                <CheckCircle class="w-4 h-4" />
              </button>
            </template>
            <ChevronRight class="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
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
        @click="handleAddNew"
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

    <CampsiteFilterSheet
      v-if="isFilterOpen"
      :model-value="filters"
      @apply="applyFilters"
      @close="isFilterOpen = false"
    />

  </div>
</template>
