import { CoreMetrics, PlayerSessionRecord } from '../types';
import { DataStore } from './dataStore';
import {
  calcStatsSummary,
  calcZScore,
  calcPercentileRank,
  calcPearsonR,
  calcLinearRegression,
} from './stats';
import { formatWholeNumber } from './positionalUtils';

export type ContextType = 'GAME' | 'PRACTICE' | 'OTHER';

export interface ContextBaselineStats {
  metric: keyof CoreMetrics | 'RPE';
  metricLabel: string;
  unit: string;
  contextType: ContextType;
  contextLabel: string; // e.g. "Previous Games" or "Previous Practices"
  sampleSize: number; // n
  mean: number | null;
  median: number | null;
  sd: number | null;
  cvPct: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  min: number | null;
  max: number | null;
  rawValues: number[];
  warning?: string;
}

export type TrafficLightStatus =
  | 'UNUSUALLY_HIGH'
  | 'ABOVE_TYPICAL'
  | 'NORMAL'
  | 'BELOW_TYPICAL'
  | 'UNUSUALLY_LOW'
  | 'INSUFFICIENT_DATA';

export interface ContextEvaluationResult {
  metric: keyof CoreMetrics | 'RPE';
  metricLabel: string;
  unit: string;
  currentValue: number | null;
  contextType: ContextType;
  contextLabel: string;
  baseline: ContextBaselineStats;
  pctChange: number | null;
  zScore: number | null;
  percentileRank: number | null;
  status: TrafficLightStatus;
  flagColor: 'RED' | 'YELLOW' | 'GREEN' | 'BLUE' | 'GRAY';
  reasonWhy: string;
  exposureGapPct: number | null; // Calculated Exposure Gap % if below typical
  potentialAdditionalLoading: boolean; // Loading signal
  loadingSignalText: string;
}

export interface SessionContextSummary {
  record: PlayerSessionRecord;
  contextType: ContextType;
  contextLabel: string;
  evaluations: ContextEvaluationResult[];
  overallStatus: TrafficLightStatus;
  overallFlagColor: 'RED' | 'YELLOW' | 'GREEN' | 'BLUE' | 'GRAY';
  underloadedMetricsCount: number;
  overloadedMetricsCount: number;
  maxExposureGapPct: number | null;
  summaryObservation: string;
  loadingSignal: {
    needed: boolean;
    exposureGapPct: number | null;
    message: string;
  };
}

// ==========================================
// SESSION TYPE IDENTIFICATION & STYLING HELPERS
// ==========================================

export function isGameSession(sessionType?: string, sessionName?: string): boolean {
  if (!sessionType && !sessionName) return false;
  const typeLower = (sessionType || '').toLowerCase();
  const nameLower = (sessionName || '').toLowerCase();
  return (
    typeLower === 'game' ||
    typeLower.includes('match') ||
    typeLower.includes('vs') ||
    nameLower.includes('vs') ||
    nameLower.includes('game')
  );
}

export function isPracticeSession(sessionType?: string, sessionName?: string): boolean {
  if (isGameSession(sessionType, sessionName)) return false;
  if (!sessionType) return true; // Default fallback to practice
  const lower = sessionType.toLowerCase();
  return (
    lower.includes('practice') ||
    lower.includes('preseason') ||
    lower.includes('conditioning') ||
    lower.includes('training') ||
    lower === 'practice'
  );
}

export function getSessionContextType(sessionType?: string, sessionName?: string): ContextType {
  if (isGameSession(sessionType, sessionName)) return 'GAME';
  if (isPracticeSession(sessionType, sessionName)) return 'PRACTICE';
  return 'OTHER';
}

/**
 * Visual Identification Palette:
 * PRACTICE = Orange (#f97316)
 * GAME = Purple (#a855f7)
 * OTHER = Zinc Neutral (#71717a)
 */
export function getSessionTypeColor(sessionType?: string, sessionName?: string): string {
  const ctx = getSessionContextType(sessionType, sessionName);
  if (ctx === 'GAME') return '#a855f7'; // Purple
  if (ctx === 'PRACTICE') return '#f97316'; // Orange
  return '#71717a'; // Zinc
}

export function getSessionTypeBadgeClasses(sessionType?: string, sessionName?: string): string {
  const ctx = getSessionContextType(sessionType, sessionName);
  if (ctx === 'GAME') {
    return 'bg-purple-950/80 border border-purple-800 text-purple-300';
  }
  if (ctx === 'PRACTICE') {
    return 'bg-orange-950/80 border border-orange-800 text-orange-400';
  }
  return 'bg-zinc-900 border border-zinc-800 text-zinc-400';
}

// METRIC META CONFIG
export const METRIC_DISPLAY_INFO: Record<keyof CoreMetrics | 'RPE', { label: string; shortLabel: string; unit: string; color: string }> = {
  distance_m: { label: 'Total Distance', shortLabel: 'Distance', unit: 'm', color: '#f59e0b' },
  accumulated_acceleration_load: { label: 'Accumulated Accel Load', shortLabel: 'Accel Load', unit: 'au', color: '#f97316' },
  accumulated_acceleration_load_per_min: { label: 'Accel Load / min', shortLabel: 'Accel/min', unit: 'au/min', color: '#ea580c' },
  anaerobic_activity_time: { label: 'Anaerobic Activity Time', shortLabel: 'Anaerobic', unit: 'min', color: '#eab308' },
  deceleration_load: { label: 'Deceleration Load', shortLabel: 'Decel Load', unit: 'au', color: '#f43f5e' },
  deceleration_load_per_min: { label: 'Decel Load / min', shortLabel: 'Decel/min', unit: 'au/min', color: '#e11d48' },
  jump_load: { label: 'Jump Load', shortLabel: 'Jump Load', unit: 'au', color: '#a855f7' },
  mechanical_load: { label: 'Mechanical Load', shortLabel: 'Mech Load', unit: 'au', color: '#38bdf8' },
  RPE: { label: 'Subjective RPE', shortLabel: 'RPE', unit: '1-10', color: '#c084fc' },
};

export const METRIC_LABELS = METRIC_DISPLAY_INFO;

export const CORE_METRIC_KEYS: (keyof CoreMetrics)[] = [
  'distance_m',
  'accumulated_acceleration_load',
  'accumulated_acceleration_load_per_min',
  'anaerobic_activity_time',
  'deceleration_load',
  'deceleration_load_per_min',
  'jump_load',
  'mechanical_load',
];


// ==========================================
// CONTEXT-AWARE BASELINE CALCULATION
// ==========================================

export function calculateContextBaseline(
  playerId: string,
  metric: keyof CoreMetrics | 'RPE',
  targetSessionType?: string,
  targetSessionName?: string
): ContextBaselineStats {
  const targetCtx = getSessionContextType(targetSessionType, targetSessionName);
  const contextLabel = targetCtx === 'GAME' ? 'Previous Games' : targetCtx === 'PRACTICE' ? 'Previous Practices' : 'All Historical Sessions';

  const meta = METRIC_DISPLAY_INFO[metric] || { label: String(metric), unit: '', color: '#38bdf8' };

  const allRecords = DataStore.getRecordsForPlayer(playerId);

  // Filter records strictly matching the target context
  const filteredRecords = allRecords.filter((r) => {
    const recordCtx = getSessionContextType(r.session_type, r.session_name);
    if (targetCtx === 'GAME') return recordCtx === 'GAME';
    if (targetCtx === 'PRACTICE') return recordCtx === 'PRACTICE';
    return true;
  });

  // Extract non-null numeric values
  const rawValues: number[] = [];
  filteredRecords.forEach((r) => {
    let val: number | null = null;
    if (metric === 'RPE') {
      val = r.RPE ?? null;
    } else {
      val = r[metric] ?? null;
    }
    if (val !== null && val !== undefined && !isNaN(val)) {
      rawValues.push(val);
    }
  });

  const sampleSize = rawValues.length;
  const summary = calcStatsSummary(rawValues);

  let warning: string | undefined = undefined;
  if (sampleSize < 3) {
    warning = `Limited ${targetCtx.toLowerCase()} history (${sampleSize} observation${
      sampleSize === 1 ? '' : 's'
    }) — baseline requires ≥3 same-context sessions.`;
  }

  return {
    metric,
    metricLabel: meta.label,
    unit: meta.unit,
    contextType: targetCtx,
    contextLabel,
    sampleSize,
    mean: summary.mean,
    median: summary.median,
    sd: summary.sd,
    cvPct: summary.cvPct,
    p25: summary.p25,
    p50: summary.p50,
    p75: summary.p75,
    p90: summary.p90,
    p95: summary.p95,
    min: summary.min,
    max: summary.max,
    rawValues,
    warning,
  };
}

// ==========================================
// CONTEXT-AWARE EVALUATION ENGINE
// ==========================================

export function evaluateContextMetric(
  playerId: string,
  currentValue: number | null,
  metric: keyof CoreMetrics | 'RPE',
  targetSessionType?: string,
  targetSessionName?: string
): ContextEvaluationResult {
  const meta = METRIC_DISPLAY_INFO[metric] || { label: String(metric), unit: '', color: '#38bdf8' };
  const baseline = calculateContextBaseline(playerId, metric, targetSessionType, targetSessionName);
  const targetCtx = baseline.contextType;
  const contextLabel = baseline.contextLabel;

  if (currentValue === null || currentValue === undefined || isNaN(currentValue)) {
    return {
      metric,
      metricLabel: meta.label,
      unit: meta.unit,
      currentValue: null,
      contextType: targetCtx,
      contextLabel,
      baseline,
      pctChange: null,
      zScore: null,
      percentileRank: null,
      status: 'INSUFFICIENT_DATA',
      flagColor: 'GRAY',
      reasonWhy: `No observation logged for ${meta.label} in this session.`,
      exposureGapPct: null,
      potentialAdditionalLoading: false,
      loadingSignalText: `No value recorded.`,
    };
  }

  if (baseline.sampleSize < 3 || baseline.mean === null) {
    return {
      metric,
      metricLabel: meta.label,
      unit: meta.unit,
      currentValue,
      contextType: targetCtx,
      contextLabel,
      baseline,
      pctChange: null,
      zScore: null,
      percentileRank: null,
      status: 'INSUFFICIENT_DATA',
      flagColor: 'GRAY',
      reasonWhy: `Baseline building (${baseline.sampleSize}/3 historical ${targetCtx.toLowerCase()} sessions logged).`,
      exposureGapPct: null,
      potentialAdditionalLoading: false,
      loadingSignalText: `Insufficient ${targetCtx.toLowerCase()} history to evaluate loading gap.`,
    };
  }

  const mean = baseline.mean;
  const sd = baseline.sd || 0;
  const pctChange = (mean !== null && mean > 0) ? Number((((currentValue - mean) / mean) * 100).toFixed(1)) : 0;
  const zScore = calcZScore(currentValue, mean, sd);
  const percentileRank = calcPercentileRank(baseline.rawValues, currentValue);

  let status: TrafficLightStatus = 'NORMAL';
  let flagColor: 'RED' | 'YELLOW' | 'GREEN' | 'BLUE' | 'GRAY' = 'GREEN';

  const validZ = zScore !== null && zScore !== undefined && !isNaN(zScore);

  if ((validZ && zScore >= 1.5) || pctChange >= 25) {
    status = 'UNUSUALLY_HIGH';
    flagColor = 'RED';
  } else if ((validZ && zScore >= 0.75) || pctChange >= 12) {
    status = 'ABOVE_TYPICAL';
    flagColor = 'YELLOW';
  } else if ((validZ && zScore <= -1.5) || pctChange <= -25) {
    status = 'UNUSUALLY_LOW';
    flagColor = 'BLUE';
  } else if ((validZ && zScore <= -0.75) || pctChange <= -12) {
    status = 'BELOW_TYPICAL';
    flagColor = 'BLUE';
  } else {
    status = 'NORMAL';
    flagColor = 'GREEN';
  }

  // Explicit "WHY?" Explanation
  const zStr = validZ ? (zScore >= 0 ? `+${zScore.toFixed(2)} SD` : `${zScore.toFixed(2)} SD`) : 'Baseline SD=0';
  const pctStr = pctChange !== null && !isNaN(pctChange) ? (pctChange >= 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`) : '0%';
  const pRankStr = percentileRank !== null && !isNaN(percentileRank) ? `${percentileRank}th` : 'N/A';
  const reasonWhy = `${meta.label} (${formatWholeNumber(currentValue)} ${meta.unit}) is ${zStr} (${pctStr}) relative to this player's historical ${targetCtx.toLowerCase()} baseline mean (${formatWholeNumber(mean)} ${meta.unit}) and sits at the ${pRankStr} percentile of previous ${targetCtx.toLowerCase()}s.`;

  // Exposure Gap % Calculation for underloaded metrics
  let exposureGapPct: number | null = null;
  let potentialAdditionalLoading = false;
  let loadingSignalText = 'Workload within normal historical baseline expectations.';

  if (status === 'BELOW_TYPICAL' || status === 'UNUSUALLY_LOW') {
    exposureGapPct = Number((((mean - currentValue) / mean) * 100).toFixed(1));
    potentialAdditionalLoading = true;
    loadingSignalText = `This player received lower-than-usual external exposure in today's ${targetCtx.toLowerCase()} (${exposureGapPct}% below baseline mean of ${formatWholeNumber(
      mean
    )} ${meta.unit}). POTENTIAL ADDITIONAL LOADING REVIEW: YES — S&C Coach Luis should review upcoming game schedule, playing minutes, and individual fatigue context before deciding whether to compensate.`;
  } else if (status === 'UNUSUALLY_HIGH' || status === 'ABOVE_TYPICAL') {
    loadingSignalText = `Elevated workload exposure (+${pctChange}% vs baseline mean). Consider monitoring fatigue and modifying upcoming high-density drills.`;
  }

  return {
    metric,
    metricLabel: meta.label,
    unit: meta.unit,
    currentValue,
    contextType: targetCtx,
    contextLabel,
    baseline,
    pctChange,
    zScore,
    percentileRank,
    status,
    flagColor,
    reasonWhy,
    exposureGapPct,
    potentialAdditionalLoading,
    loadingSignalText,
  };
}

// ==========================================
// FULL SESSION CONTEXT EVALUATION
// ==========================================

export function evaluateFullSessionContext(record: PlayerSessionRecord): SessionContextSummary {
  const targetCtx = getSessionContextType(record.session_type, record.session_name);
  const contextLabel = targetCtx === 'GAME' ? 'Previous Games' : targetCtx === 'PRACTICE' ? 'Previous Practices' : 'Historical Sessions';

  const coreMetricKeys: (keyof CoreMetrics)[] = [
    'distance_m',
    'accumulated_acceleration_load',
    'accumulated_acceleration_load_per_min',
    'anaerobic_activity_time',
    'deceleration_load',
    'deceleration_load_per_min',
    'jump_load',
    'mechanical_load',
  ];

  const evaluations: ContextEvaluationResult[] = coreMetricKeys.map((mKey) =>
    evaluateContextMetric(record.player_id, record[mKey] ?? null, mKey, record.session_type, record.session_name)
  );

  // Evaluate RPE if present
  if (record.RPE !== null && record.RPE !== undefined) {
    evaluations.push(evaluateContextMetric(record.player_id, record.RPE, 'RPE', record.session_type, record.session_name));
  }

  const overloaded = evaluations.filter((e) => e.status === 'UNUSUALLY_HIGH' || e.status === 'ABOVE_TYPICAL');
  const underloaded = evaluations.filter((e) => e.status === 'UNUSUALLY_LOW' || e.status === 'BELOW_TYPICAL');

  let overallStatus: TrafficLightStatus = 'NORMAL';
  let overallFlagColor: 'RED' | 'YELLOW' | 'GREEN' | 'BLUE' | 'GRAY' = 'GREEN';

  if (evaluations.some((e) => e.status === 'UNUSUALLY_HIGH')) {
    overallStatus = 'UNUSUALLY_HIGH';
    overallFlagColor = 'RED';
  } else if (evaluations.some((e) => e.status === 'ABOVE_TYPICAL')) {
    overallStatus = 'ABOVE_TYPICAL';
    overallFlagColor = 'YELLOW';
  } else if (underloaded.length >= 3 || evaluations.some((e) => e.status === 'UNUSUALLY_LOW')) {
    overallStatus = 'BELOW_TYPICAL';
    overallFlagColor = 'BLUE';
  }

  const gapPcts = underloaded
    .map((e) => e.exposureGapPct)
    .filter((v): v is number => v !== null && v > 0);
  const maxExposureGapPct = gapPcts.length > 0 ? Math.max(...gapPcts) : null;

  let summaryObservation = `Session performance evaluated relative to ${record.player_name}'s historical ${targetCtx.toLowerCase()} baseline.`;
  if (overloaded.length > 0) {
    const topOver = overloaded[0];
    summaryObservation = `${record.player_name} logged elevated exposure in ${topOver.metricLabel} (+${topOver.pctChange}% vs ${targetCtx.toLowerCase()} baseline mean).`;
  } else if (underloaded.length > 0 && maxExposureGapPct !== null) {
    summaryObservation = `${record.player_name} received lower external exposure in today's ${targetCtx.toLowerCase()} (${maxExposureGapPct}% maximum exposure gap below ${targetCtx.toLowerCase()} baseline).`;
  } else {
    summaryObservation = `${record.player_name} performed strictly within expected individual ${targetCtx.toLowerCase()} baseline ranges across all monitored metrics.`;
  }

  const loadingNeeded = underloaded.length >= 2 || (maxExposureGapPct !== null && maxExposureGapPct >= 15);
  let loadingMessage = 'Current exposure aligns with typical baseline targets. No compensation indicated.';
  if (loadingNeeded) {
    loadingMessage = `This player received lower-than-usual exposure in today's ${targetCtx.toLowerCase()} (${maxExposureGapPct}% exposure gap). POTENTIAL ADDITIONAL LOADING REVIEW: YES — S&C Coach Luis should review upcoming game schedule, playing minutes, and individual fatigue context before deciding whether to compensate.`;
  }

  return {
    record,
    contextType: targetCtx,
    contextLabel,
    evaluations,
    overallStatus,
    overallFlagColor,
    underloadedMetricsCount: underloaded.length,
    overloadedMetricsCount: overloaded.length,
    maxExposureGapPct,
    summaryObservation,
    loadingSignal: {
      needed: loadingNeeded,
      exposureGapPct: maxExposureGapPct,
      message: loadingMessage,
    },
  };
}
