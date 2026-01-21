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
  cost?: number
  latitude?: number
  longitude?: number
  user_id?: string
  photos?: string[]
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
