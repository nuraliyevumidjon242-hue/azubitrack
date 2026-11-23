import { describe, expect, it } from 'vitest';
import {
  getIsoWeek,
  getTrainingYear,
  getWeekRange,
  isValidWeek,
  isoWeekMonday,
  weeksInIsoYear,
} from '../src/lib/dates.js';

describe('ISO calendar week helpers', () => {
  it('calculates the ISO week for known dates', () => {
    expect(getIsoWeek(new Date('2024-01-01T12:00:00'))).toEqual({ year: 2024, week: 1 });
    expect(getIsoWeek(new Date('2026-11-23T12:00:00'))).toEqual({ year: 2026, week: 48 });
    expect(getIsoWeek(new Date('2021-01-03T12:00:00'))).toEqual({ year: 2020, week: 53 });
  });

  it('returns the Monday to Friday range for a week', () => {
    const range = getWeekRange(2026, 48);
    expect(range.start).toBe('2026-11-23');
    expect(range.end).toBe('2026-11-27');
    expect(range.days).toHaveLength(5);
    expect(range.days[0]).toBe('2026-11-23');
  });

  it('handles week 1 correctly', () => {
    const monday = isoWeekMonday(2024, 1);
    expect(monday.toISOString().slice(0, 10)).toBe('2024-01-01');
  });

  it('knows the number of ISO weeks in a year', () => {
    expect(weeksInIsoYear(2020)).toBe(53);
    expect(weeksInIsoYear(2024)).toBe(52);
    expect(weeksInIsoYear(2026)).toBe(53);
  });

  it('validates week numbers', () => {
    expect(isValidWeek(2026, 53)).toBe(true);
    expect(isValidWeek(2025, 53)).toBe(false);
    expect(isValidWeek(2026, 0)).toBe(false);
    expect(isValidWeek(1990, 1)).toBe(false);
  });

  it('derives the training year from the start date', () => {
    expect(getTrainingYear('2024-08-01', new Date('2024-09-01T12:00:00'))).toBe(1);
    expect(getTrainingYear('2024-08-01', new Date('2025-08-01T12:00:00'))).toBe(2);
    expect(getTrainingYear('2024-08-01', new Date('2026-07-31T12:00:00'))).toBe(2);
    expect(getTrainingYear('2024-08-01', new Date('2026-08-01T12:00:00'))).toBe(3);
    expect(getTrainingYear(null)).toBeNull();
    expect(getTrainingYear('invalid')).toBeNull();
  });
});
