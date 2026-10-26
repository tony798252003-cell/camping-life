<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Bell, BellRing, ChevronRight, Star } from 'lucide-vue-next'
import { useFamilyLists } from '../../composables/useFamilyLists'

const { list, grouped, openTotal, loaded, loadFailed, hasFamily, load, addItem, toggle, toggleImportant, removeItem } = useFamilyLists()

const MAX_SHOWN = 3
const shown = computed(() => grouped.value.open.slice(0, MAX_SHOWN))
const draft = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
// 「通知家人」開關：只對下一筆有效，新增成功後關回去
const notifyOn = ref(false)

// App 登入後已載入；剛加入家庭或尚未載入時補載
onMounted(() => {
  if (hasFamily.value && !list.value) load()
})

const submit = async (e: Event) => {
  // 注音／拼音選字時的 Enter 只是確認選字，不能當成送出
  if ((e as KeyboardEvent).isComposing) return
  const t = draft.value
  if (!t.trim()) return
  draft.value = ''
  if (await addItem(t, notifyOn.value)) notifyOn.value = false
}

// 往左滑或長按露出「刪除」（同時只開一列）；點刪除才真的刪，所以不再跳確認
const DELETE_W = 80
const openId = ref<string | null>(null)
const drag = ref<{ id: string; x0: number; y0: number; dx: number; horizontal: boolean | null } | null>(null)
let pressTimer: ReturnType<typeof setTimeout> | undefined
let suppressClick = false // 長按放開後瀏覽器還會補一個 click，不能讓它勾掉待辦
const offsetOf = (id: string) => {
  if (drag.value?.id === id && drag.value.horizontal) {
    const base = openId.value === id ? -DELETE_W : 0
    return Math.min(0, Math.max(-DELETE_W, base + drag.value.dx))
  }
  return openId.value === id ? -DELETE_W : 0
}
const onTouchStart = (id: string, e: TouchEvent) => {
  const t = e.touches[0]!
  if (openId.value && openId.value !== id) openId.value = null
  drag.value = { id, x0: t.clientX, y0: t.clientY, dx: 0, horizontal: null }
  clearTimeout(pressTimer)
  pressTimer = setTimeout(() => {
    if (drag.value && !drag.value.horizontal) { openId.value = id; suppressClick = true }
  }, 500)
}
const onTouchMove = (e: TouchEvent) => {
  const d = drag.value
  if (!d) return
  const t = e.touches[0]!
  const dx = t.clientX - d.x0
  const dy = t.clientY - d.y0
  if (d.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
    d.horizontal = Math.abs(dx) > Math.abs(dy)
    clearTimeout(pressTimer)
  }
  if (d.horizontal) d.dx = dx
}
const onTouchEnd = () => {
  clearTimeout(pressTimer)
  const d = drag.value
  if (d?.horizontal) openId.value = offsetOf(d.id) < -DELETE_W / 2 ? d.id : null
  drag.value = null
}
// 列開著時點內容＝收回，不觸發完成／星號
const onRowClickCapture = (id: string, e: MouseEvent) => {
  if (suppressClick || openId.value === id) {
    e.stopPropagation()
    e.preventDefault()
    if (!suppressClick) openId.value = null
    suppressClick = false
  }
}
const onDelete = async (id: string) => {
  openId.value = null
  await removeItem(id)
}

// 「＋」：有字就送出，沒字就把游標移到輸入框（使用者會先點＋再打字）
const onPlus = (e: Event) => {
  if (draft.value.trim()) submit(e)
  else inputEl.value?.focus()
}
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex items-center justify-between px-1">
      <h2 class="text-xs font-bold uppercase tracking-widest text-slate-500">家庭待辦</h2>
      <router-link v-if="list" to="/todo" class="min-h-[44px] flex items-center text-[13px] font-bold text-primary-700">
        全部 {{ openTotal }} 項 ›
      </router-link>
    </div>

    <router-link
      v-if="loaded && !hasFamily"
      to="/settings?view=family"
      class="flex items-center justify-between bg-white rounded-[20px] px-4 min-h-[56px] text-[15px] font-bold text-primary-700"
    >
      先建立或加入家庭
      <ChevronRight class="w-5 h-5 text-slate-400" aria-hidden="true" />
    </router-link>

    <button
      v-else-if="loadFailed"
      type="button"
      class="bg-white rounded-[20px] px-4 min-h-[56px] text-left text-[15px] font-bold text-primary-700"
      @click="load()"
    >載入失敗，點此重試</button>

    <div v-else-if="list" class="bg-white rounded-[20px] px-3">
      <p v-if="!shown.length" class="pt-3 px-1 text-[13px] text-slate-400">還沒有待辦</p>
      <ul>
        <li v-for="i in shown" :key="i.id" class="relative overflow-hidden border-b border-slate-100">
          <button
            type="button"
            :aria-label="`刪除：${i.text}`"
            :tabindex="openId === i.id ? 0 : -1"
            class="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 text-white text-[15px] font-bold"
            :style="{ width: `${DELETE_W}px` }"
            @click="onDelete(i.id)"
          >刪除</button>
          <div
            class="relative flex items-center bg-white select-none"
            :class="drag?.id === i.id ? '' : 'transition-transform duration-200'"
            :style="{ transform: `translateX(${offsetOf(i.id)}px)` }"
            @touchstart.passive="onTouchStart(i.id, $event)"
            @touchmove.passive="onTouchMove"
            @touchend="onTouchEnd"
            @touchcancel="onTouchEnd"
            @contextmenu.prevent
            @click.capture="onRowClickCapture(i.id, $event)"
          >
          <button
            type="button"
            :aria-label="`完成：${i.text}`"
            class="min-w-[44px] min-h-[48px] flex items-center justify-center"
            @click="toggle(i)"
          >
            <span class="w-[22px] h-[22px] rounded-full border-2 border-primary-300"></span>
          </button>
          <span class="flex-1 min-w-0 text-[15px] text-primary-900 break-words py-2">{{ i.text }}</span>
          <button
            type="button"
            :aria-pressed="i.important"
            :aria-label="`${i.important ? '取消重要' : '標為重要'}：${i.text}`"
            class="min-w-[44px] min-h-[48px] flex items-center justify-center"
            @click="toggleImportant(i)"
          >
            <Star class="w-5 h-5" :fill="i.important ? '#f59e0b' : 'none'" :stroke="i.important ? '#f59e0b' : '#cbd5e1'" aria-hidden="true" />
          </button>
          </div>
        </li>
      </ul>
      <form class="flex items-center" @submit.prevent>
        <button
          type="button"
          aria-label="加入待辦"
          class="min-w-[44px] min-h-[48px] flex items-center justify-center text-xl text-primary-700"
          @click="onPlus"
        >＋</button>
        <input
          ref="inputEl"
          v-model="draft"
          type="text"
          enterkeyhint="done"
          placeholder="新增待辦…"
          aria-label="新增待辦"
          class="flex-1 min-w-0 min-h-[48px] bg-transparent text-[15px] text-primary-900 placeholder:text-slate-400 outline-none"
          @keydown.enter.prevent="submit"
        />
        <button
          type="button"
          :aria-pressed="notifyOn"
          aria-label="通知家人"
          class="min-w-[44px] min-h-[48px] flex items-center justify-center"
          @click="notifyOn = !notifyOn"
        >
          <BellRing v-if="notifyOn" class="w-5 h-5" fill="#f59e0b" stroke="#f59e0b" aria-hidden="true" />
          <Bell v-else class="w-5 h-5" fill="none" stroke="#94a3b8" aria-hidden="true" />
        </button>
      </form>
    </div>
  </section>
</template>
