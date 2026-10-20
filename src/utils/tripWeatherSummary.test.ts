import { describe, it, expect } from 'vitest'
import { summarizeTripWeather } from './tripWeatherSummary'

const d = (tempMin: number, tempMax: number, maxPop = 0, nightLow: number | null = null) => ({ tempMin, tempMax, maxPop, nightLow })

describe('summarizeTripWeather', () => {
  it('沒有預報回 null', () => {
    // 預報尚未開放時卡片要顯示占位，不能顯示 Infinity
    expect(summarizeTripWeather([])).toBeNull()
  })
  it('跨整趟取最低與最高溫', () => {
    // 兩天行程只看第一天會漏掉第二天的低溫，影響帶多少保暖衣物
    expect(summarizeTripWeather([d(12, 19), d(9, 17)])).toMatchObject({ min: 9, max: 19 })
  })
  it('任何一晚低於 10°C 就標冷，剛好 10 不算', () => {
    // 門檻與舊卡一致；只有「低於」才警告，避免邊界天天跳警示
    expect(summarizeTripWeather([d(12, 19, 0, 15), d(9, 17, 0, 9)])!.cold).toBe(true)
    expect(summarizeTripWeather([d(12, 19, 0, 10)])!.cold).toBe(false)
    expect(summarizeTripWeather([d(12, 19, 0, null)])!.cold).toBe(false)
  })
  it('任何一天降雨機率達 30% 就標雨', () => {
    // 與天氣圖示的雨天門檻一致，卡片和日檢視不會互相矛盾
    expect(summarizeTripWeather([d(12, 19, 10), d(12, 19, 30)])!.rainy).toBe(true)
    expect(summarizeTripWeather([d(12, 19, 29)])!.rainy).toBe(false)
  })
})
