<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, Loader2, Navigation, Phone } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { campsiteQueries } from '../services/db/campsites'
import type { TablesInsert, TablesUpdate } from '../types/supabase'
import { useCampsiteForm } from '../composables/useCampsiteForm'
import { isLikelyInTaiwan } from '../utils/coordinates'
import { useConfirm } from '../composables/useConfirm'
import { campsiteNavUrl, campsiteTelUrl, FIELD_LABEL, FIELD_SOURCE_LABEL } from '../utils/campsiteNav'
import type { Campsite } from '../types/database'
import CampsiteBasicFields from './campsite/CampsiteBasicFields.vue'
import CampsiteAmenities from './campsite/CampsiteAmenities.vue'
import CampsiteRules from './campsite/CampsiteRules.vue'
import CampsiteCapacityZones from './campsite/CampsiteCapacityZones.vue'
import CampsiteLayoutImage from './campsite/CampsiteLayoutImage.vue'
import CampsiteBookingInfo from './campsite/CampsiteBookingInfo.vue'
import CampsiteBookingStatus from './campsite/CampsiteBookingStatus.vue'

const props = defineProps<{
  isOpen: boolean
  campsite: Campsite
  isEditable?: boolean
}>()

const emit = defineEmits(['close', 'saved'])

const {
  form, tagsString, nightRushStart, nightRushEnd, showerStart, showerEnd, isShower24H,
  unconfirmedKeys, init, snapshot, applySnapshot, confirmField, toPayload,
} = useCampsiteForm()
const isSaving = ref(false)
const { confirm } = useConfirm()

const navUrl = computed(() => campsiteNavUrl({
  name: form.value.name ?? '',
  google_place_id: form.value.google_place_id,
  latitude: typeof form.value.latitude === 'number' ? form.value.latitude : null,
  longitude: typeof form.value.longitude === 'number' ? form.value.longitude : null,
}))
const telUrl = computed(() => campsiteTelUrl(form.value.phone))

function reviewValue(key: string): string {
  const v = (form.value as Record<string, unknown>)[key]
  if (v === null || v === undefined || v === '') return '？查無資料'
  if (Array.isArray(v)) return v.map(x => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join('、')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// localStorage draft key per campsite
const draftKey = computed(() => `campsite-draft-${props.campsite?.id}`)

function saveDraft() {
  if (!props.isEditable) return
  localStorage.setItem(draftKey.value, JSON.stringify(snapshot()))
}

function clearDraft() {
  localStorage.removeItem(draftKey.value)
}

// Auto-save on any form change
watch([form, tagsString, nightRushStart, nightRushEnd, showerStart, showerEnd, isShower24H],
  saveDraft, { deep: true })

watch(() => props.campsite, (newVal) => {
  if (!newVal) return
  init(newVal)
  // Check for saved draft first
  const saved = localStorage.getItem(`campsite-draft-${newVal.id}`)
  if (saved && props.isEditable) {
    try {
      applySnapshot(JSON.parse(saved))
    } catch {
      clearDraft()
    }
  }
}, { immediate: true })

// 取消新增時一併清掉草稿，否則下次開新增表單會被帶出舊內容（既有營區的草稿保留，讓編輯到一半可以續）
function cancel() {
  if (props.campsite?.id === 0) clearDraft()
  emit('close')
}

const save = async () => {
  const lat = typeof form.value.latitude === 'number' ? form.value.latitude : null
  const lng = typeof form.value.longitude === 'number' ? form.value.longitude : null
  if (!isLikelyInTaiwan(lat, lng)) {
    const ok = await confirm({
      title: '座標怪怪的',
      message: `座標好像不在台灣（緯度 ${lat}、經度 ${lng}），確定要存嗎？`,
      type: 'warning',
      confirmText: '照存',
      cancelText: '修正',
    })
    if (!ok) return
  }
  isSaving.value = true
  const isNew = form.value.id === 0

  try {
    const updates = toPayload()

    // For new campsites, set created_by to current user
    if (isNew) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) updates.created_by = session.user.id
    }

    console.log('Sending updates:', updates)

    const data = isNew
      ? await campsiteQueries.insert(updates as unknown as TablesInsert<'campsites'>)
      : await campsiteQueries.update(form.value.id as number, updates as unknown as TablesUpdate<'campsites'>)

    if (!data || data.length === 0) {
       throw new Error('更新失敗，可能沒有權限或找不到該筆資料 (RLS)')
    }

    console.log('Update success:', data)
    clearDraft()
    emit('saved', data[0])
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
  <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="cancel">
    <div class="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
      
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <h3 class="font-bold text-gray-800">{{ isEditable ? '編輯營地資料' : '營地詳細資訊' }}</h3>
        <button @click="cancel" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition">
           <X class="w-5 h-5" />
        </button>
      </div>


      <!-- Form -->
      <div class="p-6 space-y-5 overflow-y-auto">

         <!-- 導航 / 撥號 -->
         <div v-if="navUrl || telUrl" class="flex gap-2">
            <a v-if="navUrl" :href="navUrl" target="_blank" rel="noopener noreferrer" class="flex-1 min-h-[44px] rounded-[14px] bg-primary-600 text-white text-sm font-bold flex items-center justify-center gap-1.5">
               <Navigation class="w-4 h-4" /> 導航
            </a>
            <a v-if="telUrl" :href="telUrl" class="flex-1 min-h-[44px] rounded-[14px] bg-white border border-gray-200 text-gray-700 text-sm font-bold flex items-center justify-center gap-1.5">
               <Phone class="w-4 h-4" /> 撥號
            </a>
         </div>

         <!-- 待確認欄位（field_sources.confirmed = false） -->
         <div v-if="unconfirmedKeys.length" class="rounded-xl bg-amber-50 border-l-4 border-amber-400 p-3 space-y-2">
            <p class="text-xs font-bold text-amber-900">⚠️ 以下 {{ unconfirmedKeys.length }} 個欄位尚未確認</p>
            <div v-for="key in unconfirmedKeys" :key="key" class="flex items-start justify-between gap-2">
               <div class="min-w-0">
                  <div class="text-[13px] font-bold text-gray-800">
                     {{ FIELD_LABEL[key] ?? key }}
                     <span class="ml-1 text-[11px] font-normal text-gray-500">{{ FIELD_SOURCE_LABEL[form.field_sources![key]!.source] ?? form.field_sources![key]!.source }}</span>
                  </div>
                  <div class="text-sm text-gray-700 break-words">{{ reviewValue(key) }}</div>
               </div>
               <button v-if="isEditable" type="button" @click="confirmField(key)" class="flex-shrink-0 min-h-[36px] px-3 rounded-[12px] bg-amber-400 text-amber-950 text-xs font-bold">確認</button>
            </div>
            <p v-if="isEditable" class="text-[11px] text-amber-800">按「確認」後記得按下方「儲存變更」；直接修改欄位也會視為已確認。</p>
         </div>

         <CampsiteBasicFields v-model:tags-string="tagsString" :form="form" :is-editable="isEditable" />

         <CampsiteAmenities :form="form" :is-editable="isEditable" />

         <CampsiteRules
           v-model:night-rush-start="nightRushStart"
           v-model:night-rush-end="nightRushEnd"
           v-model:shower-start="showerStart"
           v-model:shower-end="showerEnd"
           v-model:isShower24H="isShower24H"
           :form="form"
           :is-editable="isEditable"
         />

         <CampsiteCapacityZones :form="form" :is-editable="isEditable" />

         <CampsiteLayoutImage :form="form" :is-editable="isEditable" />

         <CampsiteBookingStatus :form="form" />

         <CampsiteBookingInfo :form="form" :is-editable="isEditable" />

         <p class="text-xs text-gray-400 text-center">其他資料可請 Claude 幫忙補</p>

      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
         <button @click="cancel" class="px-4 py-2 text-gray-600 font-bold hover:bg-white rounded-lg transition">{{ isEditable ? '取消' : '關閉' }}</button>
         <button 
           v-if="isEditable"
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
