import { ref } from 'vue'
import type { CampingTripWithCampsite } from '../types/database'

const isOpen = ref(false)
const activeTrip = ref<CampingTripWithCampsite | null>(null)
const initialDate = ref<string | null>(null)

export function useTripModal() {
    const openNew = (date?: string) => {
        activeTrip.value = null
        initialDate.value = date ?? null
        isOpen.value = true
    }

    const openEdit = (trip: CampingTripWithCampsite) => {
        activeTrip.value = trip
        initialDate.value = null
        isOpen.value = true
    }

    const close = () => {
        isOpen.value = false
    }

    return { isOpen, activeTrip, initialDate, openNew, openEdit, close }
}
