import { ref } from 'vue'
import { useCalendarFeed } from './useCalendarFeed'
import { useEventEditor } from './useEventEditor'
import { useTripModal } from './useTripModal'
import { useTrips } from './useTrips'
import type { CpblSchedule } from '../types/database'
import type { ViewEvent } from '../utils/calendar/viewEvent'

// 點事件時的共用行為：行程開 TripModal、使用者事件開詳情 sheet、賽程開賽事 sheet
// （行事曆分頁與首頁「今天」清單共用，狀態由各自頁面持有並掛載對應 sheet）
export function useEventOpener() {
  const { games } = useCalendarFeed()
  const { findTripById } = useTrips()
  const { openEdit } = useTripModal()
  const eventEditor = useEventEditor()

  const detailEventId = ref<string | null>(null)
  const gameSheet = ref<CpblSchedule | null>(null)

  const onOpen = (ev: ViewEvent) => {
    if (ev.source === 'trip') {
      const trip = findTripById(Number(ev.sourceId))
      if (trip) openEdit(trip)
    } else if (ev.source === 'event') {
      detailEventId.value = String(ev.sourceId)
    } else {
      gameSheet.value = games.value.find((g) => g.id === ev.sourceId) ?? null
    }
  }
  const onAddGame = (g: CpblSchedule) => {
    gameSheet.value = null
    eventEditor.openWithGame(g)
  }
  return { detailEventId, gameSheet, onOpen, onAddGame }
}
