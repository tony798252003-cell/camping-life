<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { 
  X, MapPin, Mountain, CloudRain, Moon, Tent, Wind, Save, RotateCcw, Calendar, Pencil
} from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import type { NewCampingTrip, CampingGear, Campsite, CampingTrip } from '../types/database'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import TripWeather from './TripWeather.vue'

interface Props {
  isOpen: boolean
  trip?: CampingTrip | null | any
  isAdmin?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: NewCampingTrip): void
  (e: 'edit-campsite', campsite: any): void
}>()

// --- State ---
const isEditing = ref(false)
const originalTripData = ref<any>(null)
const formData = ref<NewCampingTrip>({
  trip_date: new Date().toISOString().split('T')[0] ?? '',
  duration_days: 2,
  campsite_name: '',
  location: '',
  altitude: undefined,
  tent_type: '',
  has_tarp: false,
  cost: 0,
  price: 0,
  status: 'planning',
  is_windy: false,
  is_rainy: false,
  is_wet_tent: false,
  night_rush: false,
  tent_id: undefined,
  tarp_id: undefined,
  latitude: undefined,
  longitude: undefined,
  zone: '',
  companions: '',
  campsite_id: undefined,
  owner_friendliness: '',
  entertainment: '',
  notes: '',
  road_condition: undefined,
  cleanliness: undefined,
  scenery: undefined
})

const weatherTrip = computed(() => {
  return {
    id: props.trip?.id || 0,
    trip_date: formData.value.trip_date,
    duration_days: formData.value.duration_days,
    latitude: formData.value.latitude,
    longitude: formData.value.longitude,
    night_rush: formData.value.night_rush,
    price: formData.value.price,
    campsites: {
      altitude: formData.value.altitude,
      latitude: formData.value.latitude,
      longitude: formData.value.longitude,
      name: formData.value.campsite_name
    }
  } as any
})

// --- Resources ---
const tents = ref<CampingGear[]>([])
const campsiteSearchResults = ref<Campsite[]>([])
const showCampsiteDropdown = ref(false)
const isSearchingCampsite = ref(false)
let searchDebounce: ReturnType<typeof setTimeout> | null = null

// --- Map ---
const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null

// --- Initialization ---
const initFormData = (newTrip: any) => {
  if (newTrip) {
    const linkedCampsite = (newTrip as any).campsites
    
    // Construct the initial state
    const data = {
      trip_date: newTrip.trip_date,
      campsite_name: linkedCampsite?.name || newTrip.campsite_name,
      duration_days: newTrip.duration_days ?? 1,
      location: linkedCampsite?.city ? `${linkedCampsite.city}${linkedCampsite.district || ''}` : (newTrip.location ?? ''),
      altitude: linkedCampsite?.altitude ?? newTrip.altitude ?? undefined,
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
      latitude: linkedCampsite?.latitude ?? newTrip.latitude ?? undefined,
      longitude: linkedCampsite?.longitude ?? newTrip.longitude ?? undefined,
      start_latitude: newTrip.start_latitude ?? undefined,
      start_longitude: newTrip.start_longitude ?? undefined,
      tent_id: newTrip.tent_id ?? undefined,
      tarp_id: newTrip.tarp_id ?? undefined,
      campsite_id: newTrip.campsite_id ?? undefined,
      price: newTrip.price ?? 0,
      status: newTrip.status ?? 'planning',
      zone: newTrip.zone ?? '',
      companions: newTrip.companions ?? ''
    }
    
    formData.value = JSON.parse(JSON.stringify(data))
    originalTripData.value = JSON.parse(JSON.stringify(data))
    
    // Reset to View Mode whenever a trip is initialized (opened)
    isEditing.value = false
    
    refreshViewData()
  } else {
    resetForm()
    // New trip starts in edit mode
    isEditing.value = true
  }
}

function resetForm() {
  const emptyForm = {
    trip_date: new Date().toISOString().split('T')[0],
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
  formData.value = JSON.parse(JSON.stringify(emptyForm))
  originalTripData.value = JSON.parse(JSON.stringify(emptyForm))
}

const refreshViewData = () => {
  nextTick(() => {
    initMap()
  })
}

// Watchers
watch(() => props.trip, (val) => initFormData(val), { immediate: true })

// CRITICAL: Watch isOpen to reset state when re-opening same trip
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (props.trip) {
      initFormData(props.trip)
    } else {
      resetForm()
      isEditing.value = true
    }
  }
})

// --- Control ---
const toggleEdit = () => {
  isEditing.value = true
}

const cancelEdit = () => {
  if (!props.trip) {
    handleClose()
  } else {
    // If we are editing an existing trip, confirm before cancelling?
    // Or just revert:
    isEditing.value = false
    initFormData(props.trip) // Revert data
  }
}



const handleSubmit = async () => {
  try {
    // Handle new campsite creation logic if needed
    if (!formData.value.campsite_id && formData.value.campsite_name) {
       const { data: existing } = await supabase
         .from('campsites')
         .select('id')
         .eq('name', formData.value.campsite_name)
         .single()
       if (existing) {
         formData.value.campsite_id = (existing as any).id
       } else {
         const newCampsite = {
           name: formData.value.campsite_name,
           latitude: formData.value.latitude,
           longitude: formData.value.longitude,
           altitude: formData.value.altitude || null,
           is_verified: false,
           city: formData.value.location ? formData.value.location.substring(0, 3) : null 
         }
         const { data: created, error } = await supabase
           .from('campsites')
           .insert([newCampsite] as any)
           .select()
           .single()
         if (!error && created) {
           formData.value.campsite_id = (created as any).id
         }
       }
    }
    
    // Sanitize data before emitting
    const payload = { ...formData.value }
    
    const sanitizeNullable = (v: any) => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v)
    const sanitizeRequired = (v: any, def = 0) => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? def : Number(v)

    payload.altitude = sanitizeNullable(formData.value.altitude) as number | undefined
    payload.cost = sanitizeRequired(formData.value.cost, 0)
    payload.price = sanitizeRequired(formData.value.price, 0)
    payload.duration_days = sanitizeRequired(formData.value.duration_days, 1)
    
    if (!payload.location) payload.location = ''
    
    emit('submit', payload)
    isEditing.value = false
  } catch (e) {
    console.error('Error handling submission', e)
    // alert is handled by parent usually, but catching specific logic errors here
  }
}

const handleClose = () => {
  if (isEditing.value && props.trip) {
     if (confirm('您正在編輯中，確定要關閉嗎？未儲存的變更將會遺失。')) {
        emit('close')
     }
  } else {
     emit('close')
  }
}

// --- Search Logic ---
const searchCampsites = async (query: string) => {
  if (!isEditing.value) return // Disable search in view mode
  if (!query || query.length < 1) {
    campsiteSearchResults.value = []
    showCampsiteDropdown.value = false
    return
  }
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(async () => {
    isSearchingCampsite.value = true
    try {
      const { data } = await supabase.from('campsites').select('*').ilike('name', `%${query}%`).limit(5)
      campsiteSearchResults.value = data || []
      showCampsiteDropdown.value = true
    } catch (e) { console.error(e) } finally { isSearchingCampsite.value = false }
  }, 300)
}

const selectCampsite = (campsite: Campsite) => {
  formData.value.campsite_name = campsite.name
  formData.value.campsite_id = campsite.id
  if (campsite.latitude && campsite.longitude) {
    formData.value.latitude = campsite.latitude
    formData.value.longitude = campsite.longitude
  }
  if (campsite.altitude) formData.value.altitude = campsite.altitude
  let loc = ''
  if (campsite.city) loc += campsite.city
  if (campsite.district) loc += campsite.district
  if (loc) formData.value.location = loc
  showCampsiteDropdown.value = false
}

const clearCampsite = () => {
  if (!isEditing.value) return
  if (!confirm('確定要變更營地嗎？這將會清除目前的營地關聯資料。')) return
  formData.value.campsite_id = undefined
  formData.value.campsite_name = ''
  formData.value.location = ''
  formData.value.altitude = undefined
  formData.value.latitude = undefined
  formData.value.longitude = undefined
}

const closeDropdown = () => setTimeout(() => { showCampsiteDropdown.value = false }, 200)

// --- Resources Load ---
onMounted(async () => {
  const { data } = await supabase.from('camping_gear').select('*').order('name')
  if (data) {
    const allGear = data as unknown as CampingGear[]
    tents.value = allGear.filter(g => g.type === 'tent')
  }
})

const initMap = () => {
  if (!mapContainer.value || !formData.value.latitude) return
  if (map) { map.remove(); map = null }
  const lat = formData.value.latitude
  const lng = formData.value.longitude
  if (lat && lng) {
    map = L.map(mapContainer.value).setView([lat, lng], 14)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map)
    L.marker([lat, lng]).addTo(map)
  }
}

const formatDateRange = (dateString: string, duration: number | null = 1) => {
  if (!dateString) return '選擇日期'
  const start = new Date(dateString)
  const end = new Date(start)
  end.setDate(start.getDate() + Math.max(0, (duration || 1) - 1))
  return `${start.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} - ${end.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}`
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto">
        <div class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" @click="handleClose"></div>
        
        <div class="flex min-h-full items-center justify-center p-4">
          <div class="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            
            <!-- Cover Header -->
            <div class="h-48 w-full bg-gradient-to-r from-primary-400 to-primary-600 relative overflow-hidden shrink-0">
               <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl"></div>
               <div class="absolute top-10 left-10 w-20 h-20 bg-white/20 rounded-full blur-xl"></div>
               
               <!-- Actions -->
               <div class="absolute top-4 right-4 flex items-center gap-2 z-20">
                  <button 
                    v-if="!isEditing && trip"
                    @click="toggleEdit"
                    class="p-2 bg-black/20 text-white hover:bg-black/30 rounded-full backdrop-blur-md transition-all shadow-sm"
                    title="編輯"
                  >
                    <Pencil class="w-5 h-5" />
                  </button>
                  <button 
                    @click="handleClose" 
                    class="p-2 bg-black/20 text-white hover:bg-black/30 rounded-full backdrop-blur-md transition-all shadow-sm"
                  >
                    <X class="w-5 h-5" />
                  </button>
               </div>
            </div>

            <div class="px-8 py-6 -mt-12 relative z-10 flex-1">
               <form @submit.prevent="handleSubmit">
                  
                  <!-- Title Card -->
                  <div class="bg-white rounded-2xl p-6 shadow-md border border-primary-50 mb-6 relative hover:shadow-lg transition-shadow">
                     <!-- Title Display / Edit -->
                     <div class="mb-2">
                        <div class="relative">
                           <div v-if="isEditing">
                              <div v-if="formData.campsite_id" class="flex gap-2 group">
                                 <input 
                                   :value="formData.campsite_name"
                                   readonly
                                   class="text-2xl font-bold bg-transparent text-primary-900 px-2 py-1 w-full border-transparent focus:ring-0 cursor-not-allowed"
                                 />
                                 <button 
                                   type="button" @click="clearCampsite"
                                   class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                                 >
                                   <X class="w-5 h-5" />
                                 </button>
                              </div>
                              <div v-else class="relative">
                                 <input 
                                   v-model="formData.campsite_name"
                                   type="text"
                                   class="text-2xl font-bold text-primary-900 w-full border-b-2 border-transparent hover:border-primary-200 focus:border-primary-500 outline-none px-2 py-1 bg-transparent placeholder-gray-300 transition-colors"
                                   placeholder="輸入營地名稱..."
                                   @input="searchCampsites(($event.target as HTMLInputElement).value)"
                                   @focus="searchCampsites(formData.campsite_name)"
                                   @blur="closeDropdown"
                                 />
                                 <!-- Dropdown -->
                                 <div v-if="showCampsiteDropdown && campsiteSearchResults.length > 0" class="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden text-sm">
                                   <ul>
                                     <li v-for="site in campsiteSearchResults" :key="site.id" @mousedown="selectCampsite(site)" class="px-4 py-3 hover:bg-surface-50 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-none">
                                        <span class="font-bold text-gray-800">{{ site.name }}</span>
                                        <span v-if="site.city" class="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{{ site.city }}</span>
                                     </li>
                                   </ul>
                                 </div>
                              </div>
                           </div>
                           <h2 v-else class="text-3xl font-bold text-primary-900 tracking-tight px-2 py-1">
                              {{ formData.campsite_name || '未命名營地' }}
                           </h2>
                        </div>
                     </div>

                     <!-- Date & Duration -->
                     <div class="flex items-center text-primary-500 font-medium px-2">
                        <Calendar class="w-4 h-4 mr-2" />
                        <div v-if="isEditing" class="flex items-center gap-2 group">
                           <input v-model="formData.trip_date" type="date" class="bg-transparent hover:bg-gray-50 border border-transparent hover:border-gray-200 rounded px-2 py-0.5 text-sm transition-all cursor-pointer" />
                           <span class="text-xs">共</span>
                           <input v-model.number="formData.duration_days" type="number" min="1" class="w-12 bg-transparent hover:bg-gray-50 border border-transparent hover:border-gray-200 rounded px-1 py-0.5 text-sm text-center transition-all cursor-pointer" />
                           <span class="text-xs">天</span>
                        </div>
                        <div v-else>
                           {{ formatDateRange(formData.trip_date, formData.duration_days) }}
                           <span class="mx-2">·</span>
                           <span>{{ formData.duration_days }} 天</span>
                        </div>
                     </div>

                     <!-- Tags (Toggleable) -->
                     <div class="flex flex-wrap gap-2 mt-4 min-h-[32px] px-2">
                        <!-- Rainy -->
                        <label class="cursor-pointer select-none transition-all" :class="isEditing ? 'opacity-100' : (formData.is_rainy ? 'opacity-100' : 'hidden')">
                           <input v-if="isEditing" v-model="formData.is_rainy" type="checkbox" class="sr-only peer" />
                           <span class="px-3 py-1 rounded-lg text-sm font-bold flex items-center border transition-all"
                             :class="formData.is_rainy ? 'bg-blue-50 text-blue-600 border-blue-100 ring-1 ring-blue-200' : (isEditing ? 'bg-white text-gray-300 border-gray-100 hover:border-gray-300 hover:text-gray-500' : 'hidden')">
                              <CloudRain class="w-4 h-4 mr-1" /> 下雨
                           </span>
                        </label>
                        <!-- Windy -->
                        <label class="cursor-pointer select-none transition-all" :class="isEditing ? 'opacity-100' : (formData.is_windy ? 'opacity-100' : 'hidden')">
                           <input v-if="isEditing" v-model="formData.is_windy" type="checkbox" class="sr-only peer" />
                           <span class="px-3 py-1 rounded-lg text-sm font-bold flex items-center border transition-all"
                             :class="formData.is_windy ? 'bg-gray-100 text-gray-700 border-gray-300 ring-1 ring-gray-200' : (isEditing ? 'bg-white text-gray-300 border-gray-100 hover:border-gray-300 hover:text-gray-500' : 'hidden')">
                              <Wind class="w-4 h-4 mr-1" /> 大風
                           </span>
                        </label>
                        <!-- Night Rush -->
                        <label class="cursor-pointer select-none transition-all" :class="isEditing ? 'opacity-100' : (formData.night_rush ? 'opacity-100' : 'hidden')">
                           <input v-if="isEditing" v-model="formData.night_rush" type="checkbox" class="sr-only peer" />
                           <span class="px-3 py-1 rounded-lg text-sm font-bold flex items-center border transition-all"
                             :class="formData.night_rush ? 'bg-indigo-50 text-indigo-600 border-indigo-100 ring-1 ring-indigo-200' : (isEditing ? 'bg-white text-gray-300 border-gray-100 hover:border-gray-300 hover:text-gray-500' : 'hidden')">
                              <Moon class="w-4 h-4 mr-1" /> 夜衝
                           </span>
                        </label>
                        <!-- Wet Tent -->
                        <label class="cursor-pointer select-none transition-all" :class="isEditing ? 'opacity-100' : (formData.is_wet_tent ? 'opacity-100' : 'hidden')">
                           <input v-if="isEditing" v-model="formData.is_wet_tent" type="checkbox" class="sr-only peer" />
                           <span class="px-3 py-1 rounded-lg text-sm font-bold flex items-center border transition-all"
                             :class="formData.is_wet_tent ? 'bg-orange-50 text-orange-600 border-orange-100 ring-1 ring-orange-200' : (isEditing ? 'bg-white text-gray-300 border-gray-100 hover:border-gray-300 hover:text-gray-500' : 'hidden')">
                              <Tent class="w-4 h-4 mr-1" /> 收濕帳
                           </span>
                        </label>
                     </div>
                  </div>

                  <!-- Weather Forecast -->
                  <div class="mb-6">
                    <TripWeather :trip="weatherTrip" :isOpen="!!weatherTrip" @close="weatherTrip = null" />
                  </div>

                  <!-- Details Grid -->
                  <div class="grid grid-cols-2 gap-4 mb-6">
                     <!-- Location -->
                     <div class="p-4 bg-surface-50 rounded-2xl border border-primary-50 flex flex-col justify-center h-[88px] transition-colors" :class="{'group hover:border-primary-200': isEditing && !formData.campsite_id}">
                        <p class="text-xs text-primary-500 mb-1">地點</p>
                        <div class="flex items-center font-bold text-primary-900 truncate">
                           <MapPin class="w-4 h-4 mr-1.5 text-accent-sky shrink-0" />
                           <input 
                              v-model="formData.location" 
                              type="text" 
                              :readonly="!isEditing || !!formData.campsite_id" 
                              class="bg-transparent border-none w-full p-0 text-sm font-bold text-primary-900 focus:ring-0 placeholder-gray-300" 
                              :class="{'cursor-default': !isEditing || !!formData.campsite_id}" 
                              placeholder="未記錄" 
                           />
                        </div>
                     </div>
                     <!-- Altitude -->
                     <div class="p-4 bg-surface-50 rounded-2xl border border-primary-50 flex flex-col justify-center h-[88px] transition-colors" :class="{'group hover:border-primary-200': isEditing && !formData.campsite_id}">
                        <p class="text-xs text-primary-500 mb-1">海拔</p>
                        <div class="flex items-center font-bold text-primary-900">
                           <Mountain class="w-4 h-4 mr-1.5 text-purple-500 shrink-0" />
                           <div class="flex items-center">
                             <input 
                                v-model.number="formData.altitude" 
                                type="number" 
                                :readonly="!isEditing || !!formData.campsite_id" 
                                class="bg-transparent border-none w-20 p-0 text-sm font-bold text-primary-900 focus:ring-0 placeholder-gray-300" 
                                :class="{'cursor-default': !isEditing || !!formData.campsite_id}" 
                                placeholder="未記錄" 
                             />
                             <span v-if="formData.altitude" class="text-xs ml-1 font-normal text-gray-500">m</span>
                           </div>
                        </div>
                     </div>
                     <!-- Cost -->
                     <div class="p-4 bg-surface-50 rounded-2xl border border-primary-50 flex flex-col justify-center h-[88px] transition-colors" :class="{'group hover:border-primary-200': isEditing}">
                        <p class="text-xs text-primary-500 mb-1">總花費</p>
                        <div class="flex items-center font-bold text-primary-900">
                           <span class="text-sm mr-1">NT$</span>
                           <input v-model.number="formData.cost" type="number" :readonly="!isEditing" class="bg-transparent border-none w-full p-0 text-sm font-bold text-primary-900 focus:ring-0" :class="{'cursor-default': !isEditing}" />
                        </div>
                     </div>
                     <!-- Tent -->
                     <div class="p-4 bg-surface-50 rounded-2xl border border-primary-50 flex flex-col justify-center h-[88px] transition-colors" :class="{'group hover:border-primary-200': isEditing}">
                        <p class="text-xs text-primary-500 mb-1">帳篷</p>
                        <div v-if="isEditing">
                            <select v-model="formData.tent_id" class="w-full bg-transparent border-none p-0 text-sm font-bold text-primary-900 focus:ring-0 cursor-pointer">
                               <option :value="undefined">未選擇</option>
                               <option v-for="tent in tents" :key="tent.id" :value="tent.id">{{ tent.name }}</option>
                            </select>
                        </div>
                        <div v-else class="font-bold text-sm text-primary-900 truncate cursor-default">
                           {{ tents.find(t => t.id === formData.tent_id)?.name || formData.tent_type || '未記錄' }}
                        </div>
                     </div>
                     <!-- Zone (Optional) -->
                     <div class="p-4 bg-surface-50 rounded-2xl border border-primary-50 flex flex-col justify-center h-[88px] transition-colors" :class="{'group hover:border-primary-200': isEditing}" v-if="isEditing || formData.zone">
                        <p class="text-xs text-primary-500 mb-1">營位</p>
                        <input v-model="formData.zone" type="text" :readonly="!isEditing" class="w-full bg-transparent border-none p-0 text-sm font-bold text-primary-900 focus:ring-0 placeholder-gray-300" :class="{'cursor-default': !isEditing}" placeholder="例如 A區" />
                     </div>
                     <!-- Companions (Optional) -->
                     <div class="p-4 bg-surface-50 rounded-2xl border border-primary-50 flex flex-col justify-center h-[88px] transition-colors" :class="{'group hover:border-primary-200': isEditing}" v-if="isEditing || formData.companions">
                        <p class="text-xs text-primary-500 mb-1">同行夥伴</p>
                        <input v-model="formData.companions" type="text" :readonly="!isEditing" class="w-full bg-transparent border-none p-0 text-sm font-bold text-primary-900 focus:ring-0 placeholder-gray-300" :class="{'cursor-default': !isEditing}" placeholder="例如 家人" />
                     </div>
                  </div>



                  <!-- Notes -->
                  <div class="bg-white border border-primary-100 rounded-2xl p-5 mb-6 shadow-sm transition-colors" :class="{'hover:border-primary-200': isEditing}">
                     <h3 class="text-lg font-bold text-primary-900 mb-2 flex justify-between items-center">
                        心得筆記
                     </h3>
                     <textarea 
                        v-if="isEditing"
                        v-model="formData.notes" 
                        rows="4" 
                        class="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-primary-900 focus:bg-white focus:ring-2 focus:ring-primary-100 outline-none transition-all placeholder-gray-400"
                        placeholder="寫下這次的回憶..."
                     ></textarea>
                     <p v-else class="text-primary-700 leading-relaxed whitespace-pre-wrap min-h-[24px]">
                        {{ formData.notes || '( 尚未填寫心得 )' }}
                     </p>
                  </div>



                  <!-- Map & Weather (Always Visible) -->
                  <div v-if="formData.latitude && formData.longitude" class="rounded-2xl overflow-hidden border border-primary-100 h-64 relative z-0 mb-20 shadow-sm">
                     <div ref="mapContainer" class="w-full h-full"></div>
                  </div>

                  <!-- Sticky Footer (Save Actions) - ONLY IN EDIT MODE -->
                  <div v-if="isEditing" class="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur border-t border-gray-100 flex justify-center z-50 animate-in slide-in-from-bottom-10 shadow-up">
                     <div class="w-full max-w-2xl flex gap-3">
                        <button type="button" @click="cancelEdit" class="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                           <RotateCcw class="w-4 h-4" /> 取消
                        </button>
                        <button type="submit" class="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-teal-600 text-white font-bold shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                           <Save class="w-4 h-4" /> 儲存變更
                        </button>
                     </div>
                  </div>

               </form>
            </div>

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
.shadow-up {
  box-shadow: 0 -4px 6px -1px rgb(0 0 0 / 0.1), 0 -2px 4px -2px rgb(0 0 0 / 0.1);
}
</style>
