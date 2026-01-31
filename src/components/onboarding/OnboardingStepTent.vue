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
const isSubmitting = ref(false)

const isValid = computed(() => {
  return tentName.value.trim().length > 0 && selectedImageUrl.value.length > 0
})

const canSubmit = computed(() => {
  return isValid.value && !isSubmitting.value
})

onMounted(async () => {
  isLoadingImages.value = true
  try {
    systemImages.value = await systemAssetQueries.fetchByType('tent_image')
  } catch (error) {
    console.error('Failed to load tent images:', error)
  } finally {
    isLoadingImages.value = false
  }
})

const selectImage = (url: string) => {
  console.log('[OnboardingStepTent] Image selected:', url)
  selectedImageUrl.value = url
}

const handleNext = () => {
  console.log('[OnboardingStepTent] handleNext called')
  console.log('[OnboardingStepTent] isValid:', isValid.value)
  console.log('[OnboardingStepTent] isSubmitting:', isSubmitting.value)

  if (!canSubmit.value) {
    if (isSubmitting.value) {
      console.warn('[OnboardingStepTent] Already submitting, ignoring click')
    } else {
      console.warn('[OnboardingStepTent] Form is not valid, cannot proceed')
      alert('請輸入帳篷名稱並選擇圖片')
    }
    return
  }

  isSubmitting.value = true
  console.log('[OnboardingStepTent] Setting isSubmitting to true')

  const data = {
    name: tentName.value.trim(),
    brand: tentBrand.value.trim(),
    image_url: selectedImageUrl.value
  }

  console.log('[OnboardingStepTent] Emitting next event with data:', data)
  emit('next', data)
}

const handleSkip = () => {
  if (isSubmitting.value) {
    console.warn('[OnboardingStepTent] Already submitting, ignoring skip')
    return
  }

  isSubmitting.value = true
  console.log('[OnboardingStepTent] Skip button clicked')
  emit('skip')
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

    <div class="flex flex-col h-full">
      <!-- Form Content - Scrollable -->
      <div class="flex-1 space-y-4 overflow-y-auto pr-1">
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

          <div v-else class="grid grid-cols-3 gap-2 max-h-[160px] overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50">
            <button
              v-for="image in systemImages"
              :key="image.id"
              @click="selectImage(image.url)"
              type="button"
              class="relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105"
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
      </div>

      <!-- Action Buttons - Fixed at bottom -->
      <div class="flex gap-3 pt-6 mt-4 border-t border-gray-100 bg-white">
        <button
          type="button"
          @click="$emit('back')"
          :disabled="isSubmitting"
          class="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          返回
        </button>

        <button
          type="button"
          @click="handleSkip"
          :disabled="isSubmitting"
          class="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isSubmitting ? '處理中...' : '跳過' }}
        </button>

        <button
          type="button"
          @click="handleNext"
          :disabled="!canSubmit"
          class="flex-1 py-3 px-6 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          {{ isSubmitting ? '儲存中...' : '完成' }}
        </button>
      </div>
    </div>
  </div>
</template>
