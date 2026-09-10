/**
 * LLM sidekick: turns the model + formula output into operator recommendations.
 *
 * Runs as a Supabase Edge Function so the API keys stay server-side. The
 * browser never sees them.
 *
 * Providers are tried in order, first one with a key configured wins:
 *   1. Mistral - mistral-small-latest. Open-weight and named directly in the
 *      challenge eligibility criteria, so it is the primary on purpose.
 *   2. Groq    - openai/gpt-oss-120b. Apache 2.0 open-weight, and fast.
 *
 * Groq was originally primary on the assumption it served LLaMA 3.3. As of
 * 2026-09 it no longer serves any LLaMA chat model; the only llama entries are
 * llama-prompt-guard-2-*, which are safety classifiers. Hence the reorder.
 *
 * Deploy:  supabase functions deploy recommend
 * Secrets: supabase secrets set GROQ_API_KEY=... MISTRAL_API_KEY=...
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PlantState {
  grainInputTpd: number;
  electricityKwh: number;
  distillationSteamKg: number;
  dryerFuelMmbtu: number;
  ethanolProductionKl: number;
  co2eIntensityKgPerKl: number;
  totalEnergyIntensityKwhPerKl: number;
  refluxRatio?: number;
  distillationScenarios?: Array<{
    id: string;
    refluxRatio: number;
    specificSteamKgPerKl: number;
    recoveryPct: number;
    purityPct: number;
    feasible: boolean;
    recommended: boolean;
  }>;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const SHARED_RULES = `- Only use the numbers provided below. Never invent a figure, a percentage, or a saving.
- The model behind these figures was trained on a synthetic dataset in which only throughput measurably drives consumption. Do not claim a lever changes emissions unless the data given here shows it.
- If a distillation scenario table is provided, the recommended scenario is the lowest-steam option that still meets purity and recovery limits.`;

const RECOMMEND_PROMPT = `You are a process engineer advising operators at a grain-based ethanol plant.

Rules you must follow:
- Write 3 to 4 recommendations, each one or two sentences, in plain language an operator can act on.
${SHARED_RULES}
- Say why any lower-steam scenario that fails the limits was rejected.
- No preamble, no closing summary. Return a numbered list and nothing else.`;

const CHAT_PROMPT = `You are the assistant inside an ethanol plant dashboard, answering an operator's question.

Rules you must follow:
${SHARED_RULES}
- If the question cannot be answered from the figures given, say plainly that the dashboard does not have that data. Do not guess and do not fill the gap with plausible-sounding numbers.
- Be brief: two to four sentences, or a short list when the question calls for one.
- Plain language, no preamble, no sign-off.`;

function buildUserPrompt(state: PlantState): string {
  const lines = [
    `Grain input: ${state.grainInputTpd.toFixed(1)} t/day`,
    `Ethanol production: ${state.ethanolProductionKl.toFixed(2)} kL/day`,
    `Electricity: ${state.electricityKwh.toFixed(0)} kWh/day`,
    `Distillation steam: ${state.distillationSteamKg.toFixed(0)} kg/day`,
    `Dryer fuel: ${state.dryerFuelMmbtu.toFixed(1)} MMBtu/day`,
    `CO2e intensity: ${state.co2eIntensityKgPerKl.toFixed(1)} kg CO2e/kL`,
    `Energy intensity: ${state.totalEnergyIntensityKwhPerKl.toFixed(1)} kWh/kL`,
  ];

  if (state.refluxRatio !== undefined) {
    lines.push(`Current reflux ratio: ${state.refluxRatio.toFixed(2)}`);
  }

  if (state.distillationScenarios?.length) {
    lines.push('', 'Distillation scenarios (purity limit 99.5%, recovery limit 95%):');
    for (const s of state.distillationScenarios) {
      const status = s.recommended
        ? 'RECOMMENDED'
        : s.feasible
        ? 'feasible'
        : 'VIOLATES LIMITS';
      lines.push(
        `  ${s.id}: reflux ${s.refluxRatio.toFixed(2)}, ` +
          `${s.specificSteamKgPerKl.toFixed(1)} kg steam/kL, ` +
          `recovery ${s.recoveryPct.toFixed(1)}%, purity ${s.purityPct.toFixed(2)}% [${status}]`
      );
    }
  }

  return lines.join('\n');
}

interface Provider {
  name: string;
  url: string;
  model: string;
  keyEnv: string;
}

const PROVIDERS: Provider[] = [
  {
    name: 'mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-small-latest',
    keyEnv: 'MISTRAL_API_KEY',
  },
  {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'openai/gpt-oss-120b',
    keyEnv: 'GROQ_API_KEY',
  },
];

async function callProvider(
  provider: Provider,
  apiKey: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        max_tokens: 600,
        messages,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`${provider.name} returned HTTP ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error(`${provider.name} returned no content`);
    }
    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body: PlantState & { mode?: string; question?: string; history?: ChatTurn[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body must be JSON' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const state = body;
  const isChat = body.mode === 'chat';

  if (isChat && !body.question?.trim()) {
    return new Response(
      JSON.stringify({ error: 'mode "chat" requires a non-empty question' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const required: (keyof PlantState)[] = [
    'grainInputTpd',
    'electricityKwh',
    'distillationSteamKg',
    'dryerFuelMmbtu',
    'ethanolProductionKl',
    'co2eIntensityKgPerKl',
    'totalEnergyIntensityKwhPerKl',
  ];
  const missing = required.filter((k) => typeof state?.[k] !== 'number');
  if (missing.length) {
    return new Response(
      JSON.stringify({ error: `Missing or non-numeric fields: ${missing.join(', ')}` }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const plantContext = buildUserPrompt(state);

  // Chat carries the question plus a trimmed transcript so follow-ups work.
  const messages: Array<{ role: string; content: string }> = isChat
    ? [
        { role: 'system', content: CHAT_PROMPT },
        { role: 'user', content: `Current plant figures:\n${plantContext}` },
        {
          role: 'assistant',
          content: 'Understood. I will answer using only those figures.',
        },
        ...(body.history ?? [])
          .slice(-6)
          .filter((t) => t?.content?.trim())
          .map((t) => ({ role: t.role, content: t.content })),
        { role: 'user', content: body.question!.trim() },
      ]
    : [
        { role: 'system', content: RECOMMEND_PROMPT },
        { role: 'user', content: plantContext },
      ];

  const attempts: string[] = [];

  for (const provider of PROVIDERS) {
    const apiKey = Deno.env.get(provider.keyEnv);
    if (!apiKey) {
      attempts.push(`${provider.name}: ${provider.keyEnv} not set`);
      continue;
    }

    try {
      const recommendations = await callProvider(provider, apiKey, messages);
      return new Response(
        JSON.stringify({ recommendations, provider: provider.name, model: provider.model }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      // Rate limit or outage: fall through to the next provider.
      attempts.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return new Response(
    JSON.stringify({
      error: 'No LLM provider available.',
      attempts,
    }),
    { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
});
