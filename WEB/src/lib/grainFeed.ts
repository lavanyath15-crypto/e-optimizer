/**
 * Milling feed rate to the model's input.
 *
 * The Process Monitor records a grain feed rate in bushels per hour, which is
 * how a US dry mill reads it off the scale. The network takes tonnes per day.
 * This is the conversion between them, and it is the one link that lets a
 * reading typed on that screen actually drive a prediction.
 *
 * A bushel of corn is 56 lb by legal definition, not by measurement, so the
 * conversion is exact rather than an estimate.
 */

const POUNDS_PER_BUSHEL_CORN = 56;
const KG_PER_POUND = 0.45359237;
const HOURS_PER_DAY = 24;

export const KG_PER_BUSHEL_CORN = POUNDS_PER_BUSHEL_CORN * KG_PER_POUND; // 25.4012 kg

export function bushelsPerHourToTonnesPerDay(bushelsPerHour: number): number {
  return (bushelsPerHour * KG_PER_BUSHEL_CORN * HOURS_PER_DAY) / 1000;
}

export function tonnesPerDayToBushelsPerHour(tonnesPerDay: number): number {
  return (tonnesPerDay * 1000) / KG_PER_BUSHEL_CORN / HOURS_PER_DAY;
}
