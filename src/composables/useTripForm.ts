import { ref, computed, watch } from 'vue'
import type { NewCampingTrip, CampingTripWithCampsite } from '../types/database'
import { TAIWAN_LOCATIONS } from '../constants/locations'
import { resolveTripDate } from '../utils/dateRange'
import { canSaveTrip, CAMPSITE_REQUIRED_MESSAGE } from '../utils/tripValidation'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

// TripModal 的表單狀態：初始化、重置、變更偵測、送出前整理
export function useTripForm(getInitialDate: () => string | null | undefined) {
  const emptyForm = (): NewCampingTrip => ({
    trip_date: resolveTripDate(null, getInitialDate()),
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

  const formData = ref<NewCampingTrip>(emptyForm())
  const originalTripData = ref<NewCampingTrip | null>(null)
  const selectedCity = ref('')
  const selectedDistrict = ref('')

  const availableDistricts = computed(() => {
    if (!selectedCity.value) return []
    const city = TAIWAN_LOCATIONS.find(c => c.id === selectedCity.value)
    return city ? city.districts : []
  })

  // 縣市/區域變動時同步 location 字串
  watch([selectedCity, selectedDistrict], ([city, district]) => {
    if (city && district) formData.value.location = `${city}${district}`
    else if (city) formData.value.location = city
  })

  const hasChanges = computed(() => {
    if (!originalTripData.value) return false
    return JSON.stringify(formData.value) !== JSON.stringify(originalTripData.value)
  })

  function resetForm() {
    const empty = emptyForm()
    formData.value = clone(empty)
    selectedCity.value = ''
    selectedDistrict.value = ''
    originalTripData.value = clone(empty)
  }

  function initFormData(newTrip: Partial<CampingTripWithCampsite> | null | undefined) {
    if (!newTrip) return resetForm()
    const linkedCampsite = newTrip.campsites

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

    formData.value = clone(data) as NewCampingTrip
    originalTripData.value = clone(data) as NewCampingTrip

    if (linkedCampsite?.city) {
      selectedCity.value = linkedCampsite.city
      selectedDistrict.value = linkedCampsite.district || ''
    } else if (data.location) {
      // 舊行程只有 location 字串（例如「新北市三峽區」），盡量拆回縣市與區域
      const city = TAIWAN_LOCATIONS.find(c => data.location.startsWith(c.id))
      if (city) {
        selectedCity.value = city.id
        const districtPart = data.location.substring(city.id.length)
        const district = city.districts.find(d => d.id === districtPart)
        selectedDistrict.value = district ? district.id : ''
      }
    }
  }

  // 送出前整理；新增模式沒有選到營區時 throw（呼叫方負責顯示訊息）
  function toPayload(isNew: boolean): NewCampingTrip {
    if (!canSaveTrip(isNew, formData.value.campsite_id)) throw new Error(CAMPSITE_REQUIRED_MESSAGE)

    const payload = { ...formData.value }
    const nullable = (v: unknown) => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v)
    const required = (v: unknown, def = 0) => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? def : Number(v)

    payload.altitude = nullable(formData.value.altitude) as number | undefined
    payload.cost = required(formData.value.cost, 0)
    payload.price = required(formData.value.price, 0)
    payload.duration_days = required(formData.value.duration_days, 1) || 1
    if (!payload.location) payload.location = ''
    return payload
  }

  // 送出後把目前內容當成原始值，讓儲存按鈕立刻消失
  function markSaved() {
    originalTripData.value = clone(formData.value)
  }

  return { formData, selectedCity, selectedDistrict, availableDistricts, hasChanges, initFormData, resetForm, toPayload, markSaved }
}
