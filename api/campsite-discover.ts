import { requireUser } from './_lib/auth.js';
import { handleCampsiteDiscover } from './_lib/discover.js';
import { withErrors } from './_lib/http.js';

export const config = { maxDuration: 60 };

const handler = withErrors(async (req: Request): Promise<Response> => {
    await requireUser(req);
    return handleCampsiteDiscover(req);
});

export async function POST(req: Request): Promise<Response> {
    return handler(req);
}
