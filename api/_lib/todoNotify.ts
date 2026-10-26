import { HttpError, json } from './http.js'
import { isGone, type Subscription } from './reminders.js'

// 新增家庭待辦時通知家人：純邏輯（收件人、通知文字）與 IO 分開，方便測試。

const MAX_TEXT = 100

export interface TodoItemFamily {
  text: string
  family_id: string
}

export interface TodoNotifyDb {
  // 項目與其所屬清單的 family_id；找不到回 null
  getItem(itemId: string): Promise<TodoItemFamily | null>
  // 該家庭所有成員的 user id（profiles.family_id）
  listFamilyMemberIds(familyId: string): Promise<string[]>
  getSenderName(userId: string): Promise<string | null>
  listSubscriptions(userIds: string[]): Promise<Subscription[]>
  deleteSubscriptions(ids: string[]): Promise<void>
}

export type TodoSendFn = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<void>

export interface TodoNotifyResult {
  recipients: number
  sent: number
  removed: number
  failed: number
}

// 收件人：同家庭、排除自己（自己剛新增，不需要再被通知）
export function recipientIds(memberIds: string[], senderId: string): string[] {
  return [...new Set(memberIds)].filter((id) => id !== senderId)
}

// 名字取自 Google 登入的 user_metadata；沒有就用「家人」（不用 email，避免通知上出現帳號）
export function senderNameFromMeta(meta: Record<string, unknown> | null | undefined): string | null {
  for (const k of ['full_name', 'name']) {
    const v = meta?.[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

export function buildTodoPayload(i: { senderName: string | null; text: string; itemId: string }) {
  const t = i.text.trim()
  const text = t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT)}…` : t
  return {
    title: '家庭待辦',
    body: `${i.senderName?.trim() || '家人'}新增：${text}`,
    url: '/todo',
    // 每個項目各自一則，連續新增多項不會互相取代
    tag: `todo-${i.itemId}`,
  }
}

export async function runTodoNotify(
  i: { userId: string; itemId: string },
  deps: { db: TodoNotifyDb; send: TodoSendFn },
): Promise<TodoNotifyResult> {
  const item = await deps.db.getItem(i.itemId)
  const members = item ? await deps.db.listFamilyMemberIds(item.family_id) : []
  // 不是自己家庭的項目一律當作不存在，不透露別家的項目 id 是否存在
  if (!item || !members.includes(i.userId)) throw new HttpError(404, 'Item not found')

  const result: TodoNotifyResult = { recipients: 0, sent: 0, removed: 0, failed: 0 }
  const to = recipientIds(members, i.userId)
  if (to.length === 0) return result
  const subs = await deps.db.listSubscriptions(to)
  result.recipients = new Set(subs.map((s) => s.user_id)).size
  if (subs.length === 0) return result

  const payload = JSON.stringify(buildTodoPayload({ senderName: await deps.db.getSenderName(i.userId), text: item.text, itemId: i.itemId }))
  const gone: string[] = []
  await Promise.all(
    subs.map(async (s) => {
      try {
        await deps.send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        result.sent++
      } catch (e) {
        if (isGone(e)) {
          gone.push(s.id)
          result.removed++
        } else {
          result.failed++
          console.error('todo-notify: send failed', s.id, e)
        }
      }
    }),
  )
  if (gone.length > 0) await deps.db.deleteSubscriptions(gone).catch((e) => console.error('todo-notify: cleanup failed', e))
  return result
}

export async function handleTodoNotify(
  req: Request,
  userId: string,
  deps: { db: TodoNotifyDb; send: TodoSendFn },
): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { itemId?: unknown } | null
  const itemId = typeof body?.itemId === 'string' ? body.itemId.trim() : ''
  // uuid 格式先擋：非 uuid 直接進 Postgres 會變成 500
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemId)) throw new HttpError(400, 'itemId must be a uuid')
  return json(200, { ok: true, ...(await runTodoNotify({ userId, itemId }, deps)) })
}
