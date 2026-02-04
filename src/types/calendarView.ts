export interface ViewEvent {
    type: 'trip' | 'custom'
    id: string | number
    title: string
    subtitle?: string
    date: Date
    color: string
    data: any // Original object
    isAllDay: boolean
}
