import webpush from 'web-push';
import type { CalendarEventRow } from '../../src/types/database.js';
import { addDays } from '../../src/utils/dateRange.js';
import { HttpError, withErrors } from '../_lib/http.js';
import {
    handleReminders,
    type ReminderDb,
    type ReminderTrip,
    type SendFn,
} from '../_lib/reminders.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

export const config = { maxDuration: 60 };

const PAGE = 1000;

async function listAll<T>(table: string, select: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabaseAdmin
            .from(table)
            .select(select)
            .order('id')
            .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data ?? []) as T[];
        out.push(...rows);
        if (rows.length < PAGE) return out;
    }
}

const db: ReminderDb = {
    async listSubscriptions() {
        return listAll('push_subscriptions', 'id, user_id, endpoint, p256dh, auth');
    },
    async listProfiles(userIds) {
        const { data, error } = await supabaseAdmin.from('profiles').select('id, family_id').in('id', userIds);
        if (error) throw error;
        return data ?? [];
    },
    // 每年重複事件可能是任何年份建立，所以整張表抓（單人／家庭規模，分頁避開 1000 筆上限）
    async listEvents() {
        return listAll<CalendarEventRow>('calendar_events', '*');
    },
    // 夜衝行程起始日 = trip_date - 1，所以多看一天
    async listTrips(day) {
        const { data, error } = await supabaseAdmin
            .from('camping_trips')
            .select('id, trip_date, duration_days, status, night_rush, merged_into_id, user_id, family_id, campsite_name, campsites(name)')
            .gte('trip_date', day)
            .lte('trip_date', addDays(day, 1));
        if (error) throw error;
        return (data ?? []) as unknown as ReminderTrip[];
    },
    async deleteSubscriptions(ids) {
        const { error } = await supabaseAdmin.from('push_subscriptions').delete().in('id', ids);
        if (error) throw error;
    },
    async markSuccess(ids, at) {
        const { error } = await supabaseAdmin.from('push_subscriptions').update({ last_success_at: at }).in('id', ids);
        if (error) throw error;
    },
};

const send: SendFn = async (sub, payload, topic) => {
    await webpush.sendNotification(sub, payload, { TTL: 6 * 3600, topic });
};

const handler = withErrors(async (req: Request): Promise<Response> => {
    const { VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET } = process.env;
    // 先驗證身分再報設定錯誤，避免未授權者探測設定狀態
    if (!CRON_SECRET || req.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) throw new HttpError(401, 'Unauthorized');
    if (!VITE_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) throw new HttpError(500, 'Missing VAPID env');
    webpush.setVapidDetails(VAPID_SUBJECT, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    return handleReminders(req, { db, send, cronSecret: CRON_SECRET });
});

export async function GET(req: Request): Promise<Response> {
    return handler(req);
}
