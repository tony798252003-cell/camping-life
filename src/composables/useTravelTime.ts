import { ref } from 'vue'

// 預設起點 (桃園大園)
export const DEFAULT_ORIGIN = {
    lat: 25.0621,
    lng: 121.1963
}

// 台灣國定假日與連假（2026年）
const HOLIDAYS_2026 = [
    '2026-01-01', // 元旦
    '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02', // 春節
    '2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06', // 清明連假
    '2026-06-19', '2026-06-20', '2026-06-21', // 端午連假
    '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', // 中秋連假
    '2026-10-09', '2026-10-10', '2026-10-11' // 國慶連假
]

// 簡易路線快取（避免短時間內重複查詢）
interface RouteCache {
    key: string
    duration: number
    distance?: number
    timestamp: number
}
const routeCache = new Map<string, RouteCache>()
const CACHE_TTL = 10 * 60 * 1000 // 10 分鐘快取

// 判斷是否為節假日或連假
const isHoliday = (date: Date): boolean => {
    const dateStr = date.toISOString().split('T')[0]
    return HOLIDAYS_2026.includes(dateStr)
}

// 計算兩點間的直線距離（km）
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371 // 地球半徑（公里）
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

// 增強版智慧路況權重演算
export const getSmartTrafficWeight = (distanceKm?: number) => {
    const now = new Date()
    const hour = now.getHours()
    const minute = now.getMinutes()
    const day = now.getDay() // 0: 週日, 6: 週六
    const isHolidayToday = isHoliday(now)

    let weight = 1.12 // 基礎補償（略微降低，因為後續會更精細）

    // === 1. 時段基礎權重 ===
    const isWeekday = day >= 1 && day <= 5

    if (isWeekday && !isHolidayToday) {
        // 平日通勤尖峰（更細緻的時段劃分）
        if (hour === 7 || (hour === 8 && minute < 30)) {
            weight = 1.55 // 早高峰前段（7:00-8:30）最塞
        } else if ((hour === 8 && minute >= 30) || hour === 9) {
            weight = 1.40 // 早高峰後段（8:30-10:00）
        } else if (hour >= 17 && hour < 18) {
            weight = 1.60 // 晚高峰前段（17:00-18:00）嚴重塞車
        } else if (hour >= 18 && hour < 20) {
            weight = 1.45 // 晚高峰後段（18:00-20:00）
        } else if (hour >= 10 && hour < 17) {
            weight = 1.20 // 一般日間車流
        } else if (hour >= 6 && hour < 7) {
            weight = 1.15 // 早晨漸增
        } else if (hour >= 20 && hour < 23) {
            weight = 1.15 // 晚間漸緩
        }
    }

    // === 2. 露營尖峰時段（台灣特性）===
    if (day === 5) {
        // 週五
        if (hour >= 16 && hour < 19) {
            weight = Math.max(weight, 1.50) // 週五下班出發潮
        } else if (hour >= 19 && hour < 22) {
            weight = Math.max(weight, 1.35)
        }
    } else if (day === 6) {
        // 週六
        if (hour >= 7 && hour < 11) {
            weight = Math.max(weight, 1.40) // 週六早晨出發潮
        } else if (hour >= 11 && hour < 15) {
            weight = Math.max(weight, 1.25)
        }
    } else if (day === 0) {
        // 週日
        if (hour >= 14 && hour < 18) {
            weight = Math.max(weight, 1.65) // 週日下午回程大塞（國道最慘烈）
        } else if (hour >= 18 && hour < 21) {
            weight = Math.max(weight, 1.50)
        }
    }

    // === 3. 深夜時段 ===
    if (hour >= 23 || hour < 6) {
        weight = 1.08 // 路況順暢，僅保留基本緩衝
    }

    // === 4. 連假加成 ===
    if (isHolidayToday || (day === 6 || day === 0)) {
        // 連假或週末塞車更嚴重
        if (hour >= 8 && hour < 12) {
            weight *= 1.12 // 上午出發潮再加成 12%
        } else if (hour >= 15 && hour < 20) {
            weight *= 1.15 // 下午回程潮再加成 15%
        }
    }

    // === 5. 距離因素（短途紅綠燈影響大，長途高速影響大）===
    if (distanceKm) {
        if (distanceKm < 30) {
            // 短途（< 30km）：紅綠燈與市區車流影響大
            weight *= 1.08
        } else if (distanceKm > 100) {
            // 長途（> 100km）：高速公路塞車影響更嚴重
            if (hour >= 7 && hour < 20) {
                weight *= 1.05
            }
        }
    }

    // 限制最大與最小權重
    return Math.min(Math.max(weight, 1.05), 1.80)
}

export function useTravelTime() {
    const travelTime = ref<string | null>(null)
    const loading = ref(false)

    const fetchTravelTime = async (
        destLat: number,
        destLon: number,
        startLat?: number,
        startLon?: number
    ) => {
        if (!destLat || !destLon) {
            travelTime.value = null
            return
        }

        loading.value = true

        try {
            // === 1. 確定起點座標 ===
            let sLat = startLat
            let sLon = startLon

            if (!sLat || !sLon) {
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            timeout: 3000,
                            enableHighAccuracy: false // 降低精度但加快速度
                        })
                    })
                    sLat = position.coords.latitude
                    sLon = position.coords.longitude
                } catch (e) {
                    // 定位失敗，使用預設起點
                    sLat = DEFAULT_ORIGIN.lat
                    sLon = DEFAULT_ORIGIN.lng
                }
            }

            // === 2. 檢查快取 ===
            const cacheKey = `${sLat.toFixed(4)},${sLon.toFixed(4)}-${destLat.toFixed(4)},${destLon.toFixed(4)}`
            const cached = routeCache.get(cacheKey)
            const now = Date.now()

            let baseDuration: number
            let distance: number | undefined

            if (cached && (now - cached.timestamp) < CACHE_TTL) {
                // 使用快取
                baseDuration = cached.duration
                distance = cached.distance
            } else {
                // === 3. 呼叫 OSRM API ===
                const url = `https://router.project-osrm.org/route/v1/driving/${sLon},${sLat};${destLon},${destLat}?overview=false`
                const response = await fetch(url)

                if (!response.ok) {
                    throw new Error(`OSRM API error: ${response.status}`)
                }

                const data = await response.json()

                if (!data.routes || data.routes.length === 0) {
                    throw new Error('No route found')
                }

                baseDuration = data.routes[0].duration
                distance = data.routes[0].distance ? data.routes[0].distance / 1000 : undefined // 轉換為公里

                // 存入快取
                routeCache.set(cacheKey, {
                    key: cacheKey,
                    duration: baseDuration,
                    distance,
                    timestamp: now
                })

                // 清理過期快取（最多保留 50 條）
                if (routeCache.size > 50) {
                    const entries = Array.from(routeCache.entries())
                    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
                    entries.slice(0, 10).forEach(([key]) => routeCache.delete(key))
                }
            }

            // === 4. 計算直線距離（用於權重調整）===
            if (!distance) {
                distance = getDistance(sLat, sLon, destLat, destLon)
            }

            // === 5. 智慧加權 ===
            const weight = getSmartTrafficWeight(distance)

            // 基礎緩衝時間（紅綠燈、收費站等）
            const baseBuffer = distance < 50 ? 8 * 60 : 12 * 60 // 短途 8 分鐘，長途 12 分鐘

            const durationSeconds = Math.round((baseDuration * weight) + baseBuffer)

            // === 6. 格式化輸出 ===
            const hours = Math.floor(durationSeconds / 3600)
            const minutes = Math.round((durationSeconds % 3600) / 60)

            if (hours > 0) {
                travelTime.value = `${hours} 小時 ${minutes} 分`
            } else {
                travelTime.value = `${minutes} 分鐘`
            }

        } catch (e) {
            console.error('Failed to fetch travel time:', e)
            travelTime.value = null
        } finally {
            loading.value = false
        }
    }

    return {
        travelTime,
        loading,
        fetchTravelTime
    }
}
