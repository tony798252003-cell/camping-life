import { describe, it, expect } from 'vitest'
import { creatorNameFor, defaultVisibility, nextVisibility, ownerOf, OWNER_COLOR, OWNER_LABEL } from './visibility'

describe('defaultVisibility', () => {
  // 為什麼：露營、家庭本來就是兩人共同的事，預設全家可少一次點擊；其他（工作、個人、自訂）預設私人比較安全，不會不小心外流
  it('camping / family -> shared；其他與無分類 -> private', () => {
    expect(defaultVisibility('camping')).toBe('shared')
    expect(defaultVisibility('family')).toBe('shared')
    for (const k of ['baseball', 'work', 'personal', null, undefined]) expect(defaultVisibility(k)).toBe('private')
  })
})

describe('nextVisibility', () => {
  // 為什麼：沒手動選過時，換分類要跟著預設，使用者才不用每次改
  it('未手動切換：跟著分類預設', () => {
    expect(nextVisibility({ touched: false, current: 'private', systemKey: 'family' })).toBe('shared')
    expect(nextVisibility({ touched: false, current: 'shared', systemKey: 'work' })).toBe('private')
  })
  // 為什麼：使用者明確選了「只有我」，之後選到家庭分類不能偷偷改回全家（隱私事件外流）
  it('手動切換過：換分類不覆蓋', () => {
    expect(nextVisibility({ touched: true, current: 'private', systemKey: 'family' })).toBe('private')
    expect(nextVisibility({ touched: true, current: 'shared', systemKey: 'work' })).toBe('shared')
  })
})

describe('owner 顏色與標籤', () => {
  // 為什麼：全家／我的顏色是畫面辨識唯一依據（C5），對應錯了就會把私人事件看成共用
  it('shared -> 全家薰衣草；其他 -> 我青綠', () => {
    expect(ownerOf('shared')).toBe('family')
    expect(ownerOf('private')).toBe('me')
    expect(ownerOf(null)).toBe('me')
    expect(OWNER_COLOR.family).toBe('#8E7DBE')
    expect(OWNER_COLOR.me).toBe('#4A9E9B')
    expect(OWNER_LABEL).toEqual({ family: '全家', me: '我' })
  })
})

describe('creatorNameFor', () => {
  const names = new Map([['wife', '小美']])
  // 為什麼：家人新增的全家事件要讓人知道是誰排的
  it('shared 且建立者不是自己 -> 建立者名稱', () => {
    expect(creatorNameFor({ visibility: 'shared', created_by: 'wife' }, 'me', names)).toBe('小美')
  })
  it('查不到名稱 -> 家人', () => {
    expect(creatorNameFor({ visibility: 'shared', created_by: 'x' }, 'me', names)).toBe('家人')
  })
  // 為什麼：自己建立的不需要寫「我新增」；private 本來就只有自己看得到
  it('自己建立或 private -> 不標示', () => {
    expect(creatorNameFor({ visibility: 'shared', created_by: 'me' }, 'me', names)).toBeUndefined()
    expect(creatorNameFor({ visibility: 'private', created_by: 'wife' }, 'me', names)).toBeUndefined()
  })
})
