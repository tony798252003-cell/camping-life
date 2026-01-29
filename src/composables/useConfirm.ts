import { ref } from 'vue'

export interface ConfirmOptions {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    type?: 'info' | 'warning' | 'danger'
}

interface ConfirmState extends ConfirmOptions {
    isOpen: boolean
    resolve: ((value: boolean) => void) | null
}

const state = ref<ConfirmState>({
    title: '',
    message: '',
    confirmText: '確定',
    cancelText: '取消',
    type: 'info',
    isOpen: false,
    resolve: null
})

export function useConfirm() {
    const confirm = (options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            state.value = {
                ...options,
                confirmText: options.confirmText || '確定',
                cancelText: options.cancelText || '取消',
                type: options.type || 'info',
                isOpen: true,
                resolve
            }
        })
    }

    const handleConfirm = () => {
        if (state.value.resolve) {
            state.value.resolve(true)
        }
        state.value.isOpen = false
        state.value.resolve = null
    }

    const handleCancel = () => {
        if (state.value.resolve) {
            state.value.resolve(false)
        }
        state.value.isOpen = false
        state.value.resolve = null
    }

    return {
        state,
        confirm,
        handleConfirm,
        handleCancel
    }
}
