import { describe, it, expect } from 'vitest'
import { filterByOwner, isOwnerFilter } from './ownerFilter'

const ev = [
  { key: 'event:1', owner: 'family' as const }, // 全家事件
  { key: 'trip:1', owner: 'family' as const }, // 露營行程固定全家
  { key: 'event:2', owner: 'me' as const }, // 私人事件
  { key: 'cpbl:1', owner: 'me' as const }, // 中職比賽固定算我
]

describe('filterByOwner', () => {
  // 為什麼：「全部」是預設，不能偷偷濾掉東西
  it('all 全留', () => {
    expect(filterByOwner(ev, 'all')).toHaveLength(4)
  })
  // 為什麼：看家人共用的行程時，不想被個人事件和球賽干擾
  it('family 只留全家（共用事件＋露營）', () => {
    expect(filterByOwner(ev, 'family').map((e) => e.key)).toEqual(['event:1', 'trip:1'])
  })
  // 為什麼：只看自己的安排時，要含私人事件與球賽，不含家人共用的
  it('me 只留我', () => {
    expect(filterByOwner(ev, 'me').map((e) => e.key)).toEqual(['event:2', 'cpbl:1'])
  })
})

describe('isOwnerFilter', () => {
  // 為什麼：localStorage 可能被改壞，讀回來的值要驗證，否則畫面會全空
  it('只接受三個合法值', () => {
    expect(isOwnerFilter('family')).toBe(true)
    expect(isOwnerFilter('x')).toBe(false)
    expect(isOwnerFilter(null)).toBe(false)
  })
})
