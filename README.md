# E-Optimizer

**Grain ethanol plants burn more steam than they need to. This works out how much more, and what to change.**

[![live](https://img.shields.io/badge/live-e--optimizer--lava.netlify.app-0f6e8c?style=flat-square)](https://e-optimizer-lava.netlify.app)
[![stack](https://img.shields.io/badge/stack-Vite%20%2B%20React%20%2B%20Supabase-061449?style=flat-square)](#how-it-works)
[![cost](https://img.shields.io/badge/running%20cost-%240.00-2D6A4F?style=flat-square)](#what-it-costs)

Distillation is where most of a dry-mill's thermal energy goes. The cheapest reflux
setting is almost never the one you're allowed to run, because purity and recovery
limits get in the way first. E-Optimizer screens the operating points against those
limits, predicts what each one costs you in electricity, steam and dryer fuel, then
has an LLM write it up in a sentence a shift supervisor can act on.

It doesn't capture carbon. It stops you making it.

**Live:** https://e-optimizer-lava.netlify.app

---

## What's real and what isn't

Most dashboards blur this line. Here it is straight, so you know what you're looking at:

| Part | Status |
|---|---|
| Neural network predictions | **Real.** Trained on a 365-day dataset, runs in your browser |
| Emission factors | **Real.** Recovered from the data, not copied from a textbook |
| Distillation screening | **Real.** Purity and recovery constraints applied per scenario |
| LLM recommendations and chat | **Real.** Live call to an open-weight model, refuses to answer what it can't see |
| Login and sessions | **Real.** Supabase auth, RLS enabled |
| Voice in and out | **Real.** Browser Web Speech API, no packages or keys. Chrome, Edge and Safari only |
| Process stage readings | **Yours to enter.** Defaults are typical dry-mill values, saved to your browser |
| Reports, alarms, sensor streams | **Mock.** Nothing is wired to a historian yet |
| Carbon & CO2e Ledger screen | **Illustrative.** CI score, Scope 1/2 tonnages and the capture credit are fixed demo values. Not run through GREET, LCFS, RFS2 or RED II |
| Energy Intelligence screen | **Illustrative.** Totals, costs and the load profile are fixed. The 24h/7d/30d buttons don't change the data |
| Plant Analytics screen | **Illustrative.** Sample trend series. The metric buttons change the label only |
| Plant Recommendations screen | **Illustrative.** Worked examples. The savings and payback figures are invented |
| AI Optimization setpoints | **Illustrative**, except the distillation scenario table and advisory card below them, which are real |
| Plant Settings | **Not persisted.** The form reports success but saves nothing |
| The dataset itself | **Synthetic.** Its own README says it's not for regulatory reporting |

Each of those screens says the same thing in a banner at the top, so you don't have
to come back here to remember which is which. Everything marked illustrative is
there to show the layout; nothing on those screens is computed from your inputs.

---

## The numbers

The network predicts three daily consumption figures. Here's how well it does on
held-out data, including the parts that don't do well:

| Output | Test R2 | Read this as |
|---|---|---|
| Process electricity | 0.694 | Useful |
| Distillation steam | 0.376 | Weak. Indicative only |
| DDGS dryer fuel | 0.176 | Barely better than the mean |

Those last two are published rather than hidden because the reason matters: **only
grain throughput carries any signal in this dataset.** Greedy forward selection with
5-fold CV was run over 23 candidate levers and not one of them improved held-out
accuracy. Every other variable sits below |r| = 0.19. The dashboard says so on the
card, next to the number.

The emission factors weren't guessed either. They were recovered from the dataset by
least squares:

```
electricity      0.70 kg CO2e / kWh
distillation     0.06 kg CO2e / kg steam
dryer fuel      53.0  kg CO2e / MMBtu
```

Feed those back through and they reproduce the dataset's own `Operational_CO2e_t`
column to within **0.006%**. You can check that yourself in one command, further down.

One thing to know before comparing numbers across screens: the distillation scenario
screening does **not** use that 0.06 figure. It converts reboiler duty at 56.1 kg
CO2e/GJ, the generic natural gas combustion factor, which comes out around 0.12 kg
CO2e per kg of steam. The two differ by about 2x, because the synthetic dataset was
evidently built with a steam factor roughly half what natural-gas-raised steam
normally costs. Both are kept on purpose: 0.06 is what makes the emissions figures
reproduce the dataset, 56.1 is what keeps the scenario comparison physically
realistic. They are not on the same basis, so don't sum or compare CO2e across the
two cards. Both say so on screen. Swap in your plant's measured boiler factor and the
split disappears.

---

## Quick start

You'll need Node 20+ and a free Supabase project.

```bash
git clone git@github.com:lavanyath15-crypto/e-optimizer.git
cd e-optimizer/WEB
npm install
```

Set up auth (takes about five minutes, steps are in [backend/README.md](backend/README.md)):

```bash
cd ../backend
cp .env.example .env.local
```

Paste your Supabase URL and publishable key into `.env.local`, then:

```bash
cd ../WEB
npm run dev
```

Open http://localhost:3000. That single command serves the landing page, the login
page and the dashboard.

| Route | What's there |
|---|---|
| `/` | Landing page |
| `/login.html` | Sign in and sign up |
| `/dashboard/` | The React app, gated behind a session |

Without `.env.local` the site still runs. Login just tells you it isn't configured
instead of failing silently.

---

## How it works

Four layers, each doing one job:

```
  Grain input (t/day)
         |
         v
  [1] Neural network          2-layer MLP, runs in the browser as plain JS
         |                    no TensorFlow, no ONNX, 2.5 kB of JSON
         v
  electricity / steam / dryer fuel
         |
         v
  [2] Emission formulas       factors recovered from the data by least squares
         |
         v
  CO2e intensity, energy intensity, production
         |
         v
  [3] Scenario screening      purity >= 99.5%, recovery >= 95%
         |                    lowest-steam point that clears both
         v
  [4] LLM advisory            open-weight model via Mistral, Groq as backup
         |                    given only the numbers above, told not to invent
         v
  One recommendation, with its reasoning
```

**The model runs client-side.** It's a forward pass: standardise, multiply, ReLU,
unstandardise. Forty lines of TypeScript, verified bit-identical to the Python that
trained it. No inference server, no cold starts, no per-request cost.

**The LLM never sees your raw data and never invents figures.** It receives the
computed numbers and phrases them. Ask it something the dashboard can't answer and
it says so:

> **Q:** What is the vibration RMS on decanter centrifuge CF-202?
> **A:** The dashboard does not have vibration RMS data for decanter centrifuge CF-202.

That refusal is the point. An advisor that makes up a plausible bearing-fault
diagnosis is worse than no advisor at all.

---

## Talking to it

The assistant takes voice as well as typing, through the browser's own Web Speech
API. Nothing is installed and nothing is sent anywhere we control: recognition and
the voice are whatever your browser ships.

| | How |
|---|---|
| Ask by voice | Mic button next to Send. Your words appear live in the box, and the question sends itself when you stop talking |
| Replies read aloud | Spoken automatically. The speaker button stops it mid-sentence |
| Hands free | Say **"Hey Optimizer"** and the assistant opens with the mic already live |

Units are expanded before they are spoken, so `412.8 kg CO2e/kL` is read as
"412.8 kilograms of C O 2 equivalent per kilolitre" rather than spelled out
character by character. Failed replies are shown but not read out.

**The wake word holds the microphone open** for as long as it is on, so it ships
**off**. Turn it on from the toggle in the assistant's header strip, next to the
status. If the browser refuses the microphone, flick the same toggle off and on to
retry once you have granted permission. Recognition also needs a secure context, so
it works on localhost and HTTPS and silently does nothing on plain HTTP.

| Browser | Ask by voice | Replies read aloud | Wake word |
|---|---|---|---|
| Chrome, Edge, Safari | yes | yes | yes |
| Firefox | no | yes | no |

Firefox has no speech recognition. The mic button disables itself and says so
rather than breaking, and replies are still spoken.

## Layout

```
fromtend/
├── WEB/                      the whole frontend, one Vite app
│   ├── index.html            landing page
│   ├── login.html            auth
│   ├── dashboard/            React dashboard entry
│   ├── public/model/         ann.json, the trained network
│   └── src/
│       ├── lib/              annModel, emissionsFormula, distillationEngine
│       ├── components/       views and cards
│       └── data/             process units, mock plant data
├── backend/                  Supabase client, auth, Edge Function
│   └── supabase/functions/   the recommend + chat endpoint
├── ml/                       training and verification scripts
└── netlify.toml              build config, already set up
```

One gotcha worth knowing: `WEB/vite.config.ts` resolves `@backend` to `../backend/src`
and reads env files from `../backend`. **Deploy `fromtend/` as a whole.** Ship `WEB/`
on its own and the build fails on an unresolved import.

---

## Verify it yourself

Two layers. The TypeScript that actually runs in your browser:

```bash
cd WEB && npm test
```

31 tests over the three modules that do the work: the emission formulas, the
distillation screening, and the network's forward pass. The model test loads the
real `ann.json` and checks it reproduces the Python reference values to six decimal
places, so if a retrain ever drifts from the browser code, that fails.

Then the Python side, which re-checks the dataset, the model and the formulas from
scratch and reports anything that's moved:

```bash
python ml/verify.py
```

It confirms the dataset is intact (365 rows, 48 columns, no gaps), loads the exported
network, predicts against real rows, and checks the recovered factors against the
dataset's own CO2e column. It prints reference values for a grain input of 145 t/day
so you can open the dashboard, type 145, and compare the two directly.

To retrain:

```bash
python ml/train_model.py
```

That re-runs feature selection over all 23 candidates and re-exports `ann.json`.
Requires the source spreadsheet.

---

## Deploy

Push to GitHub, connect Netlify, add two environment variables. Full walkthrough in
[DEPLOYMENT.md](DEPLOYMENT.md), including the Vercel and Cloudflare settings.

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Both are public by design and end up in the browser bundle. Row Level Security is
what protects the data. Never put the `service_role` key here, it bypasses RLS.

No rewrite rules needed. Every route is a real file on disk.

---

## What it costs

Nothing, and not in the "free until you're useful" sense:

| Piece | Free tier | The catch |
|---|---|---|
| Vite, React, Tailwind, lucide | Open source | none |
| Netlify | Free for personal projects | build minutes if you push constantly |
| Supabase | 500 MB, 50k monthly users | **pauses after 7 days idle.** Open the dashboard to wake it |
| Mistral (mistral-small-latest) | Free tier | primary provider |
| Groq (gpt-oss-120b) | ~1,000 requests/day | 30/min rate limit, used only when Mistral fails |

The LLM is open-weight (Apache 2.0), so no proprietary API is in the critical path.
If Groq disappeared tomorrow you could point it at any OpenAI-compatible endpoint,
including one you host.

---

## Not built yet

Being straight about the gaps:

- **No historian connection.** SCADA, Modbus and MQTT are described on the landing
  page as the intended integration path. None of it is wired up.
- **Process readings are browser-local.** Clear your storage and they're gone.
- **Reports and alarms are mock data.**
- **No password reset, no OAuth, no per-plant roles.**
- **Normal operating bands are generic dry-mill values.** Replace them with your
  commissioned limits before anyone makes a real decision from this screen.

---

## Licence

No licence file yet. Add one before sharing this publicly.
