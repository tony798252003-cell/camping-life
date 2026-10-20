// Gemini＋Google 搜尋 grounding：查營區設施草稿（規格 §5.7、§7.2）。
// grounding（google_search tool）與 responseSchema 不能一起用，所以 prompt 要求只輸出 JSON，再手寫型別守門。
import {
  BOOKING_METHOD_OPTIONS,
  PLAYGROUND_OPTIONS,
  SCENERY_OPTIONS,
  SPOT_TYPE_OPTIONS,
  WATER_OPTIONS,
} from '../../src/constants/campsiteOptions.js'
import type { CampsiteDraft, DraftField } from './draft.js'

export interface GeminiFieldResult {
  value: unknown
  confidence: 'high' | 'low' | 'none'
  sources: string[]
}

// 規格 §5.7：AI 填的這些欄位一律要使用者確認（審查後加入進退場時間和設備）
export const HIGH_RISK_FIELDS = [
  'spot_types',
  'shower_restrictions',
  'night_rush_time',
  'booking_method',
  'booking_timing',
  'check_in_time',
  'check_out_time',
  'amenities',
] as const

const TIMEOUT_MS = 45_000
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

const TAG_OPTIONS: Record<string, readonly string[]> = {
  spot_types: SPOT_TYPE_OPTIONS,
  scenery_features: SCENERY_OPTIONS,
  water_features: WATER_OPTIONS,
  playground_features: PLAYGROUND_OPTIONS,
  booking_method: BOOKING_METHOD_OPTIONS,
}
const TEXT_FIELDS = ['shower_restrictions', 'night_rush_time', 'booking_timing', 'check_in_time', 'check_out_time', 'phone', 'ai_summary']
const AMENITY_KEYS = ['has_fridge', 'has_freezer', 'has_water_dispenser']

export function buildPrompt(input: { name: string; address: string; mapsUrl: string }): string {
  const tags = Object.entries(TAG_OPTIONS)
    .map(([k, v]) => `- ${k}（陣列，只能從這些挑）：${v.join('、')}`)
    .join('\n')
  return [
    `請用 Google 搜尋，查台灣露營區「${input.name}」（地址：${input.address}；地圖：${input.mapsUrl}）的資訊。`,
    '只根據搜尋結果回答；查不到就回 confidence:"none" 且 value:null，不要猜，也不要用 false 或空陣列代替「不知道」。',
    '只輸出一個 JSON 物件（不要 markdown、不要說明文字）。每個欄位的格式：{"value":..., "confidence":"high"|"low"|"none", "sources":["網址"]}。',
    '欄位：',
    tags,
    '- shower_restrictions：字串，衛浴熱水時段或限制',
    '- night_rush_time：字串，夜衝時段，例如 "21:00 - 23:00"',
    '- booking_timing：字串，訂位規則與開放時間',
    '- check_in_time、check_out_time：字串 HH:MM',
    '- phone：字串',
    `- amenities：物件，只能有 ${AMENITY_KEYS.join('、')}，值為 true/false`,
    '- ai_summary：字串，條列摘要：最後一段山路（小客車能否上、是否需四驅）、手機訊號（分電信）、熄燈與安靜時間、寵物、電源、最近採買點、包區；查不到的項目寫「查無資料」',
    '標籤只能從上面清單挑選，清單以外的詞不要輸出。',
  ].join('\n')
}

const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.length > 0) : []

function guardField(raw: unknown): GeminiFieldResult | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const confidence = r.confidence === 'high' || r.confidence === 'low' || r.confidence === 'none' ? r.confidence : 'none'
  return { value: r.value ?? null, confidence, sources: strArr(r.sources) }
}

export function parseGeminiJson(text: string): Record<string, unknown> {
  const t = text.replace(/```(?:json)?/g, '').trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('gemini: no json')
  const obj = JSON.parse(t.slice(start, end + 1)) as unknown
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error('gemini: bad json')
  return obj as Record<string, unknown>
}

export async function researchCampsite(
  input: { name: string; address: string; mapsUrl: string },
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, GeminiFieldResult>> {
  const model = process.env.GEMINI_MODEL
  if (!model) throw new Error('GEMINI_MODEL is not set')
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')

  const res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
      tools: [{ google_search: {} }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`gemini: HTTP ${res.status}`)
  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string } }> }
    }>
  }
  const cand = data.candidates?.[0]
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('')
  const parsed = parseGeminiJson(text)
  const grounding = (cand?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => c.web?.uri)
    .filter((u): u is string => typeof u === 'string' && u.length > 0)

  const out: Record<string, GeminiFieldResult> = {}
  for (const [k, raw] of Object.entries(parsed)) {
    const f = guardField(raw)
    if (!f) continue
    // grounding 來源合併進有值的欄位；查無資料的欄位不掛來源
    const sources = f.value === null || f.confidence === 'none' ? f.sources : [...new Set([...f.sources, ...grounding])]
    out[k] = { ...f, sources }
  }
  return out
}

// 把 Gemini 的值整理成可寫入的型別；不合格的回 null（= 查無資料，不填假值）
function normalize(key: string, value: unknown): unknown {
  const options = TAG_OPTIONS[key]
  if (options) return Array.isArray(value) ? strArr(value).filter((v) => options.includes(v)) : null
  if (key === 'amenities') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
    const o: Record<string, boolean> = {}
    for (const k of AMENITY_KEYS) {
      const v = (value as Record<string, unknown>)[k]
      if (typeof v === 'boolean') o[k] = v
    }
    return o
  }
  if (TEXT_FIELDS.includes(key)) return typeof value === 'string' && value.trim() ? value.trim() : null
  return null
}

const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)

export function mergeGemini(draft: CampsiteDraft, g: Record<string, GeminiFieldResult>): CampsiteDraft {
  const fields: CampsiteDraft['fields'] = { ...draft.fields }
  for (const [rawKey, r] of Object.entries(g)) {
    const key = rawKey === 'ai_summary' ? 'campsite_notes' : rawKey
    if (key !== 'campsite_notes' && !(key in TAG_OPTIONS) && key !== 'amenities' && !TEXT_FIELDS.includes(key)) continue
    // Places／海拔已經有值的欄位不覆蓋
    if (!isEmpty(fields[key]?.value)) continue

    const value = r.confidence === 'none' ? null : normalize(rawKey, r.value)
    const empty = isEmpty(value)
    const confidence = empty ? 'none' : r.confidence
    const sources = empty ? [] : r.sources
    const field: DraftField<unknown> = {
      value: empty ? null : value,
      source: 'gemini',
      confidence,
      urls: sources,
      needsReview:
        empty ||
        confidence !== 'high' ||
        sources.length === 0 ||
        key === 'campsite_notes' ||
        (HIGH_RISK_FIELDS as readonly string[]).includes(key),
    }
    fields[key] = field
  }
  return { ...draft, fields }
}
