import type { Owner } from './visibility.js'

// 行事曆「誰的」篩選：all 全部、family 只看全家、me 只看我
export type OwnerFilter = 'all' | Owner

export const OWNER_FILTERS: OwnerFilter[] = ['all', 'family', 'me']

export const isOwnerFilter = (v: unknown): v is OwnerFilter => v === 'all' || v === 'family' || v === 'me'

export function filterByOwner<T extends { owner: Owner }>(events: T[], f: OwnerFilter): T[] {
  return f === 'all' ? events : events.filter((e) => e.owner === f)
}
