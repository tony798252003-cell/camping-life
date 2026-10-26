<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { insideNoSwipe, pagerDecision, reduceMotion } from '../../composables/useHorizontalSwipe'

// 三格輪播：上一段／這段／下一段並排，手指判定為水平後 1:1 跟手；放手換頁或彈回
// period：目前期間的識別（例如 "2026-10"）。換頁時先 emit change，等 period 真的變了、畫面重畫完，才把軌道無動畫歸位，
// 這時新的中間格內容 = 剛剛滑進來的鄰格，所以看不出跳動
const props = defineProps<{ period: string | number }>()
const emit = defineEmits<{ (e: 'change', dir: 1 | -1): void }>()
defineSlots<{ default(props: { offset: -1 | 0 | 1 }): unknown }>()

const OFFSETS = [-1, 0, 1] as const
const CENTER = '-33.3333%'
const EASE = 'transform 250ms cubic-bezier(.2,.8,.2,1)'
const AXIS_SLOP = 8 // 移動超過 8px 才判定方向（水平跟手／垂直交給捲動）

const root = ref<HTMLElement | null>(null)
const track = ref<HTMLElement | null>(null)

let start: { x: number; y: number; t: number } | null = null
let axis: 'x' | 'y' | null = null
let dx = 0
let busy = false // 動畫中或等待父層換期間，不接新手勢
let dragged = false // 剛水平拖過：吃掉接著來的 click，避免放手時誤點日期格
let fallback: ReturnType<typeof setTimeout> | undefined

const setTrack = (x: string, animate: boolean) => {
  const el = track.value
  if (!el) return
  el.style.transition = animate ? EASE : 'none'
  el.style.transform = `translateX(${x})`
}

// 父層換完期間（DOM 已更新、還沒繪製）→ 同一幀把軌道拉回中間
const settle = () => {
  clearTimeout(fallback)
  setTrack(CENTER, false)
  busy = false
}
watch(
  () => props.period,
  () => {
    if (busy) settle()
  },
  { flush: 'post' },
)

const commit = (dir: 1 | -1) => {
  busy = true
  // 保險：父層沒換期間（例如被擋下）也要歸位解鎖
  const emitAndWait = () => {
    fallback = setTimeout(settle, 600)
    emit('change', dir)
  }
  if (reduceMotion()) return emitAndWait()
  const el = track.value
  if (!el) return emitAndWait()
  let done = false
  const onDone = () => {
    if (done) return
    done = true
    el.removeEventListener('transitionend', onEnd)
    emitAndWait()
  }
  const onEnd = (e: TransitionEvent) => {
    if (e.target === el && e.propertyName === 'transform') onDone()
  }
  el.addEventListener('transitionend', onEnd)
  setTimeout(onDone, 350) // transitionend 沒來（例如分頁被切到背景）也要繼續
  setTrack(dir === 1 ? '-66.6667%' : '0%', true)
}

const onStart = (e: TouchEvent) => {
  const t = e.touches[0]
  axis = null
  dx = 0
  dragged = false
  start = !busy && e.touches.length === 1 && t && !insideNoSwipe(e.target, root.value!) ? { x: t.clientX, y: t.clientY, t: Date.now() } : null
}
const onMove = (e: TouchEvent) => {
  const t = e.touches[0]
  if (!start || !t) return
  const mx = t.clientX - start.x
  const my = t.clientY - start.y
  if (!axis) {
    if (Math.max(Math.abs(mx), Math.abs(my)) <= AXIS_SLOP) return
    axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
  }
  if (axis === 'y') return // 判定為垂直捲動，這次手勢剩下的都不管
  dx = mx
  dragged = true
  if (!reduceMotion()) setTrack(`calc(${CENTER} + ${dx}px)`, false)
}
const onEnd = (e: TouchEvent) => {
  const t = e.changedTouches[0]
  const s = start
  start = null
  if (!s || !t || axis !== 'x') return
  const dir = pagerDecision(t.clientX - s.x, t.clientY - s.y, Date.now() - s.t, root.value?.clientWidth ?? 0)
  if (dir) commit(dir)
  else setTrack(CENTER, true)
}
const onCancel = () => {
  const wasDragging = start && axis === 'x'
  start = null
  if (wasDragging) setTrack(CENTER, true)
}
const onClickCapture = (e: MouseEvent) => {
  if (!dragged) return
  dragged = false
  e.stopPropagation()
  e.preventDefault()
}

onBeforeUnmount(() => clearTimeout(fallback))
</script>

<template>
  <div
    ref="root"
    class="overflow-hidden"
    style="touch-action: pan-y"
    @touchstart.passive="onStart"
    @touchmove.passive="onMove"
    @touchend.passive="onEnd"
    @touchcancel.passive="onCancel"
    @click.capture="onClickCapture"
  >
    <div ref="track" class="flex items-start" style="width: 300%; transform: translateX(-33.3333%)">
      <!-- 鄰格高度設 0（內容照樣溢出顯示），外框高度只跟著中間格；鄰格不可聚焦、讀屏略過 -->
      <div
        v-for="o in OFFSETS"
        :key="o"
        class="w-1/3 shrink-0"
        :class="o === 0 ? '' : 'h-0'"
        :data-pager-current="o === 0 ? '' : undefined"
        :inert="o !== 0"
        :aria-hidden="o !== 0 ? 'true' : undefined"
      >
        <slot :offset="o" />
      </div>
    </div>
  </div>
</template>
