<script setup lang="ts">
import { ref } from 'vue'
import { MapPin } from 'lucide-vue-next'

const props = defineProps<{
  initialData?: { location_name: string; latitude: number | null; longitude: number | null }
}>()

const emit = defineEmits<{
  next: [data: { location_name: string; latitude: number; longitude: number }]
  skip: []
  back: []
}>()

const locationName = ref(props.initialData?.location_name || '')
const selectedLocation = ref<{ lat: number; lng: number } | null>(
  props.initialData?.latitude && props.initialData?.longitude
    ? { lat: props.initialData.latitude, lng: props.initialData.longitude }
    : null
)

// Mock location search (replace with actual API later)
const searchResults = ref<Array<{ name: string; lat: number; lng: number }>>([])
const isSearching = ref(false)

const handleSearch = async () => {
  if (!locationName.value.trim()) return

  isSearching.value = true

  // TODO: Replace with actual Google Places API or Mapbox Geocoding
  // Mock results for now
  await new Promise(resolve => setTimeout(resolve, 500))

  searchResults.value = [
    { name: locationName.value, lat: 25.0621, lng: 121.1963 }
  ]

  isSearching.value = false
}

const selectLocation = (location: { name: string; lat: number; lng: number }) => {
  locationName.value = location.name
  selectedLocation.value = { lat: location.lat, lng: location.lng }
  searchResults.value = []
}

const handleNext = () => {
  if (!selectedLocation.value) return

  emit('next', {
    location_name: locationName.value,
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
      <!-- Search Input -->
      <div>
        <label class="block text-sm font-medium text-primary-700 mb-2">地點名稱</label>
        <div class="relative">
          <input
            v-model="locationName"
            type="text"
            placeholder="例如：家、桃園住處"
            class="w-full px-4 py-3 pr-24 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
            @keyup.enter="handleSearch"
          />
          <button
            @click="handleSearch"
            :disabled="isSearching || !locationName.trim()"
            class="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-sm rounded-lg transition-all disabled:opacity-50"
          >
            {{ isSearching ? '搜尋中...' : '搜尋' }}
          </button>
        </div>
      </div>

      <!-- Search Results -->
      <div v-if="searchResults.length > 0" class="bg-surface-50 rounded-xl p-4 space-y-2">
        <button
          v-for="result in searchResults"
          :key="`${result.lat}-${result.lng}`"
          @click="selectLocation(result)"
          class="w-full text-left px-4 py-3 bg-white hover:bg-primary-50 rounded-lg transition-all"
        >
          <div class="flex items-center gap-3">
            <MapPin class="w-4 h-4 text-primary-500" />
            <span class="font-medium text-primary-900">{{ result.name }}</span>
          </div>
        </button>
      </div>

      <!-- Selected Location Display -->
      <div v-if="selectedLocation" class="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <div class="flex items-start gap-3">
          <MapPin class="w-5 h-5 text-emerald-600 mt-0.5" />
          <div class="flex-1">
            <p class="font-medium text-emerald-900">已選擇地點</p>
            <p class="text-sm text-emerald-700">{{ locationName }}</p>
            <p class="text-xs text-emerald-600 mt-1">
              {{ selectedLocation.lat.toFixed(4) }}, {{ selectedLocation.lng.toFixed(4) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Note about map integration -->
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p class="font-medium mb-1">開發提示</p>
        <p>地圖整合待實作，目前使用模擬資料</p>
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
