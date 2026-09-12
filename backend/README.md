# E-Optimizer Backend

Two things live here, and it is worth being precise about which is which:

| | Runs where | What it is |
|---|---|---|
| `src/` | **The browser.** Bundled into the frontend via the `@backend` alias | A thin client: Supabase auth, and a caller for the function below |
| `supabase/functions/recommend/` | **Supabase Edge, Deno** | The only server-side code in the project |
| `schema.sql` | Postgres | `profiles` table, RLS policies, triggers |

Nothing in `src/` is trusted. It ships to the browser, so every check that
matters happens in the Edge Function or in RLS.

## The recommend function

`POST /recommend` turns model output into operator advice, in two modes:
`recommend` (a numbered list) and `chat` (a free-text question).

```
supabase/functions/
├── _shared/
│   ├── cors.ts          origin allowlist
│   └── http.ts          JSON responses, ApiError, structured logging
└── recommend/
    ├── index.ts         handler, ~70 lines: routing and orchestration only
    ├── auth.ts          proves the caller is a signed-in user
    ├── rateLimit.ts     per-user, per-instance brake
    ├── validate.ts      parses and bounds every untrusted field
    ├── prompts.ts       system prompts, plant-figures block
    ├── providers.ts     Mistral then Groq, one shared time budget
    └── validate.test.ts
```

Request path, in order, cheapest rejection first:

```
CORS -> method -> authenticated user -> rate limit -> validate -> LLM
```

### Why authentication is done here and not left to the platform

Supabase's gateway checks that `Authorization` carries a valid JWT. **The
publishable anon key is a valid JWT**, and it ships in the browser bundle by
design. So the gateway check alone lets anyone who viewed source call this
endpoint and spend the project's LLM quota.

`auth.ts` exchanges the token for a user against `/auth/v1/user`. No user, no
answer. It is verified against the auth API rather than by decoding the JWT
locally, which costs one request but honours revocation.

### Limits

Every field below is attacker-controlled and each one costs tokens:

| Bound | Value |
|---|---|
| Body | 64 KB, checked before parsing |
| Question | 1,000 chars |
| History | 6 turns, 2,000 chars each, roles whitelisted |
| Scenarios | 12 |
| Requests | 15 per user per minute |
| Whole request | 20s across all providers |

The rate limit is per-instance and resets on cold start, so it is a brake on one
user hammering the endpoint, not a global quota. Durable limiting needs a shared
store; that is worth doing if abuse becomes real, not before.

## Setup

### 1. Create a Supabase project

https://supabase.com. Pick a region near you and save the database password.

### 2. Run the schema

**SQL Editor > New query**, paste `schema.sql`, **Run**. It is idempotent, so
re-running after an edit is safe, and it backfills profiles for any accounts
created before it was applied.

### 3. Add your credentials

**Settings > API**, copy the **Project URL** and the **anon public** key.

```bash
cp .env.example .env.local
```

Paste both in. The anon key is public by design and ships in the bundle; RLS is
what protects the data. Never put the `service_role` key here — it bypasses RLS.

### 4. Restart the dev server

```bash
cd ../WEB && npm run dev
```

Vite reads env files only at startup.

## Deploying the function

```bash
supabase functions deploy recommend
supabase secrets set MISTRAL_API_KEY=... GROQ_API_KEY=...
supabase secrets set ALLOWED_ORIGINS="https://e-optimizer-lava.netlify.app"
```

`ALLOWED_ORIGINS` is a comma-separated list. Without it the function falls back
to the Netlify domain plus localhost, which is right for this project and wrong
the moment you fork it. `SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected by
the platform; you do not set those.

The function answers if **either** provider key is present. With neither it
returns 503 and says it is not configured, rather than failing obscurely.

## Tests

```bash
cd ../WEB && npm test
```

Covers request validation, which is the only place untrusted input meets this
backend. The rest of the function is I/O against Supabase and the providers, and
is not meaningfully testable without stubs that would only assert the stubs.

## Before this goes in front of anyone real

- Turn **Confirm email** back on: **Authentication > Sign In / Providers > Email**.
- Set Site URL and the redirect allowlist under **Authentication > URL
  Configuration**, or confirmation links point at localhost.
- Raise the minimum password length under **Authentication > Policies**. The
  default is 6.
- Set `ALLOWED_ORIGINS` to your real domain.
- Never commit `.env.local`.

## Not built yet

Password reset is a dead link. No OAuth, no per-plant roles, and no plant data
is stored server-side — `plant_id` exists on the profile and is protected from
self-service edits, but nothing reads it yet.
