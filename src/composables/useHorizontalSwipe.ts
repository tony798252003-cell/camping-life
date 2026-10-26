import { nextTick, onBeforeUnmount, onMounted, type Ref } from 'vue'

const MIN_DX = 50
const MAX_MS = 600

// 左滑 = 1（下一段）、右滑 = -1（上一段）；不夠遠、太斜（偏垂直捲動）或太慢都不算
export function swipeDirection(dx: number, dy: number, ms: number): 1 | -1 | null {
  if (ms >= MAX_MS || Math.abs(dx) < MIN_DX || Math.abs(dx) <= 1.5 * Math.abs(dy)) return null
  return dx < 0 ? 1 : -1
}

// 從 start 往上到 root：標了 data-no-swipe 或本身可左右捲動的元素，滑動留給它自己
function insideNoSwipe(start: EventTarget | null, root: HTMLElement): boolean {
  for (let el = start instanceof Element ? start : null; el && el !== root.parentElement; el = el.parentElement) {
    if (el instanceof HTMLElement && el.dataset.noSwipe !== undefined) return true
    if (el.scrollWidth > el.clientWidth && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) return true
  }
  return false
}

// 拖曳中畫面跟手的位移：打七折，避免一滑就整片飛走
export function dragOffset(dx: number, dy: number): number {
  return Math.abs(dx) > Math.abs(dy) ? Math.round(dx * 0.7) : 0
}

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const SLIDE = 60 // 換頁動畫：舊的滑出、新的從另一邊滑入的距離（px）

// 在 target 上左右滑動換期間；listener 一律 passive，不擋垂直捲動
// 動畫：拖曳時跟手移動；換頁時舊內容往滑的方向淡出、新內容從反方向滑入；不夠遠就彈回
export function useHorizontalSwipe(target: Ref<HTMLElement | null>, onSwipe: (dir: 1 | -1) => void) {
  let start: { x: number; y: number; t: number } | null = null

  const setX = (x: number, animate: boolean) => {
    const el = target.value
    if (!el) return
    el.style.transition = animate ? 'transform 180ms ease-out, opacity 180ms ease-out' : 'none'
    el.style.transform = x ? `translateX(${x}px)` : ''
    el.style.opacity = x ? String(Math.max(0.4, 1 - Math.abs(x) / 400)) : ''
  }

  const onStart = (e: TouchEvent) => {
    const t = e.touches[0]
    start = e.touches.length === 1 && t && !insideNoSwipe(e.target, target.value!) ? { x: t.clientX, y: t.clientY, t: Date.now() } : null
  }
  const onMove = (e: TouchEvent) => {
    const t = e.touches[0]
    if (!start || !t || reduceMotion()) return
    setX(dragOffset(t.clientX - start.x, t.clientY - start.y), false)
  }
  const onEnd = async (e: TouchEvent) => {
    const t = e.changedTouches[0]
    if (!start || !t) return
    const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y, Date.now() - start.t)
    start = null
    if (!dir) return setX(0, true)
    if (reduceMotion()) return onSwipe(dir)
    setX(-dir * SLIDE, true)
    await new Promise((r) => setTimeout(r, 120))
    onSwipe(dir)
    await nextTick()
    setX(dir * SLIDE, false)
    target.value?.getBoundingClientRect() // 強制套用起點，下一步的 transition 才會從這裡開始
    setX(0, true)
  }
  const onCancel = () => {
    start = null
    setX(0, true)
  }

  let el: HTMLElement | null = null
  onMounted(() => {
    el = target.value
    el?.addEventListener('touchstart', onStart, { passive: true })
    el?.addEventListener('touchmove', onMove, { passive: true })
    el?.addEventListener('touchend', onEnd, { passive: true })
    el?.addEventListener('touchcancel', onCancel, { passive: true })
  })
  onBeforeUnmount(() => {
    el?.removeEventListener('touchstart', onStart)
    el?.removeEventListener('touchmove', onMove)
    el?.removeEventListener('touchend', onEnd)
    el?.removeEventListener('touchcancel', onCancel)
  })
}
