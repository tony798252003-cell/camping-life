<script setup lang="ts">
import { ref } from 'vue'
import { Camera, Loader2 } from 'lucide-vue-next'
import { useCloudinary } from '../composables/useCloudinary'
import { useTripPhotos } from '../composables/useTripPhotos'
import { supabase } from '../lib/supabase'

const props = defineProps<{
  tripId: number
  currentCount?: number
}>()

const emit = defineEmits<{
  (e: 'uploaded'): void
}>()

const { uploadImage, isUploading, progress } = useCloudinary()
const { addPhoto } = useTripPhotos()
// Need authenticating user ID for the DB insert
// We'll trust supabase client to have session, but need user_id for the insert object
// We'll trust supabase client to have session, but need user_id for the insert object

const fileInput = ref<HTMLInputElement | null>(null)

const triggerSelect = () => {
  fileInput.value?.click()
}

const handleFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  const files = Array.from(input.files)
  
  // Gets current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
      alert('請先登入')
      return
  }

  // Process sequentially or parallel? Parallel is limited by browsers but 3 is fine.
  // We'll do one by one for progress clarity.
  
  for (const file of files) {
      const result = await uploadImage(file)
      
      if (result) {
          await addPhoto({
              trip_id: props.tripId,
              user_id: user.id,
              url: result.secure_url,
              public_id: result.public_id,
              width: result.width,
              height: result.height,
              caption: result.original_filename
          })
      }
  }
  
  emit('uploaded')
  // Reset input
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<template>
  <div class="flex items-center">
    <input 
      type="file" 
      ref="fileInput"
      accept="image/*" 
      multiple
      class="hidden"
      @change="handleFileSelect"
    >
    
    <button 
      @click="triggerSelect"
      :disabled="isUploading || (currentCount !== undefined && currentCount >= 3)"
      class="flex items-center gap-2 px-4 py-2 bg-white/50 hover:bg-white/80 backdrop-blur-sm border border-white/40 rounded-full text-primary-700 font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      :class="{'opacity-50 cursor-not-allowed': currentCount !== undefined && currentCount >= 3}"
    >
       <Loader2 v-if="isUploading" class="w-5 h-5 animate-spin" />
       <Camera v-else class="w-5 h-5 text-accent-orange" />
       <span>
           {{ isUploading ? '上傳中...' : (currentCount !== undefined && currentCount >= 3 ? '已達上限 (3/3)' : `新增照片 ${currentCount !== undefined ? `(${currentCount}/3)` : ''}`) }}
       </span>
    </button>
  </div>
</template>
