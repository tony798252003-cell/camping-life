import { describe, it, expect } from 'vitest'
import { isAllowedMapsHost, parseMapsUrl, resolveShortUrl } from './mapsUrl.js'
import { HttpError } from './http.js'

// 只有短網址主機會轉址；轉址目的地回 200，模擬真實終點
function redirectFetch(location: string) {
  return (async (u: string) =>
    new URL(u).hostname === 'maps.app.goo.gl'
      ? new Response(null, { status: 302, headers: { Location: location } })
      : new Response('', { status: 200 })) as unknown as typeof fetch
}

describe('parseMapsUrl', () => {
  it('讀出 /place/<名稱>/@lat,lng — 使用者貼的長連結要能取得名稱與座標', () => {
    expect(parseMapsUrl('https://www.google.com/maps/place/%E9%9B%B2%E9%A0%82%E9%9C%B2%E7%87%9F%E5%8D%80/@24.6,121.2,15z'))
      .toEqual({ name: '雲頂露營區', lat: 24.6, lng: 121.2 })
  })
  it('!3d/!4d 優先於 @（它是店家真正的點位，較精確）', () => {
    const r = parseMapsUrl('https://www.google.com/maps/place/X/@24.6,121.2,15z/data=!3d24.61!4d121.23')
    expect(r).toMatchObject({ lat: 24.61, lng: 121.23 })
  })
  it('?q= 與 ?query= 當作搜尋字串', () => {
    expect(parseMapsUrl('https://maps.google.com/?q=雲頂露營區')).toEqual({ query: '雲頂露營區' })
    expect(parseMapsUrl('https://www.google.com/maps/search/?api=1&query=abc')).toEqual({ query: 'abc' })
  })
  it('?cid= 取出 cid', () => {
    expect(parseMapsUrl('https://maps.google.com/?cid=123')).toEqual({ cid: '123' })
  })
  it('不是網址回傳 null，避免後續流程拿到垃圾', () => {
    expect(parseMapsUrl('not a url')).toBeNull()
  })
})

describe('isAllowedMapsHost (Review Focus 3)', () => {
  it('非 Google 網域拒絕，伺服器不得去抓', () => {
    expect(isAllowedMapsHost('https://www.facebook.com/x')).toBe(false)
  })
  it('只接受 https，避免被降級或打到內網', () => {
    expect(isAllowedMapsHost('http://maps.app.goo.gl/x')).toBe(false)
    expect(isAllowedMapsHost('https://maps.app.goo.gl/x')).toBe(true)
  })
  it('hostname 必須完全相符，不能用 google.com.evil.io 冒充', () => {
    expect(isAllowedMapsHost('https://google.com.evil.io/x')).toBe(false)
  })
  it('壞網址回傳 false', () => {
    expect(isAllowedMapsHost('nope')).toBe(false)
  })
})

describe('resolveShortUrl (Review Focus 3)', () => {
  it('轉址到內網 IP 時拒絕（SSRF），回 400', async () => {
    const p = resolveShortUrl('https://maps.app.goo.gl/a', redirectFetch('http://169.254.169.254/'))
    await expect(p).rejects.toMatchObject({ status: 400 })
    await expect(p).rejects.toBeInstanceOf(HttpError)
  })
  it('起始網址不是 Google 就不發請求', async () => {
    let called = false
    const f = (async () => { called = true; return new Response() }) as unknown as typeof fetch
    await expect(resolveShortUrl('https://www.facebook.com/x', f)).rejects.toMatchObject({ status: 400 })
    expect(called).toBe(false)
  })
  it('轉址到 Google 長連結時回傳完整 URL', async () => {
    const full = 'https://www.google.com/maps/place/abc/@24.6,121.2,15z'
    expect(await resolveShortUrl('https://maps.app.goo.gl/a', redirectFetch(full))).toBe(full)
  })
  it('轉址超過 5 跳就放棄，避免無限迴圈', async () => {
    const loop = (async () => new Response(null, { status: 302, headers: { Location: 'https://maps.app.goo.gl/b' } })) as unknown as typeof fetch
    await expect(resolveShortUrl('https://maps.app.goo.gl/a', loop)).rejects.toMatchObject({ status: 400 })
  })
})
