/**
 * Runs the trained consumption network in the browser.
 *
 * The network is a small sklearn MLPRegressor exported to JSON by
 * ml/train_model.py. A forward pass is standardise -> (matmul + bias -> ReLU)
 * per hidden layer -> linear output -> un-standardise, so no ML runtime is
 * needed here.
 */

export interface AnnModel {
  features: string[];
  targets: string[];
  xMean: number[];
  xScale: number[];
  yMean: number[];
  yScale: number[];
  weights: number[][][];
  biases: number[][];
  activation: 'relu';
  testR2: Record<string, number>;
  trainedRows: number;
  candidatesConsidered: number;
  selectionMethod: string;
  note: string;
}

export interface ConsumptionPrediction {
  electricityKwh: number;
  distillationSteamKg: number;
  dryerFuelMmbtu: number;
}

let cached: Promise<AnnModel> | null = null;

/** Fetches and caches the exported network. Safe to call repeatedly. */
export function loadAnnModel(url = '/model/ann.json'): Promise<AnnModel> {
  if (!cached) {
    cached = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load model (HTTP ${res.status})`);
        return res.json() as Promise<AnnModel>;
      })
      .catch((err) => {
        cached = null; // let a later call retry
        throw err;
      });
  }
  return cached;
}

/** Raw forward pass. `input` must be ordered to match `model.features`. */
export function predict(model: AnnModel, input: number[]): number[] {
  if (input.length !== model.features.length) {
    throw new Error(
      `Expected ${model.features.length} input(s), received ${input.length}`
    );
  }

  let activations = input.map((v, i) => (v - model.xMean[i]) / model.xScale[i]);

  model.weights.forEach((layer, layerIndex) => {
    const bias = model.biases[layerIndex];
    const isOutputLayer = layerIndex === model.weights.length - 1;
    const next = new Array<number>(bias.length);

    for (let j = 0; j < bias.length; j++) {
      let sum = bias[j];
      for (let i = 0; i < activations.length; i++) {
        sum += activations[i] * layer[i][j];
      }
      // sklearn applies the activation to hidden layers only; the output layer
      // of an MLPRegressor is identity.
      next[j] = isOutputLayer ? sum : Math.max(0, sum);
    }
    activations = next;
  });

  return activations.map((v, i) => v * model.yScale[i] + model.yMean[i]);
}

/** Convenience wrapper returning named consumption values. */
export function predictConsumption(
  model: AnnModel,
  grainInputTpd: number
): ConsumptionPrediction {
  const [electricityKwh, distillationSteamKg, dryerFuelMmbtu] = predict(model, [
    grainInputTpd,
  ]);
  return { electricityKwh, distillationSteamKg, dryerFuelMmbtu };
}
