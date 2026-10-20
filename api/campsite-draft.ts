import { requireUser } from './_lib/auth.js';
import { handleCampsiteDraft } from './_lib/draft.js';
import { withErrors } from './_lib/http.js';

export const config = { maxDuration: 60 };

const handler = withErrors(async (req: Request): Promise<Response> => {
    await requireUser(req);
    return handleCampsiteDraft(req);
});

export async function POST(req: Request): Promise<Response> {
    return handler(req);
}
