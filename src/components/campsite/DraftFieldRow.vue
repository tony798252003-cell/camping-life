<script setup lang="ts">
import { ref, computed } from 'vue'
import { Check, Pencil, ExternalLink, ChevronDown } from 'lucide-vue-next'
import type { DraftField } from '../../types/campsiteDraft'

// kind / unit 是 Task 4.5 加的可選 prop：編輯時需要知道值的型別（標籤陣列、設備物件…），
// 否則「查無資料」的欄位（value 為 null）無從得知該用哪種輸入。
const props = withDefaults(
  defineProps<{
    label: string
    field: DraftField<unknown>
    kind?: 'text' | 'textarea' | 'number' | 'tags' | 'amenities'
    unit?: string
  }>(),
  { kind: 'text', unit: '' },
)
const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'edit', value: unknown): void
}>()

const AMENITIES = [
  { key: 'has_fridge', label: '冰箱' },
  { key: 'has_freezer', label: '冷凍庫' },
  { key: 'has_water_dispenser', label: '飲水機' },
] as const

const PILL: Record<string, string> = {
  places: '📍Google',
  elevation: '⛰️計算',
  gemini: '✨AI',
  manual: '✍️自填',
}

// 三級（規格 §5.7）：3 = 需要確認；2 = AI 有來源；1 = 可信
const level = computed(() => (props.field.needsReview ? 3 : props.field.source === 'gemini' ? 2 : 1))

// 來源網址只放行 http(s)，避免 javascript:／data: 等被當成連結（資料可能來自舊草稿或 AI）
const safeUrls = computed(() => props.field.urls.filter((u) => /^https?:\/\//i.test(u)))

const display = computed(() => {
  const v = props.field.value
  if (v === null || v === undefined || v === '') return null
  if (props.kind === 'tags') return Array.isArray(v) ? v.join('、') : String(v)
  if (props.kind === 'amenities') {
    const o = v as Record<string, boolean>
    return AMENITIES.filter((a) => typeof o[a.key] === 'boolean')
      .map((a) => `${a.label}${o[a.key] ? '有' : '無'}`)
      .join('、')
  }
  return props.unit ? `${v} ${props.unit}` : String(v)
})

const editing = ref(false)
const text = ref('')
const amen = ref<Record<string, boolean>>({})
const showSources = ref(false)

function startEdit() {
  const v = props.field.value
  if (props.kind === 'tags') text.value = Array.isArray(v) ? v.join('、') : ''
  else if (props.kind === 'amenities') amen.value = { ...((v as Record<string, boolean> | null) ?? {}) }
  else text.value = v === null || v === undefined ? '' : String(v)
  editing.value = true
}

function commit() {
  let out: unknown
  if (props.kind === 'tags') {
    const arr = text.value.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
    out = arr.length ? arr : null
  } else if (props.kind === 'amenities') {
    out = Object.keys(amen.value).length ? { ...amen.value } : null
  } else if (props.kind === 'number') {
    const n = Number(text.value)
    out = text.value.trim() === '' || !Number.isFinite(n) ? null : n
  } else {
    out = text.value.trim() === '' ? null : text.value.trim()
  }
  editing.value = false
  emit('edit', out)
}
</script>

<template>
  <div
    class="rounded-[14px] px-3 py-2.5"
    :class="level === 3 ? 'bg-amber-50 border-l-4 border-amber-400' : 'bg-white border border-slate-100'"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="text-[13px] font-bold text-primary-900">{{ label }}</span>
      <span
        class="text-[11px] px-2 py-0.5 rounded-full"
        :class="field.source === 'gemini' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'"
      >{{ PILL[field.source] }}</span>
    </div>

    <template v-if="!editing">
      <p class="mt-1 text-[15px] whitespace-pre-line break-words" :class="display ? 'text-slate-900' : 'text-slate-400'">
        {{ display ?? '？查無資料' }}
      </p>

      <div v-if="safeUrls.length" class="mt-1">
        <button class="text-[12px] text-purple-700 flex items-center gap-1 min-h-[28px]" @click="showSources = !showSources">
          來源 {{ safeUrls.length }} 筆
          <ChevronDown class="w-3 h-3" :class="showSources ? 'rotate-180' : ''" />
        </button>
        <ul v-if="showSources" class="space-y-1">
          <li v-for="u in safeUrls" :key="u">
            <a :href="u" target="_blank" rel="noopener noreferrer" class="text-[12px] text-purple-700 underline break-all inline-flex items-center gap-1">
              {{ u }}<ExternalLink class="w-3 h-3 shrink-0" />
            </a>
          </li>
        </ul>
      </div>

      <div v-if="level === 3" class="mt-2 flex gap-2">
        <button
          v-if="display"
          class="min-h-[44px] px-4 rounded-[14px] bg-amber-400 text-amber-950 text-[13px] font-bold flex items-center gap-1"
          @click="emit('confirm')"
        ><Check class="w-4 h-4" />確認</button>
        <button
          class="min-h-[44px] px-4 rounded-[14px] bg-white border border-amber-300 text-amber-900 text-[13px] font-bold flex items-center gap-1"
          @click="startEdit"
        ><Pencil class="w-4 h-4" />{{ display ? '修改' : '自己填' }}</button>
      </div>
      <button v-else class="mt-1 text-[12px] text-slate-500 min-h-[32px] flex items-center gap-1" @click="startEdit">
        <Pencil class="w-3 h-3" />修改
      </button>
    </template>

    <div v-else class="mt-2 space-y-2">
      <div v-if="kind === 'amenities'" class="flex flex-wrap gap-3">
        <label v-for="a in AMENITIES" :key="a.key" class="flex items-center gap-1 text-[14px] min-h-[44px]">
          <input v-model="amen[a.key]" type="checkbox" class="w-5 h-5" />{{ a.label }}
        </label>
      </div>
      <textarea v-else-if="kind === 'textarea'" v-model="text" rows="5" class="w-full rounded-[12px] border border-slate-200 p-2 text-[15px]"></textarea>
      <input
        v-else
        v-model="text"
        :type="kind === 'number' ? 'number' : 'text'"
        :placeholder="kind === 'tags' ? '用頓號分隔' : ''"
        class="w-full min-h-[44px] rounded-[12px] border border-slate-200 px-3 text-[15px]"
      />
      <div class="flex gap-2">
        <button class="min-h-[44px] px-4 rounded-[14px] bg-primary-600 text-white text-[13px] font-bold" @click="commit">完成</button>
        <button class="min-h-[44px] px-4 rounded-[14px] bg-white border border-slate-200 text-[13px]" @click="editing = false">取消</button>
      </div>
    </div>
  </div>
</template>
