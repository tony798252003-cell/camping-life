import { HttpError, json, withErrors } from '../_lib/http.js';
import { fetchRating, runRatingsRefresh, type RatingCandidate } from '../_lib/ratings.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

export const config = { maxDuration: 60 };

const PAGE = 1000;

async function listCandidates(): Promise<RatingCandidate[]> {
    const out: RatingCandidate[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabaseAdmin
            .from('campsites')
            .select('id, google_place_id, google_rating_at')
            .not('google_place_id', 'is', null)
            .is('merged_into_id', null)
            .order('id')
            .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data ?? []) as RatingCandidate[];
        out.push(...rows);
        if (rows.length < PAGE) return out;
    }
}

const handler = withErrors(async (req: Request): Promise<Response> => {
    const { CRON_SECRET } = process.env;
    // 先驗證身分再報設定錯誤，避免未授權者探測設定狀態
    if (!CRON_SECRET || req.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) throw new HttpError(401, 'Unauthorized');
    if (!process.env.GOOGLE_PLACES_SERVER_KEY) throw new HttpError(500, 'Missing GOOGLE_PLACES_SERVER_KEY');
    const summary = await runRatingsRefresh({
        listCandidates,
        fetchRating: (placeId) => fetchRating(placeId),
        async update(id, patch) {
            const { error } = await supabaseAdmin.from('campsites').update(patch).eq('id', id);
            if (error) throw error;
        },
        now: () => new Date(),
        log: (msg) => console.warn(msg),
    });
    return json(200, summary);
});

export async function GET(req: Request): Promise<Response> {
    return handler(req);
}
