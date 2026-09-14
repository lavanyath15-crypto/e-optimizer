/**
 * The four reports this project can actually produce, each built from the live
 * figures at the moment it is generated.
 *
 * The Reports screen used to be seeded with six worked examples: a predictive
 * maintenance report on centrifuge vibration nothing here measures, a yield
 * variance log against a theoretical yield nothing here computes, and a
 * compliance report quoting a CI score of 52.4 gCO2e/MJ. That last one is the
 * exact lifecycle framing the Carbon screen removed as a scope error, so the
 * dashboard was contradicting itself in its own paperwork.
 *
 * These four are the reports the pipeline supports, and nothing in them is
 * typed by hand: every number comes from the network, the emission factors or
 * the scenario screening, at the operator's own readings.
 */

import type { ReportCategory, ReportItem } from '../../types';
import type { AnnModel, ConsumptionPrediction } from '../../lib/annModel';
import type { EmissionsResult } from '../../lib/emissionsFormula';
import {
  ELECTRICITY_KG_CO2E_PER_KWH,
  DISTILLATION_STEAM_KG_CO2E_PER_KG,
  DRYER_FUEL_KG_CO2E_PER_MMBTU,
} from '../../lib/emissionsFormula';
import {
  OPERATING_DAYS_PER_YEAR,
  PURITY_MIN_PCT,
  RECOVERY_MIN_PCT,
  type DistillationScenarioResult,
} from '../../lib/distillationEngine';
import type { PhysicsResult, UnmodelledReading } from '../../lib/processPhysics';

export interface ReportContext {
  model: AnnModel | null;
  consumption: ConsumptionPrediction;
  emissions: EmissionsResult;
  physics: PhysicsResult;
  unmodelled: UnmodelledReading[];
  grainInputTpd: number;
  /** Where the operating point came from, already phrased. */
  sourceNote: string;
  scenarios: DistillationScenarioResult[];
  current: DistillationScenarioResult;
  recommended?: DistillationScenarioResult;
  startDate: string;
  endDate: string;
}

export interface ReportTemplate {
  id: string;
  title: string;
  category: ReportCategory;
  iconType: ReportItem['iconType'];
  /** One line under the title on the card. */
  description: string;
  build: (ctx: ReportContext) => Pick<ReportItem, 'metricsSummary' | 'detailedData'>;
}

const n0 = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
const n1 = (v: number) => v.toFixed(1);
const n2 = (v: number) => v.toFixed(2);
const signed1 = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;

const r2Of = (model: AnnModel | null, key: string) =>
  model?.testR2[key] !== undefined ? `R2 ${model.testR2[key].toFixed(2)}` : 'R2 unavailable';

/** Rows describing what each reading did, shared by several reports. */
function correctionRows(physics: PhysicsResult): (string | number)[][] {
  return physics.adjustments.map((a) => [
    a.unit,
    a.reading,
    a.target,
    `${signed1(a.changePct)}%`,
    a.basis,
  ]);
}

const SCOPE_NOTE =
  'Operational emissions only: electricity, distillation steam and dryer fuel inside the plant. ' +
  'Farming, fertiliser, grain transport and land use are excluded, and those dominate ethanol\'s real ' +
  'footprint. This is not a lifecycle carbon intensity and must not be compared against an LCFS, ' +
  'GREET or RED II score. The emission factors were recovered from the source dataset by least ' +
  'squares and reproduce its own CO2e column to within 0.006%, but that dataset is synthetic.';

// ---------------------------------------------------------------------------

const energyConsumption: ReportTemplate = {
  id: 'energy-consumption',
  title: 'Energy Consumption Report',
  category: 'OPERATIONS',
  iconType: 'energy',
  description:
    'What the plant burns at your current readings: electricity, distillation steam and dryer fuel, with the network fit behind each figure.',
  build: (ctx) => ({
    metricsSummary: [
      { label: 'Grain Throughput', value: `${n1(ctx.grainInputTpd)} t/day`, change: ctx.sourceNote, isPositive: true },
      { label: 'Ethanol Production', value: `${n2(ctx.emissions.ethanolProductionKl)} kL/day`, change: 'grain x 390 L/t, corrected for moisture', isPositive: true },
      { label: 'Process Electricity', value: `${n0(ctx.consumption.electricityKwh)} kWh/day`, change: r2Of(ctx.model, 'Total_Process_Electricity_kWh'), isPositive: true },
      { label: 'Distillation Steam', value: `${n0(ctx.consumption.distillationSteamKg)} kg/day`, change: `${r2Of(ctx.model, 'Distillation_Steam_kg')} - weak`, isPositive: false },
      { label: 'DDGS Dryer Fuel', value: `${n1(ctx.consumption.dryerFuelMmbtu)} MMBtu/day`, change: `${r2Of(ctx.model, 'DDGS_Dryer_Fuel_MMBtu')} - weak`, isPositive: false },
      { label: 'Energy Intensity', value: `${n1(ctx.emissions.totalEnergyIntensityKwhPerKl)} kWh/kL`, change: 'electricity plus dryer fuel', isPositive: true },
      { label: 'Liquefaction Steam', value: `${n0(ctx.physics.liquefactionSteamKg)} kg/day`, change: 'mash sensible heat, outside the CO2e ledger', isPositive: true },
    ],
    detailedData: {
      executiveSummary:
        `Energy consumption for ${ctx.startDate} to ${ctx.endDate}, computed at ${n1(ctx.grainInputTpd)} t/day of grain. ` +
        `The network predicts ${n0(ctx.consumption.electricityKwh)} kWh of process electricity, ` +
        `${n0(ctx.consumption.distillationSteamKg)} kg of distillation steam and ${n1(ctx.consumption.dryerFuelMmbtu)} MMBtu of dryer fuel per day, ` +
        `producing ${n2(ctx.emissions.ethanolProductionKl)} kL of ethanol at ${n1(ctx.emissions.totalEnergyIntensityKwhPerKl)} kWh/kL. ` +
        `A further ${n0(ctx.physics.liquefactionSteamKg)} kg/day of steam goes to liquefaction, which the source dataset excludes from its CO2e column and which is therefore reported separately. ` +
        `Steam and dryer fuel carry weak held-out fits and should be read as indicative.`,
      sections: [
        {
          title: 'Predicted consumption',
          description:
            'Predicted by the trained network from grain throughput, then corrected for your other readings using the process relationships listed below.',
          tableHeaders: ['Measure', 'Value', 'Units', 'Basis'],
          tableRows: [
            ['Grain throughput', n1(ctx.grainInputTpd), 't/day', ctx.sourceNote],
            ['Ethanol production', n2(ctx.emissions.ethanolProductionKl), 'kL/day', 'Formula, corrected for grain moisture'],
            ['Process electricity', n0(ctx.consumption.electricityKwh), 'kWh/day', `Network, ${r2Of(ctx.model, 'Total_Process_Electricity_kWh')}`],
            ['Distillation steam', n0(ctx.consumption.distillationSteamKg), 'kg/day', `Network, ${r2Of(ctx.model, 'Distillation_Steam_kg')}, weak`],
            ['DDGS dryer fuel', n1(ctx.consumption.dryerFuelMmbtu), 'MMBtu/day', `Network, ${r2Of(ctx.model, 'DDGS_Dryer_Fuel_MMBtu')}, weak`],
            ['Liquefaction steam', n0(ctx.physics.liquefactionSteamKg), 'kg/day', 'Mash sensible heat from your cook temperature'],
            ['Energy intensity', n1(ctx.emissions.totalEnergyIntensityKwhPerKl), 'kWh/kL', 'Electricity plus dryer fuel'],
            ['Electricity intensity', n1(ctx.emissions.electricityIntensityKwhPerKl), 'kWh/kL', 'Electricity only'],
          ],
          notes:
            'Steam is a mass and is left out of the energy intensity rather than guessed at, because the source dataset gives no boiler efficiency to convert it with.',
        },
        {
          title: 'What your readings changed',
          description:
            'The network takes one input, grain throughput. Your other readings are applied to its output as process-engineering corrections.',
          tableHeaders: ['Stage', 'Reading', 'Affects', 'Change', 'Basis'],
          tableRows: correctionRows(ctx.physics),
          notes: ctx.physics.atReference
            ? 'Every reading is at the reference point the network was trained on, so nothing is being corrected.'
            : 'At the reference readings every correction is exactly 1, so the dashboard reproduces the network untouched.',
        },
        {
          title: 'Readings recorded but not used',
          description:
            'These are checked against their bands but no figure derives from them. Giving them an invented sensitivity would be worse than leaving them out.',
          tableHeaders: ['Stage', 'Reading', 'Value', 'Why it is not used'],
          tableRows: ctx.unmodelled.map((u) => [u.unit, u.label, u.value, u.reason]),
        },
      ],
      aiKeyFindings: [
        `Computed at ${n1(ctx.grainInputTpd)} t/day. ${ctx.sourceNote}.`,
        `Distillation steam is the largest single load at ${n0(ctx.consumption.distillationSteamKg)} kg/day, with liquefaction a further ${n0(ctx.physics.liquefactionSteamKg)} kg/day.`,
        'Steam and dryer fuel predictions carry held-out R2 below 0.5. Only grain throughput carries signal in the source dataset, so no other lever should be read as driving these figures.',
      ],
    },
  }),
};

// ---------------------------------------------------------------------------

const carbonLedger: ReportTemplate = {
  id: 'carbon-co2e',
  title: 'Carbon & CO2e Report',
  category: 'COMPLIANCE',
  iconType: 'carbon',
  description:
    'Operational CO2e split by the three sources the model predicts, with the emission factor behind each one.',
  build: (ctx) => {
    const share = (kg: number) =>
      ctx.emissions.totalCo2eKg > 0 ? `${n1((kg / ctx.emissions.totalCo2eKg) * 100)}%` : '0%';

    return {
      metricsSummary: [
        { label: 'Total Operational CO2e', value: `${n2(ctx.emissions.totalCo2eTonnes)} t/day`, change: 'electricity, steam and dryer fuel', isPositive: true },
        { label: 'Operational CO2e Intensity', value: `${n1(ctx.emissions.co2eIntensityKgPerKl)} kg CO2e/kL`, change: 'operations only, not lifecycle', isPositive: true },
        { label: 'Process Electricity', value: `${n0(ctx.emissions.electricityCo2eKg)} kg CO2e/day`, change: share(ctx.emissions.electricityCo2eKg), isPositive: true },
        { label: 'Distillation Steam', value: `${n0(ctx.emissions.steamCo2eKg)} kg CO2e/day`, change: share(ctx.emissions.steamCo2eKg), isPositive: false },
        { label: 'DDGS Dryer Fuel', value: `${n0(ctx.emissions.fuelCo2eKg)} kg CO2e/day`, change: share(ctx.emissions.fuelCo2eKg), isPositive: false },
        { label: 'Annualised', value: `${n0((ctx.emissions.totalCo2eTonnes * OPERATING_DAYS_PER_YEAR))} t CO2e/yr`, change: `${OPERATING_DAYS_PER_YEAR} operating days`, isPositive: true },
      ],
      detailedData: {
        executiveSummary:
          `Operational CO2e for ${ctx.startDate} to ${ctx.endDate} at ${n1(ctx.grainInputTpd)} t/day of grain. ` +
          `The plant emits ${n2(ctx.emissions.totalCo2eTonnes)} t CO2e/day across ${n2(ctx.emissions.ethanolProductionKl)} kL of ethanol, ` +
          `an intensity of ${n1(ctx.emissions.co2eIntensityKgPerKl)} kg CO2e/kL. ` +
          `Distillation steam is the largest contributor at ${share(ctx.emissions.steamCo2eKg)} of the total. ` +
          SCOPE_NOTE,
        sections: [
          {
            title: 'Emission ledger',
            description: 'Each source is the predicted consumption times the factor recovered from the source dataset.',
            tableHeaders: ['Source', 'Consumption', 'Factor', 'CO2e (kg/day)', 'Share'],
            tableRows: [
              ['Process electricity', `${n0(ctx.consumption.electricityKwh)} kWh`, `${ELECTRICITY_KG_CO2E_PER_KWH} kg CO2e/kWh`, n0(ctx.emissions.electricityCo2eKg), share(ctx.emissions.electricityCo2eKg)],
              ['Distillation steam', `${n0(ctx.consumption.distillationSteamKg)} kg`, `${DISTILLATION_STEAM_KG_CO2E_PER_KG} kg CO2e/kg`, n0(ctx.emissions.steamCo2eKg), share(ctx.emissions.steamCo2eKg)],
              ['DDGS dryer fuel', `${n1(ctx.consumption.dryerFuelMmbtu)} MMBtu`, `${DRYER_FUEL_KG_CO2E_PER_MMBTU} kg CO2e/MMBtu`, n0(ctx.emissions.fuelCo2eKg), share(ctx.emissions.fuelCo2eKg)],
              ['Total', '', '', n0(ctx.emissions.totalCo2eKg), '100%'],
            ],
            notes:
              'The fuel factor of 53.0 kg CO2e/MMBtu matches the EPA natural gas factor, which is what settles the fuel type for this dataset.',
          },
          {
            title: 'Scope',
            description: 'What is and is not inside these figures.',
            notes: SCOPE_NOTE,
          },
          {
            title: 'Excluded from this ledger',
            description: 'Loads the plant carries that the source dataset does not count in its CO2e column.',
            tableHeaders: ['Load', 'Value', 'Why it is excluded'],
            tableRows: [
              [
                'Liquefaction steam',
                `${n0(ctx.physics.liquefactionSteamKg)} kg/day`,
                'The source dataset excludes its liquefaction steam column from the CO2e it reports. Including it here would break the 0.006% reconciliation this ledger relies on.',
              ],
            ],
          },
        ],
        aiKeyFindings: [
          `Intensity is ${n1(ctx.emissions.co2eIntensityKgPerKl)} kg CO2e/kL at ${n1(ctx.grainInputTpd)} t/day.`,
          `Steam is ${share(ctx.emissions.steamCo2eKg)} of operational CO2e, so reflux is where this figure can actually be moved.`,
          'This is an operational figure. It is not a lifecycle carbon intensity and cannot be used for credits as it stands.',
        ],
      },
    };
  },
};

// ---------------------------------------------------------------------------

const optimization: ReportTemplate = {
  id: 'optimization',
  title: 'Optimization Report',
  category: 'INTELLIGENCE',
  iconType: 'ai',
  description:
    'Distillation scenarios screened against purity and recovery at your throughput, and where your submitted reflux sits among them.',
  build: (ctx) => {
    const rec = ctx.recommended;
    const steamDelta = rec ? ctx.current.steamKgDay - rec.steamKgDay : 0;
    const costsMore = steamDelta < 0;

    return {
      metricsSummary: [
        { label: 'Your Scenario', value: `${ctx.current.id} at reflux ${n2(ctx.current.refluxRatio)}`, change: ctx.current.feasible ? 'meets both limits' : 'violates purity or recovery', isPositive: ctx.current.feasible },
        { label: 'Recommended', value: rec ? `${rec.id} at reflux ${n2(rec.refluxRatio)}` : 'none feasible', change: 'lowest steam meeting both limits', isPositive: true },
        { label: costsMore ? 'Extra Steam to Comply' : 'Steam Available', value: `${n0(Math.abs(steamDelta))} kg/day`, change: costsMore ? 'a cost, not a saving' : 'moving to the recommended point', isPositive: !costsMore },
        { label: 'Specific Steam', value: `${n1(ctx.current.specificSteamKgPerKl)} kg/kL`, change: 'at your current reflux', isPositive: true },
        { label: 'Grain Throughput', value: `${n1(ctx.grainInputTpd)} t/day`, change: ctx.sourceNote, isPositive: true },
      ],
      detailedData: {
        executiveSummary:
          `Distillation screening for ${ctx.startDate} to ${ctx.endDate} at ${n1(ctx.grainInputTpd)} t/day. ` +
          `Your submitted reflux of ${n2(ctx.current.refluxRatio)} places the column on ${ctx.current.id}, which ` +
          `${ctx.current.feasible ? 'meets' : 'fails'} the purity and recovery limits. ` +
          (rec
            ? costsMore
              ? `${ctx.current.id} uses less steam than the recommended ${rec.id}, but only because it is off spec: returning to ${rec.id} costs ${n0(Math.abs(steamDelta))} kg of steam a day.`
              : `Moving to ${rec.id} at reflux ${n2(rec.refluxRatio)} would free ${n0(steamDelta)} kg of steam a day.`
            : 'No scenario met both limits.'),
        sections: [
          {
            title: 'Scenario screening',
            description: `Screened against purity >= ${PURITY_MIN_PCT}% and recovery >= ${RECOVERY_MIN_PCT}% at ${n1(ctx.grainInputTpd)} t/day.`,
            tableHeaders: ['Scenario', 'Reflux', 'Steam (kg/day)', 'Specific (kg/kL)', 'Recovery %', 'Purity %', 'Status'],
            tableRows: ctx.scenarios.map((s) => [
              s.id === ctx.current.id ? `${s.id} (yours)` : s.id,
              n2(s.refluxRatio),
              n0(s.steamKgDay),
              n1(s.specificSteamKgPerKl),
              n1(s.recoveryPct),
              s.purityPct.toFixed(2),
              s.classification === 'Energy_Efficient' ? 'Recommended' : s.classification === 'Constraint_Violation' ? 'Violates limits' : 'Feasible',
            ]),
            notes:
              'CO2e in this screening converts reboiler duty at the generic natural gas factor, which is about twice the factor recovered from the source dataset. Do not add these figures to the Carbon report totals.',
          },
          {
            title: 'Reading consistency',
            description: 'Readings that should agree with each other, checked against the throughput you entered.',
            tableHeaders: ['Check', 'You entered', 'Implied', 'Result'],
            tableRows: ctx.physics.crossChecks.map((c) => [
              c.label,
              c.entered,
              c.implied,
              c.ok ? 'consistent' : `${n0(Math.abs(c.deviation * 100))}% out`,
            ]),
          },
        ],
        aiKeyFindings: [
          `Your reflux of ${n2(ctx.current.refluxRatio)} places the column on ${ctx.current.id}.`,
          rec
            ? costsMore
              ? `${ctx.current.id} fails the limits. Returning to ${rec.id} is a cost of ${n0(Math.abs(steamDelta))} kg steam/day, not a saving.`
              : `${rec.id} at reflux ${n2(rec.refluxRatio)} is the lowest-steam option clearing both limits.`
            : 'No scenario met both the purity and recovery limits.',
          'The purity and recovery limits are study defaults. Replace them with your commissioned values before acting on this.',
        ],
      },
    };
  },
};

// ---------------------------------------------------------------------------

const creditPotential: ReportTemplate = {
  id: 'carbon-reduction',
  title: 'Carbon Reduction / Credit Potential Report',
  category: 'COMPLIANCE',
  iconType: 'carbon',
  description:
    'The CO2e reduction available from the screened distillation scenarios, and what would be required before any of it could be claimed as a credit.',
  build: (ctx) => {
    const rec = ctx.recommended;
    const co2eDelta = rec ? ctx.current.co2eKgDay - rec.co2eKgDay : 0;
    const costsMore = co2eDelta < 0;
    const annual = (Math.abs(co2eDelta) * OPERATING_DAYS_PER_YEAR) / 1000;
    const pctOfTotal =
      ctx.emissions.totalCo2eKg > 0 ? (Math.abs(co2eDelta) / ctx.emissions.totalCo2eKg) * 100 : 0;

    return {
      metricsSummary: [
        { label: costsMore ? 'Additional CO2e to Comply' : 'CO2e Reduction Available', value: `${n0(Math.abs(co2eDelta))} kg/day`, change: costsMore ? 'a cost, not a reduction' : `moving to ${rec?.id ?? 'the recommended point'}`, isPositive: !costsMore },
        { label: 'Annualised', value: `${n1(annual)} t CO2e/yr`, change: `${OPERATING_DAYS_PER_YEAR} operating days`, isPositive: !costsMore },
        { label: 'Share of Operational CO2e', value: `${n1(pctOfTotal)}%`, change: 'against the ledger total', isPositive: !costsMore },
        { label: 'Current Operational CO2e', value: `${n2(ctx.emissions.totalCo2eTonnes)} t/day`, change: 'electricity, steam and dryer fuel', isPositive: true },
        { label: 'Verified Credits', value: 'None', change: 'nothing here is a claimable credit', isPositive: false },
      ],
      detailedData: {
        executiveSummary:
          (costsMore
            ? `At your submitted reflux of ${n2(ctx.current.refluxRatio)} the column is running below the feasible band. That uses less steam than the recommended point, but only because it is off spec, so there is no reduction to claim here: returning to ${rec?.id ?? 'a compliant setting'} costs ${n0(Math.abs(co2eDelta))} kg CO2e/day.`
            : `Moving the column from ${ctx.current.id} to ${rec?.id ?? 'the recommended point'} would reduce operational CO2e by ${n0(co2eDelta)} kg/day, about ${n1(annual)} t/yr over ${OPERATING_DAYS_PER_YEAR} operating days, or ${n1(pctOfTotal)}% of current operational emissions.`) +
          ' This is an operational reduction computed from the scenario screening. It is not a carbon credit, and the section below sets out what would stand between the two.',
        sections: [
          {
            title: 'Where the reduction comes from',
            description: 'The only lever in this project with a computed CO2e effect is distillation reflux.',
            tableHeaders: ['Item', 'Value', 'Basis'],
            tableRows: [
              ['Current scenario', `${ctx.current.id} at reflux ${n2(ctx.current.refluxRatio)}`, 'From the reflux you submitted on Process Monitor'],
              ['Target scenario', rec ? `${rec.id} at reflux ${n2(rec.refluxRatio)}` : 'none feasible', 'Lowest-steam option meeting purity and recovery'],
              ['Steam difference', `${n0(Math.abs(ctx.current.steamKgDay - (rec?.steamKgDay ?? ctx.current.steamKgDay)))} kg/day`, 'Scenario anchors scaled to your throughput'],
              [costsMore ? 'Additional CO2e' : 'CO2e reduction', `${n0(Math.abs(co2eDelta))} kg/day`, 'Reboiler duty at 56.1 kg CO2e/GJ, the generic natural gas factor'],
              ['Annualised', `${n1(annual)} t CO2e/yr`, `${OPERATING_DAYS_PER_YEAR} operating days per year`],
            ],
            notes:
              'This CO2e uses the scenario table\'s natural gas factor, which is about twice the factor recovered from the source dataset used in the Carbon report. The two are not on the same basis and must not be added together.',
          },
          {
            title: 'What this is not',
            description: 'The gap between an operational reduction and a tradable credit.',
            notes:
              'A reduction of this kind is not a carbon credit and cannot be sold, banked or reported as one. To become a credit it would need, at minimum: a lifecycle methodology covering farming, fertiliser, grain transport and land use, none of which this project measures; a baseline accepted by the registry rather than a scenario anchor; third-party verification of both the baseline and the reduction; a demonstration that the reduction is additional rather than routine optimisation; and continuous measurement rather than a model prediction. The figures above also rest on a synthetic dataset and on purity and recovery limits that are study defaults, so none of it is auditable as it stands.',
          },
          {
            title: 'Before this is used for anything',
            description: 'Substitutions that would have to be made first.',
            tableHeaders: ['Item', 'Currently', 'Needs to be'],
            tableRows: [
              ['Emission factors', 'Recovered from a synthetic dataset', 'Your metered boiler and grid factors'],
              ['Purity and recovery limits', 'Study defaults (99.5% / 95%)', 'Your commissioned column limits'],
              ['Scenario anchors', 'Four fixed operating points', 'Measured steam at your own reflux settings'],
              ['Consumption', 'Model prediction, weak fit on steam', 'Metered steam from the plant historian'],
            ],
          },
        ],
        aiKeyFindings: [
          costsMore
            ? `There is no reduction available at your current reflux: ${ctx.current.id} is below the feasible band, so compliance costs ${n0(Math.abs(co2eDelta))} kg CO2e/day.`
            : `${n0(co2eDelta)} kg CO2e/day is available from reflux alone, about ${n1(annual)} t/yr.`,
          `That is ${n1(pctOfTotal)}% of current operational CO2e, so reflux alone does not move the headline far.`,
          'None of this is a claimable credit. Operational reductions need a lifecycle methodology and third-party verification before they count.',
        ],
      },
    };
  },
};

export const REPORT_TEMPLATES: ReportTemplate[] = [
  energyConsumption,
  carbonLedger,
  optimization,
  creditPotential,
];

export const findTemplate = (id: string): ReportTemplate =>
  REPORT_TEMPLATES.find((t) => t.id === id) ?? REPORT_TEMPLATES[0];
