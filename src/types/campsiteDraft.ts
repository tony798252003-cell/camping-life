// 新增營區草稿的共用型別（規格 §5.7）。api/_lib 與前端都會 import，所以只放型別、不用 DOM。
import type { FieldSource } from './database'

export type BusinessStatus = 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY'

export interface PlaceLite {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  mapsUrl?: string
  businessStatus?: BusinessStatus
  typeLabel?: string
}

export interface DraftField<T> {
  value: T | null
  source: FieldSource['source']
  confidence: FieldSource['confidence']
  urls: string[]
  needsReview: boolean
}

export type BusinessStatusValue = 'open' | 'temporarily_closed' | 'closed'

export interface CampsiteDraft {
  placeId: string
  rawName: string
  fields: {
    name: DraftField<string>
    city: DraftField<string>
    district: DraftField<string>
    address: DraftField<string>
    latitude: DraftField<number>
    longitude: DraftField<number>
    altitude: DraftField<number>
    phone: DraftField<string>
    google_maps_url: DraftField<string>
    business_status: DraftField<BusinessStatusValue>
  } & Record<string, DraftField<any>> // Gemini 填的欄位（Task 4.4）
  warnings: string[]
  // AI 是否有上網查證；沒有時前端要提示（沒帶＝沒跑 AI；off＝伺服器關閉 AI）
  aiMode?: 'grounded' | 'ungrounded' | 'off'
}
