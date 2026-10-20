import { requireUser } from './_lib/auth.js';
import { withErrors } from './_lib/http.js';
import { placesSearch } from './_lib/placesSearch.js';

export const config = { maxDuration: 60 };

const handler = withErrors(async (req: Request): Promise<Response> => {
    await requireUser(req);
    return placesSearch(req);
});

export async function POST(req: Request): Promise<Response> {
    return handler(req);
}
