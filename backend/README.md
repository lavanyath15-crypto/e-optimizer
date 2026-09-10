# E-Optimizer Backend (Supabase Auth)

Login only, for now. No plant data, reports or telemetry live here yet, so the
dashboard is still running on mock numbers.

## What this covers

- Accounts are stored in Supabase, with passwords hashed by Supabase (bcrypt).
  Plaintext passwords are never stored or logged.
- Signing in verifies the password against that hash and opens a session.
- `/dashboard/` is gated. No session means an automatic bounce to `/login.html`.
- Log Out ends the session for real, not just a redirect.

## Files

| File | Purpose |
|---|---|
| `schema.sql` | `profiles` table, RLS policies, and the new-user trigger |
| `src/supabaseClient.js` | Creates the Supabase client from env vars |
| `src/auth.js` | `signUp`, `signIn`, `signOut`, `getSession`, `getProfile`, `requireSession` |
| `.env.example` | Template for your project credentials |

The frontend imports these through the `@backend` alias set in
`WEB/vite.config.ts`.

## Setup, about 5 minutes

### 1. Create a Supabase project

Go to https://supabase.com, sign in, and create a new project. Choose a region
near you and save the database password it generates.

### 2. Run the schema

In the project dashboard: **SQL Editor > New query**. Paste the whole contents
of `schema.sql`, then **Run**.

### 3. Add your credentials

In the project dashboard: **Settings > API**. Copy the **Project URL** and the
**anon public** key.

Then in this folder:

```bash
cp .env.example .env.local
```

Open `.env.local` and paste both values in.

The anon key is meant to be public and ships in the browser bundle. Row Level
Security from `schema.sql` is what actually protects the data. Do not put the
`service_role` key in this file: it bypasses RLS.

### 4. Restart the dev server

```bash
cd ../WEB
npm run dev
```

Vite only reads env files at startup, so a restart is required.

## Email confirmation

Supabase requires new users to confirm their email by default. During
development you will probably want that off:

**Authentication > Sign In / Providers > Email**, turn off **Confirm email**.

With it on, signing up shows a "confirm your email" message instead of
redirecting, and sign-in fails until the link is clicked.

## Before you put this in front of anyone real

- Turn email confirmation back on.
- Set the Site URL and redirect allowlist under **Authentication > URL
  Configuration** so links point at your deployed domain, not localhost.
- Raise the minimum password length under **Authentication > Policies**. The
  default is 6.
- Never commit `.env.local`.

## Not built yet

Password reset is still a dead link. No OAuth, no per-plant roles, and nothing
about your actual plant data is stored server-side.
