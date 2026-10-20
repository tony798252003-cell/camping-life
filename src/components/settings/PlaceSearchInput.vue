<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2, Search } from 'lucide-vue-next'
import { apiPost } from '../../services/api'
import type { PlaceLite } from '../../types/campsiteDraft'

// 取代舊的 Maps JS Autocomplete：按下搜尋才打 /api/places-search（伺服器端持有 key）
interface PlaceResult {
  name: string
  formatted_address: string
  lat: number
  lng: number
}

const props = defineProps<{ modelValue?: string | null; placeholder?: string }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'place-selected': [place: PlaceResult]
}>()

const text = ref(props.modelValue || '')
const candidates = ref<PlaceLite[]>([])
const busy = ref(false)
const errorMsg = ref('')

watch(() => props.modelValue, (v) => { text.value = v || '' })

async function search() {
  const q = text.value.trim()
  if (!q || busy.value) return
  busy.value = true
  errorMsg.value = ''
  candidates.value = []
  try {
    const res = await apiPost<{ candidates: PlaceLite[] }>('/api/places-search', { query: q })
    candidates.value = res.candidates
    if (res.candidates.length === 0) errorMsg.value = '找不到符合的地點'
  } catch {
    errorMsg.value = '搜尋失敗，請稍後再試'
  } finally {
    busy.value = false
  }
}

function pick(c: PlaceLite) {
  text.value = c.name
  emit('update:modelValue', c.name)
  emit('place-selected', { name: c.name, formatted_address: c.address, lat: c.lat, lng: c.lng })
  candidates.value = []
}
</script>

<template>
  <div class="w-full">
    <div class="flex gap-2">
      <input
        v-model="text"
        type="text"
        :placeholder="placeholder"
        class="flex-1 min-w-0 px-4 py-3 bg-white border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-gray-400"
        @input="emit('update:modelValue', text)"
        @keydown.enter.prevent="search"
      />
      <button
        type="button"
        :disabled="busy || !text.trim()"
        class="px-4 rounded-xl bg-blue-500 text-white disabled:opacity-50 flex items-center justify-center"
        aria-label="搜尋"
        @click="search"
      >
        <Loader2 v-if="busy" class="w-4 h-4 animate-spin" />
        <Search v-else class="w-4 h-4" />
      </button>
    </div>
    <p v-if="errorMsg" class="mt-2 text-xs text-red-500">{{ errorMsg }}</p>
    <ul v-if="candidates.length" class="mt-2 bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden text-sm text-left">
      <li
        v-for="c in candidates"
        :key="c.placeId"
        class="px-4 py-3 border-b border-gray-50 last:border-none cursor-pointer hover:bg-gray-50"
        @click="pick(c)"
      >
        <div class="font-bold text-gray-800">{{ c.name }}</div>
        <div class="text-xs text-gray-500">{{ c.address }}</div>
      </li>
    </ul>
  </div>
</template>
