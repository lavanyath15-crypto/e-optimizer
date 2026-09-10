# WEB

The whole frontend lives here: landing page, login, and the React dashboard, all
served by one Vite app.

Start it with:

```bash
npm install
npm run dev
```

That's http://localhost:3000. Auth needs `backend/.env.local` set up first, which is
covered in [../backend/README.md](../backend/README.md). Without it the site still
runs, login just tells you it isn't configured.

| Route | File |
|---|---|
| `/` | `index.html` |
| `/login.html` | `login.html` |
| `/privacy.html` | `privacy.html` |
| `/dashboard/` | `dashboard/index.html` |

## What's where

| Path | What's in it |
|---|---|
| `src/lib/` | The model forward pass, emission formulas, distillation engine |
| `src/components/` | Dashboard views and cards |
| `src/data/` | Process unit definitions and mock plant data |
| `public/model/ann.json` | The trained network, 2.5 kB, loaded at runtime |

`vite.config.ts` aliases `@backend` to `../backend/src`, so the `backend/` folder has
to sit next to this one. Build from `fromtend/`, not from here on its own.

Full project docs are in [../README.md](../README.md).
