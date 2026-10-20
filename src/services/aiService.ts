import { apiPost } from './api';

export interface CampsiteInfo {
    location?: string;
    altitude?: number;
    tags?: string[];
    description?: string;
    coordinates?: { lat: number; lng: number };
}

export async function fetchCampsiteInfo(campsiteName: string): Promise<CampsiteInfo> {
    try {
        return await apiPost<CampsiteInfo>('/api/camping-info', { campsiteName });
    } catch (error) {
        console.error('AI Service Error:', error);
        throw error;
    }
}
