<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Trash2, X, ZoomIn } from 'lucide-vue-next'
import { useTripPhotos } from '../composables/useTripPhotos'
import PhotoUpload from './PhotoUpload.vue'

const props = defineProps<{
  tripId: number
  isEditable?: boolean
}>()

const { photos, fetchPhotos, deletePhoto, loading } = useTripPhotos()
const selectedPhoto = ref<string | null>(null)

onMounted(() => {
  fetchPhotos(props.tripId)
})

const handleDelete = async (id: number) => {
  if (!confirm('確定要刪除這張照片嗎？')) return
  await deletePhoto(id)
}

const openLightbox = (url: string) => {
  selectedPhoto.value = url
}

const closeLightbox = () => {
  selectedPhoto.value = null
}
</script>

<template>
  <div class="w-full">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
       <h3 class="text-lg font-bold text-primary-900 flex items-center gap-2">
           📸 回憶相簿
           <span class="text-xs font-normal text-primary-500 bg-primary-50 px-2 py-0.5 rounded-full">{{ photos.length }}</span>
       </h3>
       
       <PhotoUpload 
         v-if="isEditable" 
         :tripId="tripId" 
         :currentCount="photos.length" 
         @uploaded="fetchPhotos(tripId)" 
       />
    </div>

    <!-- Loading State -->
    <div v-if="loading && photos.length === 0" class="flex justify-center py-12">
        <div class="flex flex-col items-center gap-2 text-primary-400">
             <div class="animate-spin">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
             </div>
             <span class="text-xs font-bold">載入中...</span>
        </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="photos.length === 0" class="text-center py-8 bg-surface-50 rounded-2xl border-2 border-dashed border-primary-100 flex flex-col items-center justify-center">
        <div class="text-4xl mb-2 grayscale opacity-50">🏔️</div>
        <p class="text-primary-400 font-medium text-sm">還沒有照片<br/><span class="text-xs opacity-75">上傳幾張來記錄回憶吧！</span></p>
    </div>

    <!-- Gallery Grid -->
    <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div 
          v-for="photo in photos" 
          :key="photo.id" 
          class="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer shadow-sm hover:shadow-md transition-all"
          @click="openLightbox(photo.url)"
        >
           <img 
             :src="photo.url" 
             class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
             loading="lazy"
           />
           
           <!-- Overlay -->
           <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
               <ZoomIn class="w-8 h-8 text-white drop-shadow-md" />
           </div>

           <!-- Actions -->
           <button 
             v-if="isEditable"
             @click.stop="handleDelete(photo.id)"
             class="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm"
             title="刪除"
           >
              <Trash2 class="w-4 h-4" />
           </button>
        </div>
    </div>

    <!-- Lightbox -->
    <div v-if="selectedPhoto" class="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" @click="closeLightbox">
         <button @click="closeLightbox" class="absolute top-4 right-4 text-white hover:text-gray-300 p-2 bg-white/10 rounded-full backdrop-blur-md">
             <X class="w-6 h-6" />
         </button>
         <img 
           :src="selectedPhoto" 
           class="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain" 
           @click.stop
         />
    </div>
  </div>
</template>
