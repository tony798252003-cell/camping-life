import { onBeforeUnmount, onMounted, type Ref } from 'vue'

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

// 在 target 上左右滑動換期間；listener 一律 passive，不擋垂直捲動
export function useHorizontalSwipe(target: Ref<HTMLElement | null>, onSwipe: (dir: 1 | -1) => void) {
  let start: { x: number; y: number; t: number } | null = null

  const onStart = (e: TouchEvent) => {
    const t = e.touches[0]
    start = e.touches.length === 1 && t && !insideNoSwipe(e.target, target.value!) ? { x: t.clientX, y: t.clientY, t: Date.now() } : null
  }
  const onEnd = (e: TouchEvent) => {
    const t = e.changedTouches[0]
    if (!start || !t) return
    const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y, Date.now() - start.t)
    start = null
    if (dir) onSwipe(dir)
  }
  const onCancel = () => (start = null)

  let el: HTMLElement | null = null
  onMounted(() => {
    el = target.value
    el?.addEventListener('touchstart', onStart, { passive: true })
    el?.addEventListener('touchend', onEnd, { passive: true })
    el?.addEventListener('touchcancel', onCancel, { passive: true })
  })
  onBeforeUnmount(() => {
    el?.removeEventListener('touchstart', onStart)
    el?.removeEventListener('touchend', onEnd)
    el?.removeEventListener('touchcancel', onCancel)
  })
}
