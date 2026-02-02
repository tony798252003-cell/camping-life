import { Sun, Cloud, CloudRain, CloudSun, CloudLightning } from 'lucide-vue-next'

/**
 * Smart Weather Icon Selector
 * Prioritizes precipitation probability (POP) over the weather code.
 * 
 * @param code WMO Weather Code
 * @param pop Probability of Precipitation (%)
 * @returns The Lucide icon component to display
 */
export const getSmartWeatherIcon = (code: number, pop: number = 0) => {
    // 1. High Precipitation Probability Override (>= 30%)
    if (pop >= 30) {
        // If it's a thunderstorm code, keep lightning
        if (code >= 95) return CloudLightning
        return CloudRain
    }

    // 2. Standard Code-based fallback
    if (code <= 3) return Sun
    if (code <= 48) return Cloud
    if (code <= 67) return CloudRain
    if (code <= 77) return CloudSun
    if (code > 80) return CloudRain

    // Default
    return CloudSun
}
