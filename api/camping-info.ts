export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { campsiteName } = await req.json();

        if (!campsiteName) {
            return new Response(JSON.stringify({ error: 'Campsite name is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const API_KEY = process.env.GEMINI_API_KEY;
        // 使用穩定的最新別名
        const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

        const prompt = `
      你是一位台灣露營專家。請提供 "${campsiteName}" 的精確資訊。
      必須只回傳一個 JSON 物件（不要 Markdown）：
      {
        "location": "字串 (縣市鄉鎮)",
        "altitude": 數字 (公尺),
        "tags": ["字串陣列", 最多 5 個],
        "description": "簡短介紹 (100 字內)",
        "coordinates": { "lat": 數字, "lng": 數字 }
      }
    `;

        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            }),
        });

        const data: any = await response.json();

        if (data.error) throw new Error(data.error.message);

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonString = text.replace(/```json|```/g, '').trim();
        const result = JSON.parse(jsonString);

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
