// 台灣本島＋離島（澎湖、金門、馬祖、蘭嶼、綠島）的寬鬆外框；只用來攔明顯打錯的座標，不是精確國界。
const LAT_MIN = 21.5
const LAT_MAX = 26.5
const LNG_MIN = 118.0
const LNG_MAX = 122.5

// 沒有座標（null/undefined/NaN）不算錯，由別處決定是否必填
export function isLikelyInTaiwan(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return true
  return lat >= LAT_MIN && lat <= LAT_MAX && lng >= LNG_MIN && lng <= LNG_MAX
}
