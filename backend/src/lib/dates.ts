/**
 * Calendar-week helpers (ISO 8601 / German "Kalenderwoche").
 * All calculations are done in UTC on calendar dates to stay independent of
 * the server timezone.
 */

export interface IsoWeek {
  year: number;
  week: number;
}

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

/** Returns the ISO week and ISO week-year for a given date. */
export function getIsoWeek(date: Date = new Date()): IsoWeek {
  const d = utcDate(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNumber = d.getUTCDay() || 7; // Monday = 1 ... Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNumber);
  const isoYear = d.getUTCFullYear();
  const yearStart = utcDate(isoYear, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { year: isoYear, week };
}

/** Number of ISO weeks in a given ISO week-year (52 or 53). */
export function weeksInIsoYear(year: number): number {
  const dec28 = utcDate(year, 11, 28);
  return getIsoWeek(dec28).week;
}

/** Monday (00:00 UTC) of the given ISO week. */
export function isoWeekMonday(year: number, week: number): Date {
  const jan4 = utcDate(year, 0, 4);
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  return monday;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export interface WeekRange {
  start: string;
  end: string;
  /** Monday to Friday, as used by the IHK Ausbildungsnachweis. */
  days: string[];
}

export function getWeekRange(year: number, week: number): WeekRange {
  const monday = isoWeekMonday(year, week);
  const days = Array.from({ length: 5 }, (_, index) => toIsoDate(addDays(monday, index)));
  return {
    start: days[0]!,
    end: days[4]!,
    days,
  };
}

/**
 * Training year ("Ausbildungsjahr") derived from the start date.
 * Returns null when no start date is known.
 */
export function getTrainingYear(
  startDate: string | null | undefined,
  reference: Date = new Date(),
): number | null {
  if (!startDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;

  const ref = utcDate(reference.getFullYear(), reference.getMonth(), reference.getDate());
  if (ref < start) return 1;

  let years = ref.getUTCFullYear() - start.getUTCFullYear();
  const anniversary = utcDate(
    start.getUTCFullYear() + years,
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  if (ref < anniversary) years -= 1;
  return Math.max(years + 1, 1);
}

/** Difference in whole months between two ISO dates (dateA - dateB). */
export function monthsBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth())
  );
}

/** Validates that the week exists in the given ISO year. */
export function isValidWeek(year: number, week: number): boolean {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return false;
  if (!Number.isInteger(week) || week < 1) return false;
  return week <= weeksInIsoYear(year);
}
