import { addDays, tripRange } from './dateRange'

export interface TripLike {
  id: number
  trip_date: string
  duration_days: number | null
  status: string | null
  night_rush: boolean | null
  merged_into_id?: number | null
}

export const isActiveTrip = (t: TripLike) => t.status !== 'cancelled' && t.merged_into_id == null

// 夜衝的行程前一晚出發，起始日 = trip_date - 1
export function tripStart(t: TripLike): string {
  return t.night_rush ? addDays(t.trip_date, -1) : t.trip_date
}

// 優先順序：今晚要夜衝出發 > 進行中 > 未來最近的；同層以起始日、id 小的優先
export function pickNextTrip<T extends TripLike>(trips: T[], today: string): T | null {
  const ranked = trips
    .filter(isActiveTrip)
    .map((t) => ({ t, start: tripStart(t), end: tripRange(t.trip_date, t.duration_days).end }))
    .filter((x) => x.end >= today)
    .map((x) => {
      const tier = x.t.night_rush && x.t.trip_date > today && x.start <= today ? 0 : x.start <= today ? 1 : 2
      return { ...x, tier }
    })
    .sort((a, b) => a.tier - b.tier || a.start.localeCompare(b.start) || a.t.id - b.t.id)
  return ranked[0]?.t ?? null
}

// 首頁卡片左右翻看的清單：與行事曆同一套規則（排除取消、已合併），依日期、id 排序讓順序不隨回傳順序跳動
export function browseableTrips<T extends TripLike>(trips: T[]): T[] {
  return trips.filter(isActiveTrip).sort((a, b) => a.trip_date.localeCompare(b.trip_date) || a.id - b.id)
}

// 預設顯示的位置：和 pickNextTrip 同一趟；全部都過去了就停在最近的一趟；沒有行程回 -1
export function defaultTripIndex<T extends TripLike>(list: T[], today: string): number {
  const next = pickNextTrip(list, today)
  if (next) return list.findIndex((t) => t.id === next.id)
  return list.length - 1
}
