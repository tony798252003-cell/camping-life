import { requireUser } from './_lib/auth.js';
import { fetchCpblMonth, resyncYear, type CpblRecord, type ResyncDb } from './_lib/cpbl.js';
import { HttpError, json, withErrors } from './_lib/http.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

const resyncDb: ResyncDb = {
    async upsert(records) {
        const { error } = await supabaseAdmin
            .from('cpbl_schedule')
            .upsert(records, { onConflict: 'game_sno, game_date' });
        if (error) throw error;
    },
    async listExisting(year) {
        const { data, error } = await supabaseAdmin
            .from('cpbl_schedule')
            .select('id, game_sno, game_date')
            .gte('game_date', `${year}-01-01`)
            .lte('game_date', `${year}-12-31`);
        if (error) throw error;
        return data ?? [];
    },
    async listBoundIds() {
        const { data, error } = await supabaseAdmin
            .from('calendar_events')
            .select('cpbl_game_id')
            .not('cpbl_game_id', 'is', null);
        if (error) throw error;
        return (data ?? []).map((r) => r.cpbl_game_id as string);
    },
    async deleteByIds(ids) {
        const { error } = await supabaseAdmin.from('cpbl_schedule').delete().in('id', ids);
        if (error) throw error;
    },
};

export const config = { maxDuration: 60 };

const handler = withErrors(async (req: Request): Promise<Response> => {
    await requireUser(req);

    const body = (await req.json().catch(() => null)) as { year?: unknown; month?: unknown; resyncYear?: unknown } | null;
    const { year, month } = body ?? {};

    if (body?.resyncYear === true) {
        if (!Number.isInteger(year)) throw new HttpError(400, 'year must be an integer');
        try {
            return json(200, await resyncYear(year as number, { fetchMonth: fetchCpblMonth, db: resyncDb }));
        } catch (e) {
            console.error('cpbl-sync: resync failed', e);
            throw new HttpError(502, `CPBL resync failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
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
