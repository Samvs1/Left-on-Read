import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, binarySegmentation, labelEras, logOddsZ, median, normalizeSettings, percentiles } from '../index';
import { topK } from '../util';

describe('settings', () => {
  it('fills defaults', () => {
    const s = normalizeSettings({});
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(s.conversationGapMinutes).toBe(360);
    expect(s.doubleTextMinutes).toBe(60);
  });

  it('clamps out-of-range values', () => {
    const s = normalizeSettings({ conversationGapMinutes: 5, doubleTextMinutes: 99999, timezoneOffsetHours: 40, othersThresholdPct: -3 });
    expect(s.conversationGapMinutes).toBe(30);
    expect(s.doubleTextMinutes).toBe(24 * 60);
    expect(s.timezoneOffsetHours).toBe(14);
    expect(s.othersThresholdPct).toBe(0);
  });

  it('drops an inverted date range end and normalizes stopwords', () => {
    const s = normalizeSettings({ dateStart: 1000, dateEnd: 500, stopwords: [' Pizza ', ''] });
    expect(s.dateEnd).toBeNull();
    expect(s.stopwords).toEqual(['pizza']);
  });
});

describe('math utilities', () => {
  it('computes percentiles with interpolation', () => {
    const p = percentiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])!;
    expect(p.count).toBe(10);
    expect(p.median).toBe(5.5);
    expect(p.p25).toBeCloseTo(3.25);
    expect(p.p75).toBeCloseTo(7.75);
    expect(p.p90).toBeCloseTo(9.1);
    expect(p.mean).toBe(5.5);
    expect(percentiles([])).toBeNull();
  });

  it('computes medians for odd and even arrays', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('gives positive log-odds z-scores to over-represented words', () => {
    const over = logOddsZ(50, 1000, 5, 1000, 2, 100);
    const under = logOddsZ(5, 1000, 50, 1000, 2, 100);
    expect(over).toBeGreaterThan(3);
    expect(under).toBeLessThan(-3);
    expect(Math.abs(logOddsZ(10, 1000, 10, 1000, 1, 100))).toBeLessThan(1e-9);
  });

  it('orders top-k by count then key', () => {
    const m = new Map([['b', 2], ['a', 2], ['c', 5]]);
    expect(topK(m, 2).map((x) => x.key)).toEqual(['c', 'a']);
  });
});

describe('era segmentation', () => {
  it('finds a clear change point', () => {
    const x = [1, 1.1, 0.9, 1, 1.05, 4, 4.1, 3.9, 4, 4.2];
    const segs = binarySegmentation(x, 2, 6);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    expect(segs[0]![1]).toBe(5);
  });

  it('does not split flat noise', () => {
    const x = [2, 2.05, 1.95, 2.02, 1.98, 2.01, 1.99, 2.03, 1.97, 2.0];
    expect(binarySegmentation(x, 2, 6)).toEqual([[0, 10]]);
  });

  it('labels the busiest era golden and a slow one quiet', () => {
    const kinds = labelEras([3, 10, 1, 6], 5);
    expect(kinds[1]).toBe('golden');
    expect(kinds[2]).toBe('quiet');
    expect(kinds[0]).toBe('spark');
    expect(kinds[3]).toBe('comeback');
  });
});
