<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { MapPin } from 'lucide-vue-next'

interface PlaceResult {
  name: string
  formatted_address: string
  lat: number
  lng: number
}

const props = defineProps<{
  modelValue: string // campsite name
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'place-selected': [place: PlaceResult]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const searchValue = ref(props.modelValue)
let autocomplete: google.maps.places.Autocomplete | null = null

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  searchValue.value = newVal
})

// Watch for user typing
watch(searchValue, (newVal) => {
  emit('update:modelValue', newVal)
})

onMounted(() => {
  const initAutocomplete = () => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.error('Google Maps API not loaded')
      return
    }

    if (!inputRef.value) return

    // Initialize Autocomplete with Taiwan bias
    autocomplete = new google.maps.places.Autocomplete(inputRef.value, {
      componentRestrictions: { country: 'tw' },
      fields: ['name', 'formatted_address', 'geometry']
    })

    // Listen for place selection
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete?.getPlace()
      
      if (!place || !place.geometry || !place.geometry.location) {
        return
      }

      const result: PlaceResult = {
        name: place.name || '',
        formatted_address: place.formatted_address || '',
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      }

      emit('place-selected', result)
    })
  }

  // Check if Google Maps is already loaded
  if (window.google && window.google.maps && window.google.maps.places) {
    initAutocomplete()
  } else {
    // Wait for Google Maps to load
    window.addEventListener('google-maps-loaded', initAutocomplete)
  }
})
</script>

<template>
  <div class="relative">
    <div class="relative">
      <MapPin class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
      <input
        ref="inputRef"
        v-model="searchValue"
        type="text"
        class="w-full pl-10 pr-4 py-2.5 border border-primary-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
        placeholder="搜尋營區名稱 (例: 福壽山露營區)"
      />
    </div>
  </div>
</template>
