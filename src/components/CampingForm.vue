```
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { X, Search, Sparkles } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import type { CampingTrip, NewCampingTrip, CampingGear, Campsite } from '../types/database'


interface Props {
  isOpen: boolean
  trip?: CampingTrip | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: NewCampingTrip): void
}>()

const formData = ref<NewCampingTrip>({
  trip_date: new Date().toISOString().split('T')[0] ?? '',
  duration_days: 2,
  campsite_name: '',
  location: '',
  altitude: undefined,

  tent_type: '',
  tent_id: undefined,
  tarp_id: undefined,
  has_tarp: false,
  cost: 0,
  latitude: undefined,
  longitude: undefined,
  start_latitude: undefined,
  start_longitude: undefined,
  zone: '',
  companions: '',
  campsite_id: undefined,
  price: 0,
  status: 'planning'
})

const campsiteSearchResults = ref<Campsite[]>([])
const showCampsiteDropdown = ref(false)
const isSearchingCampsite = ref(false)
let searchDebounce: ReturnType<typeof setTimeout> | null = null

const searchCampsites = async (query: string) => {
  if (!query || query.length < 1) {
    campsiteSearchResults.value = []
    showCampsiteDropdown.value = false
    return
  }

  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(async () => {
    isSearchingCampsite.value = true
    try {
      const { data } = await supabase
        .from('campsites')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(5)
      
      campsiteSearchResults.value = data || []
      showCampsiteDropdown.value = true
    } catch (e) {
      console.error('Search error', e)
    } finally {
      isSearchingCampsite.value = false
    }
  }, 300)
}

const selectCampsite = (campsite: Campsite) => {
  formData.value.campsite_name = campsite.name
  formData.value.campsite_id = campsite.id
  
  if (campsite.latitude && campsite.longitude) {
    formData.value.latitude = campsite.latitude
    formData.value.longitude = campsite.longitude
  }
  if (campsite.altitude) {
    formData.value.altitude = campsite.altitude
  }
  // Try to parse location if format is known (e.g. City District)
  let loc = ''
  if (campsite.city) loc += campsite.city
  if (campsite.district) loc += campsite.district
  if (loc) formData.value.location = loc

  showCampsiteDropdown.value = false
}

// Close dropdown on click outside
const closeDropdown = () => {
  setTimeout(() => { showCampsiteDropdown.value = false }, 200)
}

const tents = ref<CampingGear[]>([])

// Fetch gear for dropdowns
onMounted(async () => {
  const { data } = await supabase.from('camping_gear').select('*').order('name')
  
  if (data) {
    // Explicitly cast or trust the type, but 'data' should be correct if Database is typed
    // The lint error suggests a mismatch, so we'll use a safe check or cast
    const allGear = data as unknown as CampingGear[]
    tents.value = allGear.filter(g => g.type === 'tent')
  }
})

const isGeocoding = ref(false)
const isAiLoading = ref(false)
const coordPaste = ref('')
const startCoordPaste = ref('')

// 解析貼上的座標字串
const parseCoordinates = () => {
  const input = coordPaste.value.trim()
  if (!input) return

  // 支援多種格式：
  // 1. "24.624689990617433, 121.00618568650518" (Google Maps 格式)
  // 2. "24.624689990617433 121.00618568650518" (空格分隔)
  // 3. "24.624689990617433,121.00618568650518" (無空格逗號)
  
  // 移除多餘空格，統一用逗號或空格分隔
  const parts = input.split(/[,\s]+/).filter(p => p.length > 0)
  
  if (parts.length !== 2) {
    alert('座標格式錯誤。請使用格式：緯度, 經度\n例如：24.624689990617433, 121.00618568650518')
    return
  }

  // Ensure parts are defined (TS check)
  const latStr = parts[0]
  const lngStr = parts[1]
  if (!latStr || !lngStr) return

  const lat = parseFloat(latStr)
  const lng = parseFloat(lngStr)
  
  // 驗證座標範圍（台灣大致範圍）
  if (isNaN(lat) || isNaN(lng)) {
    alert('座標格式錯誤。請確認數字格式正確。')
    return
  }
  
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    alert('座標超出有效範圍。\n緯度應在 -90 到 90 之間\n經度應在 -180 到 180 之間')
    return
  }
  
  // 填入欄位
  formData.value.latitude = lat
  formData.value.longitude = lng
  
  // 清空貼上欄位
  coordPaste.value = ''
  
  // 顯示成功提示
  alert(`✅ 座標已填入！\n緯度: ${lat}\n經度: ${lng}`)
}

// 解析出發點座標
const parseStartCoordinates = () => {
  const input = startCoordPaste.value.trim()
  if (!input) return
  const parts = input.split(/[,\s]+/).filter(p => p.length > 0)
  if (parts.length !== 2) {
    alert('座標格式錯誤。請使用格式：緯度, 經度')
    return
  }
  const latStr = parts[0]
  const lngStr = parts[1]
  if (!latStr || !lngStr) return
  const lat = parseFloat(latStr)
  const lng = parseFloat(lngStr)
  if (isNaN(lat) || isNaN(lng)) {
    alert('座標格式錯誤')
    return
  }
  formData.value.start_latitude = lat
  formData.value.start_longitude = lng
  startCoordPaste.value = ''
  alert(`✅ 出發點座標已填入！`)
}

const isFuture = computed(() => {
  if (!formData.value.trip_date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(formData.value.trip_date) >= today
})

const autoFillCoordinates = async () => {
  const name = formData.value.campsite_name
  const loc = formData.value.location
  
  if (!name) {
    alert('請先輸入營區名稱')
    return
  }

  isGeocoding.value = true
  try {
    // 策略：嘗試多種關鍵字組合，優先搜尋更精確的名稱
    const queries = []
    
    // 1. 如果有地點，優先組合地點搜尋
    if (loc) {
      queries.push(`台灣 ${loc} ${name}`)
      queries.push(`台灣 ${loc} ${name} 露營區`)
    }
    
    // 2. 加上「露營區」關鍵字
    queries.push(`台灣 ${name} 露營區`)
    
    // 3. 英文關鍵字
    queries.push(`Taiwan ${name} camping`)
    
    // 4. 原始名稱
    queries.push(`台灣 ${name}`)
    queries.push(name)

    let found = null
    
    for (const q of queries) {
      if (!q.trim()) continue
      console.log('Searching for:', q)
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=tw&limit=1`)
      const data = await response.json()
      if (data && data.length > 0) {
        found = data[0]
        console.log('Found:', found.display_name)
        break
      }
    }

    if (found) {
      // 顯示找到的地點名稱讓使用者確認
      const confirmMsg = `找到地點：\n${found.display_name}\n\n是否使用此座標？`
      if (confirm(confirmMsg)) {
        formData.value.latitude = parseFloat(found.lat)
        formData.value.longitude = parseFloat(found.lon)
      }
    } else {
      alert(`找不到與「${name}」相關的地點。\n建議您：\n1. 檢查名稱是否正確\n2. 嘗試加入縣市名稱 (例：新竹 ${name})\n3. 手動輸入座標`)
    }
  } catch (error) {
    console.error('Geocoding error:', error)
    alert('自動搜尋失敗，請檢查網路連線')
  } finally {
    isGeocoding.value = false
  }
}



function resetForm() {
  formData.value = {
    trip_date: '',
    campsite_name: '',
    duration_days: 2,
    location: '',
    cost: 0,
    price: 0,
    status: 'planning',
    is_windy: false,
    is_rainy: false,
    is_wet_tent: false,
    night_rush: false,
    has_tarp: false,
    tent_id: undefined,
    tarp_id: undefined,
    tent_type: '',
    start_latitude: undefined,
    start_longitude: undefined,
    latitude: undefined,
    longitude: undefined,
    altitude: undefined,
    zone: '',
    companions: '',
    campsite_id: undefined,
    owner_friendliness: '',
    entertainment: '',
    notes: '',
    road_condition: undefined,
    cleanliness: undefined,
    scenery: undefined
  }
}

watch(() => props.trip, (newTrip) => {
  if (newTrip) {
    formData.value = {
      trip_date: newTrip.trip_date,
      campsite_name: newTrip.campsite_name,
      duration_days: newTrip.duration_days ?? 1,
      location: newTrip.location ?? '',
      altitude: newTrip.altitude ?? undefined,
      road_condition: newTrip.road_condition ?? undefined,
      cleanliness: newTrip.cleanliness ?? undefined,
      scenery: newTrip.scenery ?? undefined,
      entertainment: newTrip.entertainment ?? '',
      owner_friendliness: newTrip.owner_friendliness ?? '',
      notes: newTrip.notes ?? '',
      is_windy: newTrip.is_windy,
      is_rainy: newTrip.is_rainy,
      is_wet_tent: newTrip.is_wet_tent,
      night_rush: newTrip.night_rush,
      tent_type: newTrip.tent_type ?? '',
      has_tarp: newTrip.has_tarp,
      cost: newTrip.cost,
      latitude: newTrip.latitude ?? undefined,
      longitude: newTrip.longitude ?? undefined,
      start_latitude: newTrip.start_latitude ?? undefined,
      start_longitude: newTrip.start_longitude ?? undefined,
      tent_id: newTrip.tent_id ?? undefined,
      tarp_id: newTrip.tarp_id ?? undefined,
      campsite_id: newTrip.campsite_id ?? undefined,
      price: newTrip.price ?? 0,
      status: newTrip.status ?? 'planning'
    }
  } else {
    resetForm()
  }
}, { immediate: true })

const handleSubmit = async () => {
  try {
    // Check if we need to create a NEW campsite first
    if (!formData.value.campsite_id && formData.value.campsite_name) {
       // Search again to prevent duplicates (exact match)
       const { data: existing } = await supabase
         .from('campsites')
         .select('id')
         .eq('name', formData.value.campsite_name)
         .single()
       
       if (existing) {
         formData.value.campsite_id = (existing as any).id
       } else {
         // Create new campsite
         const newCampsite = {
           name: formData.value.campsite_name,
           latitude: formData.value.latitude,
           longitude: formData.value.longitude,
           altitude: formData.value.altitude,
           // Simply try to guess city from location string for now, or leave null
           city: formData.value.location ? formData.value.location.substring(0, 3) : null 
         }
         
         const { data: created, error } = await supabase
           .from('campsites')
           .insert([newCampsite] as any)
           .select()
           .single()
           
         if (!error && created) {
           formData.value.campsite_id = (created as any).id
           console.log('Created new shared campsite:', (created as any).name)
         }
       }
    }
    
    emit('submit', formData.value)
    resetForm()
  } catch (e) {
    console.error('Error handling campsite submission', e)
    // Build fail-safe: submit anyway without ID if shared DB error
    emit('submit', formData.value) 
    resetForm()
  }
}

const handleClose = () => {
  emit('close')
  resetForm()
}

import { fetchCampsiteInfo } from '../services/aiService'

const autoFillAI = async () => {
  if (!formData.value.campsite_name) {
    alert('請先輸入營區名稱')
    return
  }

  isAiLoading.value = true
  try {
    const data = await fetchCampsiteInfo(formData.value.campsite_name)
    
    if (data.location) formData.value.location = data.location
    if (data.altitude) formData.value.altitude = data.altitude
    if (data.coordinates) {
      formData.value.latitude = data.coordinates.lat
      formData.value.longitude = data.coordinates.lng
    }
    
    // 將標籤與簡介加入備註
    let aiNotes = ''
    if (data.tags && data.tags.length > 0) {
      aiNotes += `標籤：${data.tags.join(', ')}\n`
    }
    if (data.description) {
      aiNotes += `簡介：${data.description}\n`
    }
    
    if (aiNotes) {
      formData.value.notes = (formData.value.notes ? formData.value.notes + '\n\n' : '') + '--- AI 智能提供 (高精度模型) ---\n' + aiNotes
    }

    alert('✅ AI 智能填寫完成！(已使用高精度模型)')
  } catch (error) {
    console.error('AI error:', error)
    alert('AI 搜尋失敗，請手動輸入或稍後再試')
  } finally {
    isAiLoading.value = false
  }
}

const openMapSearch = () => {
  const q = formData.value.campsite_name || ''
  const win = window as any
  if (q) {
    win.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank')
  } else {
    win.alert('請先輸入營區名稱')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto">
        <!-- 背景遮罩 (Glassmorphism) -->
        <div class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" @click="handleClose"></div>
        
        <!-- 表單容器 -->
        <div class="flex min-h-full items-center justify-center p-4">
          <div class="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <!-- 標題列 -->
            <div class="sticky top-0 bg-white/95 backdrop-blur z-10 px-8 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-teal-500">
                  {{ trip ? '編輯回憶' : '記錄新旅程' }}
                </h2>
                <p class="text-xs text-gray-500 mt-1">
                  {{ trip ? '修改這段美好的時光' : '寫下這次露營的點點滴滴' }}
                </p>
              </div>
              <button @click="handleClose" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
                <X class="w-6 h-6" />
              </button>
            </div>

            <!-- 表單內容 -->
            <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
              <!-- 基本資訊 -->
              <div class="space-y-4">
                <h3 class="text-lg font-semibold text-gray-900">基本資訊</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="md:col-span-2 relative">
                    <div class="flex items-center justify-between mb-1">
                      <label class="block text-sm font-medium text-gray-700">
                        營區名稱 <span class="text-red-500">*</span>
                      </label>
                      <button 
                        type="button"
                        @click="autoFillAI"
                        :disabled="isAiLoading"
                        class="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary-500/10 to-teal-500/10 text-primary-600 border border-primary-200 hover:from-primary-500 hover:to-teal-500 hover:text-white transition-all duration-300 disabled:opacity-50 font-bold"
                      >
                        <Sparkles class="w-3.5 h-3.5" :class="{ 'animate-spin': isAiLoading }" />
                        {{ isAiLoading ? 'AI 填寫中...' : '✨ AI 智能填寫' }}
                      </button>
                    </div>
                    <input 
                      v-model="formData.campsite_name"
                      type="text" 
                      required
                      class="w-full px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none"
                      placeholder="例：拉拉山露營區"
                      @input="searchCampsites(($event.target as HTMLInputElement).value)"
                      @focus="searchCampsites(formData.campsite_name)"
                      @blur="closeDropdown"
                    />
                    
                    <!-- Search Results Dropdown -->
                    <div v-if="showCampsiteDropdown && campsiteSearchResults.length > 0" class="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-100">
                      <ul>
                        <li 
                          v-for="site in campsiteSearchResults" 
                          :key="site.id"
                          @mousedown="selectCampsite(site)" 
                          class="px-4 py-3 hover:bg-surface-50 cursor-pointer flex justify-between items-center group border-b border-gray-50 last:border-none"
                        >
                           <div class="flex items-center gap-2">
                             <span class="font-bold text-gray-800">{{ site.name }}</span>
                             <span v-if="site.city" class="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{{ site.city }}</span>
                           </div>
                           <span class="text-xs text-gray-400 group-hover:text-primary-500 flex items-center gap-1">
                             使用此資料 <Sparkles class="w-3 h-3" />
                           </span>
                        </li>
                      </ul>
                    </div>
                    <!-- Create New Hint (Optional) -->
                    <div v-if="showCampsiteDropdown && campsiteSearchResults.length === 0 && formData.campsite_name.length > 1" class="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-3 text-sm text-gray-500">
                       <p>找不到「{{ formData.campsite_name }}」，將會自動建立新營地資料。</p>
                    </div>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      露營日期 <span class="text-red-500">*</span>
                    </label>
                    <input 
                      v-model="formData.trip_date"
                      type="date" 
                      required
                      class="w-full px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">天數</label>
                    <input 
                      v-model.number="formData.duration_days"
                      type="number" 
                      min="1"
                      class="w-full px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">地點</label>
                    <input 
                      v-model="formData.location"
                      type="text"
                      class="w-full px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none"
                      placeholder="例：新竹尖石"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">海拔 (公尺)</label>
                    <input 
                      v-model.number="formData.altitude"
                      type="number"
                      class="w-full px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none"
                      placeholder="例：1500"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">營位</label>
                    <input 
                      v-model="formData.zone"
                      type="text"
                      class="w-full px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none"
                      placeholder="例：A區、草地區"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">同行夥伴</label>
                    <input 
                      v-model="formData.companions"
                      type="text"
                      class="w-full px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none"
                      placeholder="例：爸爸、媽媽、小明"
                    />
                  </div>
                </div>
              </div>

              <!-- 評分 (僅過去行程顯示) -->
              <div v-if="!isFuture" class="space-y-4">
                <h3 class="text-lg font-semibold text-gray-900">營區評分</h3>
                
                <div class="space-y-4">
                  <!-- 路況 -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">路況 (1-5分)</label>
                    <div class="flex gap-2">
                       <button 
                         v-for="n in 5" 
                         :key="n"
                         type="button"
                         @click="formData.road_condition = n"
                         class="flex-1 py-2 rounded-lg border transition-all font-medium"
                         :class="formData.road_condition === n 
                           ? 'bg-yellow-100 border-yellow-300 text-yellow-700 ring-2 ring-yellow-200' 
                           : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'"
                       >
                         {{ n }}
                       </button>
                    </div>
                  </div>

                  <!-- 整潔 -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">整潔 (1-5分)</label>
                    <div class="flex gap-2">
                       <button 
                         v-for="n in 5" 
                         :key="n"
                         type="button"
                         @click="formData.cleanliness = n"
                         class="flex-1 py-2 rounded-lg border transition-all font-medium"
                         :class="formData.cleanliness === n 
                           ? 'bg-green-100 border-green-300 text-green-700 ring-2 ring-green-200' 
                           : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'"
                       >
                         {{ n }}
                       </button>
                    </div>
                  </div>

                  <!-- 風景 -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">風景 (1-5分)</label>
                    <div class="flex gap-2">
                       <button 
                         v-for="n in 5" 
                         :key="n"
                         type="button"
                         @click="formData.scenery = n"
                         class="flex-1 py-2 rounded-lg border transition-all font-medium"
                         :class="formData.scenery === n 
                           ? 'bg-blue-100 border-blue-300 text-blue-700 ring-2 ring-blue-200' 
                           : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'"
                       >
                         {{ n }}
                       </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 天氣與狀況 -->
              <div class="space-y-4">
                <h3 class="text-lg font-semibold text-gray-900">天氣與狀況</h3>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label class="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-100 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all"
                         :class="{ 'bg-blue-50 border-blue-300 ring-2 ring-blue-100': formData.is_rainy }">
                    <input v-model="formData.is_rainy" type="checkbox" class="sr-only" />
                    <span class="text-2xl mb-1">🌧️</span>
                    <span class="text-sm font-medium text-gray-700">下雨</span>
                  </label>

                  <label class="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-all"
                         :class="{ 'bg-gray-100 border-gray-400 ring-2 ring-gray-200': formData.is_windy }">
                    <input v-model="formData.is_windy" type="checkbox" class="sr-only" />
                    <span class="text-2xl mb-1">💨</span>
                    <span class="text-sm font-medium text-gray-700">大風</span>
                  </label>

                  <label class="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-100 cursor-pointer hover:bg-orange-50 hover:border-orange-200 transition-all"
                         :class="{ 'bg-orange-50 border-orange-300 ring-2 ring-orange-100': formData.is_wet_tent }">
                    <input v-model="formData.is_wet_tent" type="checkbox" class="sr-only" />
                    <span class="text-2xl mb-1">⛺</span>
                    <span class="text-sm font-medium text-gray-700">收濕帳</span>
                  </label>

                  <label class="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-100 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                         :class="{ 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-100': formData.night_rush }">
                    <input v-model="formData.night_rush" type="checkbox" class="sr-only" />
                    <span class="text-2xl mb-1">🌙</span>
                    <span class="text-sm font-medium text-gray-700">夜衝</span>
                  </label>
                </div>
              </div>

              <!-- 裝備 -->
              <div class="space-y-4">
                <h3 class="text-lg font-semibold text-gray-900">裝備</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">帳篷選擇</label>
                    <select 
                      v-model="formData.tent_id"
                      class="w-full px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none appearance-none"
                    >
                      <option :value="undefined" disabled>請選擇帳篷</option>
                      <option v-for="tent in tents" :key="tent.id" :value="tent.id">
                        {{ tent.name }}
                      </option>
                    </select>
                    <p v-if="tents.length === 0" class="text-xs text-gray-400 mt-1">
                       (尚未建立帳篷資料，請至「裝備」頁籤新增)
                    </p>
                  </div>

                  <!-- 天幕 (Checkbox only) -->
                  <div class="flex items-center p-3 rounded-xl border border-gray-100 bg-surface-50 h-[46px]">
                    <label class="flex items-center gap-3 w-full cursor-pointer">
                      <div class="relative flex items-center">
                        <input 
                          v-model="formData.has_tarp"
                          type="checkbox"
                          class="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 bg-white transition-all checked:border-primary-500 checked:bg-primary-500 hover:border-primary-400"
                        />
                        <svg class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </div>
                      <span class="text-sm font-medium text-gray-700">有搭天幕</span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- 其他資訊 -->
              <div class="space-y-4">
                <h3 class="text-lg font-semibold text-gray-900">其他資訊</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">費用 (NT$)</label>
                    <input 
                      v-model.number="formData.cost"
                      type="number"
                      min="0"
                      class="w-full px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">營主親切度</label>
                    <input 
                      v-model="formData.owner_friendliness"
                      type="text"
                      class="w-full px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none"
                    />
                  </div>

                  <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-1">娛樂設施</label>
                    <input 
                      v-model="formData.entertainment"
                      type="text"
                      class="w-full px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none"
                      placeholder="例：戲水池、遊樂場"
                    />
                  </div>

                  <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-1">心得備註</label>
                    <textarea 
                      v-model="formData.notes"
                      rows="4"
                      class="w-full px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none transition-all outline-none leading-relaxed"
                      placeholder="記錄您的露營心得..."
                    ></textarea>
                  </div>
                </div>
              </div>

              <!-- 地理位置 -->
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-semibold text-gray-900">地理位置 (選填)</h3>
                  <div class="flex items-center gap-2">
                    <button 
                      type="button"
                      @click="openMapSearch"
                      class="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Google Maps 找座標
                    </button>
                    <button 
                      type="button"
                      @click="autoFillCoordinates"
                      :disabled="isGeocoding"
                      class="text-sm flex items-center text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                    >
                      <Search class="w-4 h-4 mr-1" />
                      {{ isGeocoding ? '搜尋中...' : '自動搜尋座標' }}
                    </button>
                  </div>
                </div>
                
                <!-- 快速貼上座標 -->
                <div class="bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-200 rounded-xl p-4">
                  <label class="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    📋 快速貼上座標
                    <span class="ml-2 text-xs text-gray-500 font-normal">(從 Google Maps 複製後直接貼上)</span>
                  </label>
                  <div class="flex gap-2">
                    <input 
                      v-model="coordPaste"
                      type="text"
                      class="flex-1 px-4 py-2.5 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all outline-none"
                      placeholder="貼上格式：24.624689990617433, 121.00618568650518"
                      @keydown.enter.prevent="parseCoordinates"
                    />
                    <button 
                      type="button"
                      @click="parseCoordinates"
                      class="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium whitespace-nowrap"
                    >
                      解析
                    </button>
                  </div>
                  <p class="text-xs text-gray-500 mt-2">💡 提示：在 Google Maps 上點擊地點，複製顯示的座標後貼上即可</p>
                </div>
                
                <!-- 分隔線 -->
                <div class="relative">
                  <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-gray-200"></div>
                  </div>
                  <div class="relative flex justify-center text-xs">
                    <span class="px-2 bg-white text-gray-400">或手動輸入</span>
                  </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">緯度</label>
                    <input 
                      v-model.number="formData.latitude"
                      type="number"
                      step="any"
                      class="w-full px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none"
                      placeholder="例：24.123456 (手動輸入)"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">經度</label>
                    <input 
                      v-model.number="formData.longitude"
                      type="number"
                      step="any"
                      class="w-full px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none"
                      placeholder="例：121.123456 (手動輸入)"
                    />
                  </div>
                </div>

                <!-- 出發地點 (自定義) -->
                <div class="space-y-4 pt-6 border-t border-gray-100 mt-6">
                  <div class="flex items-center justify-between">
                    <h3 class="text-lg font-semibold text-gray-900">出發起點 (選填)</h3>
                    <p class="text-xs text-gray-500">若留空則使用預設出發點（桃園）</p>
                  </div>

                  <div class="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4">
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                      🏠 設定此次行程的出發起點
                    </label>
                    <div class="flex gap-2">
                      <input 
                        v-model="startCoordPaste"
                        type="text"
                        class="flex-1 px-4 py-2.5 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all outline-none text-sm"
                        placeholder="貼上特定起點座標 (例：辦公室)"
                        @keydown.enter.prevent="parseStartCoordinates"
                      />
                      <button 
                        type="button"
                        @click="parseStartCoordinates"
                        class="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium whitespace-nowrap text-sm"
                      >
                        填入
                      </button>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <input 
                      v-model.number="formData.start_latitude"
                      type="number"
                      step="any"
                      class="px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 transition-all outline-none text-sm"
                      placeholder="起點緯度"
                    />
                    <input 
                      v-model.number="formData.start_longitude"
                      type="number"
                      step="any"
                      class="px-4 py-2.5 bg-surface-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-400 transition-all outline-none text-sm"
                      placeholder="起點經度"
                    />
                  </div>
                </div>
              </div>

              <!-- 按鈕 -->
              <div class="flex justify-end gap-3 pt-6 border-t border-gray-100 bg-gray-50/50 -mx-6 -mb-6 px-6 py-4 mt-8 rounded-b-3xl">
                <button 
                  type="button"
                  @click="handleClose"
                  class="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-medium shadow-sm"
                >
                  取消
                </button>
                <button 
                  type="submit"
                  class="px-8 py-2.5 bg-gradient-to-r from-primary-600 to-teal-600 text-white rounded-xl hover:shadow-lg hover:shadow-primary-500/30 hover:-translate-y-0.5 transition-all font-medium btn-bounce"
                >
                  {{ trip ? '儲存修改' : '立即發布' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
