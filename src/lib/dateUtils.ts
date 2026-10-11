/**
 * Minimal Cairo-aware date utilities for the Business Calendar foundation.
 * 
 * NOTE ON APPLICATION-WIDE TIMEZONE GOVERNANCE:
 * The broader application currently derives dates via `todayStr()` (UTC slice).
 * A global timezone migration requires an independent, dedicated governance phase.
 * This module isolates the official accounting timezone ("Africa/Cairo") strictly
 * for Business Calendar evaluation, effectiveFrom resolution, and lookahead logic.
 */

export const ACCOUNTING_TIMEZONE = 'Africa/Cairo';

/**
 * Returns the current date in Cairo timezone formatted as YYYY-MM-DD.
 */
export function getCairoDateStr(dateInput: Date = new Date()): string {
  // Use en-CA format which deterministically yields YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ACCOUNTING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(dateInput);
}

/**
 * Validates whether a string is a strict YYYY-MM-DD calendar date.
 */
export function isValidDateStr(str: string): boolean {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * Adds an integer number of days to a YYYY-MM-DD string and returns the resulting YYYY-MM-DD string.
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  const nextY = date.getUTCFullYear();
  const nextM = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextD = String(date.getUTCDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
}

/**
 * Returns the day-of-week index (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * for a given YYYY-MM-DD string in UTC/calendar sense.
 */
export function getDayOfWeekFromDateStr(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCDay();
}
