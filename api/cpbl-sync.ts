import { requireUser } from './_lib/auth.js';
import { fetchCpblMonth, type CpblRecord } from './_lib/cpbl.js';
import { HttpError, json, withErrors } from './_lib/http.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

export const config = { maxDuration: 60 };

const handler = withErrors(async (req: Request): Promise<Response> => {
    await requireUser(req);

    const body = (await req.json().catch(() => null)) as { year?: unknown; month?: unknown } | null;
    const { year, month } = body ?? {};
    if (!Number.isInteger(year) || !Number.isInteger(month) || (month as number) < 1 || (month as number) > 12) {
        throw new HttpError(400, 'year and month must be integers (month 1-12)');
    }

    let records: CpblRecord[];
    try {
        records = await fetchCpblMonth(year as number, month as number);
    } catch (e) {
        console.error('cpbl-sync: fetch failed', e);
        throw new HttpError(502, `CPBL fetch failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (records.length > 0) {
        const { error } = await supabaseAdmin
            .from('cpbl_schedule')
            .upsert(records, { onConflict: 'game_sno, game_date' });
        if (error) throw error;
    }
    return json(200, { upserted: records.length });
});

export async function POST(req: Request): Promise<Response> {
    return handler(req);
}
