<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { Loader2, Check, Link2, Search, X, AlertTriangle } from 'lucide-vue-next'
import { supabase } from '../../lib/supabase'
import { apiPost } from '../../services/api'
import { matchCampsite, type CampsiteMatch, type MatchableCampsite } from '../../utils/campsiteMatch'
import { cleanCampsiteName } from '../../utils/campsiteName'
import { useConfirm } from '../../composables/useConfirm'
import type { Campsite, FieldSources } from '../../types/database'
import type { CampsiteDraft, DraftField } from '../../types/campsiteDraft'
import type { PlaceLite } from '../../types/campsiteDraft'
import DraftFieldRow from './DraftFieldRow.vue'

const props = defineProps<{ initialPlaceId?: string; initialName?: string; embedded?: boolean }>()
const emit = defineEmits<{
  (e: 'saved', campsite: Campsite): void
  (e: 'cancel'): void
}>()

const router = useRouter()
const { confirm } = useConfirm()

type Stage = 'input' | 'candidates' | 'generating' | 'confirm'
const stage = ref<Stage>('input')
const mapsUrl = ref('')
const searchName = ref('')
const busy = ref(false)
const errorMsg = ref('')
const candidates = ref<PlaceLite[]>([])
const selectedId = ref<string | null>(null)
const existing = ref<MatchableCampsite[]>([])
const dupDismissed = ref(false)

// 產生中
const stepPlaces = ref(false)
const baseDraft = ref<CampsiteDraft | null>(null)
let abort: AbortController | null = null

// 草稿只存在 component state（規格 §5.7，不寫 DB）
type Row = DraftField<unknown> & { confirmed: boolean }
const draft = ref<CampsiteDraft | null>(null)
const rows = ref<Record<string, Row>>({})
const saving = ref(false)
const alreadyExists = ref(false)
const existingWarn = ref('')

type Kind = 'text' | 'textarea' | 'number' | 'tags' | 'amenities'
const DISPLAY_ROWS: Array<{ key: string; label: string; kind?: Kind; unit?: string }> = [
  { key: 'name', label: '名稱' },
  { key: 'city', label: '縣市' },
  { key: 'district', label: '鄉鎮' },
  { key: 'address', label: '地址' },
  { key: 'altitude', label: '海拔', kind: 'number', unit: 'm' },
  { key: 'phone', label: '電話' },
  { key: 'spot_types', label: '營位類型（雨棚等）', kind: 'tags' },
  { key: 'shower_restrictions', label: '衛浴熱水時段', kind: 'textarea' },
  { key: 'night_rush_time', label: '夜衝時段' },
  { key: 'booking_method', label: '訂位方式', kind: 'tags' },
  { key: 'booking_timing', label: '訂位規則', kind: 'textarea' },
  { key: 'check_in_time', label: '進場時間' },
  { key: 'check_out_time', label: '退場時間' },
  { key: 'amenities', label: '設備', kind: 'amenities' },
  { key: 'scenery_features', label: '景觀', kind: 'tags' },
  { key: 'water_features', label: '水域', kind: 'tags' },
  { key: 'playground_features', label: '遊樂設施', kind: 'tags' },
  { key: 'campsite_notes', label: 'AI 摘要', kind: 'textarea' },
]

const visibleRows = computed(() => DISPLAY_ROWS.filter((r) => rows.value[r.key]))
const unconfirmed = computed(
  () => visibleRows.value.filter((r) => rows.value[r.key]!.needsReview && !rows.value[r.key]!.confirmed).length,
)
// 按過確認或修改過的欄位，不再當成需要檢查
const asField = (key: string): DraftField<unknown> => {
  const r = rows.value[key]!
  return { ...r, needsReview: r.needsReview && !r.confirmed }
}

const selected = computed(() => candidates.value.find((c) => c.placeId === selectedId.value) ?? null)

// 規格 §5.7：呼叫 Gemini 之前就先比對已收錄營區
const dupMatches = computed<CampsiteMatch[]>(() => {
  const c = selected.value
  if (!c) return []
  const hasCoord = Number.isFinite(c.lat) && Number.isFinite(c.lng)
  return matchCampsite(
    {
      name: cleanCampsiteName(c.name),
      district: null,
      latitude: hasCoord ? c.lat : null,
      longitude: hasCoord ? c.lng : null,
      google_place_id: c.placeId,
    },
    existing.value,
    { bracketAware: true },
  ).filter((m) => m.level === 'same_place' || m.level === 'likely')
})
const showDup = computed(() => dupMatches.value.length > 0 && !dupDismissed.value)

function errText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (m === 'cannot_resolve') return '這個連結解析不出地點，請改用名稱搜尋'
  return m || '發生錯誤，請稍後再試'
}

function showCandidates(list: PlaceLite[], preselect?: string) {
  candidates.value = list
  selectedId.value = preselect ?? null
  dupDismissed.value = false
  stage.value = 'candidates'
}

async function resolveLink() {
  if (!mapsUrl.value.trim() || busy.value) return
  busy.value = true
  errorMsg.value = ''
  try {
    const r = await apiPost<{ candidates: PlaceLite[]; preselectId?: string }>('/api/campsite-draft', {
      mapsUrl: mapsUrl.value.trim(),
      resolveOnly: true,
    })
    if (r.candidates.length === 0) errorMsg.value = '找不到符合的地點，請改用名稱搜尋'
    else showCandidates(r.candidates, r.preselectId)
  } catch (e) {
    errorMsg.value = errText(e)
  } finally {
    busy.value = false
  }
}

async function searchByName() {
  if (!searchName.value.trim() || busy.value) return
  busy.value = true
  errorMsg.value = ''
  try {
    const r = await apiPost<{ candidates: PlaceLite[] }>('/api/places-search', { query: searchName.value.trim() })
    if (r.candidates.length === 0) errorMsg.value = '找不到符合的地點，換個關鍵字試試'
    else showCandidates(r.candidates)
  } catch (e) {
    errorMsg.value = errText(e)
  } finally {
    busy.value = false
  }
}

function showDraft(d: CampsiteDraft) {
  const out: Record<string, Row> = {}
  for (const [k, f] of Object.entries(d.fields)) out[k] = { ...(f as DraftField<unknown>), confirmed: false }
  draft.value = d
  rows.value = out
  alreadyExists.value = false
  stage.value = 'confirm'
}

async function generate() {
  const id = selectedId.value
  if (!id) return
  errorMsg.value = ''
  stepPlaces.value = false
  baseDraft.value = null
  stage.value = 'generating'
  abort = new AbortController()
  const ctl = abort
  try {
    // 先拿 Places＋海拔（快），才能提供「跳過 AI」；再查 Gemini（慢）
    const base = await apiPost<CampsiteDraft>('/api/campsite-draft', { placeId: id, skipAi: true }, ctl.signal)
    if (ctl.signal.aborted) return
    baseDraft.value = base
    stepPlaces.value = true
    try {
      // 帶上第一次的 Places 草稿，伺服器不用再查一次 Place Details
      const full = await apiPost<CampsiteDraft>('/api/campsite-draft', { placeId: id, baseDraft: base }, ctl.signal)
      if (ctl.signal.aborted) return
      showDraft(full)
    } catch {
      if (ctl.signal.aborted) return
      // AI 失敗：保留 Places 資料，其他欄位手動補
      showDraft({ ...base, warnings: [...base.warnings, 'gemini_failed'] })
    }
  } catch (e) {
    if (ctl.signal.aborted) return
    errorMsg.value = errText(e)
    stage.value = 'candidates'
  }
}

function skipAi() {
  if (!baseDraft.value) return
  abort?.abort()
  showDraft(baseDraft.value)
}

function cancelGenerating() {
  abort?.abort()
  stage.value = 'candidates'
}

function onConfirm(key: string) {
  rows.value[key]!.confirmed = true
}

function onEdit(key: string, value: unknown) {
  rows.value[key] = {
    value,
    source: 'manual',
    confidence: value === null ? 'none' : 'high',
    urls: [],
    needsReview: false,
    confirmed: true, // 使用者親手填過（含清空）
  }
}

async function discard() {
  if (!(await confirm({ title: '捨棄草稿？', message: '草稿還沒存檔，捨棄後會遺失。', type: 'warning', confirmText: '捨棄' }))) return
  draft.value = null
  rows.value = {}
  stage.value = 'input'
}

function hasUnsavedDraft() {
  return stage.value === 'confirm' && draft.value !== null
}

async function cancelFlow() {
  if (
    hasUnsavedDraft() &&
    !(await confirm({ title: '捨棄草稿？', message: '草稿還沒存檔，離開會遺失。', type: 'warning', confirmText: '離開' }))
  )
    return
  abort?.abort()
  emit('cancel')
}
defineExpose({ hasUnsavedDraft })

function buildInsert() {
  const row: Record<string, unknown> = { google_place_id: draft.value!.placeId }
  const sources: FieldSources = {}
  for (const [k, r] of Object.entries(rows.value)) {
    if (r.value !== null && r.value !== undefined) row[k] = r.value
    sources[k] = {
      source: r.source,
      confidence: r.confidence,
      urls: r.urls.filter((u) => /^https?:\/\//i.test(u)),
      // 不需檢查的欄位視為可信；需檢查的欄位要使用者按過確認或修改過才算
      confirmed: !r.needsReview || r.confirmed,
    }
  }
  row.field_sources = sources
  return row
}

async function save() {
  if (!draft.value || saving.value) return
  const nameVal = rows.value.name?.value
  if (typeof nameVal !== 'string' || !nameVal.trim()) {
    errorMsg.value = '請填寫營區名稱'
    return
  }
  if (unconfirmed.value > 0) {
    const ok = await confirm({
      title: '還有欄位未確認',
      message: `還有 ${unconfirmed.value} 個欄位未確認，要直接存嗎？`,
      type: 'warning',
      confirmText: '直接存檔',
    })
    if (!ok) return
  }
  saving.value = true
  errorMsg.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const insert = { ...buildInsert(), ...(session ? { created_by: session.user.id } : {}) }
    const { data, error } = await (supabase.from('campsites') as any).insert(insert).select().single()
    if (error) {
      if (error.code === '23505') {
        alreadyExists.value = true
        return
      }
      throw error
    }
    draft.value = null // 已存，離開頁面不再攔截
    emit('saved', data as unknown as Campsite)
  } catch (e: any) {
    errorMsg.value = `儲存失敗：${e?.message ?? '未知錯誤'}`
  } finally {
    saving.value = false
  }
}

// 內嵌（TripModal）時，已收錄的營區直接拿來用：抓回完整列並交給父層選取
async function useExisting(filter: { id: number } | { googlePlaceId: string }) {
  if (saving.value) return
  saving.value = true
  errorMsg.value = ''
  try {
    const q = supabase.from('campsites').select('*')
    const { data, error } = await ('id' in filter ? q.eq('id', filter.id) : q.eq('google_place_id', filter.googlePlaceId)).limit(1).maybeSingle()
    if (error || !data) throw error ?? new Error('找不到這個營區')
    draft.value = null
    emit('saved', data as unknown as Campsite)
  } catch (e: any) {
    errorMsg.value = `無法選取既有營區：${e?.message ?? '未知錯誤'}`
  } finally {
    saving.value = false
  }
}

function viewExisting(name: string) {
  router.push({ name: 'library', query: { q: name } })
}

function beforeUnload(ev: BeforeUnloadEvent) {
  if (hasUnsavedDraft()) ev.preventDefault()
}

onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  const { data, error } = await supabase
    .from('campsites')
    .select('id,name,district,latitude,longitude,google_place_id,phone,merged_into_id')
    .is('merged_into_id', null)
    .limit(5000)
  if (error) existingWarn.value = '無法載入已收錄營區，這次沒有重複檢查，請自行確認是否已收錄'
  existing.value = (data ?? []) as MatchableCampsite[]
  if (props.initialPlaceId) {
    // 只有 placeId（例如從「找新營區」帶入）：沒有座標，重複檢查只能比對 place_id
    showCandidates(
      [{ placeId: props.initialPlaceId, name: props.initialName ?? '指定的地點', address: '', lat: NaN, lng: NaN }],
      props.initialPlaceId,
    )
    // 從「找新營區」帶入：先做重複檢查；有疑似重複就停在候選頁讓使用者決定，沒有才直接產生
    if (!showDup.value) void generate()
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  abort?.abort()
})
</script>

<template>
  <div class="flex flex-col h-full bg-surface-50">
    <header class="shrink-0 flex items-center justify-between px-4 py-3">
      <h2 class="text-[17px] font-bold text-primary-900">新增營區</h2>
      <button class="w-11 h-11 flex items-center justify-center rounded-full active:bg-slate-100" aria-label="關閉" @click="cancelFlow">
        <X class="w-5 h-5" />
      </button>
    </header>

    <p v-if="existingWarn" class="shrink-0 mx-4 mb-2 text-[13px] text-amber-800 bg-amber-50 rounded-[12px] px-3 py-2">{{ existingWarn }}</p>
    <p v-if="errorMsg" class="shrink-0 mx-4 mb-2 text-[13px] text-red-600 bg-red-50 rounded-[12px] px-3 py-2">{{ errorMsg }}</p>

    <!-- 1 輸入 -->
    <div v-if="stage === 'input'" class="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
      <section class="space-y-2">
        <label class="text-[13px] font-bold text-primary-900 flex items-center gap-1"><Link2 class="w-4 h-4" />貼上 Google Maps 連結</label>
        <input v-model="mapsUrl" type="url" inputmode="url" placeholder="https://maps.app.goo.gl/…" class="w-full min-h-[44px] rounded-[14px] border border-slate-200 px-3 text-[15px] bg-white" @keyup.enter="resolveLink" />
        <button :disabled="busy || !mapsUrl.trim()" class="w-full min-h-[48px] rounded-[16px] bg-primary-600 text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2" @click="resolveLink">
          <Loader2 v-if="busy" class="w-4 h-4 animate-spin" />解析連結
        </button>
      </section>
      <p class="text-center text-[13px] text-slate-400">── 或 ──</p>
      <section class="space-y-2">
        <label class="text-[13px] font-bold text-primary-900 flex items-center gap-1"><Search class="w-4 h-4" />用名稱搜尋</label>
        <div class="flex gap-2">
          <input v-model="searchName" type="text" placeholder="例如：雲頂露營區" class="flex-1 min-h-[44px] rounded-[14px] border border-slate-200 px-3 text-[15px] bg-white" @keyup.enter="searchByName" />
          <button :disabled="busy || !searchName.trim()" class="min-h-[44px] px-5 rounded-[14px] bg-primary-600 text-white font-bold disabled:opacity-40" @click="searchByName">搜尋</button>
        </div>
      </section>
    </div>

    <!-- 2 候選 -->
    <template v-else-if="stage === 'candidates'">
      <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        <p class="text-[13px] text-slate-600">請選擇正確的地點，再按「產生草稿」。</p>
        <div v-if="showDup" class="rounded-[14px] bg-amber-50 border border-amber-300 p-3 space-y-2">
          <p class="text-[14px] font-bold text-amber-900 flex items-center gap-1"><AlertTriangle class="w-4 h-4" />可能已經收錄</p>
          <p v-for="m in dupMatches" :key="m.campsite.id" class="text-[14px] text-amber-900">
            {{ m.campsite.name }}<span v-if="m.distanceM != null" class="text-[12px] text-amber-700">（相距約 {{ Math.round(m.distanceM) }} m）</span>
            <button v-if="!embedded" class="ml-2 underline font-bold min-h-[32px]" @click="viewExisting(m.campsite.name)">查看</button>
            <button v-else :disabled="saving" class="ml-2 underline font-bold min-h-[32px]" @click="useExisting({ id: m.campsite.id })">用這個營區</button>
          </p>
          <button class="min-h-[44px] px-4 rounded-[14px] bg-white border border-amber-300 text-[13px] font-bold text-amber-900" @click="dupDismissed = true">仍要新增</button>
        </div>
        <label
          v-for="c in candidates" :key="c.placeId"
          class="flex items-start gap-3 rounded-[16px] bg-white border px-3 py-3 min-h-[56px]"
          :class="selectedId === c.placeId ? 'border-primary-500' : 'border-slate-100'"
        >
          <input v-model="selectedId" type="radio" :value="c.placeId" class="mt-1 w-5 h-5" />
          <span class="min-w-0">
            <span class="block text-[15px] font-bold text-slate-900">{{ c.name }}</span>
            <span v-if="c.address" class="block text-[13px] text-slate-500">{{ c.address }}</span>
          </span>
        </label>
        <button class="w-full min-h-[48px] text-[14px] text-primary-700 underline" @click="stage = 'input'">都不是，換關鍵字</button>
      </div>
      <footer class="shrink-0 p-4 border-t border-slate-100 bg-white">
        <button :disabled="!selectedId || showDup" class="w-full min-h-[48px] rounded-[16px] bg-primary-600 text-white font-bold disabled:opacity-40" @click="generate">產生草稿 →</button>
      </footer>
    </template>

    <!-- 3 產生中 -->
    <div v-else-if="stage === 'generating'" class="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
      <ol class="space-y-3 text-[15px]">
        <li class="flex items-center gap-2">
          <Check v-if="stepPlaces" class="w-5 h-5 text-emerald-600" /><Loader2 v-else class="w-5 h-5 animate-spin text-slate-400" />取得地點
        </li>
        <li class="flex items-center gap-2">
          <Check v-if="stepPlaces" class="w-5 h-5 text-emerald-600" /><Loader2 v-else class="w-5 h-5 animate-spin text-slate-400" />查海拔
        </li>
        <li class="flex items-center gap-2">
          <Loader2 class="w-5 h-5 animate-spin text-purple-500" />搜尋設施資訊（約 10–30 秒）
        </li>
      </ol>
      <div class="space-y-2">
        <button v-if="stepPlaces" class="w-full min-h-[48px] rounded-[16px] bg-primary-600 text-white font-bold" @click="skipAi">跳過 AI，先存基本資料</button>
        <button class="w-full min-h-[48px] rounded-[16px] bg-white border border-slate-200 font-bold" @click="cancelGenerating">取消</button>
      </div>
    </div>

    <!-- 4 確認 -->
    <template v-else-if="stage === 'confirm' && draft">
      <div class="shrink-0 mx-4 mb-2 rounded-[14px] bg-white border border-slate-100 px-3 py-2">
        <p class="text-[15px] font-bold text-slate-900">{{ draft.rawName }}</p>
        <p class="text-[13px] text-slate-500">{{ rows.address?.value ?? '' }}</p>
        <p class="mt-1 text-[12px] text-slate-500">很多營區的設施只在 FB 粉專，查不到的欄位請自己確認</p>
        <p v-if="draft.warnings.includes('gemini_failed')" class="mt-1 text-[12px] text-amber-700">AI 查詢沒有成功，其他欄位請手動補。</p>
        <p v-if="draft.aiMode === 'ungrounded'" class="mt-1 text-[12px] font-bold text-amber-700">AI 未上網查證，以下資料僅供參考，請逐項確認</p>
        <p v-if="unconfirmed > 0" class="mt-1 text-[12px] font-bold text-amber-700">有 {{ unconfirmed }} 個欄位請確認</p>
      </div>
      <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        <div v-if="alreadyExists" class="rounded-[14px] bg-red-50 border border-red-200 p-3 text-[14px] text-red-800">
          這個地點已經收錄了。
          <button v-if="!embedded" class="underline font-bold min-h-[32px]" @click="viewExisting(String(rows.name?.value ?? ''))">前往圖鑑查看</button>
          <button v-else :disabled="saving" class="underline font-bold min-h-[32px]" @click="useExisting({ googlePlaceId: draft.placeId })">用這個營區</button>
        </div>
        <DraftFieldRow
          v-for="r in visibleRows" :key="r.key"
          :label="r.label" :field="asField(r.key)" :kind="r.kind" :unit="r.unit"
          @confirm="onConfirm(r.key)" @edit="(v: unknown) => onEdit(r.key, v)"
        />
      </div>
      <footer class="shrink-0 p-4 border-t border-slate-100 bg-white flex gap-2">
        <button class="min-h-[48px] px-5 rounded-[16px] bg-white border border-slate-200 font-bold" @click="discard">捨棄草稿</button>
        <button :disabled="saving || alreadyExists" class="flex-1 min-h-[48px] rounded-[16px] bg-primary-600 text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2" @click="save">
          <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />存檔
        </button>
      </footer>
    </template>
  </div>
</template>
