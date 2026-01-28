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

// Initialize cache from localStorage
const CACHE_KEY_STORAGE = 'camping_route_cache'
let routeCache = new Map<string, RouteCache>()
try {
    const stored = localStorage.getItem(CACHE_KEY_STORAGE)
    if (stored) {
        const parsed = JSON.parse(stored)
        // Convert object back to Map
        routeCache = new Map(Object.entries(parsed))
    }
} catch (e) {
    console.warn('Failed to load route cache', e)
}

const CACHE_TTL = 30 * 60 * 1000 // Increase TTL to 30 mins to save API quota
const saveCache = () => {
    try {
        // Convert Map to Object for JSON
        const obj = Object.fromEntries(routeCache)
        localStorage.setItem(CACHE_KEY_STORAGE, JSON.stringify(obj))
    } catch (e) { }
}

// 判斷是否為節假日或連假
const isHoliday = (date: Date): boolean => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
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

    // 大幅降低基礎補償，避免過度高估
    let weight = 1.02

    // === 1. 時段基礎權重 ===
    const isWeekday = day >= 1 && day <= 5

    if (isWeekday && !isHolidayToday) {
        // 平日通勤尖峰
        if (hour === 7 || (hour === 8 && minute < 30)) {
            weight = 1.25 // 早高峰前段
        } else if ((hour === 8 && minute >= 30) || hour === 9) {
            weight = 1.15 // 早高峰後段
        } else if (hour >= 17 && hour < 19) {
            weight = 1.30 // 晚高峰
        } else if (hour >= 19 && hour < 20) {
            weight = 1.10
        } else if (hour >= 10 && hour < 16) {
            weight = 1.05 // 一般日間 Almost no buffering needed
        }
    }

    // === 2. 露營尖峰時段 (台灣特性) ===
    if (day === 5) {
        // 週五
        if (hour >= 16 && hour < 20) {
            weight = Math.max(weight, 1.25)
        }
    } else if (day === 6) {
        // 週六
        if (hour >= 7 && hour < 11) {
            weight = Math.max(weight, 1.20)
        }
    } else if (day === 0) {
        // 週日
        if (hour >= 14 && hour < 20) {
            weight = Math.max(weight, 1.35) // 週日下午回程
        }
    }

    // === 3. 深夜時段 ===
    if (hour >= 23 || hour < 6) {
        weight = 0.95 // 深夜可能比預估更快
    }

    // === 4. 連假加成 ===
    if (isHolidayToday) {
        weight *= 1.05 // 略微增加即可
    }

    // === 5. 距離因素 ===
    if (distanceKm && distanceKm < 10) {
        weight *= 1.05 // 市區極短途
    }

    // 限制最大與最小權重
    return Math.min(Math.max(weight, 0.90), 1.40)
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
                // 不使用定位，直接使用預設起點
                sLat = DEFAULT_ORIGIN.lat
                sLon = DEFAULT_ORIGIN.lng
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
                // === 3. 呼叫 OSRM API (嘗試) ===
                // 此 API 為 Demo Server，有速率限制 (429 Too Many Requests)
                try {
                    const url = `https://router.project-osrm.org/route/v1/driving/${sLon},${sLat};${destLon},${destLat}?overview=false`

                    // Add strict timeout (3s) to fallback quickly
                    const controller = new AbortController()
                    const timeoutId = setTimeout(() => controller.abort(), 3000)

                    const response = await fetch(url, { signal: controller.signal })
                    clearTimeout(timeoutId)

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
                    saveCache() // Persist to local storage

                    // 清理過期快取
                    if (routeCache.size > 50) {
                        const entries = Array.from(routeCache.entries())
                        entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
                        entries.slice(0, 10).forEach(([key]) => routeCache.delete(key))
                        saveCache()
                    }
                } catch (apiError) {
                    console.warn(`OSRM API failed (${apiError}), falling back to straight-line estimation.`)

                    // === Fallback Calculation ===
                    // 1. Calculate straight line distance
                    const straightDist = getDistance(sLat, sLon, destLat, destLon)

                    // 2. Estimate "Road Distance" (Winding factor ~1.4x for Taiwan mountains/roads)
                    distance = straightDist * 1.4

                    // 3. Estimate Duration (Avg speed 45km/h for mixed city/mountain)
                    // Speed: 45 km/h => 45/3600 km/s = 0.0125 km/s
                    // Duration = Distance / Speed
                    baseDuration = (distance / 45) * 3600
                }
            }

            // === 4. 計算直線距離（若皆無，再次確認）===
            if (!distance) {
                distance = getDistance(sLat, sLon, destLat, destLon)
            }

            // === 5. 智慧加權 (Traffic + Winding adjustment already in weight) ===
            const weight = getSmartTrafficWeight(distance)

            // 基礎緩衝時間
            const baseBuffer = distance < 50 ? 5 * 60 : 10 * 60

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
            console.error('Failed to calculate travel time:', e)
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
