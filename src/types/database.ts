export interface CampingTrip {
  id: number
  trip_date: string
  duration_days: number | null
  campsite_name: string
  location: string | null
  altitude: number | null
  road_condition: number | null
  cleanliness: number | null
  scenery: number | null
  entertainment: string | null
  owner_friendliness: string | null
  notes: string | null
  is_windy: boolean
  is_rainy: boolean
  is_wet_tent: boolean
  night_rush: boolean
  tent_type: string | null
  has_tarp: boolean
  tent_id: number | null
  tarp_id: number | null
  cost: number
  latitude: number | null
  longitude: number | null
  user_id: string | null
  photos: string[] | null
  created_at: string
}

export interface NewCampingTrip {
  trip_date: string
  duration_days?: number
  campsite_name: string
  location?: string
  altitude?: number
  road_condition?: number
  cleanliness?: number
  scenery?: number
  entertainment?: string
  owner_friendliness?: string
  notes?: string
  is_windy?: boolean
  is_rainy?: boolean
  is_wet_tent?: boolean
  night_rush?: boolean
  tent_type?: string
  has_tarp?: boolean
  tent_id?: number
  tarp_id?: number
  cost?: number
  latitude?: number
  longitude?: number
  user_id?: string
  photos?: string[]
}

export interface CampingGear {
  id: number
  created_at: string
  name: string
  usage_count: number
  base_usage_count: number
  type: string
  cost: number
  rental_price: number
  user_id?: string | null
}

export interface NewCampingGear {
  name: string
  usage_count?: number
  base_usage_count?: number
  type?: string
  cost?: number
  rental_price?: number
  user_id?: string
}

export interface Database {
  public: {
    Tables: {
      camping_trips: {
        Row: CampingTrip
        Insert: NewCampingTrip
        Update: Partial<NewCampingTrip>
        Relationships: []
      }
      camping_gear: {
        Row: CampingGear
        Insert: NewCampingGear
        Update: Partial<NewCampingGear>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
