import { HttpError, json } from './http.js'
import { textSearch } from './places.js'

export async function placesSearch(req: Request, fetchImpl?: typeof fetch): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { query?: unknown } | null
  const query = typeof body?.query === 'string' ? body.query.trim() : ''
  if (query.length === 0 || query.length > 100) {
    throw new HttpError(400, 'query must be 1-100 characters')
  }
  const { places } = await textSearch(query, {}, fetchImpl)
  return json(200, { candidates: places.slice(0, 5) })
}
