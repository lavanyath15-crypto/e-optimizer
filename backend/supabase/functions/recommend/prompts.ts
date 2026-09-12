/**
 * System prompts and the plant-figures block the model reasons over.
 *
 * The rules exist because the failure mode that matters here is not a wrong
 * answer, it is a confident invented one. An advisor that makes up a plausible
 * bearing-fault diagnosis is worse than no advisor.
 */

import type { ChatTurn, PlantState } from './validate.ts';

const SHARED_RULES = `- Only use the numbers provided below. Never invent a figure, a percentage, or a saving.
- The model behind these figures was trained on a synthetic dataset in which only throughput measurably drives consumption. Do not claim a lever changes emissions unless the data given here shows it.
- If a distillation scenario table is provided, the recommended scenario is the lowest-steam option that still meets purity and recovery limits.`;

export const RECOMMEND_PROMPT = `You are a process engineer advising operators at a grain-based ethanol plant.

Rules you must follow:
- Write 3 to 4 recommendations, each one or two sentences, in plain language an operator can act on.
${SHARED_RULES}
- Say why any lower-steam scenario that fails the limits was rejected.
- No preamble, no closing summary. Return a numbered list and nothing else.`;

export const CHAT_PROMPT = `You are the assistant inside an ethanol plant dashboard, answering an operator's question.

Rules you must follow:
${SHARED_RULES}
- If the question cannot be answered from the figures given, say plainly that the dashboard does not have that data. Do not guess and do not fill the gap with plausible-sounding numbers.
- Be brief: two to four sentences, or a short list when the question calls for one.
- Plain language, no preamble, no sign-off.`;

export function buildPlantContext(state: PlantState): string {
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
      const status = s.recommended ? 'RECOMMENDED' : s.feasible ? 'feasible' : 'VIOLATES LIMITS';
      lines.push(
        `  ${s.id}: reflux ${s.refluxRatio.toFixed(2)}, ` +
          `${s.specificSteamKgPerKl.toFixed(1)} kg steam/kL, ` +
          `recovery ${s.recoveryPct.toFixed(1)}%, purity ${s.purityPct.toFixed(2)}% [${status}]`
      );
    }
  }

  return lines.join('\n');
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const DATASET_PROMPT = `You are a process engineer reviewing an operating dataset exported from a grain-based ethanol plant.

You are given summary statistics, not the rows themselves: per-column min, max, mean and standard deviation, and where the columns could be recognised, how the plant's real consumption compares against a trained model's prediction for its throughput.

Rules you must follow:
- Only use the statistics provided. Never invent a column, a row, a correlation or a saving.
- A positive bias means the plant consumes more than the model expects for its throughput. Say what that is worth in the plant's own units before saying anything about percentages.
- Treat a low or negative R2 as the model failing to explain their data, not as the plant being wrong. Say which it is.
- You cannot see individual rows, so do not claim to have found a specific day, batch or outlier.
- Call out any column whose range or standard deviation looks physically implausible, and say why.
- Respect the caveats listed at the end of the summary if there are any.

Structure your answer as:
1. What this dataset is, in one or two sentences.
2. Where the plant stands against the model, with figures.
3. Two to four things worth investigating, most valuable first, each one an action an engineer could take this week.
4. What the data cannot tell you.

Plain language. No preamble, no sign-off.`;

export function buildMessages(options: {
  mode: 'recommend' | 'chat' | 'dataset';
  state: PlantState;
  question: string;
  history: ChatTurn[];
  datasetSummary?: string;
}): ChatMessage[] {
  const context = buildPlantContext(options.state);

  if (options.mode === 'recommend') {
    return [
      { role: 'system', content: RECOMMEND_PROMPT },
      { role: 'user', content: context },
    ];
  }

  if (options.mode === 'dataset') {
    return [
      { role: 'system', content: DATASET_PROMPT },
      {
        role: 'user',
        content:
          `Dataset summary:\n${options.datasetSummary ?? ''}\n\n` +
          `For reference, the dashboard's current figures:\n${context}`,
      },
    ];
  }

  return [
    { role: 'system', content: CHAT_PROMPT },
    { role: 'user', content: `Current plant figures:\n${context}` },
    { role: 'assistant', content: 'Understood. I will answer using only those figures.' },
    // Already role-whitelisted and trimmed in validate.ts.
    ...options.history,
    { role: 'user', content: options.question },
  ];
}
