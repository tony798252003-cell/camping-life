<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Tent, Check } from 'lucide-vue-next'
import { systemAssetQueries } from '../../services/supabaseQueries'
import type { SystemAsset } from '../../types/database'

const props = defineProps<{
  initialData?: { name: string; brand: string; image_url: string }
}>()

const emit = defineEmits<{
  next: [data: { name: string; brand: string; image_url: string }]
  skip: []
  back: []
}>()

const tentName = ref(props.initialData?.name || '')
const tentBrand = ref(props.initialData?.brand || '')
const selectedImageUrl = ref(props.initialData?.image_url || '')

const systemImages = ref<SystemAsset[]>([])
const isLoadingImages = ref(false)

const isValid = computed(() => {
  return tentName.value.trim().length > 0 && selectedImageUrl.value.length > 0
})

onMounted(async () => {
  isLoadingImages.value = true
  try {
    systemImages.value = await systemAssetQueries.fetchByType('tent')
  } catch (error) {
    console.error('Failed to load tent images:', error)
  } finally {
    isLoadingImages.value = false
  }
})

const selectImage = (url: string) => {
  selectedImageUrl.value = url
}

const handleNext = () => {
  if (!isValid.value) return

  emit('next', {
    name: tentName.value.trim(),
    brand: tentBrand.value.trim(),
    image_url: selectedImageUrl.value
  })
}
</script>

<template>
  <div>
    <div class="text-center mb-8">
      <div class="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
        <Tent class="w-10 h-10 text-white" />
      </div>
      <h2 class="text-2xl font-bold text-primary-900 mb-2">新增你的第一頂帳篷</h2>
      <p class="text-primary-500">記錄你的露營裝備</p>
    </div>

    <div class="space-y-6">
      <!-- Tent Name -->
      <div>
        <label class="block text-sm font-medium text-primary-700 mb-2">
          帳篷名稱 <span class="text-red-500">*</span>
        </label>
        <input
          v-model="tentName"
          type="text"
          placeholder="例如：Snow Peak TP-670"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
        />
      </div>

      <!-- Brand (Optional) -->
      <div>
        <label class="block text-sm font-medium text-primary-700 mb-2">品牌（選填）</label>
        <input
          v-model="tentBrand"
          type="text"
          placeholder="例如：Snow Peak"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
        />
      </div>

      <!-- Image Selection -->
      <div>
        <label class="block text-sm font-medium text-primary-700 mb-3">
          選擇圖片 <span class="text-red-500">*</span>
        </label>

        <div v-if="isLoadingImages" class="text-center py-8 text-gray-500">
          載入圖片中...
        </div>

        <div v-else-if="systemImages.length === 0" class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
          <p class="font-medium mb-1">尚無系統圖片</p>
          <p>請管理員先上傳帳篷圖片到系統資產庫</p>
        </div>

        <div v-else class="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
          <button
            v-for="image in systemImages"
            :key="image.id"
            @click="selectImage(image.url)"
            class="relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105"
            :class="selectedImageUrl === image.url ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-200 hover:border-primary-300'"
          >
            <img :src="image.url" :alt="image.name || 'Tent'" class="w-full h-full object-cover" />
            <div v-if="selectedImageUrl === image.url" class="absolute inset-0 bg-primary-500/20 flex items-center justify-center">
              <div class="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
                <Check class="w-5 h-5 text-white" />
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-3 pt-4">
        <button
          @click="$emit('back')"
          class="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
        >
          返回
        </button>

        <button
          @click="$emit('skip')"
          class="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
        >
          跳過
        </button>

        <button
          @click="handleNext"
          :disabled="!isValid"
          class="flex-1 py-3 px-6 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          完成
        </button>
      </div>
    </div>
  </div>
</template>
