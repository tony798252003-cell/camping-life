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

    <!-- Empty State -->
    <div v-if="!loading && photos.length === 0" class="text-center py-8 bg-surface-50 rounded-2xl border-2 border-dashed border-primary-100">
        <div class="text-4xl mb-2">🏔️</div>
        <p class="text-primary-400 font-medium">還沒有照片，上傳幾張來記錄回憶吧！</p>
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

    <!-- Loading -->
    <div v-if="loading && photos.length === 0" class="flex justify-center py-8">
        <div class="animate-spin text-primary-400">Loading...</div>
    </div>

    <!-- Lightbox -->
    <div v-if="selectedPhoto" class="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" @click="closeLightbox">
         <button @click="closeLightbox" class="absolute top-4 right-4 text-white hover:text-gray-300 p-2">
             <X class="w-8 h-8" />
         </button>
         <img 
           :src="selectedPhoto" 
           class="max-w-full max-h-screen rounded-lg shadow-2xl" 
           @click.stop
         />
    </div>
  </div>
</template>
