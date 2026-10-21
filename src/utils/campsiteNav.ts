// 營地一鍵導航與撥號連結（規格 §5.3）。純函式，與 NextTripCard 的導航規則一致。
export function campsiteNavUrl(c: {
  name: string
  google_place_id?: string | null
  latitude?: number | null
  longitude?: number | null
}): string | null {
  if (c.google_place_id) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.name)}&destination_place_id=${c.google_place_id}`
  }
  if (typeof c.latitude === 'number' && typeof c.longitude === 'number') {
    return `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`
  }
  return null
}

export function campsiteTelUrl(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : null
}

export const FIELD_SOURCE_LABEL: Record<string, string> = {
  places: 'Google 地點',
  elevation: '高程計算',
  gemini: 'AI 推測',
  claude: 'Claude 查詢',
  manual: '自填',
}

export const FIELD_LABEL: Record<string, string> = {
  name: '名稱', city: '縣市', district: '鄉鎮', address: '地址', latitude: '緯度', longitude: '經度',
  altitude: '海拔', phone: '電話', google_maps_url: 'Google 地圖連結', business_status: '營業狀態',
  tags: '標籤', amenities: '營地設施', playground_features: '遊樂設施', water_features: '水域設施',
  scenery_features: '自然景觀', spot_types: '營位類型', check_in_time: '進場時間', check_out_time: '離場時間',
  night_rush_time: '夜衝時段', shower_restrictions: '熱水供應', zone_config: '營位配置說明',
  capacity_zones: '營區帳數', total_capacity: '總帳數', booking_method: '訂位方式', booking_timing: '訂位規則',
  booking_difficulty: '搶位難度', recommended_spots: '推薦營位', campsite_notes: '其他備注',
}
