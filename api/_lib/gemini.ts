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
import { HttpError } from './http.js'

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
// 重試至少要剩這麼多時間才值得送出
const MIN_RETRY_MS = 8_000
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

export function buildPrompt(input: { name: string; address: string; mapsUrl: string }, grounded = true): string {
  const tags = Object.entries(TAG_OPTIONS)
    .map(([k, v]) => `- ${k}（陣列，只能從這些挑）：${v.join('、')}`)
    .join('\n')
  const intro = grounded
    ? [
        `請用 Google 搜尋，查台灣露營區「${input.name}」（地址：${input.address}；地圖：${input.mapsUrl}）的資訊。`,
        '只根據搜尋結果回答；查不到就回 confidence:"none" 且 value:null，不要猜，也不要用 false 或空陣列代替「不知道」。',
      ]
    : [
        `你無法上網。請只憑你已知的資料，回答台灣露營區「${input.name}」（地址：${input.address}；地圖：${input.mapsUrl}）的資訊。`,
        '不確定就回 confidence:"none" 且 value:null，寧可留空也不要猜或編造，也不要用 false 或空陣列代替「不知道」；sources 一律給空陣列。',
      ]
  return [
    ...intro,
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

// 來源網址會被前端當 <a href>，只放行 http(s)，擋 javascript:、data:、相對路徑
export function isHttpUrl(u: unknown): u is string {
  if (typeof u !== 'string') return false
  try {
    const p = new URL(u).protocol
    return p === 'http:' || p === 'https:'
  } catch {
    return false
  }
}

function guardField(raw: unknown): GeminiFieldResult | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const confidence = r.confidence === 'high' || r.confidence === 'low' || r.confidence === 'none' ? r.confidence : 'none'
  return { value: r.value ?? null, confidence, sources: strArr(r.sources).filter(isHttpUrl) }
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

export type AiMode = 'grounded' | 'ungrounded'

// 搜尋 grounding 不可用（免費額度沒有 Search）：429／RESOURCE_EXHAUSTED，或 400/403 明講 google_search 工具不能用
class GroundingUnavailable extends Error {}

async function callGemini(
  input: { name: string; address: string; mapsUrl: string },
  grounded: boolean,
  fetchImpl: typeof fetch,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Record<string, GeminiFieldResult>> {
  const model = process.env.GEMINI_MODEL
  if (!model) throw new Error('GEMINI_MODEL is not set')
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')

  let res: Response
  try {
    res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(input, grounded) }] }],
        ...(grounded ? { tools: [{ google_search: {} }] } : {}),
      }),
      signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
    })
  } catch (e) {
    throw new HttpError(502, `gemini request failed: ${e instanceof Error ? e.name : 'error'}`)
  }
  if (!res.ok) {
    if (grounded) {
      const body = typeof res.text === 'function' ? await res.text().catch(() => '') : ''
      const quota = res.status === 429 || body.includes('RESOURCE_EXHAUSTED')
      const toolOff = (res.status === 400 || res.status === 403) && /google_search|grounding/i.test(body)
      if (quota || toolOff) throw new GroundingUnavailable(`gemini: HTTP ${res.status}`)
    }
    throw new HttpError(502, `gemini: HTTP ${res.status}`)
  }
  const data = (await res.json().catch(() => {
    throw new HttpError(502, 'gemini: invalid JSON')
  })) as {
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
    .filter(isHttpUrl)

  const out: Record<string, GeminiFieldResult> = {}
  for (const [k, raw] of Object.entries(parsed)) {
    const f = guardField(raw)
    if (!f) continue
    if (!grounded) {
      // 沒上網：不可能有可信來源，信心最多 low
      out[k] = { value: f.value, confidence: f.confidence === 'none' ? 'none' : 'low', sources: [] }
      continue
    }
    // grounding 來源合併進有值的欄位；查無資料的欄位不掛來源
    const sources = f.value === null || f.confidence === 'none' ? f.sources : [...new Set([...f.sources, ...grounding])]
    out[k] = { ...f, sources }
  }
  return out
}

// 只跑有搜尋的版本（grounded）
export function researchCampsite(
  input: { name: string; address: string; mapsUrl: string },
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, GeminiFieldResult>> {
  return callGemini(input, true, fetchImpl)
}

// 先試 grounded；額度或工具不可用就退回不搜尋重試一次。GEMINI_GROUNDING=off 直接跳過 grounded。
// 兩次呼叫共用一個 deadline（絕對毫秒），避免兩段逾時加起來超過 function 的 maxDuration。
export async function researchCampsiteAuto(
  input: { name: string; address: string; mapsUrl: string },
  fetchImpl: typeof fetch = fetch,
  opts: { deadline?: number; now?: () => number } = {},
): Promise<{ fields: Record<string, GeminiFieldResult>; aiMode: AiMode }> {
  const now = opts.now ?? Date.now
  const deadline = opts.deadline ?? now() + TIMEOUT_MS
  if (process.env.GEMINI_GROUNDING?.toLowerCase() !== 'off') {
    try {
      return { fields: await callGemini(input, true, fetchImpl, deadline - now()), aiMode: 'grounded' }
    } catch (e) {
      if (!(e instanceof GroundingUnavailable)) throw e
      console.warn(`gemini: ${e.message}, retrying without search`)
    }
  }
  const remaining = deadline - now()
  if (remaining < MIN_RETRY_MS) throw new HttpError(502, 'gemini: no time left for retry')
  return { fields: await callGemini(input, false, fetchImpl, remaining), aiMode: 'ungrounded' }
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
    if (rawKey === 'campsite_notes') continue
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
