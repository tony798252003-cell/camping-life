// 型別由 supabase gen types 產生（src/types/supabase.ts，npm run db:types），這裡只做衍生與 JSONB 收窄
import type { Tables, TablesInsert } from './supabase'

export type { Database, Json } from './supabase'

export type Family = Tables<'families'>

export type Profile = Tables<'profiles'>

export interface CapacityZone {
    name: string        // 區域名稱，例如 A區、草地區，可空白
    type: '草地' | '碎石' | '雨棚' | '棧板' | '其他'
    tents: number       // 該區帳數
}

export type FieldSource = {
    source: 'places' | 'elevation' | 'gemini' | 'manual'
    confidence: 'high' | 'low' | 'none'
    urls: string[]
    confirmed: boolean
}

export type FieldSources = Record<string, FieldSource>

export type Campsite = Omit<
    Tables<'campsites'>,
    'amenities' | 'capacity_zones' | 'booking_difficulty' | 'booking_platform' | 'field_sources'
> & {
    field_sources: FieldSources
    booking_difficulty: 'normal' | 'moderate' | 'hard' | null
    booking_platform: 'icamping' | 'campingfun' | null
    amenities: {
        has_fridge?: boolean
        has_freezer?: boolean
        has_water_dispenser?: boolean
    } | null
    capacity_zones: CapacityZone[] | null
}

type TripStatus = 'planning' | 'booked' | 'completed' | 'cancelled'

export type CampingTrip = Omit<Tables<'camping_trips'>, 'status'> & {
    status: TripStatus | null
}

export interface CampingTripWithCampsite extends CampingTrip {
    campsites: Campsite | null
    tent?: {
        name: string
        image_url: string | null
        brand: string | null
    } | null
}

// 表單必填欄位維持 App 端語意（DB 欄位皆可空，但新增行程一定帶這些）
export type NewCampingTrip = Omit<
    TablesInsert<'camping_trips'>,
    'status' | 'duration_days' | 'campsite_name' | 'location' | 'price'
> & {
    status: TripStatus
    duration_days: number
    campsite_name: string
    location: string
    price: number
}

// cost / rental_price / base_usage_count 在 DB 可空，但 ROI 計算一律當數字用（新增時都有帶 0）
export type GearItem = Omit<Tables<'camping_gear'>, 'cost' | 'rental_price' | 'base_usage_count'> & {
    cost: number
    rental_price: number
    base_usage_count: number
}

export type CampingGear = GearItem // Alias for consistency if needed

export type NewGearItem = TablesInsert<'camping_gear'>

export type TripPhoto = Tables<'trip_photos'>

export type NewTripPhoto = TablesInsert<'trip_photos'>

export type SystemAsset = Tables<'system_assets'>

export type CalendarEvent = Tables<'calendar_events'>
export type CalendarEventRow = Tables<'calendar_events'>

export type EventCategory = Tables<'event_categories'>

export type NewCalendarEvent = TablesInsert<'calendar_events'>

export type CpblSchedule = Tables<'cpbl_schedule'>
