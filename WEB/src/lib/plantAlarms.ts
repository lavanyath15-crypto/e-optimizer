/**
 * Alarms derived from the operator's own readings.
 *
 * Overview used to list three invented alarms from mockData: a centrifuge
 * vibration warning, a beer well sensor fault and a grid tariff window. None of
 * them could ever change, and none of them had anything to do with what the
 * operator had just entered. Someone could submit a grain moisture of 18.4% in a
 * 13-15.5% band and the alarm panel two screens away would still be talking
 * about a centrifuge bearing.
 *
 * There is no DCS behind this dashboard, so the only thing it can honestly raise
 * an alarm about is a reading that sits outside its band. That is what this
 * does.
 */

import { PROCESS_UNITS, isInBand, formatValue, type ProcessValues } from '../data/processUnits';
import type { PlantAlarm } from '../types';

/**
 * How far outside its band a reading has to sit before it is called critical,
 * as a fraction of the band's own width. A moisture band of 13-15.5 is 2.5 wide,
 * so 15.5 + 0.625 = 16.125 and above is critical.
 */
const CRITICAL_MARGIN = 0.25;

export interface DerivedAlarm extends PlantAlarm {
  unitId: string;
  fieldKey: string;
  /** How far outside the band, in the field's own units. Zero when in band. */
  deviation: number;
}

export function deriveAlarms(readings: ProcessValues): DerivedAlarm[] {
  const alarms: DerivedAlarm[] = [];

  for (const unit of PROCESS_UNITS) {
    for (const field of unit.fields) {
      const value = readings[unit.id]?.[field.key];
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      if (isInBand(field, value)) continue;

      const low = value < field.normalMin;
      const deviation = low ? field.normalMin - value : value - field.normalMax;
      const bandWidth = field.normalMax - field.normalMin;
      const severity: PlantAlarm['severity'] =
        bandWidth > 0 && deviation > bandWidth * CRITICAL_MARGIN ? 'critical' : 'warning';

      const unitSuffix = field.unit ? ` ${field.unit}` : '';

      alarms.push({
        id: `alm-${unit.id}-${field.key}`,
        unitId: unit.id,
        fieldKey: field.key,
        deviation,
        severity,
        title: `${field.label} ${low ? 'below' : 'above'} band`,
        location: `${unit.step}. ${unit.name} / ${unit.equipment}`,
        timestamp: 'From your last submitted readings',
        acknowledged: false,
        metric: field.label,
        currentValue: `${formatValue(field, value)}${unitSuffix}`,
        threshold: `${formatValue(field, field.normalMin)} to ${formatValue(
          field,
          field.normalMax
        )}${unitSuffix}`,
        recommendation: `You entered ${formatValue(field, value)}${unitSuffix}, which is ${formatValue(
          field,
          deviation
        )}${unitSuffix} ${low ? 'under' : 'over'} the band on this screen. Those bands are typical dry-mill figures, not your commissioned limits, so check yours before acting.`,
      });
    }
  }

  // Worst first, measured against each field's own band so a 3 °F excursion and
  // a 3% moisture excursion are ranked on comparable terms.
  return alarms.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return b.deviation - a.deviation;
  });
}
