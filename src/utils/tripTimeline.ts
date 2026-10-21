import { diffDays } from './dateRange'

// 行程列表（時間軸）用的純函式：日期一律 YYYY-MM-DD（Asia/Taipei），不依賴系統時區。
export interface TimelineTrip {
  id: number
  trip_date: string
  duration_days: number | null
  campsite_name?: string | null
  campsites?: { id?: number | null; name?: string | null; city?: string | null; district?: string | null } | null
}

const ymd = (t: TimelineTrip) => t.trip_date.slice(0, 10)
const yearOf = (t: TimelineTrip) => Number(ymd(t).slice(0, 4))

// 幾晚 = 天數 - 1，最少 0（單日行程不算過夜）
export const tripNights = (t: TimelineTrip) => Math.max(0, (t.duration_days ?? 1) - 1)

// 今天出發算「即將出發」（>= today），昨天以前算已去過
export const isUpcoming = (t: TimelineTrip, today: string) => ymd(t) >= today

export function upcomingBadge(t: TimelineTrip, today: string): string {
  const n = diffDays(today, ymd(t))
  return n <= 0 ? '今天' : `${n} 天後`
}

export function tripYears(trips: TimelineTrip[]): number[] {
  return [...new Set(trips.map(yearOf))].sort((a, b) => b - a)
}

const campsiteKey = (t: TimelineTrip) => t.campsites?.id ?? t.campsite_name ?? `trip-${t.id}`

export interface YearSummary {
  trips: number
  nights: number
  campsites: number
  monthly: number[] // 長度 12，index 0 = 1 月
}

export function summarizeYear(trips: TimelineTrip[], year: number): YearSummary {
  const inYear = trips.filter((t) => yearOf(t) === year)
  const monthly = Array<number>(12).fill(0)
  for (const t of inYear) monthly[Number(ymd(t).slice(5, 7)) - 1]!++
  return {
    trips: inYear.length,
    nights: inYear.reduce((s, t) => s + tripNights(t), 0),
    campsites: new Set(inYear.map(campsiteKey)).size,
    monthly,
  }
}

export function searchTrips<T extends TimelineTrip>(trips: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return trips
  return trips.filter((t) =>
    [t.campsites?.name ?? t.campsite_name, t.campsites?.city, t.campsites?.district]
      .some((s) => s?.toLowerCase().includes(q)),
  )
}

export interface TimelineGroup<T> {
  key: string
  label: string
  upcoming: boolean
  meta: string
  trips: T[]
}

// 即將出發（日期由近到遠）在最上面，之後已去過依年份由新到舊、年內也由新到舊
export function groupTimeline<T extends TimelineTrip>(trips: T[], today: string): TimelineGroup<T>[] {
  const byDate = (a: T, b: T) => ymd(a).localeCompare(ymd(b)) || a.id - b.id
  const upcoming = trips.filter((t) => isUpcoming(t, today)).sort(byDate)
  const groups: TimelineGroup<T>[] = []
  if (upcoming.length) {
    groups.push({ key: 'upcoming', label: '即將出發', upcoming: true, meta: `${upcoming.length} 趟`, trips: upcoming })
  }
  const past = trips.filter((t) => !isUpcoming(t, today)).sort((a, b) => byDate(b, a))
  for (const y of new Set(past.map(yearOf))) {
    const list = past.filter((t) => yearOf(t) === y)
    const nights = list.reduce((s, t) => s + tripNights(t), 0)
    groups.push({ key: String(y), label: String(y), upcoming: false, meta: `${list.length} 趟 · ${nights} 晚`, trips: list })
  }
  return groups
}
