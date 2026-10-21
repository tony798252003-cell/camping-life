<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  Moon, Save, RotateCcw, ChevronLeft, ChevronRight, Trash2
} from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { gearQueries } from '../services/db/gear'
import { toGearItems } from '../utils/dbRows'
import type { NewCampingTrip, CampingGear, Campsite, CampingTrip } from '../types/database'
import { TAIWAN_LOCATIONS } from '../constants/locations'
import { resolveTripDate } from '../utils/dateRange'
import { CAMPSITE_REQUIRED_MESSAGE } from '../utils/tripValidation'
import { useNotification } from '../composables/useNotification'
import { useAuth } from '../composables/useAuth'
import { isOwnRow } from '../utils/familyJourney'
import type { UserProfileState } from '../composables/useUserProfile'
import { useTripForm } from '../composables/useTripForm'

import TripWeather from './TripWeather.vue'
import AddCampsiteFlow from './campsite/AddCampsiteFlow.vue'
import TripCampsitePicker from './trip/TripCampsitePicker.vue'
import TripStartLocation from './trip/TripStartLocation.vue'
import TripCampsiteInfoPanel from './trip/TripCampsiteInfoPanel.vue'
import TripGearSection from './trip/TripGearSection.vue'
import TripReviewSection from './trip/TripReviewSection.vue'

interface Props {
  isOpen: boolean
  trip?: CampingTrip | null | any
  userProfile?: UserProfileState | null
  hasPrev?: boolean
  hasNext?: boolean
  initialDate?: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: NewCampingTrip): void
  (e: 'delete', id: number): void
  (e: 'prev'): void
  (e: 'next'): void
}>()

// Seamless editing: 沒有檢視/編輯切換，有變更才顯示儲存按鈕
const isSubmitting = ref(false)
const campsiteError = ref('')
const { warning } = useNotification()
const {
  formData, selectedCity, selectedDistrict, availableDistricts,
  hasChanges, initFormData, resetForm, toPayload, markSaved
} = useTripForm(() => props.initialDate)

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

const fetchTents = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  try {
    tents.value = toGearItems(await gearQueries.listVisible('tent'))
  } catch (error) {
    console.error('Error fetching tents:', error)
  }
}

const selectCampsite = (campsite: Campsite) => {
  // 新增行程選營區後日期不能變空白（QA）：空白時補回預設日期，已填的保留
  if (!props.trip) formData.value.trip_date = resolveTripDate(formData.value.trip_date, props.initialDate)
  formData.value.campsite_name = campsite.name
  formData.value.campsite_id = campsite.id
  if (campsite.latitude && campsite.longitude) {
    formData.value.latitude = campsite.latitude
    formData.value.longitude = campsite.longitude
  }
  if (campsite.altitude) formData.value.altitude = campsite.altitude
  if (campsite.city) {
    selectedCity.value = campsite.city
    selectedDistrict.value = campsite.district || ''
  }
  campsiteError.value = ''
}

// --- 新增營區 sheet（疊在 TripModal 上，表單不卸載）---
const showAddCampsite = ref(false)
const handleCampsiteCreated = (campsite: Campsite) => {
  selectCampsite(campsite)
  showAddCampsite.value = false
}

// --- Watchers ---
watch(() => props.trip, (val) => initFormData(val), { immediate: true })

// 重新開啟同一筆行程時要重置狀態
watch(() => props.isOpen, (newVal) => {
  if (!newVal) return
  fetchTents()
  campsiteError.value = ''
  if (props.trip) initFormData(props.trip)
  else resetForm()
})

// --- Control ---
const handleClose = () => emit('close')

const cancelEdit = () => {
  if (props.trip) initFormData(props.trip) // 還原
  else handleClose()
}

// RLS 只允許擁有者刪行程；家人編輯別人的行程不顯示刪除鈕
const { session: authSession } = useAuth()
const canDelete = computed(() => isOwnRow(props.trip?.user_id, authSession.value?.user?.id))

// 確認視窗由父層 deleteTrip 處理，這裡直接 emit
const handleDelete = () => {
  if (!props.trip?.id) return
  emit('delete', props.trip.id)
}

const handleSubmit = async () => {
  if (isSubmitting.value) return

  isSubmitting.value = true
  try {
    let payload: NewCampingTrip
    try {
      payload = toPayload(!props.trip)
    } catch {
      campsiteError.value = CAMPSITE_REQUIRED_MESSAGE
      warning(CAMPSITE_REQUIRED_MESSAGE)
      return
    }
    emit('submit', payload)
    markSaved()
  } catch (e) {
    console.error('Error handling submission', e)
  } finally {
    isSubmitting.value = false
  }
}

// 帳篷清單只由 fetchTents 載入（自己 + 家人的帳篷，依建立時間；RLS 決定可見範圍）。
// 原本 onMounted 另有一支全表查詢與 isOpen watcher 競態，實際上開啟後以 fetchTents 結果為準；
// 這裡只補「掛載時已開啟」的情況（watch 非 immediate）。
onMounted(() => {
  if (props.isOpen) fetchTents()
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
                aria-label="返回"
                class="w-11 h-11 -ml-2 flex items-center justify-center text-primary-600 hover:bg-surface-100 rounded-full transition-colors active:scale-95 bg-white/50"
              >
                <ChevronLeft class="w-6 h-6" />
              </button>
              <h1 class="font-bold text-lg text-primary-900 truncate max-w-[200px]">
                行程詳情
              </h1>
           </div>
           
           <!-- Actions (Trash) -->
           <div class="flex items-center gap-2">
               <!-- Navigation -->
               <div class="flex items-center bg-gray-100 rounded-full p-0.5" v-if="hasPrev || hasNext">
                  <button 
                    @click="emit('prev')" 
                    aria-label="上一趟"
                    :disabled="!hasPrev"
                    class="w-10 h-11 flex items-center justify-center rounded-full hover:bg-white transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                     <ChevronLeft class="w-4 h-4 text-gray-600" />
                  </button>
                  <div class="w-px h-3 bg-gray-300 mx-0.5"></div>
                  <button 
                    @click="emit('next')" 
                    aria-label="下一趟"
                    :disabled="!hasNext"
                    class="w-10 h-11 flex items-center justify-center rounded-full hover:bg-white transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                     <ChevronRight class="w-4 h-4 text-gray-600" />
                  </button>
               </div>

               <button 
                  v-if="trip?.id && canDelete"
                  @click="handleDelete" 
                  class="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  title="刪除行程"
                  aria-label="刪除行程"
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
                     <div class="absolute inset-0 bg-gradient-to-b from-transparent from-35% to-surface-50"></div>
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
                      <div class="flex items-center gap-1.5 mb-3 bg-white/75 rounded-full px-3.5 py-1.5">
                          <input 
                              v-model="formData.trip_date" 
                              type="date" 
                              class="bg-transparent border-none text-[13px] font-bold text-primary-800 p-0 focus:ring-0 cursor-pointer w-[110px]" 
                          />
                          <span class="text-[13px] text-primary-800 font-bold">·</span>
                          <div class="flex items-center gap-1">
                              <input 
                                  v-model.number="formData.duration_days" 
                                  type="number" 
                                  min="1" 
                                  class="w-8 bg-transparent border-none text-[13px] font-bold text-primary-800 p-0 focus:ring-0 text-center" 
                              />
                              <span class="text-[13px] text-primary-800 font-bold">天</span>
                          </div>
                      </div>

                      <!-- Title: 營區搜尋 / 已選營區 -->
                      <TripCampsitePicker :form="formData" :is-edit="!!trip" :error="campsiteError" @select="selectCampsite" @add-campsite="showAddCampsite = true" />

                      <!-- Subtitle Location -->
                       <!-- Subtitle Location -->
                      <div class="flex items-center justify-center gap-2 text-primary-800">
                              <select
                                v-model="selectedCity"
                                class="bg-transparent border-none text-sm font-medium text-primary-800 p-0 pr-5 focus:ring-0 cursor-pointer"
                              >
                                <option value="">選縣市</option>
                                <option v-for="city in TAIWAN_LOCATIONS" :key="city.id" :value="city.id">
                                  {{ city.name }}
                                </option>
                              </select>
                              <select
                                v-model="selectedDistrict"
                                :disabled="!selectedCity"
                                class="bg-transparent border-none text-sm font-medium text-primary-800 p-0 pr-5 focus:ring-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <option value="">選區域</option>
                                <option v-for="district in availableDistricts" :key="district.id" :value="district.id">
                                  {{ district.name }}
                                </option>
                              </select>
                      </div>
                  </div>
              </div>


              <!-- 2. CONTENT CONTAINER -->
              <div class="px-4 md:px-8 -mt-5 relative z-20 flex flex-col gap-3">
                  
                  <!-- Weather Widget -->
                  <TripWeather :trip="weatherTrip" :isOpen="!!weatherTrip" @close="weatherTrip = null" />

                  <TripStartLocation :form="formData" :user-profile="userProfile" />


                  <!-- INFO CARDS (Home Style) - Grid -->
                  <div class="grid grid-cols-2 gap-2.5">
                      <TripCampsiteInfoPanel :trip="trip" :altitude="formData.altitude" />

                      <TripGearSection :form="formData" :tents="tents" />
                  </div>

                  <!-- Section Header: Conditions & Notes -->
                  <!-- Campsite Map (Read-Only) -->
                  <div v-if="trip?.campsites?.layout_image_url" class="mt-6 mb-2">
                      <h3 class="text-sm font-bold text-primary-900 mb-2 px-1">營區配置圖</h3>
                      <div class="rounded-[20px] overflow-hidden shadow-sm bg-white group cursor-zoom-in" onclick="window.open(this.querySelector('img').src)">
                          <img 
                            :src="trip.campsites.layout_image_url" 
                            class="w-full h-auto object-contain bg-gray-50 max-h-[400px]" 
                            title="點擊查看大圖"
                          />
                          <div class="bg-gray-50 px-3 py-2 border-t border-gray-100 flex items-center justify-center text-xs text-gray-400 group-hover:text-primary-600 font-bold transition-colors">
                             點擊放大查看
                          </div>
                      </div>
                  </div>

                  <TripReviewSection :form="formData" :trip-id="trip?.id" :collapsed="!trip" />


              </div>

              <div class="h-24"></div> <!-- Spacer -->

           </form>
        </div>

        <!-- Sticky Footer for Save -->
        <div v-if="hasChanges" class="absolute bottom-6 left-0 right-0 px-4 flex justify-center z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
             <div class="bg-white/90 backdrop-blur-md p-2 pr-6 pl-2 rounded-full shadow-2xl border border-primary-100 flex items-center gap-3">
                 <button @click="cancelEdit" aria-label="還原變更" class="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors">
                     <RotateCcw class="w-5 h-5" />
                 </button>
                 <button
                   @click="handleSubmit"
                   :disabled="isSubmitting"
                   class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-full font-bold shadow-lg shadow-primary-500/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                 >
                     <Save class="w-4 h-4" /> {{ isSubmitting ? '儲存中...' : '儲存變更' }}
                 </button>
             </div>
        </div>

      </div>
    </Transition>
  </Teleport>

  <!-- 新增營區：全螢幕 sheet，不換路由，TripModal 已填的表單不會遺失 -->
  <Teleport to="body">
    <div v-if="showAddCampsite" class="fixed inset-0 z-[70] bg-surface-50 overflow-y-auto">
      <AddCampsiteFlow embedded @saved="handleCampsiteCreated" @cancel="showAddCampsite = false" />
    </div>
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
