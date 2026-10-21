import type { NewCampingTrip } from '../types/database'

// 新增才寫入 user_id / family_id；編輯時絕不送，否則家人編輯會把行程擁有者改掉，原擁有者就刪不掉
export const buildTripSavePayload = (
  tripData: NewCampingTrip,
  opts: { isEdit: boolean; userId: string; familyId: string | null }
): NewCampingTrip | Partial<NewCampingTrip> => {
  if (opts.isEdit) {
    const { user_id: _u, family_id: _f, ...rest } = tripData
    return rest
  }
  return { ...tripData, user_id: opts.userId, family_id: opts.familyId }
}
