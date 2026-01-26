<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, MapPin, Loader2 } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import type { Campsite } from '../types/database'

const props = defineProps<{
  isOpen: boolean
  campsite: Campsite
}>()

const emit = defineEmits(['close', 'saved'])

const form = ref<Partial<Campsite>>({})
const isSaving = ref(false)
const tagsString = ref('') // Edit tags as comma-separated string for simplicity

watch(() => props.campsite, (newVal) => {
  if (newVal) {
    form.value = { ...newVal }
    tagsString.value = newVal.tags ? newVal.tags.join(', ') : ''
  }
}, { immediate: true })

const save = async () => {
  if (!form.value.id) return
  isSaving.value = true
  
  try {
    const updates = {
      ...form.value,
      tags: tagsString.value.split(/[,，]/).map(t => t.trim()).filter(Boolean)
    }
    
    // Remove protected fields
    delete (updates as any).id
    delete (updates as any).created_at
    delete (updates as any).created_by

    console.log('Sending updates:', updates)

    const { data, error } = await (supabase
      .from('campsites') as any)
      .update(updates)
      .eq('id', form.value.id)
      .select()

    if (error) throw error
    
    if (!data || data.length === 0) {
       throw new Error('更新失敗，可能沒有權限或找不到該筆資料 (RLS)')
    }

    console.log('Update success:', data)
    emit('saved')
    emit('close')
  } catch (e: any) {
    console.error('Update failed:', e)
    alert(`儲存失敗：${e.message || e.error_description || '未知錯誤'}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
      
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <h3 class="font-bold text-gray-800">編輯營地資料</h3>
        <button @click="$emit('close')" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition">
           <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Form -->
      <div class="p-6 space-y-4 overflow-y-auto">
         
         <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">名稱</label>
               <input v-model="form.name" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>

            <div class="col-span-1">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">縣市 (City)</label>
               <input v-model="form.city" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="例如：新竹縣" />
            </div>
             <div class="col-span-1">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">鄉鎮 (District)</label>
               <input v-model="form.district" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="例如：尖石鄉" />
            </div>
            
            <div class="col-span-1">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">海拔 (m)</label>
               <input v-model.number="form.altitude" type="number" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div class="col-span-1">
               <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">電話</label>
               <input v-model="form.phone" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
         </div>

         <!-- Coordinates -->
         <div class="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <h4 class="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2 flex items-center gap-1">
               <MapPin class="w-3 h-3" /> GPS 座標
            </h4>
            <div class="grid grid-cols-2 gap-3">
               <div>
                  <label class="text-xs text-blue-600 block mb-1">緯度 (Latitude)</label>
                  <input v-model.number="form.latitude" type="number" step="0.000001" class="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
               </div>
               <div>
                  <label class="text-xs text-blue-600 block mb-1">經度 (Longitude)</label>
                  <input v-model.number="form.longitude" type="number" step="0.000001" class="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
               </div>
            </div>
            <p v-if="!form.latitude || !form.longitude" class="text-xs text-orange-600 mt-2 font-bold flex items-center gap-1">
               ⚠️ 尚未設定座標，無法使用地圖導航功能
            </p>
         </div>

         <!-- Tags -->
         <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">標籤 (用逗號分隔)</label>
            <input v-model="tagsString" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="草地, 雲海, 戲水池" />
         </div>

         <!-- Zone Config -->
         <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">營位配置說明</label>
            <textarea v-model="form.zone_config" rows="3" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"></textarea>
         </div>
         
         <!-- Verified -->
         <div class="flex items-center gap-2">
            <input id="verified" v-model="form.is_verified" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <label for="verified" class="text-sm font-medium text-gray-700">已審核確認 (Verified)</label>
         </div>

      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
         <button @click="$emit('close')" class="px-4 py-2 text-gray-600 font-bold hover:bg-white rounded-lg transition">取消</button>
         <button 
           @click="save" 
           :disabled="isSaving"
           class="px-6 py-2 bg-primary-900 text-white font-bold rounded-lg hover:bg-black transition flex items-center gap-2 disabled:opacity-50"
         >
           <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
           儲存變更
         </button>
      </div>

    </div>
  </div>
</template>
