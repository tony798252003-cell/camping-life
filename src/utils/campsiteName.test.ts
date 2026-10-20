import { describe, it, expect } from 'vitest'
import { cleanCampsiteName } from './campsiteName'

describe('cleanCampsiteName', () => {
  it('Google 顯示名稱常塞行銷字尾，遇到第一個分隔符就截斷', () => {
    expect(cleanCampsiteName('雲頂露營區｜親子｜雲海｜免裝備')).toBe('雲頂露營區')
    expect(cleanCampsiteName('雲頂露營區 | 親子')).toBe('雲頂露營區')
    expect(cleanCampsiteName('雲頂露營區 - 親子')).toBe('雲頂露營區')
  })
  it('沒有空白的連字號是名稱的一部分，不能截斷', () => {
    expect(cleanCampsiteName('A-Ma 營地')).toBe('A-Ma 營地')
  })
  it('前後空白會被清掉', () => {
    expect(cleanCampsiteName('  雲頂  ')).toBe('雲頂')
  })
})
