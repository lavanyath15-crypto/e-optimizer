# Deployment

All of this runs free. The site compiles down to plain static files, so any
host will take it. Supabase is the only piece you don't run yourself.

## Cost

| Thing | Free tier | Watch out for |
|---|---|---|
| Vite / React / Tailwind / lucide | Open source, free forever | nothing |
| Netlify, Vercel, or Cloudflare Pages | Free for personal projects | build minutes if you push very often |
| Supabase | 500 MB database, 50k monthly active users, 2 projects | **a free project pauses after 7 days with no requests.** Open the dashboard or hit the API to wake it |
| Google Fonts | Free | loaded from Google's CDN at runtime |

No paid API keys are required. `@google/genai` was in `package.json` but never
imported, and it needs a paid key, so it was removed along with `express`,
`dotenv`, `motion`, `tsx`, `autoprefixer`, and `@types/express` (all unused).

## The one thing that will break your build

**Commit and deploy `fromtend/` as a whole, not `WEB/` on its own.**

`WEB/vite.config.ts` resolves `@backend` to `../backend/src` and reads env files
from `../backend`. If `backend/` is not a sibling of `WEB/` at build time, the
build fails with an unresolved import. Verified by removing the folder and
watching the build fail.

Hosts clone your whole repo first, so pointing the base directory at `WEB` is
fine. Zipping up just the `WEB` folder isn't.

## Netlify

`netlify.toml` at the repo root already sets base, command, and publish. Connect
the repo and it picks them up. Then add the two environment variables below.

## Vercel

| Setting | Value |
|---|---|
| Root Directory | `WEB` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Leave "Include files outside the root directory" enabled, otherwise `backend/`
is missing and the build fails.

## Cloudflare Pages

| Setting | Value |
|---|---|
| Root directory | `WEB` |
| Build command | `npm run build` |
| Build output directory | `dist` |

## Environment variables

Set these in the host's dashboard, not in a committed file:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Verified that host-provided variables reach the build even though `envDir`
points at `backend/`, so no `.env` file needs to exist on the server.

Both values are public by design and end up in the browser bundle. Row Level
Security in `backend/schema.sql` is what protects the data. Never set
`SUPABASE_SERVICE_ROLE_KEY` here: it bypasses RLS.

## After the first deploy

In Supabase, go to **Authentication > URL Configuration** and set the Site URL
to your deployed domain, adding it to the redirect allowlist. Until you do,
confirmation and recovery emails point at localhost.

Turn **Confirm email** back on for anything real.

## Routing

No rewrite rules or `_redirects` file are needed. Every route is a real file:

| URL | File |
|---|---|
| `/` | `dist/index.html` |
| `/login.html` | `dist/login.html` |
| `/privacy.html` | `dist/privacy.html` |
| `/dashboard/` | `dist/dashboard/index.html` |

All four were verified against a plain static server. `/dashboard` without the
trailing slash 301s to `/dashboard/`, which every host does by default.

## GitHub Pages

Works only for a user/org site served from the domain root. Built assets use
absolute paths like `/assets/app.js`, and the post-login redirect targets
`/dashboard/`, so a project site served from `/repo-name/` will 404. Use one of
the three hosts above instead, or set `base` in `vite.config.ts` and make the
redirects relative.
