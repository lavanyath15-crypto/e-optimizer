/**
 * The dashboard runs the trained network as forty lines of TypeScript rather
 * than shipping an ML runtime. That only holds up if it agrees with the Python
 * that trained it, so these load the real exported ann.json and check the
 * forward pass against the reference values ml/verify.py prints.
 *
 * If this fails after a retrain, the model and the UI have drifted apart.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { predict, predictConsumption, type AnnModel } from './annModel';

const model: AnnModel = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../public/model/ann.json', import.meta.url)),
    'utf-8'
  )
);

describe('the exported model', () => {
  it('takes grain input alone and returns the three consumption targets', () => {
    expect(model.features).toEqual(['Grain_Input_tpd']);
    expect(model.targets).toEqual([
      'Total_Process_Electricity_kWh',
      'Distillation_Steam_kg',
      'DDGS_Dryer_Fuel_MMBtu',
    ]);
  });

  it('carries the provenance the UI displays', () => {
    expect(model.trainedRows).toBe(365);
    expect(model.candidatesConsidered).toBe(23);
    expect(model.activation).toBe('relu');
    // The dashboard prints these next to each prediction, weak ones included.
    expect(model.testR2['Total_Process_Electricity_kWh']).toBeCloseTo(0.6944, 4);
    expect(model.testR2['Distillation_Steam_kg']).toBeCloseTo(0.3756, 4);
    expect(model.testR2['DDGS_Dryer_Fuel_MMBtu']).toBeCloseTo(0.1755, 4);
  });

  it('has matching weight and bias shapes per layer', () => {
    expect(model.weights).toHaveLength(model.biases.length);
    model.weights.forEach((layer, i) => {
      expect(layer[0]).toHaveLength(model.biases[i].length);
    });
    // Input width matches the feature count, output width the target count.
    expect(model.weights[0]).toHaveLength(model.features.length);
    expect(model.biases[model.biases.length - 1]).toHaveLength(model.targets.length);
  });
});

describe('predict', () => {
  it('matches the Python reference values for 145 t/day', () => {
    // Printed by ml/verify.py section 5. Six decimal places is well beyond what
    // the UI shows, so any real drift in the forward pass trips this.
    const [electricity, steam, fuel] = predict(model, [145.0]);

    expect(electricity).toBeCloseTo(2614.669379, 5);
    expect(steam).toBeCloseTo(96282.846286, 4);
    expect(fuel).toBeCloseTo(53.520339, 5);
  });

  it('rejects the wrong number of inputs instead of guessing', () => {
    expect(() => predict(model, [])).toThrow(/Expected 1 input/);
    expect(() => predict(model, [145, 12])).toThrow(/Expected 1 input/);
  });

  it('is deterministic', () => {
    expect(predict(model, [150])).toEqual(predict(model, [150]));
  });

  it('increases consumption with throughput across the trained range', () => {
    const low = predict(model, [124.5]);
    const high = predict(model, [165]);

    // Grain input is the only feature with signal in this dataset, and it
    // correlates positively with all three targets.
    expect(high[0]).toBeGreaterThan(low[0]);
    expect(high[1]).toBeGreaterThan(low[1]);
    expect(high[2]).toBeGreaterThan(low[2]);
  });

  it('applies ReLU to hidden layers but leaves the output linear', () => {
    // An identity output layer can return values below the training mean; a
    // ReLU-clamped one could not. Far below the range, outputs must still vary
    // rather than all pinning to a single clamped value.
    const a = predict(model, [1]);
    const b = predict(model, [5]);
    expect(a).not.toEqual(b);
  });
});

describe('predictConsumption', () => {
  it('names the three outputs in target order', () => {
    const raw = predict(model, [147.4]);
    const named = predictConsumption(model, 147.4);

    expect(named.electricityKwh).toBeCloseTo(raw[0], 9);
    expect(named.distillationSteamKg).toBeCloseTo(raw[1], 9);
    expect(named.dryerFuelMmbtu).toBeCloseTo(raw[2], 9);
  });
});
