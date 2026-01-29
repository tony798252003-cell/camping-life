import { ref } from 'vue'

export interface Notification {
    id: number
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
    duration?: number
}

const notifications = ref<Notification[]>([])

export function useNotification() {
    const notify = (
        message: string,
        type: Notification['type'] = 'info',
        duration: number = 3000
    ) => {
        const id = Date.now() + Math.random()

        notifications.value.push({ id, message, type, duration })

        if (duration > 0) {
            setTimeout(() => {
                remove(id)
            }, duration)
        }
    }

    const remove = (id: number) => {
        notifications.value = notifications.value.filter(n => n.id !== id)
    }

    const success = (message: string, duration?: number) => notify(message, 'success', duration)
    const error = (message: string, duration?: number) => notify(message, 'error', duration)
    const info = (message: string, duration?: number) => notify(message, 'info', duration)
    const warning = (message: string, duration?: number) => notify(message, 'warning', duration)

    return {
        notifications,
        notify,
        remove,
        success,
        error,
        info,
        warning
    }
}
