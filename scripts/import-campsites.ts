import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import { TAIWAN_LOCATIONS } from '../src/constants/locations'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// === Mapping Tables ===
const PLAYGROUND_MAP: Record<string, string> = {
  '溜': '溜滑梯', '沙': '沙坑', '盪': '盪鞦韆',
  '遊戲區': '遊戲室', '遊戲室': '遊戲室',
  '氣墊城堡': '氣墊城堡', '滑草': '滑草',
  '彈簧床': '彈簧床', '兒童攀岩': '兒童攀岩',
  '棒球九宮格': '棒球九宮格'
}
const WATER_MAP: Record<string, string> = {
  '池': '戲水池', '溪': '溪流', '河': '河流',
  '瀑布': '瀑布', '湖': '湖泊', '溫泉': '溫泉',
  '滑水道': '滑水道', '海': '海邊'
}
const SCENERY_MAP: Record<string, string> = {
  '櫻': '櫻花', '落羽松': '落羽松', '桐花': '桐花',
  '楓': '楓葉', '螢': '螢火蟲', '螢火蟲': '螢火蟲',
  '雲': '雲海', '雲海': '雲海', '夜': '夜景', '夜景': '夜景',
  '山': '山景', '海景': '海景', '湖景': '湖景',
  '林': '森林', '森林': '森林'
}

function mapTags(raw: string | undefined, mapping: Record<string, string>): string[] {
  if (!raw) return []
  const tokens = String(raw).split(/[\s　]+/).filter(Boolean)
  const result: string[] = []
  const unmapped: string[] = []
  for (const token of tokens) {
    if (mapping[token]) {
      if (!result.includes(mapping[token])) result.push(mapping[token])
    } else {
      unmapped.push(token)
    }
  }
  return result
}

// Maps Excel short city names to TAIWAN_LOCATIONS IDs
const CITY_MAP: Record<string, string> = {
  '基隆': '基隆市', '台北': '臺北市', '臺北': '臺北市',
  '新北': '新北市', '桃園': '桃園市', '新竹市': '新竹市',
  '新竹': '新竹縣', '苗栗': '苗栗縣', '台中': '臺中市', '臺中': '臺中市',
  '彰化': '彰化縣', '南投': '南投縣', '雲林': '雲林縣',
  '嘉義市': '嘉義市', '嘉義': '嘉義縣', '台南': '臺南市', '臺南': '臺南市',
  '高雄': '高雄市', '屏東': '屏東縣', '宜蘭': '宜蘭縣',
  '花蓮': '花蓮縣', '台東': '臺東縣', '臺東': '臺東縣',
  '澎湖': '澎湖縣', '金門': '金門縣', '連江': '連江縣',
}

function parseLocation(location: string | undefined): { city: string; district: string } {
  if (!location) return { city: '', district: '' }
  const s = String(location).trim()
  // Try longer prefixes first (e.g. '新竹市' before '新竹', '嘉義市' before '嘉義')
  const sortedKeys = Object.keys(CITY_MAP).sort((a, b) => b.length - a.length)
  for (const key of sortedKeys) {
    if (s.startsWith(key)) {
      const city = CITY_MAP[key]
      const districtShort = s.slice(key.length).trim()
      // Look up full district ID from TAIWAN_LOCATIONS (e.g. '成功' → '成功鎮')
      const cityData = TAIWAN_LOCATIONS.find(c => c.id === city)
      const districtFull = cityData?.districts.find(d => d.id.startsWith(districtShort))?.id ?? districtShort
      return { city, district: districtFull }
    }
  }
  return { city: s, district: '' }
}

function parseDate(val: any): string | null {
  if (!val) return null
  const s = String(val).trim()
  if (/^\d{5}$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(Number(s))
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const match = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }
  return null
}

function parseSpotTypes(row: any): string[] {
  const types: string[] = []
  if (row['草地']) types.push('草地')
  if (row['碎石']) types.push('碎石')
  if (row['草地'] && row['碎石']) types.push('草地混碎石')
  if (row['雨棚']) types.push('雨棚')
  if (row['棧板']) types.push('棧板')
  if (row['免搭']) types.push('免搭帳')
  return [...new Set(types)]
}

async function main() {
  const filePath = process.argv[2] || './data/campsites.xlsx'
  if (!fs.existsSync(filePath)) {
    console.error(`找不到檔案：${filePath}`)
    process.exit(1)
  }

  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  console.log(`讀取到 ${rows.length} 筆資料`)

  let success = 0
  let failed = 0

  for (const row of rows) {
    const name = String(row['名稱'] || '').trim()
    if (!name) continue

    const { city, district } = parseLocation(row['地點'])
    const altitude = row['海拔'] ? Number(row['海拔']) : null

    const playgroundTokens = String(row['遊樂區'] || '').split(/[\s　]+/).filter(Boolean)
    const unmappedPlayground = playgroundTokens.filter((t: string) => !PLAYGROUND_MAP[t])

    const campsite = {
      name,
      city,
      district,
      altitude,
      is_verified: false,
      playground_features: mapTags(row['遊樂區'], PLAYGROUND_MAP),
      water_features: mapTags(row['水'], WATER_MAP),
      scenery_features: mapTags(row['景'], SCENERY_MAP),
      spot_types: parseSpotTypes(row),
      booking_available_until: parseDate(row['可訂時間']),
      booking_timing: String(row['訂位時間'] || '').trim() || null,
      booking_difficulty: row['要搶'] === 'O' ? 'hard' : row['要搶'] === '△' ? 'moderate' : 'normal',
      recommended_spots: String(row['推薦營位'] || '').trim() || null,
      campsite_notes: [
        String(row['其他'] || '').trim(),
        unmappedPlayground.length ? `遊樂區（未對應）：${unmappedPlayground.join(' ')}` : ''
      ].filter(Boolean).join('；') || null,
    }

    const { error } = await supabase.from('campsites').insert(campsite as any)
    if (error) {
      console.error(`❌ 匯入失敗：${name}`, error.message)
      failed++
    } else {
      console.log(`✅ 已匯入：${name}`)
      success++
    }
  }

  console.log(`\n完成：成功 ${success} 筆，失敗 ${failed} 筆`)
}

main().catch(console.error)
