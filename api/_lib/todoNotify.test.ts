import { describe, it, expect, vi } from 'vitest'
import { HttpError } from './http.js'
import type { Subscription } from './reminders.js'
import {
  buildTodoPayload,
  handleTodoNotify,
  recipientIds,
  runTodoNotify,
  senderNameFromMeta,
  type TodoNotifyDb,
  type TodoSendFn,
} from './todoNotify.js'

const ITEM = '11111111-2222-3333-4444-555555555555'
const sub = (id: string, user_id: string): Subscription => ({ id, user_id, endpoint: `https://push/${id}`, p256dh: 'p', auth: 'a' })

const makeDb = (over: Partial<TodoNotifyDb> = {}): TodoNotifyDb => ({
  getItem: vi.fn(async () => ({ text: '買牛奶', family_id: 'f1' })),
  listFamilyMemberIds: vi.fn(async () => ['me', 'wife']),
  getSenderName: vi.fn(async () => '小明'),
  listSubscriptions: vi.fn(async (ids: string[]) => [sub('s-me', 'me'), sub('s-wife', 'wife')].filter((s) => ids.includes(s.user_id))),
  deleteSubscriptions: vi.fn(async () => {}),
  ...over,
})

describe('recipientIds', () => {
  it('排除寄件人：自己剛新增的項目，再推播給自己的手機只是噪音', () => {
    expect(recipientIds(['me', 'wife'], 'me')).toEqual(['wife'])
  })
  it('家庭只有自己時沒有收件人（UI 據此提示「家人還沒開啟通知」）', () => {
    expect(recipientIds(['me'], 'me')).toEqual([])
  })
})

describe('senderNameFromMeta', () => {
  it('優先用 Google 的 full_name，其次 name', () => {
    expect(senderNameFromMeta({ full_name: ' 小明 ', name: 'x' })).toBe('小明')
    expect(senderNameFromMeta({ name: 'Ming' })).toBe('Ming')
  })
  it('沒有名字回 null，不退回 email：通知會顯示在鎖定畫面，不該露出帳號', () => {
    expect(senderNameFromMeta({ email: 'a@b.c', full_name: '  ' })).toBeNull()
    expect(senderNameFromMeta(null)).toBeNull()
  })
})

describe('buildTodoPayload', () => {
  it('文字格式為「名字新增：項目」，點開到 /todo', () => {
    expect(buildTodoPayload({ senderName: '小明', text: ' 買牛奶 ', itemId: ITEM })).toEqual({
      title: '家庭待辦',
      body: '小明新增：買牛奶',
      url: '/todo',
      tag: `todo-${ITEM}`,
    })
  })
  it('沒有名字時用「家人」，通知仍看得懂是誰的動作', () => {
    expect(buildTodoPayload({ senderName: null, text: '買牛奶', itemId: ITEM }).body).toBe('家人新增：買牛奶')
  })
  it('tag 依項目區分：連續新增兩項時，第二則不會把第一則取代掉', () => {
    expect(buildTodoPayload({ senderName: null, text: 'a', itemId: 'x' }).tag).not.toBe(
      buildTodoPayload({ senderName: null, text: 'a', itemId: 'y' }).tag,
    )
  })
  it('過長文字截斷：推播 payload 有大小上限（約 4KB），超過整則會送不出去', () => {
    const body = buildTodoPayload({ senderName: '小明', text: '字'.repeat(500), itemId: ITEM }).body
    expect(body.length).toBeLessThan(120)
    expect(body.endsWith('…')).toBe(true)
  })
})

describe('runTodoNotify', () => {
  it('只送給家人的裝置，不送給自己', async () => {
    const db = makeDb()
    const send = vi.fn<TodoSendFn>(async () => {})
    const r = await runTodoNotify({ userId: 'me', itemId: ITEM }, { db, send })
    expect(r).toEqual({ recipients: 1, sent: 1, removed: 0, failed: 0 })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![0].endpoint).toBe('https://push/s-wife')
    expect(JSON.parse(send.mock.calls[0]![1]).body).toBe('小明新增：買牛奶')
  })

  it('不是呼叫者家庭的項目回 404：不能拿別家的項目 id 去推播給別人', async () => {
    const db = makeDb({ listFamilyMemberIds: vi.fn(async () => ['other1', 'other2']) })
    const send = vi.fn<TodoSendFn>(async () => {})
    await expect(runTodoNotify({ userId: 'me', itemId: ITEM }, { db, send })).rejects.toMatchObject({ status: 404 })
    expect(send).not.toHaveBeenCalled()
  })

  it('項目不存在回 404', async () => {
    const db = makeDb({ getItem: vi.fn(async () => null) })
    await expect(runTodoNotify({ userId: 'me', itemId: ITEM }, { db, send: vi.fn() })).rejects.toBeInstanceOf(HttpError)
  })

  it('家人沒有訂閱時 sent 為 0 且不報錯（前端據此提示，而不是當成失敗）', async () => {
    const db = makeDb({ listSubscriptions: vi.fn(async () => []) })
    const r = await runTodoNotify({ userId: 'me', itemId: ITEM }, { db, send: vi.fn() })
    expect(r).toEqual({ recipients: 0, sent: 0, removed: 0, failed: 0 })
  })

  it('失效訂閱（410）刪除、其他錯誤只計數：避免之後每次都對死掉的 endpoint 重送', async () => {
    const db = makeDb({
      listFamilyMemberIds: vi.fn(async () => ['me', 'wife', 'kid']),
      listSubscriptions: vi.fn(async () => [sub('s-wife', 'wife'), sub('s-kid', 'kid')]),
    })
    const send = vi.fn<TodoSendFn>(async (s) => {
      if (s.endpoint.endsWith('s-wife')) throw Object.assign(new Error('gone'), { statusCode: 410 })
      throw Object.assign(new Error('boom'), { statusCode: 500 })
    })
    const r = await runTodoNotify({ userId: 'me', itemId: ITEM }, { db, send })
    expect(r).toEqual({ recipients: 2, sent: 0, removed: 1, failed: 1 })
    expect(db.deleteSubscriptions).toHaveBeenCalledWith(['s-wife'])
  })
})

describe('handleTodoNotify', () => {
  const post = (body: unknown) => new Request('http://x/api/todo-notify', { method: 'POST', body: JSON.stringify(body) })

  it('itemId 不是 uuid 回 400：直接丟進 Postgres 的 uuid 欄位會變成 500', async () => {
    await expect(handleTodoNotify(post({ itemId: 'abc' }), 'me', { db: makeDb(), send: vi.fn() })).rejects.toMatchObject({ status: 400 })
  })

  it('成功回 ok 與計數', async () => {
    const res = await handleTodoNotify(post({ itemId: ITEM }), 'me', { db: makeDb(), send: vi.fn(async () => {}) })
    expect(await res.json()).toEqual({ ok: true, recipients: 1, sent: 1, removed: 0, failed: 0 })
  })
})
