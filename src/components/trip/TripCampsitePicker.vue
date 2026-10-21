<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '../../lib/supabase'
import { toCampsites } from '../../utils/dbRows'
import type { NewCampingTrip, Campsite } from '../../types/database'

// 營區標題輸入 + 搜尋下拉；只搜 campsites，選到才有 campsite_id（規格 §5.6）
defineProps<{
  form: NewCampingTrip
  isEdit: boolean
  error: string
}>()
const emit = defineEmits<{
  (e: 'select', campsite: Campsite): void
  (e: 'add-campsite'): void
}>()

const results = ref<Campsite[]>([])
const showDropdown = ref(false)
let searchDebounce: ReturnType<typeof setTimeout> | null = null

const searchCampsites = async (query: string) => {
  if (!query || query.length < 1) {
    results.value = []
    showDropdown.value = false
    return
  }
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(async () => {
    try {
      const { data } = await supabase.from('campsites').select('*').is('merged_into_id', null).ilike('name', `%${query}%`).limit(5)
      results.value = toCampsites(data)
      showDropdown.value = true
    } catch (e) { console.error(e) }
  }, 300)
}

const select = (campsite: Campsite) => {
  showDropdown.value = false
  emit('select', campsite)
}

const closeDropdown = () => setTimeout(() => { showDropdown.value = false }, 200)
</script>

<template>
<div class="w-full max-w-2xl relative mb-2">
     <div v-if="form.campsite_id" class="flex items-center justify-center gap-2">
         <h2 class="text-3xl md:text-5xl font-black text-primary-900 tracking-tight drop-shadow-sm">
             {{ form.campsite_name }}
         </h2>
     </div>
     <div v-else class="relative group/search text-center">
         <div>
              <input 
                v-model="form.campsite_name"
                type="text"
                class="w-full text-center bg-transparent border-none p-0 text-3xl md:text-5xl font-black text-primary-900 placeholder-primary-900/40 focus:ring-0 disabled:opacity-80 disabled:cursor-not-allowed"
                placeholder="輸入營地名稱..."
                @input="searchCampsites(($event.target as HTMLInputElement).value)"
                @focus="searchCampsites(form.campsite_name)"
                @blur="closeDropdown"
              />
              <!-- Dropdown -->
              <div v-if="showDropdown && results.length > 0" class="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl z-50 text-left text-sm overflow-hidden text-primary-900">
                <ul>
                  <li v-for="site in results" :key="site.id" @mousedown="select(site)" class="px-4 py-3 hover:bg-surface-50 cursor-pointer border-b border-gray-50 last:border-none">
                     <div class="font-bold">{{ site.name }}</div>
                     <div class="text-xs text-gray-500">{{ site.city }}{{ site.district }}</div>
                  </li>
                </ul>
              </div>
         </div>
         <div v-if="isEdit" class="mt-3 flex flex-col items-center gap-1">
             <p class="text-xs text-primary-700">此行程尚未綁定營區（可不綁定直接儲存）</p>
             <button type="button" @click="searchCampsites(form.campsite_name)" class="text-sm font-bold text-primary-700 bg-white/70 px-3 py-1 rounded-full shadow-sm border border-white/40">
                 綁定營區
             </button>
         </div>
         <div v-if="!isEdit" class="mt-3 flex flex-col items-center gap-1">
             <button type="button" @click="emit('add-campsite')" class="text-sm font-bold text-primary-700 bg-white/70 px-3 py-1 rounded-full shadow-sm border border-white/40">
                 ＋新增營區
             </button>
             <p v-if="error" class="text-xs font-bold text-red-500">{{ error }}</p>
         </div>
     </div>
</div>
</template>
