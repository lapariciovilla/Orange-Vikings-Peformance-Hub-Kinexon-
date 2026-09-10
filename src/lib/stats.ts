/**
 * Orange Vikings KINEXON Statistical Analysis Engine
 * Implements deterministic scientific statistical functions for athlete load monitoring.
 */

export interface StatsSummary {
  n: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
  cvPct: number | null;
  min: number | null;
  max: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  iqr: number | null;
}

/**
 * Calculates mean of numbers.
 */
export function calcMean(arr: number[]): number | null {
  if (!arr || arr.length === 0) return null;
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum / arr.length;
}

/**
 * Calculates median (50th percentile) of numbers.
 */
export function calcMedian(arr: number[]): number | null {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculates sample standard deviation (N - 1 denominator).
 */
export function calcSampleSD(arr: number[]): number | null {
  if (!arr || arr.length < 2) return null;
  const mean = calcMean(arr);
  if (mean === null) return null;
  const variance = arr.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculates Coefficient of Variation (CV%) = (SD / Mean) * 100.
 */
export function calcCVPct(arr: number[]): number | null {
  const mean = calcMean(arr);
  const sd = calcSampleSD(arr);
  if (mean === null || sd === null || mean === 0) return null;
  return (sd / Math.abs(mean)) * 100;
}

/**
 * Calculates percentile value (0 to 100) using linear interpolation.
 */
export function calcPercentile(arr: number[], p: number): number | null {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  if (p <= 0) return sorted[0];
  if (p >= 100) return sorted[sorted.length - 1];

  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sorted.length) return sorted[sorted.length - 1];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculates Percentile Rank of a value relative to a distribution (0 to 100).
 */
export function calcPercentileRank(arr: number[], val: number): number | null {
  if (!arr || arr.length === 0) return null;
  const countBelow = arr.filter((x) => x < val).length;
  const countEqual = arr.filter((x) => x === val).length;
  return Number((((countBelow + 0.5 * countEqual) / arr.length) * 100).toFixed(1));
}

/**
 * Calculates Z-score = (Current - Mean) / SD.
 */
export function calcZScore(val: number, mean: number | null, sd: number | null): number | null {
  if (mean === null || sd === null || sd === 0) return null;
  return Number(((val - mean) / sd).toFixed(2));
}

/**
 * Calculates % change = ((Current - Mean) / Mean) * 100.
 */
export function calcPctChange(val: number, mean: number | null): number | null {
  if (mean === null || mean === 0) return null;
  return Number((((val - mean) / mean) * 100).toFixed(1));
}

/**
 * Calculates full descriptive statistics summary.
 */
export function calcStatsSummary(arr: number[]): StatsSummary {
  const clean = arr.filter((x) => x !== null && x !== undefined && !isNaN(x));
  if (clean.length === 0) {
    return {
      n: 0,
      mean: null,
      median: null,
      sd: null,
      cvPct: null,
      min: null,
      max: null,
      p25: null,
      p50: null,
      p75: null,
      p90: null,
      p95: null,
      iqr: null,
    };
  }

  const mean = calcMean(clean);
  const median = calcMedian(clean);
  const sd = calcSampleSD(clean);
  const cvPct = calcCVPct(clean);
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const p25 = calcPercentile(clean, 25);
  const p50 = calcPercentile(clean, 50);
  const p75 = calcPercentile(clean, 75);
  const p90 = calcPercentile(clean, 90);
  const p95 = calcPercentile(clean, 95);
  const iqr = p75 !== null && p25 !== null ? p75 - p25 : null;

  return {
    n: clean.length,
    mean: mean !== null ? Number(mean.toFixed(2)) : null,
    median: median !== null ? Number(median.toFixed(2)) : null,
    sd: sd !== null ? Number(sd.toFixed(2)) : null,
    cvPct: cvPct !== null ? Number(cvPct.toFixed(1)) : null,
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    p25: p25 !== null ? Number(p25.toFixed(2)) : null,
    p50: p50 !== null ? Number(p50.toFixed(2)) : null,
    p75: p75 !== null ? Number(p75.toFixed(2)) : null,
    p90: p90 !== null ? Number(p90.toFixed(2)) : null,
    p95: p95 !== null ? Number(p95.toFixed(2)) : null,
    iqr: iqr !== null ? Number(iqr.toFixed(2)) : null,
  };
}

/**
 * Calculates Pearson Correlation Coefficient (r) and 95% Confidence Interval.
 */
export function calcPearsonR(xArr: number[], yArr: number[]): {
  r: number | null;
  r2: number | null;
  n: number;
  ciLower: number | null;
  ciUpper: number | null;
} {
  if (!xArr || !yArr || xArr.length !== yArr.length || xArr.length < 3) {
    return { r: null, r2: null, n: xArr ? xArr.length : 0, ciLower: null, ciUpper: null };
  }

  const n = xArr.length;
  const meanX = calcMean(xArr)!;
  const meanY = calcMean(yArr)!;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xArr[i] - meanX;
    const dy = yArr[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0 || denY === 0) {
    return { r: null, r2: null, n, ciLower: null, ciUpper: null };
  }

  const r = num / Math.sqrt(denX * denY);
  const rClamped = Math.max(-0.9999, Math.min(0.9999, r));
  const r2 = rClamped * rClamped;

  // 95% CI via Fisher z-transform requires n >= 4
  let ciLower: number | null = null;
  let ciUpper: number | null = null;

  if (n >= 4) {
    const z = 0.5 * Math.log((1 + rClamped) / (1 - rClamped));
    const seZ = 1 / Math.sqrt(n - 3);
    const zLower = z - 1.96 * seZ;
    const zUpper = z + 1.96 * seZ;

    const lowerVal = (Math.exp(2 * zLower) - 1) / (Math.exp(2 * zLower) + 1);
    const upperVal = (Math.exp(2 * zUpper) - 1) / (Math.exp(2 * zUpper) + 1);

    if (Number.isFinite(lowerVal) && !isNaN(lowerVal)) ciLower = Number(lowerVal.toFixed(2));
    if (Number.isFinite(upperVal) && !isNaN(upperVal)) ciUpper = Number(upperVal.toFixed(2));
  }

  return {
    r: Number(rClamped.toFixed(2)),
    r2: Number(r2.toFixed(2)),
    n,
    ciLower,
    ciUpper,
  };
}

/**
 * Calculates Spearman Rank Correlation Coefficient (rho).
 */
export function calcSpearmanRho(xArr: number[], yArr: number[]): number | null {
  if (!xArr || !yArr || xArr.length !== yArr.length || xArr.length < 3) return null;

  const rank = (arr: number[]) => {
    const sorted = arr.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
    const ranks = new Array(arr.length);
    for (let i = 0; i < sorted.length; i++) {
      ranks[sorted[i].idx] = i + 1;
    }
    return ranks;
  };

  const rankX = rank(xArr);
  const rankY = rank(yArr);

  const res = calcPearsonR(rankX, rankY);
  return res.r;
}

/**
 * Calculates Simple Linear Regression (Slope, Intercept, R², n).
 */
export function calcLinearRegression(xArr: number[], yArr: number[]): {
  slope: number | null;
  intercept: number | null;
  r2: number | null;
  n: number;
} {
  if (!xArr || !yArr || xArr.length !== yArr.length || xArr.length < 3) {
    return { slope: null, intercept: null, r2: null, n: xArr ? xArr.length : 0 };
  }

  const n = xArr.length;
  const meanX = calcMean(xArr)!;
  const meanY = calcMean(yArr)!;

  let num = 0;
  let den = 0;

  for (let i = 0; i < n; i++) {
    const dx = xArr[i] - meanX;
    const dy = yArr[i] - meanY;
    num += dx * dy;
    den += dx * dx;
  }

  if (den === 0) {
    return { slope: null, intercept: null, r2: null, n };
  }

  const slope = num / den;
  const intercept = meanY - slope * meanX;
  const pR = calcPearsonR(xArr, yArr);

  return {
    slope: Number(slope.toFixed(4)),
    intercept: Number(intercept.toFixed(2)),
    r2: pR.r2,
    n,
  };
}

/**
 * Calculates Exponentially Weighted Moving Average (EWMA) with smoothing factor lambda.
 */
export function calcEWMA(values: number[], lambda = 0.2): number[] {
  if (!values || values.length === 0) return [];
  const ewma: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    const prev = ewma[i - 1];
    const curr = values[i];
    ewma.push(Number((lambda * curr + (1 - lambda) * prev).toFixed(2)));
  }
  return ewma;
}

/**
 * Standard Statistical Definitions for Tooltips
 */
export const STAT_TOOLTIPS = {
  zScore:
    'Shows how many standard deviations the current value is above or below the athlete’s historical baseline mean.',
  percentile:
    'Shows where the current value sits relative to the athlete’s historical distribution (0 = lowest, 100 = highest).',
  cv:
    'Coefficient of Variation (CV%) = (SD / Mean) * 100. Describes overall variability relative to the mean.',
  sd:
    'Sample Standard Deviation. Measures the degree of dispersion or spread around the mean.',
  median:
    '50th percentile. Middle value of the distribution, resistant to extreme outliers.',
  iqr:
    'Interquartile Range = P75 − P25. Measures the spread of the middle 50% of historical data.',
  pearsonR:
    'Pearson linear correlation coefficient (r) measuring strength and direction of linear association.',
  spearmanRho:
    'Spearman rank correlation coefficient (rho) measuring monotonic relationship.',
  r2:
    'Coefficient of determination (R²). Represents the proportion of variance accounted for by the linear model.',
};
