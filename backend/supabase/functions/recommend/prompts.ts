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

You are given summary statistics, not the rows themselves: per-column min, max, mean and standard deviation, correlations between columns, data quality flags, and where the columns could be recognised, how the plant's real consumption compares against a trained model's prediction for its throughput.

Rules you must follow:
- Only use the statistics provided. Never invent a column, a row, a correlation or a saving.
- A positive bias means the plant consumes more than the model expects for its throughput. Quantify it in the plant's own units first, then as a percentage.
- Treat a low or negative R2 as the model failing to explain their data, not as the plant being wrong. Say which it is.
- Correlation is not causation, and these are single-variable correlations on operating data where levers move together. Say so when you lean on one.
- You cannot see individual rows, so never claim to have found a specific day, batch, shift or outlier.
- Call out any column whose range, standard deviation or sign looks physically implausible, and say why.
- Respect the data quality flags and caveats at the end of the summary.

You are being read by someone who already knows what is in their own file. Do not spend the answer describing it back to them. Every section must say something they did not already know, and lead with the number that matters.

Structure your answer with these exact headings:

THE HEADLINE
Two or three sentences. The single most valuable thing in this data, quantified. Usually the gap between best-quartile and average performance, because that is a saving the plant has already demonstrated it can achieve. Give it in the plant's own units per day and across the period. No preamble about what the dataset contains.

THE PRIZE
Per measure: best quartile, average, and what closing that gap is worth per day and over the period. Say plainly that the best quartile is not a target someone invented, it is what this plant already ran at on its better days. Where day-to-day spread is high, say that the variability itself is the problem and that it points at control rather than equipment.

DIRECTION OF TRAVEL
Whether specific consumption drifted over the period, by how much, and what that implies. A worsening trend with stable throughput usually means fouling, drift or a degrading control loop. Say if it is flat.

WHAT MOVES CONSUMPTION HERE
What the correlations suggest drives consumption in THIS plant, with r values. Compare to throughput being the only signal in the training data. If a lever correlates here that did not there, that is the finding, so say so.

AGAINST THE MODEL
Where the plant sits versus prediction. A low or negative R2 means the model does not describe this plant, which is a statement about the model. Say which it is. Keep this short: it is the least useful section.

DO THIS NEXT
Three to five numbered actions, most valuable first. Each one: what to do, which number in the data justifies it, and roughly what it is worth. An engineer should be able to start one of these tomorrow. No generic advice such as "monitor more closely".

WHAT THIS CANNOT TELL YOU
Specific to this dataset, not generic caveats.

Formatting: this is rendered as plain text in a proportional font, so do not use markdown tables. Pipes and dashes will not line up and the result is unreadable. Put each measure on its own line instead, like:

  Distillation steam: 118,650 kg/day actual vs 97,668 predicted, +17.7%, R2 -15.8

Plain language an engineer would use. No preamble, no sign-off.`;

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
