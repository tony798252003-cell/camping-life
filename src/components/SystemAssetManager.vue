<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, Upload, Trash2, CheckCircle, AlertCircle, Library, Plus, Edit2, Save } from 'lucide-vue-next'
import { useCloudinary } from '../composables/useCloudinary'
import { supabase } from '../lib/supabase'
import type { SystemAsset } from '../types/database'

const props = withDefaults(defineProps<{
  isOpen: boolean
  mode?: 'manage' | 'select' // Default 'manage'
}>(), {
  mode: 'manage'
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'refresh'): void
  (e: 'select', asset: SystemAsset): void
}>()

// ... (keep existing code)

// View Mode - force library if select mode
const viewMode = ref<'library' | 'upload'>('library')
watch(() => props.mode, (newMode) => {
    if (newMode === 'select') viewMode.value = 'library'
}, { immediate: true })

// ... (keep existing code)


// Categories

const { uploadImage } = useCloudinary()

// Categories
const categories = [
  { id: 'tent_image', label: '帳篷' },
  // { id: 'gear_image', label: '裝備' } // Future use
]
const activeCategory = ref('tent_image')

// Library State
const existingAssets = ref<SystemAsset[]>([])
const loadingAssets = ref(false)

// Upload State
interface PendingImage {
  file: File
  preview: string
  name: string
  brand: string // New
  status: 'pending' | 'uploading' | 'success' | 'error'
}
const pendingImages = ref<PendingImage[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const overallUploading = ref(false)

// --- Library Functions ---

const fetchAssets = async () => {
    loadingAssets.value = true
    try {
        const { data, error } = await (supabase
            .from('system_assets') as any)
            .select('*')
            .eq('type', activeCategory.value)
            .order('created_at', { ascending: false })
            
        if (error) throw error
        existingAssets.value = (data as any) || []
    } catch (e) {
        console.error('Error fetching assets:', e)
    } finally {
        loadingAssets.value = false
    }
}

const deleteAsset = async (id: number) => {
    if (!confirm('確定要刪除此圖片嗎？此操作不可復原。')) return
    
    try {
        const { error } = await supabase
            .from('system_assets')
            .delete()
            .eq('id', id)
            
        if (error) throw error
        
        // Remove locally
        existingAssets.value = existingAssets.value.filter(a => a.id !== id)
        emit('refresh')
    } catch (e) {
        console.error('Error deleting asset:', e)
        alert('刪除失敗')
    }
}


// ...

// Edit State
const isEditOpen = ref(false)
const editingAsset = ref<Partial<SystemAsset>>({})
const isUpdating = ref(false)

// ...

const startEditAsset = (asset: SystemAsset) => {
    editingAsset.value = { ...asset }
    isEditOpen.value = true
}

const updateAsset = async () => {
    if (!editingAsset.value.id) return
    
    isUpdating.value = true
    try {
        const { error } = await (supabase
            .from('system_assets') as any)
            .update({
                name: editingAsset.value.name,
                brand: editingAsset.value.brand // Update brand
            })
            .eq('id', editingAsset.value.id)
            
        if (error) throw error
        
        // Update locally
        const idx = existingAssets.value.findIndex(a => a.id === editingAsset.value.id)
        if (idx !== -1) {
            existingAssets.value[idx].name = editingAsset.value.name || null
            existingAssets.value[idx].brand = editingAsset.value.brand || null
        }
        
        isEditOpen.value = false
        emit('refresh')
    } catch (e) {
        console.error('Error updating asset:', e)
        alert('更新失敗')
    } finally {
        isUpdating.value = false
    }
}

watch([activeCategory, () => props.isOpen], () => {
    if (props.isOpen) fetchAssets()
    isEditOpen.value = false // Reset edit mode
}, { immediate: true })

// --- Upload Functions ---

const triggerFileSelect = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (!files) return

  Array.from(files).forEach(file => {
    const reader = new FileReader()
    reader.onload = (e) => {
      pendingImages.value.push({
        file,
        preview: e.target?.result as string,
        name: file.name.split('.')[0] || 'Image',
        brand: '', // Default empty
        status: 'pending'
      })
    }
    reader.readAsDataURL(file)
  })
  
  if (fileInput.value) fileInput.value.value = ''
}

const removePending = (index: number) => {
  pendingImages.value.splice(index, 1)
}

const uploadAll = async () => {
    if (pendingImages.value.length === 0) return
    
    overallUploading.value = true
    
    const uploadTask = async (img: PendingImage) => {
        if (img.status === 'success') return
        
        img.status = 'uploading'
        try {
            const result = await uploadImage(img.file)
            if (result) {
                // Save to DB
                // Cast to any to bypass strict type check for now
                const { error } = await (supabase.from('system_assets') as any).insert([{
                    type: activeCategory.value,
                    url: result.secure_url,
                    public_id: result.public_id,
                    width: result.width,
                    height: result.height,
                    name: img.name,
                    brand: img.brand // Insert brand
                }])
                
                if (error) throw error
                img.status = 'success'
            } else {
                img.status = 'error'
            }
        } catch (e) {
            console.error(e)
            img.status = 'error'
        }
    }

    await Promise.all(pendingImages.value.map(uploadTask))
    
    overallUploading.value = false
    emit('refresh')
    fetchAssets() // Refresh library
}

const clearSuccess = () => {
    pendingImages.value = pendingImages.value.filter(i => i.status !== 'success')
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="emit('close')">
    <div class="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col h-[85vh]">
      
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
        <div class="flex items-center gap-4">
            <h3 class="text-xl font-bold text-gray-900">系統裝備庫管理</h3>
            <!-- Category Tabs -->
            <div class="flex bg-gray-100 p-1 rounded-lg">
                <button 
                  v-for="cat in categories" 
                  :key="cat.id"
                  @click="activeCategory = cat.id"
                  class="px-4 py-1.5 rounded-md text-sm font-bold transition-all"
                  :class="activeCategory === cat.id ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'"
                >
                  {{ cat.label }}
                </button>
            </div>
        </div>
        <button @click="emit('close')" class="p-1 rounded-full hover:bg-gray-100 transition-colors">
          <X class="w-6 h-6 text-gray-400 hover:text-gray-600" />
        </button>
      </div>

      <!-- Main Navigation Tabs (Only show in manage mode) -->
      <div v-if="mode === 'manage'" class="flex border-b border-gray-100 shrink-0">
          <button 
            @click="viewMode = 'library'"
            class="flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors"
            :class="viewMode === 'library' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'"
          >
             <Library class="w-4 h-4" /> 圖片列表
          </button>
          <button 
            @click="viewMode = 'upload'"
            class="flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors"
            :class="viewMode === 'upload' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'"
          >
             <Upload class="w-4 h-4" /> 批量上傳
          </button>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-hidden bg-gray-50/50 relative">
          
          <!-- LIBRARY VIEW -->
          <div v-if="viewMode === 'library'" class="h-full overflow-y-auto p-6">
              <div v-if="loadingAssets" class="flex justify-center py-20">
                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              
              <div v-else-if="existingAssets.length > 0" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  <div 
                     v-for="asset in existingAssets" 
                     :key="asset.id"
                     @click="mode === 'select' ? emit('select', asset) : null"
                     class="group bg-white rounded-xl border border-gray-100 overflow-hidden relative shadow-sm hover:shadow-md transition-all cursor-pointer"
                     :class="{'ring-2 ring-blue-500': mode === 'select'}"
                  >
                      <div class="aspect-square bg-gray-50 p-4 flex items-center justify-center">
                          <img :src="asset.url" class="w-full h-full object-contain" />
                      </div>
                      <div class="p-2 border-t border-gray-50 bg-white">
                          <p class="text-[10px] font-bold text-gray-400 text-center truncate mb-0.5">{{ asset.brand || 'No Brand' }}</p>
                          <p class="text-xs font-bold text-gray-700 truncate text-center">{{ asset.name || '未命名' }}</p>
                      </div>
                      
                      <!-- Delete Overlay (Manager Only) -->
                      <div v-if="mode === 'manage'" class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button 
                            @click.stop="startEditAsset(asset)"
                            class="p-2 bg-white text-blue-600 rounded-full hover:bg-blue-50 hover:scale-110 transition-transform shadow-lg"
                            title="編輯資訊"
                          >
                             <Edit2 class="w-5 h-5" />
                          </button>
                          <button 
                            @click.stop="deleteAsset(asset.id)"
                            class="p-2 bg-white text-red-600 rounded-full hover:bg-red-50 hover:scale-110 transition-transform shadow-lg"
                            title="刪除圖片"
                          >
                             <Trash2 class="w-5 h-5" />
                          </button>
                      </div>
                  </div>
              </div>
              
              <div v-else class="h-full flex flex-col items-center justify-center text-gray-400">
                  <Library class="w-16 h-16 mb-4 text-gray-200" />
                  <p class="font-medium">此分類尚無圖片</p>
                  <button @click="viewMode = 'upload'" class="mt-4 text-blue-600 font-bold hover:underline">
                      立即上傳
                  </button>
              </div>
          </div>

          <!-- UPLOAD VIEW -->
          <div v-if="viewMode === 'upload'" class="h-full flex flex-col">
               <!-- Toolbar -->
              <div class="px-6 py-3 bg-white border-b border-gray-100 flex justify-between items-center shrink-0">
                  <div class="flex gap-2">
                      <input type="file" ref="fileInput" multiple accept="image/*" class="hidden" @change="handleFileSelect" />
                      <button 
                        @click="triggerFileSelect"
                        :disabled="overallUploading"
                        class="flex items-center gap-2 bg-gray-100 border border-transparent text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                          <Plus class="w-4 h-4" /> 選擇檔案
                      </button>
                      <button 
                         v-if="pendingImages.some(i => i.status === 'success')"
                         @click="clearSuccess"
                         class="text-sm text-green-600 font-bold hover:underline px-2"
                      >
                         清除已完成
                      </button>
                  </div>
                  <button 
                    @click="uploadAll"
                    :disabled="overallUploading || pendingImages.length === 0 || pendingImages.every(i => i.status === 'success')"
                    class="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-200"
                  >
                     <span v-if="overallUploading" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                     {{ overallUploading ? '上傳中...' : '開始上傳' }}
                  </button>
              </div>
              
              <div class="flex-1 overflow-y-auto p-6">
                  <div v-if="pendingImages.length === 0" class="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-white m-1">
                      <Upload class="w-12 h-12 mb-3 text-gray-300" />
                      <p class="font-medium">拖曳檔案至此或點擊按鈕</p>
                  </div>

                  <div v-else class="grid gap-3">
                      <div 
                         v-for="(img, idx) in pendingImages" 
                         :key="idx" 
                         class="group bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 transition-all"
                         :class="{'border-green-200 bg-green-50': img.status === 'success', 'border-red-200 bg-red-50': img.status === 'error'}"
                      >
                          <div class="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-100">
                              <img :src="img.preview" class="w-full h-full object-cover" />
                          </div>
                          
                          <div class="flex-1 min-w-0">
                              <div class="mb-2">
                                  <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 block">品牌</label>
                                  <input 
                                     v-model="img.brand" 
                                     type="text" 
                                     :disabled="img.status === 'success' || img.status === 'uploading'"
                                     class="w-full bg-transparent border-b border-gray-200 p-0 pb-1 text-sm font-bold text-gray-800 focus:ring-0 focus:border-black placeholder-gray-300 disabled:border-transparent"
                                     placeholder="例如: Snow Peak" 
                                  />
                              </div>
                              <div>
                                  <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 block">品名</label>
                                  <input 
                                     v-model="img.name" 
                                     type="text" 
                                     :disabled="img.status === 'success' || img.status === 'uploading'"
                                     class="w-full bg-transparent border-b border-gray-200 p-0 pb-1 text-sm font-bold text-gray-800 focus:ring-0 focus:border-black placeholder-gray-300 disabled:border-transparent"
                                     placeholder="例如: Amenity Dome" 
                                  />
                              </div>
                          </div>

                          <div class="flex items-center gap-3 pr-2">
                               <span v-if="img.status === 'pending'" class="text-xs text-gray-400 font-medium">準備中</span>
                               <span v-else-if="img.status === 'uploading'" class="text-xs text-blue-500 font-medium animate-pulse">上傳...</span>
                               <div v-else-if="img.status === 'success'" class="flex items-center gap-1 text-green-600 font-bold text-xs">
                                   <CheckCircle class="w-4 h-4" /> 完成
                               </div>
                               <div v-else-if="img.status === 'error'" class="flex items-center gap-1 text-red-500 font-bold text-xs">
                                   <AlertCircle class="w-4 h-4" /> 失敗
                               </div>
                               
                               <button 
                                 v-if="img.status !== 'uploading'"
                                 @click="removePending(idx)" 
                                 class="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                               >
                                  <Trash2 class="w-4 h-4" />
                               </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
          
      </div>
      
      <!-- Edit Modal -->
      <div v-if="isEditOpen" class="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
              <h4 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Edit2 class="w-5 h-5 text-blue-600" /> 編輯裝備資訊
              </h4>
              <div class="space-y-4">
                  <div>
                      <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">品牌</label>
                      <input 
                        v-model="editingAsset.brand" 
                        type="text" 
                        class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="例如: Snow Peak" 
                      />
                  </div>
                  <div>
                      <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">品名</label>
                      <input 
                        v-model="editingAsset.name" 
                        type="text" 
                        class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="例如: Amenity Dome" 
                      />
                  </div>
                  
                  <div class="flex gap-2 pt-2">
                      <button 
                        @click="isEditOpen = false" 
                        class="flex-1 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors"
                      >
                          取消
                      </button>
                      <button 
                        @click="updateAsset"
                        :disabled="isUpdating"
                        class="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                          <span v-if="isUpdating" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                          {{ isUpdating ? '儲存中' : '儲存' }}
                      </button>
                  </div>
              </div>
          </div>
      </div>
    </div>
  </div>
</template>
