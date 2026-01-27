import { ref, computed, watch, type Ref } from 'vue'
import type { CampingTrip, CampingTripWithCampsite } from '../types/database'
import { analyzePackUpWeather, type PackUpPrediction } from '../utils/weatherAnalysis'

export interface WeatherHour {
    time: string // HH:00
    timestamp: number
    temp: number
    code: number
    pop: number // Probability of Precipitation %
    rain: number // Precipitation mm
    humidity: number // RH %
    isValid: boolean // In camping range?
}

export interface WeatherDay {
    date: string
    dateLabel: string
    fullDateLabel: string // For detail title
    summary: {
        code: number
        temp_max: number
        temp_min: number
    }
    hours: WeatherHour[]
}

export interface TripWeatherSummary {
    code: number
    temp_max: number
    temp_min: number
}

export function useTripWeather(trip: Ref<CampingTripWithCampsite | CampingTrip | null>) {
    const weatherDays = ref<WeatherDay[]>([])
    const tripSummary = ref<TripWeatherSummary | null>(null)
    const packingStatus = ref<PackUpPrediction | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    const isPastTrip = computed(() => {
        if (!trip.value?.trip_date) return false
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const tripDate = new Date(trip.value.trip_date)
        tripDate.setHours(0, 0, 0, 0)

        const duration = trip.value.duration_days || 1
        const endDate = new Date(tripDate)
        endDate.setDate(endDate.getDate() + duration - 1)

        return today.getTime() > endDate.getTime()
    })

    // Helper: Get most frequent weather code
    const getMostFrequentCode = (codes: number[]) => {
        if (codes.length === 0) return 0
        const map: Record<number, number> = {}
        let max = 0
        let res = codes[0]
        for (const c of codes) {
            map[c] = (map[c] || 0) + 1
            if (map[c] > max) { max = map[c]; res = c; }
        }
        return res || 0
    }

    // Helper: Format Date YYYY-MM-DD
    const formatDate = (d: Date) => {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    }

    const processWeatherData = (data: any) => {
        if (!trip.value?.trip_date) return
        const t = trip.value as any // Access loose props

        const tripStart = new Date(t.trip_date)
        tripStart.setHours(0, 0, 0, 0)

        const duration = Number(t.duration_days || 1)
        const tripEnd = new Date(tripStart)
        tripEnd.setDate(tripEnd.getDate() + duration - 1)
        tripEnd.setHours(0, 0, 0, 0)

        // Key Dates
        const tripStartStr = formatDate(tripStart)
        const tripEndStr = formatDate(tripEnd)

        // Night Rush
        const nightRushDate = new Date(tripStart)
        nightRushDate.setDate(nightRushDate.getDate() - 1)
        const nightRushStr = formatDate(nightRushDate)

        // Allowed Days
        const allowedDays = new Set<string>()
        const iter = new Date(tripStart)
        while (iter <= tripEnd) {
            allowedDays.add(formatDate(iter))
            iter.setDate(iter.getDate() + 1)
        }
        if (t.night_rush) {
            allowedDays.add(nightRushStr)
        }

        // Process Hours
        const daysMap = new Map<string, { hours: WeatherHour[], date: Date }>()
        if (!data || !data.hourly || !data.hourly.time) return

        // 1. Pack Up Prediction
        const rawHourly = data.hourly
        packingStatus.value = analyzePackUpWeather(rawHourly, tripEndStr)

        // 2. Build Hourly Data
        data.hourly.time.forEach((timeStr: string, index: number) => {
            if (!timeStr) return

            // Parse local time from API string directly (e.g. "2023-10-25T14:00")
            const parts = timeStr.split('T')
            const rawDateStr = parts[0]
            const timePart = parts[1]

            if (!rawDateStr || !timePart) return
            const hourPart = timePart ? timePart.split(':')[0] : '0'
            const rawHour = parseInt(hourPart ?? '0', 10)

            // Filter irrelevant days
            if (!allowedDays.has(rawDateStr)) return

            // Valid Logic (Is user visibly camping?)
            let isValid = false
            if (t.night_rush) {
                if (rawDateStr === nightRushStr) {
                    isValid = rawHour >= 17
                } else if (rawDateStr === tripStartStr) {
                    isValid = true
                } else if (rawDateStr === tripEndStr) {
                    isValid = rawHour <= 12
                } else {
                    isValid = true
                }
            } else {
                if (rawDateStr === tripStartStr) {
                    isValid = rawHour >= 10
                } else if (rawDateStr === tripEndStr) {
                    isValid = rawHour <= 12
                } else {
                    isValid = true
                }
            }

            if (!daysMap.has(rawDateStr)) {
                daysMap.set(rawDateStr, { hours: [], date: new Date(rawDateStr) })
            }

            const hourItem: WeatherHour = {
                time: String(rawHour).padStart(2, '0') + ':00',
                timestamp: index,
                temp: data.hourly.temperature_2m?.[index] ?? 0,
                code: data.hourly.weather_code?.[index] ?? 0,
                pop: data.hourly.precipitation_probability?.[index] ?? 0,
                rain: data.hourly.precipitation?.[index] ?? 0,
                humidity: data.hourly.relative_humidity_2m?.[index] ?? 0,
                isValid
            }

            daysMap.get(rawDateStr)?.hours.push(hourItem)
        })

        // 3. Aggregate Days
        const finalDays: WeatherDay[] = []
        const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
        const sortedAllowedDays = Array.from(allowedDays).sort()

        sortedAllowedDays.forEach(dStr => {
            const dayData = daysMap.get(dStr)
            if (!dayData) return
            const dDate = new Date(dStr)

            if (dayData.hours.length > 0) {
                // Summary Logic: Prefer valid hours, else all hours
                const validHours = dayData.hours.filter(h => h.isValid)
                const calcHours = validHours.length > 0 ? validHours : dayData.hours

                const temps = calcHours.map(h => h.temp)
                const codes = calcHours.map(h => h.code)

                const max = temps.length ? Math.max(...temps) : 0
                const min = temps.length ? Math.min(...temps) : 0
                const code = codes.length ? getMostFrequentCode(codes) : 0

                finalDays.push({
                    date: dStr,
                    dateLabel: `${dDate.getMonth() + 1}/${dDate.getDate()}`,
                    fullDateLabel: `${dDate.getMonth() + 1}/${dDate.getDate()} ${weekdays[dDate.getDay()]}`,
                    hours: dayData.hours,
                    summary: {
                        temp_max: Math.round(max),
                        temp_min: Math.round(min),
                        code
                    }
                })
            }
        })

        weatherDays.value = finalDays

        // 4. Calculate Overall Trip Summary (Min of mins, Max of maxs, Most Frequent Code)
        if (finalDays.length > 0) {
            const allMax = finalDays.map(d => d.summary.temp_max)
            const allMin = finalDays.map(d => d.summary.temp_min)
            const allCodes = finalDays.map(d => d.summary.code)

            tripSummary.value = {
                temp_max: Math.max(...allMax),
                temp_min: Math.min(...allMin),
                code: getMostFrequentCode(allCodes)
            }
        } else {
            tripSummary.value = null
        }
    }

    const fetchWeather = async () => {
        // Reset state immediately when fetch starts (new trip or refresh)
        weatherDays.value = []
        tripSummary.value = null
        packingStatus.value = null
        error.value = null
        loading.value = false // Default to false, set true if fetching

        if (!trip.value) return
        if (isPastTrip.value) return
        if (!trip.value.trip_date) return

        const tr = trip.value as any
        const lat = tr.campsites?.latitude ?? tr.latitude
        const lng = tr.campsites?.longitude ?? tr.longitude

        if (!lat || !lng) {
            error.value = 'no_coords'
            return
        }

        const today = new Date()
        const tripDateStr = tr.trip_date
        const tripTime = new Date(tripDateStr).getTime()

        // 16 days limit
        // If too far, we just stop (state is already cleared above)
        if ((tripTime - today.getTime()) / (1000 * 3600 * 24) > 16) {
            return
        }

        loading.value = true

        try {
            let elevation = tr.campsites?.altitude ?? tr.altitude

            // Auto-fetch elevation if missing
            if (!elevation) {
                try {
                    const elevRes = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`)
                    const elevData = await elevRes.json()
                    if (elevData.elevation?.[0]) elevation = elevData.elevation[0]
                } catch (e) { }
            }

            let apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=weather_code,temperature_2m,precipitation_probability,precipitation,relative_humidity_2m&forecast_days=16&past_days=1&models=gem_global&timezone=auto`
            if (elevation) apiUrl += `&elevation=${elevation}`

            // Check Cache
            const cacheKey = `weather_v4_${tr.id}_${tr.trip_date}`
            const cached = localStorage.getItem(cacheKey)
            if (cached) {
                const { timestamp, data } = JSON.parse(cached)
                if (Date.now() - timestamp < 60 * 60 * 1000) { // 1 hour
                    processWeatherData(data)
                    loading.value = false
                    return
                }
            }

            const response = await fetch(apiUrl)
            const data = await response.json()
            if (!data.hourly) throw new Error('API Error')

            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }))
            processWeatherData(data)
        } catch (e) {
            console.error(e)
            error.value = 'fetch_error'
        } finally {
            loading.value = false
        }
    }

    // UI State (Moved here to keep logic together, or could be in component)
    const selectedDay = ref<WeatherDay | null>(null)
    const showDetailModal = ref(false)

    const selectDay = (day: WeatherDay) => {
        selectedDay.value = day
        showDetailModal.value = true
    }

    const closeModal = () => {
        showDetailModal.value = false
    }

    // Auto-select first day when data arrives
    watch(weatherDays, (days) => {
        if (days.length > 0) {
            const firstDay = days[0]
            if (firstDay && (!selectedDay.value || !days.find(d => d.date === selectedDay.value?.date))) {
                selectDay(firstDay)
                // Don't auto-open modal, just select
                showDetailModal.value = false
            } else {
                // Update selected day reference to new object
                const found = days.find(d => d.date === selectedDay.value?.date)
                if (found) selectedDay.value = found
            }
        }
    })

    // Auto fetch
    watch(trip, () => {
        fetchWeather()
    }, { immediate: true, deep: true })

    return {
        weatherDays,
        tripSummary,
        packingStatus,
        loading,
        error,
        isPastTrip,
        selectedDay,
        showDetailModal,
        selectDay,
        closeModal,
        fetchWeather
    }
}
