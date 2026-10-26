import webpush from 'web-push';
import { requireUser } from './_lib/auth.js';
import { HttpError, withErrors } from './_lib/http.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { handleTodoNotify, senderNameFromMeta, type TodoNotifyDb, type TodoSendFn } from './_lib/todoNotify.js';

export const config = { maxDuration: 60 };

const db: TodoNotifyDb = {
    async getItem(itemId) {
        const { data, error } = await supabaseAdmin
            .from('family_list_items')
            .select('text, family_lists(family_id)')
            .eq('id', itemId)
            .maybeSingle();
        if (error) throw error;
        const fid = (data as { family_lists?: { family_id: string } | null } | null)?.family_lists?.family_id;
        return data && fid ? { text: (data as { text: string }).text, family_id: fid } : null;
    },
    async listFamilyMemberIds(familyId) {
        const { data, error } = await supabaseAdmin.from('profiles').select('id').eq('family_id', familyId);
        if (error) throw error;
        return (data ?? []).map((p) => p.id as string);
    },
    async getSenderName(userId) {
        // 名字只是錦上添花，查不到就用「家人」
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (error) return null;
        return senderNameFromMeta(data.user?.user_metadata);
    },
    async listSubscriptions(userIds) {
        const { data, error } = await supabaseAdmin
            .from('push_subscriptions')
            .select('id, user_id, endpoint, p256dh, auth')
            .in('user_id', userIds);
        if (error) throw error;
        return data ?? [];
    },
    async deleteSubscriptions(ids) {
        const { error } = await supabaseAdmin.from('push_subscriptions').delete().in('id', ids);
        if (error) throw error;
    },
};

const send: TodoSendFn = async (sub, payload) => {
    await webpush.sendNotification(sub, payload, { TTL: 24 * 3600 });
};

const handler = withErrors(async (req: Request): Promise<Response> => {
    const { userId } = await requireUser(req);
    const { VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    if (!VITE_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) throw new HttpError(500, 'Missing VAPID env');
    webpush.setVapidDetails(VAPID_SUBJECT, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    return handleTodoNotify(req, userId, { db, send });
});

export async function POST(req: Request): Promise<Response> {
    return handler(req);
}
