export interface Profile {
    id: string
    updated_at: string | null
    location_name: string | null
    latitude: number | null
    longitude: number | null
}

export interface Campsite {
    id: number
    created_at: string
    name: string
    city: string | null
    district: string | null
    latitude: number | null
    longitude: number | null
    altitude: number | null
    created_by: string | null
}

export interface CampingTrip {
    id: number
    created_at: string
    trip_date: string
    duration_days: number
    campsite_name: string
    location: string
    price: number
    notes: string | null
    rating: number | null
    cover_image: string | null
    status: 'planning' | 'booked' | 'completed' | 'cancelled'
    user_id: string | null
    zone: string | null
    companions: string | null
    latitude: number | null
    longitude: number | null
    altitude: number | null
    night_rush: boolean
    start_latitude: number | null
    start_longitude: number | null
    scenery: number | null
    cleanliness: number | null
    road_condition: number | null
    campsite_id: number | null
    // Missing fields restored below
    entertainment: string | null
    owner_friendliness: string | null
    is_windy: boolean
    is_rainy: boolean
    is_wet_tent: boolean
    tent_type: string | null
    has_tarp: boolean
    cost: number
    tent_id: number | null
    tarp_id: number | null
}

export interface CampingTripWithCampsite extends CampingTrip {
    campsites: Campsite | null
}

export interface NewCampingTrip {
    trip_date: string
    duration_days: number
    campsite_name: string
    location: string
    price: number
    notes?: string
    rating?: number
    cover_image?: string
    status: 'planning' | 'booked' | 'completed' | 'cancelled'
    user_id?: string
    zone?: string
    companions?: string
    latitude?: number
    longitude?: number
    altitude?: number
    night_rush?: boolean
    start_latitude?: number
    start_longitude?: number
    scenery?: number
    cleanliness?: number
    road_condition?: number
    campsite_id?: number
    // Missing fields restored below
    entertainment?: string
    owner_friendliness?: string
    is_windy?: boolean
    is_rainy?: boolean
    is_wet_tent?: boolean
    tent_type?: string
    has_tarp?: boolean
    cost?: number
    tent_id?: number
    tarp_id?: number
}

export interface GearItem {
    id: number
    name: string
    category: string
    price: number
    purchase_date: string
    brand: string | null
    notes: string | null
    image_url: string | null
    weight_kg: number | null
    is_consumable: boolean
    status: 'active' | 'retired' | 'lost'
    user_id: string | null
    type?: string // Often inferred from category or distinct field
    // Added fields for ROI
    base_usage_count: number
    rental_price: number
    cost: number
}

export type CampingGear = GearItem // Alias for consistency if needed

export interface NewGearItem {
    name: string
    category: string
    price: number
    purchase_date: string
    brand?: string
    notes?: string
    image_url?: string
    weight_kg?: number
    is_consumable?: boolean
    status?: 'active' | 'retired' | 'lost'
    user_id?: string
    type?: string
    base_usage_count?: number
    rental_price?: number
    cost?: number
}

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: Profile
                Insert: Profile
                Update: Partial<Profile>
            }
            campsites: {
                Row: Campsite
                Insert: Omit<Campsite, 'id' | 'created_at'>
                Update: Partial<Campsite>
            }
            camping_trips: {
                Row: CampingTrip
                Insert: NewCampingTrip
                Update: Partial<NewCampingTrip>
            }
            camping_gear: {
                Row: GearItem
                Insert: NewGearItem
                Update: Partial<NewGearItem>
            }
        }
    }
}