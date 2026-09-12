/**
 * POST /recommend
 *
 * Turns the model and formula output into operator-facing advice, in two modes:
 *   - recommend: a numbered list of setpoint changes worth making
 *   - chat:      a free-text question answered from the same figures
 *
 * Runs as a Supabase Edge Function so the provider API keys stay server-side.
 * The browser never sees them.
 *
 * The request path, in order:
 *   CORS -> method -> authenticated user -> rate limit -> validate -> LLM
 *
 * Authentication comes before anything expensive on purpose. Supabase's gateway
 * only checks that the Authorization header is a valid JWT, and the publishable
 * anon key satisfies that while being public by design. Without the user check
 * in auth.ts, anyone who viewed source could spend the project's LLM quota.
 *
 * Deploy:  supabase functions deploy recommend
 * Secrets: supabase secrets set MISTRAL_API_KEY=... GROQ_API_KEY=...
 * Optional: supabase secrets set ALLOWED_ORIGINS="https://your-domain"
 */

import { corsHeaders, isPreflight } from '../_shared/cors.ts';
import { ApiError, json, logError } from '../_shared/http.ts';
import { requireUser } from './auth.ts';
import { checkRateLimit } from './rateLimit.ts';
import { parseRequest } from './validate.ts';
import { buildMessages } from './prompts.ts';
import { complete } from './providers.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeaders(req.headers.get('Origin'));

  if (isPreflight(req)) {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'POST required', code: 'method_not_allowed' }, {
      ...cors,
      Allow: 'POST, OPTIONS',
    });
  }

  try {
    const user = await requireUser(req);

    const limit = checkRateLimit(user.id);
    if (!limit.allowed) {
      return json(
        429,
        { error: 'Too many requests. Give it a minute.', code: 'rate_limited' },
        { ...cors, 'Retry-After': String(limit.retryAfterSeconds) }
      );
    }

    const { mode, state, question, history, datasetSummary } = await parseRequest(req);
    const messages = buildMessages({ mode, state, question, history, datasetSummary });

    // Sized per mode. A dataset review is asked for six headed sections and was
    // being cut off mid-table at the 600 tokens that suit a short recommendation.
    const completion = await complete(
      messages,
      mode === 'dataset'
        ? { maxTokens: 2_200, budgetMs: 40_000 }
        : { maxTokens: 700, budgetMs: 20_000 }
    );

    return json(
      200,
      {
        recommendations: completion.text,
        provider: completion.provider,
        model: completion.model,
      },
      cors
    );
  } catch (err) {
    if (err instanceof ApiError) {
      // `internal` is for us; the caller gets only `message`.
      if (err.internal) logError(err.code, err.internal);
      return json(err.status, { error: err.message, code: err.code }, cors);
    }

    logError('unhandled', err);
    return json(500, { error: 'Something went wrong.', code: 'internal_error' }, cors);
  }
});
