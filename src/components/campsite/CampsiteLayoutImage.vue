<script setup lang="ts">
import { ref } from 'vue'
import { X, Loader2, Upload, Image as ImageIcon } from 'lucide-vue-next'
import { supabase } from '../../lib/supabase'
import type { Campsite } from '../../types/database'

const props = defineProps<{
  form: Partial<Campsite>
  isEditable?: boolean
}>()

const isUploadingMap = ref(false)
const mapFileInput = ref<HTMLInputElement | null>(null)

const handleMapUpload = async (event: Event) => {
   const input = event.target as HTMLInputElement
   if (!input.files || input.files.length === 0) return

   const file = input.files ? input.files[0] : null
   if (!file) return
   
   // Basic validation
   if (!file.type.startsWith('image/')) {
      alert('請上傳圖片格式 (JPG, PNG)')
      return
   }
   if (file.size > 5 * 1024 * 1024) {
      alert('圖片大小請勿超過 5MB')
      return
   }

   isUploadingMap.value = true
   try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `map-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
         .from('campsite-maps') // Bucket name
         .upload(filePath, file)

      if (uploadError) throw uploadError

      // 2. Get Public URL
      const { data } = supabase.storage
         .from('campsite-maps')
         .getPublicUrl(filePath)
      
      // 3. Update Form
      props.form.layout_image_url = data.publicUrl
      
   } catch (e: any) {
      console.error('Map upload failed:', e)
      alert(`上傳失敗: ${e.message}`)
   } finally {
      isUploadingMap.value = false
      if (input) input.value = '' // Reset input
   }
}

const triggerMapUpload = () => {
   mapFileInput.value?.click()
}

const removeMap = () => {
   if (confirm('確定要移除這張營區配置圖嗎？')) {
      props.form.layout_image_url = ''
   }
}
</script>

<template>
         <!-- Campsite Map -->
         <div>
             <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">營區配置圖</label>
             
             <!-- Hidden Input -->
             <input
               ref="mapFileInput"
               type="file"
               accept="image/*"
               class="hidden"
               @change="handleMapUpload"
             />

             <!-- Edit Mode -->
             <div v-if="isEditable">
                 <div 
                   v-if="form.layout_image_url" 
                   class="relative w-full rounded-xl overflow-hidden border border-gray-200 group"
                 >
                    <img :src="form.layout_image_url" class="w-full h-auto object-contain bg-gray-50" />
                    <!-- Overlay Actions -->
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                        <button @click="triggerMapUpload" class="px-3 py-1.5 bg-white text-gray-700 text-sm font-bold rounded-lg shadow hover:bg-gray-100 flex items-center gap-1">
                           <Upload class="w-4 h-4" /> 更換
                        </button>
                        <button @click="removeMap" class="px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded-lg shadow hover:bg-red-600 flex items-center gap-1">
                           <X class="w-4 h-4" /> 移除
                        </button>
                    </div>
                 </div>
                 
                 <button 
                   v-else
                   @click="triggerMapUpload"
                   :disabled="isUploadingMap"
                   class="w-full h-40 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/50 transition cursor-pointer text-gray-500 hover:text-blue-600"
                 >
                     <Loader2 v-if="isUploadingMap" class="w-8 h-8 animate-spin text-blue-500" />
                     <template v-else>
                         <div class="p-3 bg-gray-100 rounded-full">
                            <ImageIcon class="w-6 h-6" />
                         </div>
                         <div class="text-sm font-bold">點擊上傳配置圖</div>
                         <div class="text-xs text-gray-400">支援 JPG, PNG (Max 5MB)</div>
                     </template>
                 </button>
             </div>

             <!-- View Mode -->
             <div v-else>
                 <div v-if="form.layout_image_url" class="rounded-xl overflow-hidden border border-gray-200">
                    <img :src="form.layout_image_url" class="w-full h-auto object-contain bg-gray-50 cursor-zoom-in" onclick="window.open(this.src)" title="點擊放大" />
                 </div>
                 <div v-else class="flex items-center gap-2 text-gray-400 py-2">
                    <ImageIcon class="w-5 h-5 opacity-50" />
                    <span class="text-sm">未提供配置圖</span>
                 </div>
             </div>
         </div>
</template>
