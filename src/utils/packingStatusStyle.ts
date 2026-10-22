import type { PackUpPrediction } from './weatherAnalysis'

export type PackingStatus = PackUpPrediction['status']
export type PackingIcon = 'sun' | 'rain'

export interface PackingStyle {
  bg: string
  icon: string
  label: string
  desc: string
  iconType: PackingIcon
}

// 為什麼用 Record：新增 status 時 TypeScript 會強制補樣式，避免該狀態沒底色
export const PACKING_STYLES: Record<PackingStatus, PackingStyle> = {
  perfect: { bg: 'bg-emerald-50', icon: 'text-emerald-600', label: 'text-emerald-800', desc: 'text-emerald-700', iconType: 'sun' },
  dry: { bg: 'bg-emerald-50', icon: 'text-emerald-600', label: 'text-emerald-800', desc: 'text-emerald-700', iconType: 'sun' },
  wet: { bg: 'bg-red-50', icon: 'text-red-600', label: 'text-red-800', desc: 'text-red-700', iconType: 'rain' },
  risk: { bg: 'bg-orange-50', icon: 'text-orange-600', label: 'text-orange-800', desc: 'text-orange-700', iconType: 'rain' },
  damp: { bg: 'bg-orange-50', icon: 'text-orange-600', label: 'text-orange-800', desc: 'text-orange-700', iconType: 'rain' },
  chance: { bg: 'bg-yellow-50', icon: 'text-yellow-600', label: 'text-yellow-800', desc: 'text-yellow-700', iconType: 'rain' },
  drying: { bg: 'bg-yellow-50', icon: 'text-yellow-600', label: 'text-yellow-800', desc: 'text-yellow-700', iconType: 'sun' },
}

export function packingStyle(status: PackingStatus): PackingStyle {
  return PACKING_STYLES[status]
}
