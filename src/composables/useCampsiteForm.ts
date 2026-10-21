import { ref, computed } from 'vue'
import type { Campsite, FieldSource, FieldSources } from '../types/database'

// 不算「使用者修改資料欄位」的 key：唯讀、系統欄位、或不屬於 AI 補資料範圍
const NON_DATA_KEYS = new Set([
  'id', 'created_at', 'created_by', 'field_sources', 'is_verified', 'merged_into_id',
])

// null / undefined / 空字串視為同一種「沒填」，避免 '' 與 null 互轉被當成修改
const norm = (v: unknown) => (v === null || v === undefined || v === '' ? null : JSON.stringify(v))
// 時段字串載入時會加空格（"18:00-22:00" → "18:00 - 22:00"），比對時忽略
const normTime = (v: unknown) => (typeof v === 'string' ? norm(v.replace(/\s+/g, '')) : norm(v))

function parseRange(s: string | null | undefined): [string, string] {
  if (!s || !s.includes('-')) return ['', '']
  const [a, b, ...rest] = s.split('-')
  return rest.length === 0 && a && b ? [a.trim(), b.trim()] : ['', '']
}

// 營地編輯表單狀態（非 singleton：每個 modal 一份）
export function useCampsiteForm() {
  const form = ref<Partial<Campsite>>({})
  const original = ref<Partial<Campsite>>({})
  const tagsString = ref('')
  const nightRushStart = ref('')
  const nightRushEnd = ref('')
  const showerStart = ref('')
  const showerEnd = ref('')
  const isShower24H = ref(false)
  let initialTimes = ''

  const timesKey = () =>
    [nightRushStart.value, nightRushEnd.value, showerStart.value, showerEnd.value, isShower24H.value].join('|')

  function init(c: Campsite) {
    form.value = {
      ...c,
      amenities: c.amenities || { has_fridge: false, has_freezer: false, has_water_dispenser: false },
      playground_features: c.playground_features ?? [],
      water_features: c.water_features ?? [],
      scenery_features: c.scenery_features ?? [],
      spot_types: c.spot_types ?? [],
      booking_method: c.booking_method ?? [],
      booking_difficulty: c.booking_difficulty ?? 'normal',
      capacity_zones: c.capacity_zones ?? [],
      field_sources: c.field_sources ?? {},
    }
    original.value = JSON.parse(JSON.stringify(form.value))
    tagsString.value = c.tags ? c.tags.join(', ') : ''
    ;[nightRushStart.value, nightRushEnd.value] = parseRange(c.night_rush_time)
    if (c.shower_restrictions === '24H') {
      isShower24H.value = true
      showerStart.value = ''
      showerEnd.value = ''
    } else {
      isShower24H.value = false
      ;[showerStart.value, showerEnd.value] = parseRange(c.shower_restrictions)
    }
    initialTimes = timesKey()
  }

  function snapshot() {
    return {
      form: form.value,
      tagsString: tagsString.value,
      nightRushStart: nightRushStart.value,
      nightRushEnd: nightRushEnd.value,
      showerStart: showerStart.value,
      showerEnd: showerEnd.value,
      isShower24H: isShower24H.value,
    }
  }

  function applySnapshot(d: Partial<ReturnType<typeof snapshot>>) {
    if (d.form) form.value = d.form
    tagsString.value = d.tagsString ?? ''
    nightRushStart.value = d.nightRushStart ?? ''
    nightRushEnd.value = d.nightRushEnd ?? ''
    showerStart.value = d.showerStart ?? ''
    showerEnd.value = d.showerEnd ?? ''
    isShower24H.value = d.isShower24H ?? false
  }

  const unconfirmedKeys = computed(() =>
    Object.entries(form.value.field_sources ?? {})
      .filter(([, s]) => !s.confirmed)
      .map(([k]) => k),
  )

  // 使用者看過覺得沒錯：只標確認，值與來源不動
  function confirmField(key: string) {
    const fs = form.value.field_sources
    const s = fs?.[key]
    if (fs && s) fs[key] = { ...s, confirmed: true }
  }

  // 送出前整理；使用者改過的欄位 → field_sources 標成 manual + confirmed
  function toPayload(): Record<string, unknown> {
    const updates: Record<string, unknown> = { ...form.value }
    updates.tags = tagsString.value.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    if (timesKey() !== initialTimes) {
      updates.night_rush_time =
        nightRushStart.value && nightRushEnd.value ? `${nightRushStart.value} - ${nightRushEnd.value}` : ''
      updates.shower_restrictions = isShower24H.value
        ? '24H'
        : showerStart.value && showerEnd.value
          ? `${showerStart.value} - ${showerEnd.value}`
          : ''
    }

    const orig = original.value as Record<string, unknown>
    const sources: FieldSources = { ...(form.value.field_sources ?? {}) }
    for (const key of Object.keys(updates)) {
      if (NON_DATA_KEYS.has(key)) continue
      const isTime = key === 'night_rush_time' || key === 'shower_restrictions'
      const n = isTime ? normTime : norm
      const origVal = key === 'tags' ? orig.tags ?? [] : orig[key]
      if (n(updates[key]) === n(origVal)) continue
      const empty = norm(updates[key]) === null
      const src: FieldSource = { source: 'manual', confidence: empty ? 'none' : 'high', urls: [], confirmed: true }
      sources[key] = src
    }
    updates.field_sources = sources

    delete updates.id
    delete updates.created_at
    delete updates.created_by
    return updates
  }

  return {
    form, tagsString, nightRushStart, nightRushEnd, showerStart, showerEnd, isShower24H,
    unconfirmedKeys, init, snapshot, applySnapshot, confirmField, toPayload,
  }
}
