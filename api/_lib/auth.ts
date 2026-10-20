import { HttpError } from './http.js'
import { supabaseAdmin } from './supabaseAdmin.js'

type GetUser = (token: string) => Promise<{ id: string } | null>

const defaultGetUser: GetUser = async (token) => {
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id }
}

// 不做白名單：Supabase 已關閉新使用者註冊（規格 §7.1、§17 S4）
export async function requireUser(
  req: Request,
  deps: { getUser?: GetUser } = {},
): Promise<{ userId: string }> {
  const match = /^Bearer (.+)$/.exec(req.headers.get('Authorization') ?? '')
  if (!match) throw new HttpError(401, 'Unauthorized')

  let user: { id: string } | null
  try {
    user = await (deps.getUser ?? defaultGetUser)(match[1]!)
  } catch (err) {
    console.error('requireUser: getUser failed', err)
    throw new HttpError(401, 'Unauthorized')
  }
  if (!user) throw new HttpError(401, 'Unauthorized')
  return { userId: user.id }
}
