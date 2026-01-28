import { ref } from 'vue'
import imageCompression from 'browser-image-compression'

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export interface CloudinaryResult {
    secure_url: string
    public_id: string
    width: number
    height: number
    original_filename: string
}

export function useCloudinary() {
    const isUploading = ref(false)
    const error = ref<string | null>(null)
    const progress = ref(0) // 0-100

    const compressImage = async (file: File) => {
        const options = {
            maxSizeMB: 1, // Max 1MB (keeps quality high but safely under limit)
            maxWidthOrHeight: 1920, // 1080p+
            useWebWorker: true,
            fileType: 'image/webp' // Convert to WebP
        }
        try {
            return await imageCompression(file, options)
        } catch (e) {
            console.error('Compression failed:', e)
            return file // Fallback to original
        }
    }

    const uploadImage = async (file: File): Promise<CloudinaryResult | null> => {
        if (!CLOUD_NAME || !UPLOAD_PRESET) {
            error.value = 'Cloudinary configuration missing'
            return null
        }

        isUploading.value = true
        error.value = null
        progress.value = 0

        try {
            // 1. Compress
            const compressedFile = await compressImage(file)

            // 2. Prepare FormData
            const formData = new FormData()
            formData.append('file', compressedFile)
            formData.append('upload_preset', UPLOAD_PRESET)

            // 3. Upload (using XMLHttpRequest for progress, or simple Fetch)
            // Using Fetch for simplicity, but XHR allows progress. 
            // Let's use XHR for better UX if possible, or just fake progress.
            // Let's use simple fetch for robustness first.

            const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`

            const response = await fetch(url, {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const errData = await response.json()
                throw new Error(errData.error?.message || 'Upload failed')
            }

            const data = await response.json()

            return {
                secure_url: data.secure_url,
                public_id: data.public_id,
                width: data.width,
                height: data.height,
                original_filename: data.original_filename
            }

        } catch (e: any) {
            error.value = e.message || 'Upload failed'
            console.error('Cloudinary upload error:', e)
            return null
        } finally {
            isUploading.value = false
        }
    }

    return {
        uploadImage,
        isUploading,
        error,
        progress
    }
}
