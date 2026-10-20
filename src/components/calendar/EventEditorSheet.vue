<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import { useCalendarEvents } from '../../composables/useCalendarEvents'
import { useEventCategories } from '../../composables/useEventCategories'
import { useEventEditor } from '../../composables/useEventEditor'
import { useNotification } from '../../composables/useNotification'
import { useTripModal } from '../../composables/useTripModal'
import { getCpblSchedule } from '../../services/cpblService'
import type { CpblSchedule } from '../../types/database'
import { fromEventRow, normalizeTimedRange, type EventInput } from '../../utils/calendar/eventRow'
import { isRakutenGame } from '../../utils/calendar/eventSources'
import { todayYmd } from '../../utils/dateRange'

const PALETTE = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b']

const { isOpen, editing, initialDate, presetGame, close } = useEventEditor()
const { create, update } = useCalendarEvents()
const { categories, bySystemKey, load: loadCategories, create: createCategory } = useEventCategories()
const { openNew: openNewTrip } = useTripModal()
const { error: notifyError } = useNotification()

const title = ref('')
const categoryId = ref('')
const allDay = ref(true)
const startDate = ref('')
const endDate = ref('')
const startTime = ref('09:00')
const endTime = ref('10:00')
const description = ref('')
const cpblGameId = ref<string | null>(null)
const clamped = ref(false)
const nextDayHint = ref(false)
const saving = ref(false)
const game = ref<CpblSchedule | null>(null)

const isEdit = computed(() => editing.value !== null)
const campingId = computed(() => bySystemKey.value.camping?.id)

// 每次開啟都重設表單；編輯模式用 fromEventRow 還原
watch(isOpen, (open) => {
  if (!open) return
  loadCategories()
  clamped.value = false
  nextDayHint.value = false
  saving.value = false
  const e = editing.value
  if (e) {
    const f = fromEventRow(e)
    title.value = f.title
    categoryId.value = f.categoryId
    allDay.value = f.allDay
    startDate.value = f.startDate
    endDate.value = f.endDate
    startTime.value = f.startTime ?? '09:00'
    endTime.value = f.endTime ?? '10:00'
    description.value = f.description ?? ''
    cpblGameId.value = f.cpblGameId ?? null
    // 分類已被刪除或舊資料沒有分類：預設個人，避免送出空字串
    if (!categoryId.value) categoryId.value = bySystemKey.value.personal?.id ?? ''
  } else {
    title.value = ''
    categoryId.value = bySystemKey.value.personal?.id ?? ''
    allDay.value = true
    startDate.value = initialDate.value ?? todayYmd()
    endDate.value = startDate.value
    startTime.value = '09:00'
    endTime.value = '10:00'
    description.value = ''
    cpblGameId.value = null
    if (presetGame.value) apply(presetGame.value)
  }
})

// 分類載入完成後，新增模式若還沒選分類就補上預設「個人」
watch(bySystemKey, (m) => {
  if (isOpen.value && !categoryId.value) categoryId.value = m.personal?.id ?? ''
})

// 結束日期早於開始日期：自動改成開始日期，只在表單上提示（規格 §5.5）
// selfClamp：改 endDate 會再觸發本 watcher，要略過那一次，否則提示會被立刻清掉
let selfClamp = false
watch([startDate, endDate], ([s, e], [, oldE]) => {
  if (s && e && e < s) {
    selfClamp = true
    endDate.value = s
    clamped.value = true
  } else if (selfClamp) {
    selfClamp = false
  } else if (e !== oldE) {
    clamped.value = false
  }
})

// 有時段事件同一天結束早於開始：結束日改成隔天並提示（不可默默改成 0 分鐘）
watch([startDate, endDate, startTime, endTime, allDay], () => {
  if (allDay.value) {
    nextDayHint.value = false
    return
  }
  const r = normalizeTimedRange(startDate.value, endDate.value, startTime.value, endTime.value, nextDayHint.value)
  if (r.endDate !== endDate.value) endDate.value = r.endDate
  nextDayHint.value = r.bumped
})

// 開始日期當天有樂天比賽時提示套用；用 token 避免快速改日期時舊回應蓋掉新結果
let token = 0
watch([startDate, isOpen], async ([d, open]) => {
  const mine = ++token
  game.value = null
  if (!open || !d) return
  const list = await getCpblSchedule(d, d)
  if (mine !== token) return
  game.value = list.find(isRakutenGame) ?? null
})

const gameLabel = computed(() => (game.value ? `${game.value.visiting_team_name} vs ${game.value.home_team_name}` : ''))

function apply(g: CpblSchedule) {
  title.value = `⚾ ${g.visiting_team_name} vs ${g.home_team_name}`
  categoryId.value = bySystemKey.value.baseball?.id ?? categoryId.value
  cpblGameId.value = g.id
}

function pickCategory(id: string) {
  // 編輯模式不能把既有事件轉成露營（規格 §5.5）
  if (id === campingId.value && isEdit.value) return
  categoryId.value = id
}

async function save() {
  if (saving.value) return
  // 露營標題會被丟棄，所以必須在標題檢查之前分流，否則空標題會卡住無法進 TripModal
  // 新增模式選了露營：關閉 sheet，改開 TripModal 新增（露營資料只存 camping_trips）
  if (!isEdit.value && categoryId.value === campingId.value) {
    const d = startDate.value
    close()
    openNewTrip(d)
    return
  }
  if (!title.value.trim()) {
    notifyError('請輸入標題')
    return
  }
  const range = allDay.value
    ? { endDate: endDate.value }
    : normalizeTimedRange(startDate.value, endDate.value, startTime.value, endTime.value, nextDayHint.value)
  const input: EventInput = {
    title: title.value.trim(),
    description: description.value.trim() || null,
    categoryId: categoryId.value,
    allDay: allDay.value,
    startDate: startDate.value,
    endDate: range.endDate,
    ...(allDay.value ? {} : { startTime: startTime.value, endTime: endTime.value }),
    cpblGameId: cpblGameId.value,
  }
  saving.value = true
  try {
    if (editing.value) await update(editing.value.id, input)
    else await create(input)
    close()
  } catch (e) {
    console.error('[EventEditorSheet] save error:', e)
    notifyError('儲存失敗，請再試一次')
  } finally {
    saving.value = false
  }
}

// 新增分類小 sheet
const catOpen = ref(false)
const catName = ref('')
const catColor = ref(PALETTE[0]!)
const catSaving = ref(false)
const openCatSheet = () => {
  catName.value = ''
  catColor.value = PALETTE[0]!
  catOpen.value = true
}
async function saveCategory() {
  const name = catName.value.trim()
  if (!name || catSaving.value) return
  catSaving.value = true
  try {
    const c = await createCategory(name, catColor.value)
    categoryId.value = c.id
    catOpen.value = false
  } catch (e) {
    console.error('[EventEditorSheet] create category error:', e)
    notifyError('新增分類失敗')
  } finally {
    catSaving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[70] bg-white flex flex-col">
      <header class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button class="p-2 -ml-2 text-primary-600" aria-label="關閉" @click="close()"><X class="w-5 h-5" /></button>
        <h2 class="font-bold text-primary-900">{{ isEdit ? '編輯事件' : '新增事件' }}</h2>
        <button class="px-4 py-1.5 rounded-full btn-primary font-bold text-sm disabled:opacity-50" :disabled="saving" @click="save()">
          儲存
        </button>
      </header>

      <div class="flex-1 overflow-y-auto p-4 space-y-5 max-w-md w-full mx-auto">
        <input
          v-model="title"
          type="text"
          placeholder="標題"
          class="w-full text-xl font-bold text-primary-900 border-b border-gray-200 pb-2 outline-none focus:border-primary-500"
        />

        <button
          v-if="game"
          class="w-full text-left text-sm rounded-xl bg-red-50 text-red-900 px-3 py-2 flex items-center justify-between gap-2"
          @click="apply(game)"
        >
          <span>⚾ 這天有桃猿比賽：{{ gameLabel }}</span>
          <span class="font-bold shrink-0">套用</span>
        </button>

        <section>
          <p class="text-xs text-primary-600 mb-2">分類</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in categories"
              :key="c.id"
              class="px-3 py-1.5 rounded-full text-sm font-medium border flex items-center gap-1.5 disabled:opacity-40"
              :class="categoryId === c.id ? 'text-white border-transparent' : 'bg-white text-primary-700 border-gray-200'"
              :style="categoryId === c.id ? { backgroundColor: c.color } : {}"
              :disabled="isEdit && c.id === campingId && categoryId !== c.id"
              @click="pickCategory(c.id)"
            >
              <span v-if="categoryId !== c.id" class="w-2 h-2 rounded-full" :style="{ backgroundColor: c.color }"></span>
              {{ c.name }}
            </button>
            <button
              class="w-8 h-8 rounded-full border border-dashed border-gray-300 text-primary-600 flex items-center justify-center"
              aria-label="新增分類"
              @click="openCatSheet()"
            >
              <Plus class="w-4 h-4" />
            </button>
          </div>
        </section>

        <section class="space-y-3">
          <label class="flex items-center justify-between text-sm text-primary-900 font-medium">
            全天
            <input v-model="allDay" type="checkbox" class="w-5 h-5 accent-primary-600" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="text-xs text-primary-600">
              開始日期
              <input v-model="startDate" type="date" class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-primary-900" />
            </label>
            <label class="text-xs text-primary-600">
              結束日期
              <input v-model="endDate" type="date" :min="startDate" class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-primary-900" />
            </label>
          </div>
          <p v-if="clamped" class="text-xs text-amber-600">結束日期不能早於開始日期，已自動改成開始日期</p>
          <p v-if="nextDayHint && !allDay" class="text-xs text-amber-600">結束時間早於開始時間，已改成隔天結束</p>
          <div v-if="!allDay" class="grid grid-cols-2 gap-3">
            <label class="text-xs text-primary-600">
              開始時間
              <input v-model="startTime" type="time" class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-primary-900" />
            </label>
            <label class="text-xs text-primary-600">
              結束時間
              <input v-model="endTime" type="time" class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-primary-900" />
            </label>
          </div>
        </section>

        <label class="block text-xs text-primary-600">
          備註
          <textarea
            v-model="description"
            rows="4"
            class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-primary-900"
          ></textarea>
        </label>
      </div>
    </div>

    <div v-if="isOpen && catOpen" class="fixed inset-0 z-[80] flex items-end justify-center bg-black/40" @click.self="catOpen = false">
      <div class="w-full max-w-md bg-white rounded-t-3xl p-5 pb-safe shadow-xl">
        <div class="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4"></div>
        <h3 class="font-bold text-primary-900 mb-3">新增分類</h3>
        <input
          v-model="catName"
          type="text"
          placeholder="分類名稱"
          class="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm mb-3"
        />
        <div class="flex gap-2 mb-4">
          <button
            v-for="c in PALETTE"
            :key="c"
            class="w-8 h-8 rounded-full border-2"
            :class="catColor === c ? 'border-primary-900' : 'border-transparent'"
            :style="{ backgroundColor: c }"
            :aria-label="c"
            @click="catColor = c"
          ></button>
        </div>
        <button class="w-full py-3 rounded-2xl btn-primary font-bold text-sm disabled:opacity-50" :disabled="!catName.trim() || catSaving" @click="saveCategory()">
          新增
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pb-safe {
  padding-bottom: max(1.25rem, env(safe-area-inset-bottom, 20px));
}
</style>
