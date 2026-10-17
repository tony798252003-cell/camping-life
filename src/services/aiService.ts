export interface CampsiteInfo {
    location?: string;
    altitude?: number;
    tags?: string[];
    description?: string;
    coordinates?: { lat: number; lng: number };
}

export async function fetchCampsiteInfo(campsiteName: string): Promise<CampsiteInfo> {
    try {
        const response = await fetch('/api/camping-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campsiteName })
        });

        if (response.ok) {
            return await response.json();
        }

        throw new Error(`API returned ${response.status}`);
    } catch (error) {
        console.error('AI Service Error:', error);
        throw error;
    }
}
