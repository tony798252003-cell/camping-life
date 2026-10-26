// 新增露營的「建議日期」：接下來幾個月內沒有安排的週末與連假（純函式，日期一律 YYYY-MM-DD 台北日期）。
import { addDays, eachDay, weekdayMon0 } from './dateRange'
import type { Holiday } from './holidays'
import type { ViewEvent } from './calendar/viewEvent'
import { PRACTICE_CATEGORY } from './calendar/monthLayout'

export interface DateSpan {
  start: string
  end: string
}

export interface TripDateCandidate extends DateSpan {
  days: number
  isLongWeekend: boolean // 連假（連續 ≥3 天不用上班）
  holidayName?: string // 連假的代表節日；全是「連假／補假」時沒有
}

const pad = (n: number) => String(n).padStart(2, '0')

// 同日往後 n 個月；目標月份沒有那一天就落在月底（1/31 + 1 月 → 2/28）
export function addMonths(ymd: string, n: number): string {
  const idx = Number(ymd.slice(0, 4)) * 12 + Number(ymd.slice(5, 7)) - 1 + n
  const y = Math.floor(idx / 12)
  const m = (idx % 12) + 1
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${y}-${pad(m)}-${pad(Math.min(Number(ymd.slice(8)), last))}`
}

// 「連假」「補假」只是附屬名稱，標籤要顯示真正的節日；春節各天統一叫春節
function representativeName(names: string[]): string | undefined {
  const name = names.find((n) => !/^(連假|補假)$/.test(n))
  return name && /^(小年夜|除夕|初.)$/.test(name) ? '春節' : name
}

export function suggestTripDates(i: {
  today: string
  months: number
  holidays: Holiday[]
  workdays?: string[] // 補班日（週六也要上班）；holidays.ts 目前沒有這類資料
  busy: DateSpan[]
}): TripDateCandidate[] {
  const holidayName = new Map(i.holidays.map((h) => [h.date, h.name]))
  const workdays = new Set(i.workdays ?? [])
  const isOff = (d: string) => !workdays.has(d) && (holidayName.has(d) || weekdayMon0(d) >= 5)
  const windowEnd = addMonths(i.today, i.months)

  // 前後多掃兩週，確保邊界上的連假是完整的一段（今天在連假中間時，那段起始日在今天之前會被濾掉）
  const stretches: string[][] = []
  let cur: string[] = []
  for (const d of eachDay(addDays(i.today, -14), addDays(windowEnd, 14))) {
    if (isOff(d)) {
      cur.push(d)
    } else if (cur.length) {
      stretches.push(cur)
      cur = []
    }
  }
  if (cur.length) stretches.push(cur)

  const overlaps = (s: DateSpan, c: DateSpan) => s.start <= c.end && s.end >= c.start
  const out: TripDateCandidate[] = []
  for (const days of stretches) {
    // 只有一天的假（週間單日假、週六補班剩週日）無法過夜，不建議
    if (days.length < 2) continue
    const c: DateSpan = { start: days[0]!, end: days[days.length - 1]! }
    if (c.start < i.today || c.start > windowEnd) continue
    if (i.busy.some((b) => overlaps(b, c))) continue
    const isLongWeekend = days.length >= 3
    const cand: TripDateCandidate = { ...c, days: days.length, isLongWeekend }
    if (isLongWeekend) {
      const name = representativeName(days.map((d) => holidayName.get(d)).filter((n): n is string => !!n))
      if (name) cand.holidayName = name
    }
    out.push(cand)
  }
  return out
}

// 會擋掉建議日期的安排：露營行程（feed 已排除取消／合併，且夜衝從前一晚算起）、全家事件、「練球」分類（不論可見性）。
// 只有「我」的個人事件、桃猿賽程不算。編輯中的那趟行程本身要忽略，否則永遠建議不到它原本的日期。
export function busySpans(feed: ViewEvent[], ignoreTripId?: number | null): DateSpan[] {
  return feed
    .filter((e) => {
      if (e.source === 'trip') return ignoreTripId == null || e.sourceId !== ignoreTripId
      if (e.source === 'event') return e.owner === 'family' || e.categoryName === PRACTICE_CATEGORY
      return false
    })
    .map((e) => ({ start: e.startDate, end: e.endDate }))
}

const WEEK = ['一', '二', '三', '四', '五', '六', '日']
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}（${WEEK[weekdayMon0(d)]}）`

// 「11/14（六）–11/15（日）・2天1夜」
export const candidateLabel = (c: TripDateCandidate) => `${md(c.start)}–${md(c.end)}・${c.days}天${c.days - 1}夜`

// 「連假・國慶日」；週末沒有標籤
export const candidateTag = (c: TripDateCandidate) =>
  c.isLongWeekend ? (c.holidayName ? `連假・${c.holidayName}` : '連假') : null

// 營區開放訂位只到 bookable_until；出發日比它晚表示還訂不到
export const isNotYetBookable = (bookableUntil: string | null | undefined, start: string) =>
  !!bookableUntil && bookableUntil < start
