<script setup lang="ts">
import { ref } from 'vue'
import { MapPin } from 'lucide-vue-next'
import GooglePlaceSearch from '../GooglePlaceSearch.vue'

const props = defineProps<{
  initialData?: { location_name: string; latitude: number | null; longitude: number | null }
}>()

const emit = defineEmits<{
  next: [data: { location_name: string; latitude: number; longitude: number }]
  skip: []
  back: []
}>()

const locationName = ref(props.initialData?.location_name || '')
const selectedLocation = ref<{ lat: number; lng: number; name: string } | null>(
  props.initialData?.latitude && props.initialData?.longitude
    ? {
        lat: props.initialData.latitude,
        lng: props.initialData.longitude,
        name: props.initialData.location_name
      }
    : null
)

const handlePlaceSelected = (place: any) => {
  console.log('[OnboardingStepOrigin] Place selected:', place)

  locationName.value = place.name || place.formatted_address || ''
  selectedLocation.value = {
    lat: place.lat,
    lng: place.lng,
    name: place.name || place.formatted_address || ''
  }
}

const handleNext = () => {
  if (!selectedLocation.value) return

  emit('next', {
    location_name: selectedLocation.value.name,
    latitude: selectedLocation.value.lat,
    longitude: selectedLocation.value.lng
  })
}

const handleSkip = () => {
  emit('skip')
}
</script>

<template>
  <div>
    <div class="text-center mb-8">
      <div class="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
        <MapPin class="w-10 h-10 text-white" />
      </div>
      <h2 class="text-2xl font-bold text-primary-900 mb-2">設定你的起始地點</h2>
      <p class="text-primary-500">用於計算到營地的車程時間</p>
    </div>

    <div class="space-y-4">
      <!-- Google Places Search -->
      <div>
        <label class="block text-sm font-medium text-primary-700 mb-2">
          搜尋地點（輸入地址或地標）
        </label>
        <GooglePlaceSearch
          placeholder="例如：台北市、桃園住處、信義區"
          @place-selected="handlePlaceSelected"
        />
      </div>

      <!-- Selected Location Display -->
      <div v-if="selectedLocation" class="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <div class="flex items-start gap-3">
          <MapPin class="w-5 h-5 text-emerald-600 mt-0.5" />
          <div class="flex-1">
            <p class="font-medium text-emerald-900">已選擇地點</p>
            <p class="text-sm text-emerald-700">{{ selectedLocation.name }}</p>
            <p class="text-xs text-emerald-600 mt-1">
              {{ selectedLocation.lat.toFixed(4) }}, {{ selectedLocation.lng.toFixed(4) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-3 pt-6">
        <button
          @click="$emit('back')"
          class="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
        >
          返回
        </button>

        <button
          @click="handleSkip"
          class="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
        >
          跳過
        </button>

        <button
          @click="handleNext"
          :disabled="!selectedLocation"
          class="flex-1 py-3 px-6 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一步
        </button>
      </div>
    </div>
  </div>
</template>
