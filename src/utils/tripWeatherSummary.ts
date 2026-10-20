// 露營卡「天氣」格：把整趟行程的每日預報濃縮成 最低–最高溫 + 風險旗標。
export const COLD_NIGHT_C = 10
export const RAIN_POP = 30 // 與 getSmartWeatherIcon 顯示雨天圖示的門檻一致

export interface DayInput {
  tempMin: number
  tempMax: number
  maxPop: number
  nightLow: number | null // 夜間最低溫（已海拔校正），沒資料為 null
}

export interface TripWeatherSummary {
  min: number
  max: number
  cold: boolean
  rainy: boolean
}

export function summarizeTripWeather(days: DayInput[]): TripWeatherSummary | null {
  if (days.length === 0) return null
  return {
    min: Math.min(...days.map((d) => d.tempMin)),
    max: Math.max(...days.map((d) => d.tempMax)),
    cold: days.some((d) => d.nightLow != null && d.nightLow < COLD_NIGHT_C),
    rainy: days.some((d) => d.maxPop >= RAIN_POP),
  }
}
