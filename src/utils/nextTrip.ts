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
