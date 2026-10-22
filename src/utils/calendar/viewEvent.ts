import type { Owner } from './visibility.js'

// 行事曆統一顯示用的事件型別：行程、使用者事件、中職比賽都轉成 ViewEvent。
export type ViewEventSource = 'event' | 'trip' | 'cpbl'

// 「多天事件」＝ allDay && endDate > startDate（規格 §5.4）。timed 事件即使跨午夜也不是多天事件。
export interface ViewEvent {
  key: string // `${source}:${sourceId}`
  source: ViewEventSource
  sourceId: string | number
  title: string
  color: string // 由可見性決定（全家／我），不是分類色
  owner: Owner
  categoryName?: string // 副標用
  creatorName?: string // 只有「全家事件、建立者不是自己」才有
  categoryId: string | null
  allDay: boolean
  startDate: string // 含頭尾，台北時間
  endDate: string
  startMin?: number // 只有 timed 事件有：startDate 當日分鐘數
  endMin?: number // endDate 當日分鐘數
  past: boolean // endDate < today
  nightRushDate?: string // 只有夜衝的 trip 有 = trip_date - 1；此時 startDate 也等於它
}
