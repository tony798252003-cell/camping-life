import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

const MIN_DX = 50
const MAX_MS = 600

// 左滑 = 1（下一段）、右滑 = -1（上一段）；不夠遠、太斜（偏垂直捲動）或太慢都不算
export function swipeDirection(dx: number, dy: number, ms: number): 1 | -1 | null {
  if (ms >= MAX_MS || Math.abs(dx) < MIN_DX || Math.abs(dx) <= 1.5 * Math.abs(dy)) return null
  return dx < 0 ? 1 : -1
}

// 輪播（SwipePager）放手時決定換頁：快速一滑沿用 swipeDirection；慢慢拖但超過寬度 1/3 也算；其餘彈回（0）
export function pagerDecision(dx: number, dy: number, ms: number, width: number): 1 | -1 | 0 {
  if (Math.abs(dx) <= Math.abs(dy)) return 0
  const dir = swipeDirection(dx, dy, ms)
  if (dir) return dir
  return width > 0 && Math.abs(dx) >= width / 3 ? (dx < 0 ? 1 : -1) : 0
}

// 從 start 往上到 root：標了 data-no-swipe 或本身可左右捲動的元素，滑動留給它自己
export function insideNoSwipe(start: EventTarget | null, root: HTMLElement): boolean {
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

export const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const SLIDE_MS = 200 // 換頁動畫：舊內容整個滑出、新內容從另一邊整個滑入，各 200ms
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 在 target 上左右滑動換期間；listener 一律 passive，不擋垂直捲動（外層要 overflow-hidden 裁切、target 要 touch-action: pan-y）
// 動畫：拖曳時跟手移動；換頁時舊內容往滑的方向整個滑出、換內容、新內容從反方向滑入；不夠遠就彈回；不改透明度避免閃爍
// onSwipe 可回傳 Promise（例如 router.replace），等它完成才滑入新內容
export function useHorizontalSwipe(target: Ref<HTMLElement | null>, onSwipe: (dir: 1 | -1) => unknown) {
  let start: { x: number; y: number; t: number } | null = null
  let busy = false

  const setX = (x: string, animate: boolean) => {
    const el = target.value
    if (!el) return
    el.style.transition = animate ? `transform ${SLIDE_MS}ms ease-out` : 'none'
    el.style.transform = x ? `translateX(${x})` : ''
  }

  const onStart = (e: TouchEvent) => {
    const t = e.touches[0]
    start = !busy && e.touches.length === 1 && t && !insideNoSwipe(e.target, target.value!) ? { x: t.clientX, y: t.clientY, t: Date.now() } : null
  }
  const onMove = (e: TouchEvent) => {
    const t = e.touches[0]
    if (!start || !t || reduceMotion()) return
    const x = dragOffset(t.clientX - start.x, t.clientY - start.y)
    setX(x ? `${x}px` : '', false)
  }
  const onEnd = async (e: TouchEvent) => {
    const t = e.changedTouches[0]
    if (!start || !t) return
    const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y, Date.now() - start.t)
    start = null
    if (!dir) return setX('', true)
    if (reduceMotion()) return onSwipe(dir)
    busy = true
    try {
      setX(`${-dir * 100}%`, true)
      await wait(SLIDE_MS)
      await onSwipe(dir)
      await nextTick()
      setX(`${dir * 100}%`, false)
      target.value?.getBoundingClientRect() // 強制套用起點，下一步的 transition 才會從這裡開始
      setX('', true)
      await wait(SLIDE_MS)
    } finally {
      busy = false
    }
  }
  const onCancel = () => {
    if (!start) return
    start = null
    setX('', true)
  }

  // target 可能被 v-if 切換（例如行事曆月檢視改用 SwipePager），跟著元素掛／拆 listener
  const detach = (el: HTMLElement) => {
    el.removeEventListener('touchstart', onStart)
    el.removeEventListener('touchmove', onMove)
    el.removeEventListener('touchend', onEnd)
    el.removeEventListener('touchcancel', onCancel)
  }
  watch(
    target,
    (el, old) => {
      if (old) detach(old)
      el?.addEventListener('touchstart', onStart, { passive: true })
      el?.addEventListener('touchmove', onMove, { passive: true })
      el?.addEventListener('touchend', onEnd, { passive: true })
      el?.addEventListener('touchcancel', onCancel, { passive: true })
    },
    { immediate: true, flush: 'post' },
  )
  onBeforeUnmount(() => {
    if (target.value) detach(target.value)
  })
}
