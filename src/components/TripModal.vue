<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { 
  MapPin, Mountain, CloudRain, Moon, Tent, Wind, Save, RotateCcw, 
  Globe, ChevronLeft, ChevronRight, Users, Home, Trash2, Snowflake, IceCream, Droplets, Pencil
} from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import type { NewCampingTrip, CampingGear, Campsite, CampingTrip } from '../types/database'

import TripWeather from './TripWeather.vue'
import GooglePlaceSearch from './GooglePlaceSearch.vue'
import PhotoGallery from './PhotoGallery.vue'

interface Props {
  isOpen: boolean
  trip?: CampingTrip | null | any
  isAdmin?: boolean
  userProfile?: any
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: NewCampingTrip): void
  (e: 'edit-campsite', campsite: any): void
  (e: 'delete', id: number): void
}>()

// --- State ---
// Seamless editing: No explicit View/Edit mode toggle.
// We track changes to show/hide the Save button.
const originalTripData = ref<any>(null)
const formData = ref<NewCampingTrip>({
  trip_date: new Date().toISOString().split('T')[0] ?? '',
  duration_days: 2,
  campsite_name: '',
  location: '',
  altitude: undefined,
  tent_type: '',
  has_tarp: false,
  cost: undefined,
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
  scenery: undefined,
  start_location: ''
})

const hasChanges = computed(() => {
  if (!originalTripData.value) return false
  return JSON.stringify(formData.value) !== JSON.stringify(originalTripData.value)
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

// Fetch tents for selection
const fetchTents = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  try {
    const { data, error } = await supabase
      .from('camping_gear')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('type', 'tent')
      .order('created_at', { ascending: true })

    if (error) throw error
    tents.value = data || []
  } catch (error) {
    console.error('Error fetching tents:', error)
  }
}

// --- Google Places Search ---
const useGoogleSearch = ref(false)



// --- UI State ---
const isStartLocationExpanded = ref(false)
const isEditingStartLocation = ref(false)

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
      cost: newTrip.cost || undefined,
      latitude: linkedCampsite?.latitude ?? newTrip.latitude ?? undefined,
      longitude: linkedCampsite?.longitude ?? newTrip.longitude ?? undefined,
      start_latitude: newTrip.start_latitude ?? undefined,
      start_longitude: newTrip.start_longitude ?? undefined,
      start_location: newTrip.start_location ?? '',
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
    
    refreshViewData()
  } else {
    resetForm()
  }
}

function resetForm() {
  const emptyForm = {
    trip_date: new Date().toISOString().split('T')[0],
    campsite_name: '',
    duration_days: 2,
    location: '',
    cost: undefined,
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

  })
}

// Watchers
watch(() => props.trip, (val) => initFormData(val), { immediate: true })

// CRITICAL: Watch isOpen to reset state when re-opening same trip
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    //Reset UI state
    isStartLocationExpanded.value = false
    isEditingStartLocation.value = false
    
    // Fetch tents for selection
    fetchTents()
    
    if (props.trip) {
      initFormData(props.trip)
    } else {
      resetForm()
    }
  }
})

// --- Control ---
const cancelEdit = () => {
    if (props.trip) {
       initFormData(props.trip) // Revert data
    } else {
       handleClose()
    }
}

const handleDelete = () => {
  if (!props.trip?.id) return
  // Confirm is usually handled by parent, but here we emit directly if confirmed
  // Or we can let parent handle confirm. 
  // Let's rely on parent's deleteTrip to confirm, or confirm here.
  // App.vue deleteTrip has confirm. So just emit.
  emit('delete', props.trip.id)
}

const handleSubmit = async () => {
  try {
    // Handle new campsite logic if needed
    if (!formData.value.campsite_id && formData.value.campsite_name) {
       const { data: existing } = await supabase.from('campsites').select('id').eq('name', formData.value.campsite_name).single()
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
         const { data: created, error } = await supabase.from('campsites').insert([newCampsite] as any).select().single()
         if (!error && created) formData.value.campsite_id = (created as any).id
       }
    }
    
    const payload = { ...formData.value }
    const sanitizeNullable = (v: any) => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v)
    const sanitizeRequired = (v: any, def = 0) => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? def : Number(v)

    payload.altitude = sanitizeNullable(formData.value.altitude) as number | undefined
    payload.cost = sanitizeRequired(formData.value.cost, 0)
    payload.price = sanitizeRequired(formData.value.price, 0)
    payload.duration_days = sanitizeRequired(formData.value.duration_days, 1)
    
    if (!payload.location) payload.location = ''
    
    emit('submit', payload)
    // Update original data locally to hide Save button immediately
    originalTripData.value = JSON.parse(JSON.stringify(formData.value))

  } catch (e) {
    console.error('Error handling submission', e)
  }
}

const handleClose = () => {
    emit('close')
}

// --- Search Logic ---
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

const closeDropdown = () => setTimeout(() => { showCampsiteDropdown.value = false }, 200)

const handleGooglePlaceSelected = (place: any) => {
  formData.value.campsite_name = place.name
  formData.value.latitude = place.lat
  formData.value.longitude = place.lng
  if (place.formatted_address) {
    const addressParts = place.formatted_address.split(',')
    if (addressParts.length > 0) formData.value.location = addressParts[0].trim()
  }

}

const handleStartLocationSelected = (place: any) => {
  // Save place name (e.g., "台北車站"), NOT full address
  formData.value.start_location = place.name || place.formatted_address || ''
  formData.value.start_latitude = place.lat
  formData.value.start_longitude = place.lng
}

const toggleSearchMode = () => {
  useGoogleSearch.value = !useGoogleSearch.value
  campsiteSearchResults.value = []
  showCampsiteDropdown.value = false
}

// --- Resources Load ---
onMounted(async () => {
  try {
    const { data } = await supabase.from('camping_gear').select('*').order('name')
    if (data) {
      const allGear = data as unknown as CampingGear[]
      // Filter safer: assume type might be Tent or tent or null
      tents.value = allGear.filter(g => g.type && g.type.toLowerCase() === 'tent')
    }
  } catch (e) {
    console.error('Error loading gear', e)
  }
})


</script>

<template>
  <Teleport to="body">
    <Transition name="page">
      <div v-if="isOpen" class="fixed inset-x-0 bottom-0 top-[64px] md:top-[72px] z-40 bg-surface-50 flex flex-col font-sans border-t border-gray-100 shadow-xl overflow-hidden">
        
        <!-- Navigation Header (Sticky) -->
        <div class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-white/20 px-4 py-3 flex items-center justify-between shadow-sm">
           <div class="flex items-center gap-2">
              <button 
                @click="handleClose" 
                class="p-2 -ml-2 text-primary-600 hover:bg-surface-100 rounded-full transition-colors active:scale-95 bg-white/50"
              >
                <ChevronLeft class="w-6 h-6" />
              </button>
              <h1 class="font-bold text-lg text-primary-900 truncate max-w-[200px]">
                行程詳情
              </h1>
           </div>
           
           <!-- Actions (Trash) -->
           <div class="flex items-center gap-2">
               <button 
                  v-if="trip?.id"
                  @click="handleDelete" 
                  class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  title="刪除行程"
               >
                   <Trash2 class="w-5 h-5" />
               </button>
           </div>
        </div>

        <!-- Main Content (Scrollable) -->
        <div class="flex-1 overflow-y-auto pb-32">
           <form @submit.prevent="handleSubmit" class="w-full">
              
              <!-- 1. HERO SECTION (Seamless Edit) -->
              <div class="relative w-full h-[280px] md:h-[320px] bg-gray-200 group">
                  <!-- Background Image -->
                  <div class="absolute inset-0">
                     <img 
                       src="/images/card_bg.jpg" 
                       class="w-full h-full object-cover opacity-80"
                     />
                     <div class="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-surface-50"></div>
                  </div>

                  <!-- Night Rush Toggle (Top Right) -->
                  <div class="absolute top-4 right-4 z-20">
                      <button 
                        type="button" 
                        @click="formData.night_rush = !formData.night_rush" 
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md transition-all active:scale-95 border"
                        :class="formData.night_rush ? 'bg-indigo-400 border-indigo-300 text-white' : 'bg-white/80 border-white/50 text-gray-600 hover:bg-white'"
                      >
                         <Moon class="w-4 h-4" :class="{'fill-current': formData.night_rush}" />
                         <span class="text-xs font-bold">夜衝</span>
                      </button>
                  </div>

                  <!-- Content -->
                  <div class="absolute inset-0 flex flex-col items-center justify-center p-6 z-10 text-center">
                      <!-- Date Pill -->
                      <div class="flex items-center gap-2 mb-4 bg-white/60 backdrop-blur rounded-full px-4 py-1.5 shadow-sm border border-white/40">
                          <input 
                              v-model="formData.trip_date" 
                              type="date" 
                              class="bg-transparent border-none text-sm font-bold text-primary-900 p-0 focus:ring-0 cursor-pointer w-[110px]" 
                          />
                          <span class="text-xs text-primary-600 font-bold">|</span>
                          <div class="flex items-center gap-1">
                              <input 
                                  v-model.number="formData.duration_days" 
                                  type="number" 
                                  min="1" 
                                  class="w-8 bg-transparent border-none text-sm font-bold text-primary-900 p-0 focus:ring-0 text-center" 
                              />
                              <span class="text-xs text-primary-600 font-bold">天</span>
                          </div>
                      </div>

                      <!-- Title (Seamless Input) -->
                      <div class="w-full max-w-2xl relative mb-2">
                           <div v-if="formData.campsite_id" class="flex items-center justify-center gap-2">
                               <h2 class="text-3xl md:text-5xl font-black text-primary-900 tracking-tight drop-shadow-sm">
                                   {{ formData.campsite_name }}
                               </h2>
                           </div>
                           <div v-else class="relative group/search text-center">
                               <!-- Google/Local Toggle (floating) -->
                               <div class="absolute -top-10 right-0 left-0 flex justify-center opacity-0 group-hover/search:opacity-100 transition-opacity pointer-events-none group-hover/search:pointer-events-auto">
                                   <button type="button" @click="toggleSearchMode" class="text-[10px] bg-white/80 px-2 py-1 rounded-full shadow-sm flex items-center gap-1 text-primary-600">
                                       <Globe class="w-3 h-3" /> {{ useGoogleSearch ? 'Google' : 'Local' }}
                                   </button>
                               </div>

                               <div v-if="useGoogleSearch">
                                 <GooglePlaceSearch
                                   v-model="formData.campsite_name"
                                   @place-selected="handleGooglePlaceSelected"
                                   class="text-3xl md:text-5xl font-black text-primary-900 bg-transparent text-center w-full placeholder-primary-900/40"
                                 />
                               </div>
                               <div v-else>
                                   <input 
                                      v-model="formData.campsite_name"
                                      type="text"
                                      class="w-full text-center bg-transparent border-none p-0 text-3xl md:text-5xl font-black text-primary-900 placeholder-primary-900/40 focus:ring-0"
                                      placeholder="輸入營地名稱..."
                                      @input="searchCampsites(($event.target as HTMLInputElement).value)"
                                      @focus="searchCampsites(formData.campsite_name)"
                                      @blur="closeDropdown"
                                    />
                                    <!-- Dropdown -->
                                    <div v-if="showCampsiteDropdown && campsiteSearchResults.length > 0" class="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl z-50 text-left text-sm overflow-hidden text-primary-900">
                                      <ul>
                                        <li v-for="site in campsiteSearchResults" :key="site.id" @mousedown="selectCampsite(site)" class="px-4 py-3 hover:bg-surface-50 cursor-pointer border-b border-gray-50 last:border-none">
                                           <div class="font-bold">{{ site.name }}</div>
                                           <div class="text-xs text-gray-500">{{ site.city }}{{ site.district }}</div>
                                        </li>
                                      </ul>
                                    </div>
                               </div>
                           </div>
                      </div>

                      <!-- Subtitle Location -->
                      <div class="flex items-center justify-center gap-1.5 text-primary-700 font-bold bg-white/40 backdrop-blur-sm px-3 py-1 rounded-full">
                          <MapPin class="w-4 h-4" />
                          <input 
                            v-model="formData.location" 
                            type="text" 
                            class="bg-transparent border-none text-sm font-bold text-primary-800 p-0 focus:ring-0 w-[120px] text-center placeholder-primary-600/50"
                            placeholder="輸入地點..."
                          />
                      </div>
                  </div>
              </div>


              <!-- 2. CONTENT CONTAINER -->
              <div class="px-4 md:px-8 -mt-6 relative z-20 flex flex-col gap-4">
                  
                  <!-- Weather Widget -->
                  <TripWeather :trip="weatherTrip" :isOpen="!!weatherTrip" @close="weatherTrip = null" />

                  <!-- Section Header: Basic Info -->
                  <div class="flex items-center justify-between mt-4 px-1 mb-2">
                     <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">CAMPSITE INFO</h3>
                     
                     <!-- Collapsible Start Location Trigger -->
                     <button type="button" @click="isStartLocationExpanded = !isStartLocationExpanded" class="flex items-center gap-1 text-[10px] bg-white border border-gray-100 px-2 py-1 rounded-full text-gray-500 hover:text-primary-600 transition-colors">
                        <MapPin class="w-3 h-3" />
                        <span class="max-w-[150px] truncate">
                           {{ formData.start_location ? `自訂出發地：${formData.start_location}` : '自訂出發地' }}
                        </span>
                        <ChevronRight class="w-3 h-3 transition-transform duration-300" :class="{'rotate-90': isStartLocationExpanded}" />
                     </button>
                  </div>
                  
                  <!-- Collapsible Start Location Input -->
                  <div v-if="isStartLocationExpanded" class="px-1 mb-4 animate-in slide-in-from-top-2 fade-in duration-200">
                     <div class="card-organic bg-white p-3 border-l-4 border-l-blue-400">
                        <div class="flex justify-between items-center mb-2">
                           <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">自訂本次出發地</label> 
                           <span v-if="userProfile?.location_name && !formData.start_location" class="text-[10px] text-gray-400 truncate max-w-[150px]">
                              預設: {{ userProfile.location_name }}
                           </span>
                        </div>

                        <!-- 1. LOCKED VIEW: Show Selected Address -->
                        <div v-if="formData.start_location && !isEditingStartLocation" class="flex items-center justify-between bg-surface-50 rounded-xl p-2">
                           <div class="flex items-center gap-2 overflow-hidden">
                              <MapPin class="w-4 h-4 text-primary-500 shrink-0" />
                              <span class="text-sm font-bold text-gray-800 truncate">{{ formData.start_location }}</span>
                           </div>
                           <div class="flex items-center gap-1 shrink-0">
                               <button type="button" @click="isEditingStartLocation = true" class="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg text-xs font-medium transition-colors">修改</button>
                               <button 
                                 type="button" 
                                 @click="formData.start_location = ''; formData.start_latitude = undefined; formData.start_longitude = undefined; isEditingStartLocation = false"
                                 class="p-1.5 text-red-400 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors"
                               >
                                 清除
                               </button>
                           </div>
                        </div>

                        <!-- 2. SEARCH VIEW -->
                        <div v-else>
                           <GooglePlaceSearch
                              v-model="formData.start_location"
                              @place-selected="(p) => { handleStartLocationSelected(p); isEditingStartLocation = false }"
                              class="w-full bg-surface-50 border-none rounded-xl p-2 text-sm font-bold text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-100 transition-all"
                              placeholder="輸入地址，轉換為本次出發座標..."
                           />
                           <div class="mt-2 flex justify-end" v-if="isEditingStartLocation">
                               <button type="button" @click="isEditingStartLocation = false" class="text-xs text-gray-400 hover:text-gray-600">取消</button>
                           </div>
                        </div>
                        
                        <p class="text-[10px] text-gray-400 mt-2 leading-relaxed">
                           若本次露營出發地非預設出發地，可在此設定。系統將依此計算路程與導航。
                        </p>
                     </div>
                  </div>

                  <!-- INFO CARDS (Home Style) - Grid -->
                  <div class="grid grid-cols-2 gap-3">
                      <!-- 1. Altitude & Facilities (Combined, Full Width) -->
                      <div class="col-span-2 card-organic bg-white p-3 flex items-center justify-between gap-4 overflow-hidden">
                          <!-- Altitude Section -->
                          <div class="flex items-center gap-3 pl-1">
                              <div class="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500 shrink-0">
                                  <Mountain class="w-5 h-5" />
                              </div>
                              <div class="flex flex-col min-w-0">
                                  <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">海拔</span>
                                  <div class="flex items-baseline">
                                      <span class="text-xl font-black text-gray-800">{{ formData.altitude || '--' }}</span>
                                      <span class="text-xs text-gray-400 ml-1 font-bold">m</span>
                                  </div>
                              </div>
                          </div>

                          <!-- Divider -->
                          <div class="w-px h-8 bg-gray-100"></div>

                          <!-- Facilities Section -->
                          <div class="flex items-center gap-3 md:gap-6 pr-2">
                               <!-- Fridge -->
                               <div class="flex flex-col items-center gap-1 min-w-[24px]">
                                   <div class="relative w-6 h-6 flex items-center justify-center">
                                       <Snowflake class="w-full h-full" :class="trip?.campsites?.amenities?.has_fridge ? 'text-sky-500' : 'text-slate-200'" />
                                       <div v-if="!trip?.campsites?.amenities?.has_fridge" class="absolute w-[140%] h-[2px] bg-red-400/50 rotate-45 rounded-full z-10"></div>
                                   </div>
                                   <span class="text-[10px] font-bold mt-0.5" :class="trip?.campsites?.amenities?.has_fridge ? 'text-sky-700' : 'text-slate-300'">冷藏</span>
                               </div>
                               <!-- Freezer -->
                               <div class="flex flex-col items-center gap-1 min-w-[24px]">
                                   <div class="relative w-6 h-6 flex items-center justify-center">
                                       <IceCream class="w-full h-full" :class="trip?.campsites?.amenities?.has_freezer ? 'text-indigo-500' : 'text-slate-200'" />
                                       <div v-if="!trip?.campsites?.amenities?.has_freezer" class="absolute w-[140%] h-[2px] bg-red-400/50 rotate-45 rounded-full z-10"></div>
                                   </div>
                                   <span class="text-[10px] font-bold mt-0.5" :class="trip?.campsites?.amenities?.has_freezer ? 'text-indigo-700' : 'text-slate-300'">冷凍</span>
                               </div>
                               <!-- Water -->
                               <div class="flex flex-col items-center gap-1 min-w-[24px]">
                                   <div class="relative w-6 h-6 flex items-center justify-center">
                                       <Droplets class="w-full h-full" :class="trip?.campsites?.amenities?.has_water_dispenser ? 'text-teal-500' : 'text-slate-200'" />
                                       <div v-if="!trip?.campsites?.amenities?.has_water_dispenser" class="absolute w-[140%] h-[2px] bg-red-400/50 rotate-45 rounded-full z-10"></div>
                                   </div>
                                   <span class="text-[10px] font-bold mt-0.5" :class="trip?.campsites?.amenities?.has_water_dispenser ? 'text-teal-700' : 'text-slate-300'">飲水</span>
                               </div>
                          </div>
                      </div>

                      <!-- 2. Zone -->
                      <div class="card-organic bg-white p-4 flex items-center gap-3 overflow-hidden">
                          <div class="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                              <Tent class="w-5 h-5" />
                          </div>
                          <div class="flex flex-col min-w-0">
                              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">營位</span>
                              <input 
                                v-model="formData.zone" 
                                type="text" 
                                placeholder="未指定"
                                class="bg-transparent border-none p-0 text-base font-black text-gray-800 w-full focus:ring-0 leading-tight"
                              />
                          </div>
                      </div>

                       <!-- 3. Campsite Fee -->
                      <div class="card-organic bg-white p-4 flex items-center gap-3 overflow-hidden">
                           <div class="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
                              <span class="font-bold text-lg">$</span>
                          </div>
                          <div class="flex flex-col min-w-0">
                              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">營位費</span>
                              <input 
                                v-model.number="formData.cost" 
                                type="number" 
                                placeholder="未提供"
                                class="bg-transparent border-none p-0 text-base font-black text-gray-800 w-full focus:ring-0 leading-tight placeholder:text-gray-300"
                              />
                          </div>
                      </div>

                      <!-- 4. Companions -->
                      <div class="card-organic bg-white p-4 flex items-center gap-3 overflow-hidden">
                          <div class="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                              <Users class="w-5 h-5" />
                          </div>
                          <div class="flex flex-col min-w-0">
                              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">露友</span>
                              <input 
                                v-model="formData.companions" 
                                type="text" 
                                placeholder="無"
                                class="bg-transparent border-none p-0 text-base font-black text-gray-800 w-full focus:ring-0 leading-tight"
                              />
                          </div>
                      </div>

                      <!-- 5. Tent Selection -->
                      <div class="card-organic bg-white p-4 flex items-center gap-3 overflow-hidden">
                           <div class="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0 overflow-hidden">
                              <img 
                                v-if="formData.tent_id && tents.find(t => t.id === formData.tent_id)?.image_url" 
                                :src="tents.find(t => t.id === formData.tent_id)?.image_url || ''" 
                                class="w-full h-full object-contain"
                              />
                              <Home v-else class="w-5 h-5" />
                           </div>
                           <div class="flex flex-col flex-1 min-w-0">
                                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">使用帳篷</span>
                                <div class="relative w-full">
                                  <select 
                                    v-model="formData.tent_id" 
                                    class="w-full bg-transparent border-none p-0 text-base font-black text-gray-800 focus:ring-0 cursor-pointer appearance-none pr-6 truncate"
                                    :class="{'text-gray-400': !formData.tent_id}"
                                  >
                                       <option :value="undefined">未選擇</option>
                                       <option v-for="tent in tents" :key="tent.id" :value="tent.id">{{ tent.name }}</option>
                                  </select>
                                  <div class="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                     <ChevronLeft class="w-4 h-4 -rotate-90" />
                                  </div>
                                </div>
                           </div>
                      </div>
                  </div>

                  <!-- Section Header: Conditions & Notes -->
                  <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 mt-6 px-1">CONDITIONS & NOTES</h3>

                  <!-- Tags (Toggleable Buttons) -->
                  <div class="flex flex-wrap gap-2 py-2">
                       <!-- Night Rush moved to header -->
                       <button type="button" @click="formData.is_rainy = !formData.is_rainy" 
                         class="px-4 py-2 rounded-xl flex items-center gap-2 transition-all border"
                         :class="formData.is_rainy ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-100 text-gray-400 grayscale'">
                           <CloudRain class="w-4 h-4" /> <span class="text-sm font-bold">下雨</span>
                       </button>
                       <button type="button" @click="formData.is_windy = !formData.is_windy" 
                         class="px-4 py-2 rounded-xl flex items-center gap-2 transition-all border"
                         :class="formData.is_windy ? 'bg-gray-100 border-gray-200 text-gray-600' : 'bg-white border-gray-100 text-gray-400 grayscale'">
                           <Wind class="w-4 h-4" /> <span class="text-sm font-bold">大風</span>
                       </button>
                       <button type="button" @click="formData.is_wet_tent = !formData.is_wet_tent" 
                         class="px-4 py-2 rounded-xl flex items-center gap-2 transition-all border"
                         :class="formData.is_wet_tent ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-gray-100 text-gray-400 grayscale'">
                           <Tent class="w-4 h-4" /> <span class="text-sm font-bold">收濕帳</span>
                       </button>
                  </div>

                  <!-- Notes -->
                  <div class="card-organic bg-white p-5">
                      <div class="flex items-center gap-2 mb-2 text-primary-900 font-bold">
                         <Pencil class="w-4 h-4" /> 心得筆記
                      </div>
                      <textarea 
                         v-model="formData.notes"
                         rows="4"
                         placeholder="寫下這次的回憶..."
                         class="w-full bg-surface-50/50 border-none rounded-xl p-3 text-primary-900 focus:bg-white focus:ring-2 focus:ring-primary-100 transition-all placeholder-gray-400 text-sm leading-relaxed"
                      ></textarea>
                  </div>

                  <!-- Section Header: Gallery -->
                  <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 mt-6 px-1">GALLERY</h3>

                  <!-- Gallery -->
                  <div v-if="trip?.id">
                      <PhotoGallery :tripId="trip.id" :isEditable="true" />
                  </div>


              </div>

              <div class="h-24"></div> <!-- Spacer -->

           </form>
        </div>

        <!-- Sticky Footer for Save -->
        <div v-if="hasChanges" class="absolute bottom-6 left-0 right-0 px-4 flex justify-center z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
             <div class="bg-white/90 backdrop-blur-md p-2 pr-6 pl-2 rounded-full shadow-2xl border border-primary-100 flex items-center gap-3">
                 <button @click="cancelEdit" class="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors">
                     <RotateCcw class="w-5 h-5" />
                 </button>
                 <button @click="handleSubmit" class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-full font-bold shadow-lg shadow-primary-500/30 transition-all hover:scale-105 active:scale-95">
                     <Save class="w-4 h-4" /> 儲存變更
                 </button>
             </div>
        </div>

      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.page-enter-active,
.page-leave-active {
  transition: all 0.3s ease-out;
}

.page-enter-from,
.page-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
</style>
