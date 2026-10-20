// 天氣海拔校正（規格 §5.11，§14 Q7）：約每升高 1000 m 降 6°C
export const LAPSE_RATE_C_PER_M = 0.006

// 任一海拔為 null 時原值回傳（不能憑空校正）
export function correctTemp(tempC: number, siteAltitudeM: number | null, gridElevationM: number | null): number {
  if (siteAltitudeM == null || gridElevationM == null) return tempC
  return tempC - LAPSE_RATE_C_PER_M * (siteAltitudeM - gridElevationM)
}

export function isAltitudeCorrected(siteAltitudeM: number | null, gridElevationM: number | null): boolean {
  return siteAltitudeM != null && gridElevationM != null
}
