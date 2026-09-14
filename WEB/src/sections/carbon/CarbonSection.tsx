import React from 'react';
import { Leaf, ShieldCheck, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { usePlantFigures } from '../../hooks/usePlantFigures';
import { DataSourceBanner } from '../../components/DataSourceBanner';
import {
  ELECTRICITY_KG_CO2E_PER_KWH,
  DISTILLATION_STEAM_KG_CO2E_PER_KG,
  DRYER_FUEL_KG_CO2E_PER_MMBTU,
} from '../../lib/emissionsFormula';
import {
  DISTILLATION_SCENARIOS,
  classifyScenarios,
  evaluateScenario,
  resolveCurrentScenario,
} from '../../lib/distillationEngine';
import { ReadingsEffect } from '../../components/ReadingsEffect';
import { Co2ReductionCard } from '../../components/Co2ReductionCard';
import { BOILER_EFFICIENCY, impliedBoilerEfficiency } from '../../lib/thermalChain';
import { TabType } from '../../types';

interface CarbonSectionProps {
  onNavigateTab?: (tab: TabType) => void;
}

/**
 * Operational CO2e, computed live.
 *
 * This screen used to show a "Certified Carbon Intensity" in gCO2e/MJ driven by
 * an invented sensitivity (baseCi = 58.0, arbitrary slider coefficients). That
 * unit is a *lifecycle* measure: it includes farming, fertiliser N2O, grain
 * transport and land use, which dominate corn ethanol's footprint and which
 * nothing here measures.
 *
 * Feeding this project's operational figure into that basis gives about
 * 8.8 gCO2e/MJ against an industry range of 50-70, which reads as a
 * world-beating result and is really a scope error. So the CI framing is gone.
 * What is shown instead is what the pipeline genuinely produces: operational
 * CO2e in its own units, split by the three sources it is recovered from.
 */
export const CarbonSection: React.FC<CarbonSectionProps> = ({ onNavigateTab }) => {
  const {
    emissions,
    consumption,
    loading,
    error,
    grainInputTpd,
    refluxRatio,
    hasSubmitted,
    source,
    updatedAt,
    physics,
    unmodelled,
  } = usePlantFigures();

  // Where the submitted reflux sits against the screened scenarios, and what the
  // recommended point would save. resolveCurrentScenario is shared with AI
  // Optimization so the two screens cannot disagree about which scenario the
  // plant is on.
  const scenarios = classifyScenarios(
    DISTILLATION_SCENARIOS.map((s) => evaluateScenario(s, grainInputTpd))
  );
  const recommended = scenarios.find((s) => s.classification === 'Energy_Efficient');
  const current = hasSubmitted ? resolveCurrentScenario(scenarios, refluxRatio) : null;
  // The reduction card does not wait for a submit: reflux has a value from the
  // defaults, so the screening is real before the operator touches anything.
  const scenarioNow = resolveCurrentScenario(scenarios, refluxRatio);

  // Positive means the recommended point uses less steam than the plant is using
  // now. It goes negative whenever the operator is running below the feasible
  // band, which is cheaper on steam precisely because it is off spec.
  const steamDeltaKgDay = current && recommended ? current.steamKgDay - recommended.steamKgDay : 0;
  const co2eDeltaKgDay = current && recommended ? current.co2eKgDay - recommended.co2eKgDay : 0;
  const costsMore = steamDeltaKgDay < 0;

  const sources =
    emissions && consumption
      ? [
          {
            id: 'electricity',
            label: 'Process Electricity',
            co2eKg: emissions.electricityCo2eKg,
            basis: `${consumption.electricityKwh.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })} kWh x ${ELECTRICITY_KG_CO2E_PER_KWH} kg CO2e/kWh`,
          },
          {
            id: 'steam',
            label: 'Distillation Steam',
            co2eKg: emissions.steamCo2eKg,
            basis:
              `${consumption.distillationSteamKg.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })} kg steam -> ${Math.round(emissions.steamThermalMj).toLocaleString()} MJ heat -> ` +
              `${Math.round(emissions.steamFuelMj).toLocaleString()} MJ gas at ${(
                BOILER_EFFICIENCY * 100
              ).toFixed(0)}% boiler`,
          },
          {
            id: 'fuel',
            label: 'DDGS Dryer Fuel',
            co2eKg: emissions.fuelCo2eKg,
            basis: `${consumption.dryerFuelMmbtu.toFixed(1)} MMBtu x ${DRYER_FUEL_KG_CO2E_PER_MMBTU} kg CO2e/MMBtu`,
          },
        ]
      : [];

  const totalKg = emissions?.totalCo2eKg ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#e0e3e6]/60">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#2D6A4F] bg-[#2D6A4F]/10 px-2.5 py-0.5 rounded-full">
            Operational Emissions
          </span>
          <h2 className="text-3xl font-extrabold text-[#191c1e] tracking-tight mt-1">
            Carbon &amp; CO2e Ledger
          </h2>
          <p className="text-xs text-[#45464f] mt-1">
            What the plant emits running, split by the three sources the model predicts.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-[#2D6A4F]/10 border border-[#2D6A4F]/20 rounded-lg text-xs font-bold text-[#2D6A4F]">
          <ShieldCheck className="w-4 h-4" />
          <span>Recovered from the source data</span>
        </div>
      </div>

      {/* Data source provenance banner */}
      <DataSourceBanner
        hasSubmitted={hasSubmitted}
        source={source}
        updatedAt={updatedAt}
        grainInputTpd={grainInputTpd}
        onGoToProcessMonitor={onNavigateTab ? () => onNavigateTab('process-monitor') : undefined}
      />

      {error && (
        <div className="flex items-start gap-2 p-3.5 bg-[#BA1A1A]/5 border border-[#BA1A1A]/25 rounded-xl text-xs text-[#BA1A1A]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Could not load the consumption model: {error}</span>
        </div>
      )}

      {loading && <div className="h-40 bg-white rounded-2xl border border-[#e0e3e6] animate-pulse" />}

      {emissions && (
        <>
          {/* Where it comes from */}
          <div className="bg-white rounded-xl p-6 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#061449] flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-[#2D6A4F]" />
                  <span>Where the CO2e comes from</span>
                </h3>
                <p className="text-xs text-[#767680] mt-0.5">
                  Each source is the model's predicted consumption times its recovered factor.
                </p>
              </div>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('process-monitor')}
                  className="text-xs font-bold text-[#0f6e8c] hover:text-[#0b5670] flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {/* Process Monitor, not AI Optimization. Throughput is the
                      milling feed rate; sending the operator to the advisory
                      slider was pointing them at the second way to set the same
                      thing. */}
                  <span>Change throughput</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              {sources.map((source) => {
                const share = totalKg > 0 ? (source.co2eKg / totalKg) * 100 : 0;
                return (
                  <div key={source.id} className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-xs gap-3">
                      <span className="font-bold text-[#061449]">{source.label}</span>
                      <span className="font-mono text-[#45464f]">
                        {source.co2eKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
                        <span className="text-[#767680] ml-1.5">({share.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-[#eceef1] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0f6e8c] h-full rounded-full transition-all"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[#767680] font-mono">{source.basis}</p>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[#e0e3e6] flex items-baseline justify-between text-xs">
              <span className="font-bold text-[#061449]">Total</span>
              <span className="font-mono font-bold text-[#061449]">
                {totalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO2e/day
              </span>
            </div>
          </div>

          {/* Item 8: what is actually on the table, in CO2e. */}
          <Co2ReductionCard
            current={scenarioNow}
            recommended={recommended}
            totalCo2eKgDay={emissions.totalCo2eKg}
          />

          {/* The energy balance, in the unit an energy balance is quoted in. */}
          <div className="bg-white rounded-xl p-6 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#061449]">Energy intensity</h3>
              <p className="text-xs text-[#767680] mt-0.5">
                Primary energy into the plant per kL of ethanol, steam included as the gas burnt to
                raise it.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-[11px] text-[#767680] block">Energy Intensity</span>
                <span className="text-2xl font-extrabold font-mono text-[#061449]">
                  {emissions.energyIntensityGjPerKl.toFixed(2)}
                </span>
                <span className="text-[11px] text-[#767680] ml-1">GJ/kL</span>
              </div>
              <div>
                <span className="text-[11px] text-[#767680] block">Same figure, US units</span>
                <span className="text-2xl font-extrabold font-mono text-[#45464f]">
                  {Math.round(emissions.energyIntensityBtuPerGal).toLocaleString()}
                </span>
                <span className="text-[11px] text-[#767680] ml-1">Btu/gal</span>
              </div>
              <div>
                <span className="text-[11px] text-[#767680] block">Steam heat delivered</span>
                <span className="text-2xl font-extrabold font-mono text-[#0f6e8c]">
                  {Math.round(emissions.steamThermalMj / 1000).toLocaleString()}
                </span>
                <span className="text-[11px] text-[#767680] ml-1">GJ/day</span>
              </div>
              <div>
                <span className="text-[11px] text-[#767680] block">Gas burnt to raise it</span>
                <span className="text-2xl font-extrabold font-mono text-[#8a6100]">
                  {Math.round(emissions.steamFuelMj / 1000).toLocaleString()}
                </span>
                <span className="text-[11px] text-[#767680] ml-1">GJ/day</span>
              </div>
            </div>

            <p className="text-[10px] text-[#767680] pt-2 border-t border-[#e0e3e6] leading-relaxed">
              Steam used to be priced at a flat {DISTILLATION_STEAM_KG_CO2E_PER_KG} kg CO2e per kg,
              recovered from the source dataset. That factor implies a boiler efficiency of{' '}
              <strong className="font-mono">
                {(impliedBoilerEfficiency(DISTILLATION_STEAM_KG_CO2E_PER_KG, 148.5) * 100).toFixed(0)}%
              </strong>
              , which is not possible: a boiler cannot return more heat than its fuel carries. Steam
              now goes through the chain it stood in for, at an assumed{' '}
              {(BOILER_EFFICIENCY * 100).toFixed(0)}% boiler efficiency, giving an effective{' '}
              <strong className="font-mono">
                {emissions.steamEffectiveFactor.toFixed(3)} kg CO2e/kg
              </strong>
              . The check on the whole thing is the Btu/gal above: a US dry mill runs 20,000 to
              25,000. Replace the boiler efficiency with your own measured figure.
            </p>
          </div>

          {/* Every reading other than throughput, and what it did to the
              figures above. */}
          {physics && (
            <ReadingsEffect
              physics={physics}
              unmodelled={unmodelled}
              onNavigateToReadings={
                onNavigateTab ? () => onNavigateTab('process-monitor') : undefined
              }
            />
          )}

          {/* The reflux submitted on Process Monitor, priced against the
              screened alternatives. Steam is the largest single source above, so
              this is where the CO2e on this screen can actually be moved. */}
          {current && (
            <div className="bg-white rounded-xl p-6 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-3">
              <div>
                <h3 className="text-base font-bold text-[#061449]">
                  What your reflux is costing
                </h3>
                <p className="text-xs text-[#767680] mt-0.5">
                  From the reflux ratio you submitted on Process Monitor.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#45464f]">
                  You entered{' '}
                  <strong className="font-mono">{refluxRatio.toFixed(2)}</strong>, closest to{' '}
                  <strong>{current.id}</strong> at{' '}
                  <strong className="font-mono">{current.refluxRatio.toFixed(2)}</strong>
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    current.classification === 'Energy_Efficient'
                      ? 'bg-[#2D6A4F]/15 text-[#2D6A4F]'
                      : current.classification === 'Constraint_Violation'
                      ? 'bg-[#BA1A1A]/10 text-[#BA1A1A]'
                      : 'bg-[#eceef1] text-[#45464f]'
                  }`}
                >
                  {current.classification === 'Energy_Efficient'
                    ? 'Already the lowest-steam feasible point'
                    : current.classification === 'Constraint_Violation'
                    ? 'Violates purity or recovery'
                    : 'Feasible'}
                </span>
              </div>

              {recommended && current.id !== recommended.id && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                    <div className="bg-[#f7f9fc] p-3.5 rounded-lg border border-[#e0e3e6]">
                      <span className="text-[11px] text-[#767680] block">Move to</span>
                      <span className="text-lg font-bold font-mono text-[#0f6e8c]">
                        {recommended.id}
                      </span>
                      <span className="text-[11px] text-[#767680] ml-1">
                        reflux {recommended.refluxRatio.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-[#f7f9fc] p-3.5 rounded-lg border border-[#e0e3e6]">
                      <span className="text-[11px] text-[#767680] block">
                        {costsMore ? 'Extra steam' : 'Steam saved'}
                      </span>
                      <span
                        className={`text-lg font-bold font-mono ${
                          costsMore ? 'text-[#8a6100]' : 'text-[#2D6A4F]'
                        }`}
                      >
                        {Math.abs(steamDeltaKgDay).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                      <span className="text-[11px] text-[#767680] ml-1">kg/day</span>
                    </div>
                    <div className="bg-[#f7f9fc] p-3.5 rounded-lg border border-[#e0e3e6]">
                      <span className="text-[11px] text-[#767680] block">
                        {costsMore ? 'Extra CO2e' : 'CO2e saved'}
                      </span>
                      <span
                        className={`text-lg font-bold font-mono ${
                          costsMore ? 'text-[#8a6100]' : 'text-[#2D6A4F]'
                        }`}
                      >
                        {Math.abs(co2eDeltaKgDay).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                      <span className="text-[11px] text-[#767680] ml-1">kg/day</span>
                    </div>
                  </div>

                  {/* Running below the feasible band is cheaper on steam and off
                      spec, so the move to the recommended point costs energy
                      rather than saving it. Printing "Steam saved: -2,854" was
                      technically the same number and the wrong sentence. */}
                  {costsMore && (
                    <p className="text-xs text-[#8a6100] bg-[#FFB703]/10 border border-[#FFB703]/40 rounded-lg p-3">
                      You are running below {recommended.id}, which uses less steam but does not meet
                      the purity and recovery limits. Getting back inside them costs energy, it does
                      not save it. The figures above are what that costs.
                    </p>
                  )}
                </>
              )}

              <p className="text-[10px] text-[#767680] pt-2 border-t border-[#e0e3e6]">
                This CO2e uses the scenario table's natural gas factor, not the 0.06 kg CO2e/kg
                recovered from the dataset that the ledger above uses. The two are about 2x apart
                and are not on the same basis, so don't add these savings to the totals above.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
