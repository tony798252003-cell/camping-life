
/**
 * Analyze the pack-up day weather to provide actionable advice.
 * 
 * Logic:
 * 1. Overnight Rain (00:00 - 06:00): Did it rain last night? (Wet ground/tent baseline)
 * 2. Morning Rain (06:00 - 12:00): When did it stop raining?
 * 3. Sunlight (08:00 - 12:00): Is there enough sun to dry things?
 * 
 * Codes:
 * - Rain: >= 51
 * - Sun: 0, 1, 2
 * - Cloudy: 3, 45, 48
 */

export interface PackUpPrediction {
    status: 'wet' | 'risk' | 'chance' | 'damp' | 'drying' | 'dry' | 'perfect'
    label: string
    advice: string
    color: 'red' | 'orange' | 'yellow' | 'green' | 'teal'
}

export const analyzePackUpWeather = (hourlyData: any, lastDayDateStr: string): PackUpPrediction | null => {
    if (!hourlyData || !hourlyData.time) return null

    // 1. Extract relevant hours with new metrics
    const hours = hourlyData.time.map((t: string, i: number) => {
        const parts = t.split('T')
        const dateStr = parts[0]
        const timePart = parts[1]
        const hourStr = timePart ? timePart.split(':')[0] : '0'
        const hour = parseInt(hourStr ?? '0', 10)
        return {
            date: dateStr,
            hour,
            code: hourlyData.weather_code?.[i] ?? 0,
            temp: hourlyData.temperature_2m?.[i] ?? 0,
            pop: hourlyData.precipitation_probability?.[i] ?? 0,
            rain: hourlyData.precipitation?.[i] ?? 0
        }
    })

    // Filter for Last Day (00:00 - 12:00)
    const lastDayHours = hours.filter((h: any) => h.date === lastDayDateStr && h.hour <= 12)
    if (lastDayHours.length === 0) return null

    // --- Metrics ---


    // 2. Determine Max Risk in Critical Window
    const criticalWindow = lastDayHours.filter((h: any) => h.hour >= 10 && h.hour <= 12)
    const maxPop = criticalWindow.length > 0 ? Math.max(...criticalWindow.map((h: any) => h.pop)) : 0
    const maxRainMap = criticalWindow.length > 0 ? Math.max(...criticalWindow.map((h: any) => h.rain)) : 0
    const hasRainCode = criticalWindow.some((h: any) => h.code >= 51)

    // 3. Morning Rain (06:00 - 12:00) - Find stop time
    // Only count significant rain (POP > 30 or Rain > 0.1)
    const morningRainHours = lastDayHours.filter((h: any) =>
        h.hour >= 6 && h.hour <= 12 && h.code >= 51 && (h.pop >= 30 || h.rain >= 0.1)
    )
    const lastRainHour = morningRainHours.length > 0 ? Math.max(...morningRainHours.map((h: any) => h.hour)) : -1

    // 4. Drying Power (08:00 - 12:00)
    const dryingWindowStart = lastRainHour === -1 ? 8 : Math.max(8, lastRainHour + 1)
    const sunHours = lastDayHours.filter((h: any) =>
        h.hour >= dryingWindowStart &&
        h.hour <= 12 &&
        h.code <= 2 // Clear/Partly Cloudy
    )
    const dryingHoursCount = sunHours.length

    // --- Decision Tree (Enhanced) ---

    // A. WET: High Probability (>= 60%) OR (Real Rain Code AND significant rain)
    if (maxPop >= 60 || (hasRainCode && maxRainMap >= 0.5)) {
        return {
            status: 'wet',
            label: '濕帳撤收',
            advice: `降雨機率高 (${maxPop}%)，建議做好濕收準備。`,
            color: 'red'
        }
    }

    // B. RISK: Medium Probability (40-60%) OR Rain Code present
    // Strict threshold: Even if code says "Cloudy", if POP is 45%, call it Risk.
    if (maxPop >= 40 || (hasRainCode && maxPop >= 30)) {
        return {
            status: 'risk',
            label: '降雨風險',
            advice: `降雨機率約 ${maxPop}%，建議隨時觀察天色，抓準空檔撤收。`,
            color: 'orange'
        }
    }

    // C. CHANCE: Low Probability (20-40%)
    // Lowered threshold for warning
    if (maxPop >= 20) {
        return {
            status: 'chance',
            label: '留意降雨',
            advice: `雖然預報偏乾，但有 ${maxPop}% 機率降雨，仍建議把雨具備好。`,
            color: 'yellow'
        }
    }

    // E. LATE STOP (Legacy Logic adapted)
    if (lastRainHour >= 9) {
        if (dryingHoursCount >= 2) {
            return {
                status: 'drying',
                label: '延後撤收',
                advice: '雖上午有雨，但隨後轉晴。建議延後至 12:00 後收外帳。',
                color: 'yellow'
            }
        }
        // If rain stopped but no sun
        return {
            status: 'damp',
            label: '難以曬乾',
            advice: '太晚停雨且無足夠日照，外帳難乾，建議回家處理。',
            color: 'orange'
        }
    }

    // F. DRY: Default or Very Low Probability (< 20%)
    return {
        status: 'perfect',
        label: '乾燥撤收',
        advice: '天氣良好，乾燥撤收！',
        color: 'teal'
    }
}
