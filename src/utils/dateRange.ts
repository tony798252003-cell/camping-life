// 日期工具：時區一律 Asia/Taipei，日期字串 YYYY-MM-DD，不依賴系統 TZ。

const TAIPEI = 'Asia/Taipei'
const ymdFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TAIPEI, year: 'numeric', month: '2-digit', day: '2-digit',
})
const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TAIPEI, hourCycle: 'h23', hour: '2-digit', minute: '2-digit',
})

const toDate = (d: Date | string) => (typeof d === 'string' ? new Date(d) : d)
const utcMs = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d)
}
const fromUtcMs = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function taipeiYmd(d: Date | string): string {
  return ymdFmt.format(toDate(d))
}

export function taipeiMinutes(d: Date | string): number {
  const parts = timeFmt.formatToParts(toDate(d))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return get('hour') * 60 + get('minute')
}

export function todayYmd(now: Date = new Date()): string {
  return taipeiYmd(now)
}

export function addDays(ymd: string, n: number): string {
  return fromUtcMs(utcMs(ymd) + n * 86400000)
}

export function diffDays(a: string, b: string): number {
  return Math.round((utcMs(b) - utcMs(a)) / 86400000)
}

export function eachDay(start: string, end: string): string[] {
  const out: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

export function weekdayMon0(ymd: string): number {
  return (new Date(utcMs(ymd)).getUTCDay() + 6) % 7
}

export function taipeiIso(ymd: string, hhmm: string): string {
  return `${ymd}T${hhmm}:00+08:00`
}

export function tripRange(trip_date: string, duration_days: number | null): { start: string; end: string } {
  const days = duration_days != null && duration_days > 0 ? duration_days : 1
  return { start: trip_date, end: addDays(trip_date, days - 1) }
}
