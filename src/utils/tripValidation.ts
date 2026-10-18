export const CAMPSITE_REQUIRED_MESSAGE = '請從清單選營區，或按＋新增營區'

// 新增行程必須綁定已收錄的營區；舊行程可能沒有 campsite_id，編輯時不能因此擋存檔
export function canSaveTrip(isNewTrip: boolean, campsiteId: number | null | undefined): boolean {
  if (!isNewTrip) return true
  return !!campsiteId
}
