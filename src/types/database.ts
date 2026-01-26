// Family Interface
export interface Family {
    id: string
    created_at: string
    name: string
    invite_code: string
    created_by: string
}

export interface Profile {
    id: string
    updated_at: string | null
    location_name: string | null
    latitude: number | null
    longitude: number | null
    is_admin?: boolean // Added for Admin permissions
    family_id?: string | null // Family Link
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
    is_verified?: boolean // Added for verification flow
    tags?: string[]
    phone?: string
    zone_config?: string
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
    // Family
    family_id?: string | null
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
    family_id?: string | null
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
    family_id?: string | null
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
    family_id?: string | null
}

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: Profile
                Insert: Profile
                Update: Partial<Profile>
            }
            families: {
                Row: Family
                Insert: Omit<Family, 'id' | 'created_at'>
                Update: Partial<Family>
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