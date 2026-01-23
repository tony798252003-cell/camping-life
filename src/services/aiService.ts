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

        if (response.status === 404 && import.meta.env.VITE_GEMINI_API_KEY) {
            return await fetchFromGeminiDirectly(campsiteName);
        }

        throw new Error(`API returned ${response.status}`);
    } catch (error) {
        console.error('AI Service Error:', error);
        if (import.meta.env.DEV && import.meta.env.VITE_GEMINI_API_KEY) {
            return await fetchFromGeminiDirectly(campsiteName);
        }
        throw error;
    }
}

async function fetchFromGeminiDirectly(campsiteName: string): Promise<CampsiteInfo> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('找不到 API Key');

    // 使用 aliases 較穩定，會自動指向該 Key 可用的最新版本
    const modelsToTry = [
        { version: 'v1', name: 'gemini-flash-latest' },
        { version: 'v1', name: 'gemini-pro-latest' },
        { version: 'v1beta', name: 'gemini-2.0-flash' }
    ];

    let lastError = '';

    for (const model of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/${model.version}/models/${model.name}:generateContent?key=${apiKey}`;

            const prompt = `
        你是一位台灣露營專家。請提供 "${campsiteName}" 的精確資訊。
        必須只回傳一個 JSON 物件（絕對不要 Markdown 標籤）：
        {
          "location": "字串 (縣市鄉鎮)",
          "altitude": 數字 (公尺),
          "tags": ["字串陣列", 最多 5 個],
          "description": "字串 (簡短特色介紹)",
          "coordinates": { "lat": 數字, "lng": 數字 }
        }
      `;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                }),
            });

            const data = await response.json();

            if (response.ok) {
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const jsonString = text.replace(/```json|```/g, '').trim();
                return JSON.parse(jsonString);
            } else if (response.status === 429) {
                throw new Error('AI 目前請求過於頻繁（Rate Limit），請稍等 1 分鐘再試。');
            } else {
                lastError = data.error?.message || `HTTP ${response.status}`;
                console.warn(`嘗試模型 ${model.name} 失敗: ${lastError}`);
            }
        } catch (e: any) {
            if (e.message.includes('Rate Limit')) throw e; // 429 直接拋出，不嘗試下一個
            lastError = e.message;
        }
    }

    throw new Error(`AI 搜尋失敗：${lastError}`);
}
