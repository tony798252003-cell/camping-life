import { todayYmd } from './dateRange'

// 新增行程或尚未出發（出發日 > 今天，台北）時收合評價區；出發當天起展開
export function shouldCollapseReview(tripDate: string | null | undefined, isNew: boolean, now: Date = new Date()): boolean {
  if (isNew) return true
  if (!tripDate) return false
  return tripDate > todayYmd(now)
}
