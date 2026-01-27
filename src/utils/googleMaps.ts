import { TAIWAN_LOCATIONS } from '../constants/locations'

interface AddressComponent {
    long_name: string
    short_name: string
    types: string[]
}

export function parseTaiwanLocation(addressComponents: AddressComponent[]): { cityId: string, districtId: string } {
    let foundCityId = ''
    let foundDistrictId = ''

    // First pass: Try to find City (Administrative Area Level 1)
    for (const component of addressComponents) {
        const types = component.types
        const name = component.long_name

        if (types.includes('administrative_area_level_1')) {
            // Try to match with our TAIWAN_LOCATIONS
            // Our IDs are names like '新竹縣', '臺北市'
            // Google might return 'Hsinchu County' or '新竹縣'
            const match = TAIWAN_LOCATIONS.find(c => c.name === name || c.id === name)
            if (match) {
                foundCityId = match.id
            } else {
                // Fallback: Check for partial match (Chinese)
                const partialMatch = TAIWAN_LOCATIONS.find(c => name.includes(c.name) || c.name.includes(name))
                if (partialMatch) foundCityId = partialMatch.id
            }
        }
    }

    // Second pass: Filter districts by found City (if any) or search all
    const targetDistricts = foundCityId
        ? (TAIWAN_LOCATIONS.find(c => c.id === foundCityId)?.districts || [])
        : TAIWAN_LOCATIONS.flatMap(c => c.districts)

    for (const component of addressComponents) {
        const types = component.types
        const name = component.long_name

        // Google Maps District is usually 'administrative_area_level_2' (County-Cities, Districts)
        // OR 'administrative_area_level_3' (Townships)
        // OR 'locality'
        if (types.includes('administrative_area_level_2') ||
            types.includes('administrative_area_level_3') ||
            types.includes('locality')) {

            // Try to find in targetDistricts
            const distMatch = targetDistricts.find(d => d.name === name || d.id === name || name.includes(d.name))
            if (distMatch) {
                foundDistrictId = distMatch.id

                // If we didn't have a city yet, we might deduce it from the district
                if (!foundCityId) {
                    const parentCity = TAIWAN_LOCATIONS.find(c => c.districts.some(d => d.id === distMatch.id))
                    if (parentCity) foundCityId = parentCity.id
                }
                break // Found a district
            }
        }
    }

    return { cityId: foundCityId, districtId: foundDistrictId }
}
