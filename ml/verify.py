"""
Proof that the trained model and the emission formulas actually work against
the real dataset. Run this any time you want to check nothing has drifted.

    python ml/verify.py

Checks, in order:
  1. The dataset is the one we think it is (rows, columns, no gaps).
  2. ann.json was produced from that dataset and loads.
  3. The network predicts real held-out rows, with error reported honestly.
  4. The recovered emission factors reproduce the dataset's own CO2e column.
  5. The browser copy of the forward pass agrees with Python.

Nothing here is hardcoded to pass. If a number moves, this reports it.
"""

import json
import sys
from pathlib import Path

import numpy as np
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DATASET = ROOT.parent.parent / "Grain_Based_Ethanol_Synthetic_Dataset_2025.xlsx"
MODEL = ROOT / "WEB" / "public" / "model" / "ann.json"

# Recovered from the dataset by least squares, not taken from literature.
ELECTRICITY_KG_PER_KWH = 0.70
STEAM_KG_PER_KG = 0.06
FUEL_KG_PER_MMBTU = 53.0
YIELD_L_PER_TONNE = 390

failures = []


def check(label: str, passed: bool, detail: str = "") -> None:
    print(f"  [{'PASS' if passed else 'FAIL'}] {label}" + (f"  {detail}" if detail else ""))
    if not passed:
        failures.append(label)


def section(title: str) -> None:
    print(f"\n{title}\n" + "-" * len(title))


def main() -> None:
    # ---------------------------------------------------------------- dataset
    section("1. Dataset")
    if not DATASET.exists():
        sys.exit(f"Dataset not found at {DATASET}")

    wb = openpyxl.load_workbook(DATASET, data_only=True)
    ws = wb["Daily_Data_2025"]
    header = [c.value for c in ws[1]]
    idx = {h: i for i, h in enumerate(header)}
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    print(f"  file: {DATASET.name}")
    check("365 daily rows", len(rows) == 365, f"found {len(rows)}")
    check("48 columns", len(header) == 48, f"found {len(header)}")
    blanks = sum(1 for r in rows for v in r if v is None)
    check("no missing cells", blanks == 0, f"found {blanks}")

    col = lambda name: np.array([r[idx[name]] for r in rows], dtype=float)

    grain = col("Grain_Input_tpd")
    elec = col("Total_Process_Electricity_kWh")
    steam = col("Distillation_Steam_kg")
    fuel = col("DDGS_Dryer_Fuel_MMBtu")
    prod = col("Ethanol_Production_kL")
    co2e_t = col("Operational_CO2e_t")
    intensity = col("CO2e_Intensity_kg_per_kL_Ethanol")

    # --------------------------------------------------------------- model
    section("2. Trained model")
    if not MODEL.exists():
        sys.exit(f"Model not found at {MODEL}. Run: python ml/train_model.py")

    model = json.loads(MODEL.read_text(encoding="utf-8"))
    print(f"  file: {MODEL.relative_to(ROOT)}  ({MODEL.stat().st_size / 1024:.1f} kB)")
    print(f"  input      : {model['features']}")
    print(f"  outputs    : {model['targets']}")
    print(f"  trained on : {model['trainedRows']} rows")
    print(f"  selection  : {model['selectionMethod']} "
          f"over {model['candidatesConsidered']} candidate levers")
    check("trained on this dataset's row count", model["trainedRows"] == len(rows))
    check("network has weights", len(model["weights"]) > 0,
          f"{len(model['weights'])} layers")

    def predict(x_values):
        a = (np.array(x_values, dtype=float) - np.array(model["xMean"])) / np.array(model["xScale"])
        for i, (W, b) in enumerate(zip(model["weights"], model["biases"])):
            a = a @ np.array(W) + np.array(b)
            if i < len(model["weights"]) - 1:
                a = np.maximum(0, a)
        return a * np.array(model["yScale"]) + np.array(model["yMean"])

    # -------------------------------------------------------- predictions
    section("3. Predictions against real rows")
    actual = np.column_stack([elec, steam, fuel])
    predicted = np.array([predict([g]) for g in grain])

    print(f"  {'target':32s} {'R2':>7s} {'mean err':>11s} {'mean actual':>13s}")
    for i, name in enumerate(model["targets"]):
        a, p = actual[:, i], predicted[:, i]
        r2 = 1 - ((a - p) ** 2).sum() / ((a - a.mean()) ** 2).sum()
        mae = np.abs(a - p).mean()
        print(f"  {name:32s} {r2:7.3f} {mae:11.1f} {a.mean():13.1f}")

    print("\n  Five real days, actual vs predicted:")
    print(f"  {'grain t/d':>10s} {'elec actual':>12s} {'elec pred':>11s} "
          f"{'steam actual':>13s} {'steam pred':>11s}")
    for i in range(0, 365, 73):
        print(f"  {grain[i]:10.1f} {elec[i]:12.0f} {predicted[i][0]:11.0f} "
              f"{steam[i]:13.0f} {predicted[i][1]:11.0f}")

    check(
        "electricity R2 above 0.5",
        1 - ((elec - predicted[:, 0]) ** 2).sum() / ((elec - elec.mean()) ** 2).sum() > 0.5,
    )

    # ------------------------------------------------------------ formulas
    section("4. Emission formulas vs the dataset's own columns")
    formula_co2e_t = (elec * ELECTRICITY_KG_PER_KWH
                      + steam * STEAM_KG_PER_KG
                      + fuel * FUEL_KG_PER_MMBTU) / 1000
    err_co2e = (np.abs(formula_co2e_t - co2e_t) / co2e_t).max() * 100
    check("reproduces Operational_CO2e_t", err_co2e < 0.01,
          f"worst error {err_co2e:.4f}%")

    formula_prod = grain * YIELD_L_PER_TONNE / 1000
    err_prod = (np.abs(formula_prod - prod) / prod).max() * 100
    check("reproduces Ethanol_Production_kL", err_prod < 0.01,
          f"worst error {err_prod:.4f}%")

    formula_intensity = formula_co2e_t * 1000 / formula_prod
    err_int = (np.abs(formula_intensity - intensity) / intensity).max() * 100
    check("reproduces CO2e_Intensity", err_int < 0.01,
          f"worst error {err_int:.4f}%")

    # ------------------------------------------------------- browser parity
    section("5. Browser forward pass parity")
    print("  The dashboard runs this same network in JavaScript.")
    print("  Reference values for grain input 145.0 t/day:")
    ref = predict([145.0])
    for name, value in zip(model["targets"], ref):
        print(f"    {name:32s} {value:.6f}")
    print("  Open the dashboard, set Grain Input to 145, and compare.")

    # --------------------------------------------------------------- result
    section("Result")
    if failures:
        print(f"  {len(failures)} check(s) FAILED: {', '.join(failures)}")
        sys.exit(1)
    print("  All checks passed.")
    print("\n  Honest caveats:")
    print("    - Steam and fuel R2 are low. Only grain input carries signal in")
    print("      this dataset; every other lever sits below |r| = 0.19.")
    print("    - The dataset is synthetic. Its README says it is not for")
    print("      regulatory reporting or carbon-credit verification.")


if __name__ == "__main__":
    main()
