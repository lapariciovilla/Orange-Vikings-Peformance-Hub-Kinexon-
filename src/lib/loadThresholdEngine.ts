import {
  Player,
  PlayerSessionRecord,
  SessionMeta,
  CoreMetrics,
  Position,
  ReferenceType,
  DataConfidenceLabel,
  ExposureStatus,
  PlayerMetricThreshold,
} from '../types';
import { CORE_METRIC_KEYS, METRIC_LABELS, isGameSession } from './contextBaseline';
import { calcMean, calcMedian, calcSD, calcCVPct, calcPercentiles, calcPercentileRank, calcZScore, calcLinearRegression, calcPearsonR } from './stats';
import { POSITION_GROUPS, getPositionGroup } from './positionalUtils';

export function getDataConfidenceLabel(n: number): DataConfidenceLabel {
  if (n < 3) return 'Insufficient Data (n<3)';
  if (n <= 4) return 'Exploratory (n=3-4)';
  if (n <= 7) return 'Provisional (n=5-7)';
  if (n <= 9) return 'Individual Threshold (n>=8)';
  if (n <= 14) return 'Stable Distribution (n>=10)';
  return 'High Confidence (n>=15)';
}

/**
 * Calculates individualized load thresholds for a specific player, metric, and session context.
 * Implements a 5-level fallback hierarchy when individual sample size is small.
 */
export function calculatePlayerMetricThreshold(
  records: PlayerSessionRecord[],
  player: Player,
  metric: keyof CoreMetrics,
  targetContext: 'GAME' | 'PRACTICE' = 'GAME'
): PlayerMetricThreshold {
  // 1. LEVEL 1: Filter records for this exact player and target context
  const playerContextRecs = records.filter((r) => {
    if (r.player_id !== player.id) return false;
    const isG = isGameSession(r.session_type, r.session_name);
    return targetContext === 'GAME' ? isG : !isG;
  });

  const rawValues = playerContextRecs
    .map((r) => r[metric])
    .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

  let selectedValues = rawValues;
  let referenceType: ReferenceType = targetContext === 'GAME' ? 'Individual Game' : 'Individual Practice';
  let disclaimer: string | null = null;

  // 2. LEVEL 2: Fallback to Practice for Game context if Game n < 3
  if (rawValues.length < 3 && targetContext === 'GAME') {
    const playerPracticeRecs = records.filter((r) => {
      if (r.player_id !== player.id) return false;
      return !isGameSession(r.session_type, r.session_name);
    });
    const practiceValues = playerPracticeRecs
      .map((r) => r[metric])
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

    if (practiceValues.length >= 3) {
      selectedValues = practiceValues;
      referenceType = 'Individual Practice';
      disclaimer = '「異なるセッションコンテキストのため、直接比較には注意が必要」';
    }
  }

  // 3. LEVEL 3: Fallback to Position Game Reference if still n < 3
  if (selectedValues.length < 3) {
    const posGroup = getPositionGroup(player.position);
    const posGroupPositions = POSITION_GROUPS[posGroup] || [player.position];

    const posRecs = records.filter((r) => {
      if (!posGroupPositions.includes(r.position)) return false;
      const isG = isGameSession(r.session_type, r.session_name);
      return targetContext === 'GAME' ? isG : !isG;
    });

    const posValues = posRecs
      .map((r) => r[metric])
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

    if (posValues.length >= 3) {
      selectedValues = posValues;
      referenceType = 'Position Reference';
      disclaimer = `Position group (${posGroup}) reference benchmark`;
    }
  }

  // 4. LEVEL 4: Fallback to Team Reference if still n < 3
  if (selectedValues.length < 3) {
    const teamRecs = records.filter((r) => {
      const isG = isGameSession(r.session_type, r.session_name);
      return targetContext === 'GAME' ? isG : !isG;
    });

    const teamValues = teamRecs
      .map((r) => r[metric])
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

    if (teamValues.length >= 3) {
      selectedValues = teamValues;
      referenceType = 'Team Reference';
      disclaimer = 'Team overall baseline reference benchmark';
    }
  }

  // 5. LEVEL 5: Insufficient Data
  if (selectedValues.length < 3) {
    return {
      playerId: player.id,
      playerName: player.displayName,
      position: player.position,
      metric,
      context: targetContext,
      n: selectedValues.length,
      mean: null,
      median: null,
      sd: null,
      cvPct: null,
      min: null,
      max: null,
      iqr: null,
      p25: null,
      p50: null,
      p75: null,
      p90: null,
      p95: null,
      lowerTarget: null,
      typicalTarget: null,
      highThreshold: null,
      veryHighThreshold: null,
      historicalMax: null,
      referenceType: 'Insufficient Data',
      confidenceLabel: 'Insufficient Data (n<3)',
      disclaimer: 'Insufficient historical observations available to establish baseline.',
    };
  }

  const mean = calcMean(selectedValues);
  const median = calcMedian(selectedValues);
  const sd = calcSD(selectedValues);
  const cvPct = calcCVPct(selectedValues);
  const min = Math.min(...selectedValues);
  const max = Math.max(...selectedValues);
  const percentiles = calcPercentiles(selectedValues, [25, 50, 75, 90, 95]);

  const p25 = percentiles[25] ?? null;
  const p50 = percentiles[50] ?? median;
  const p75 = percentiles[75] ?? null;
  const p90 = percentiles[90] ?? null;
  const p95 = percentiles[95] ?? null;

  const iqr = (p75 !== null && p25 !== null) ? Number((p75 - p25).toFixed(2)) : null;

  return {
    playerId: player.id,
    playerName: player.displayName,
    position: player.position,
    metric,
    context: targetContext,
    n: selectedValues.length,
    mean,
    median,
    sd,
    cvPct,
    min,
    max,
    iqr,
    p25,
    p50,
    p75,
    p90,
    p95,
    lowerTarget: p25,
    typicalTarget: p50 ?? mean,
    highThreshold: p90 ?? (mean !== null ? Number((mean * 1.25).toFixed(1)) : null),
    veryHighThreshold: p95 ?? (mean !== null ? Number((mean * 1.35).toFixed(1)) : null),
    historicalMax: max,
    referenceType,
    confidenceLabel: getDataConfidenceLabel(selectedValues.length),
    disclaimer,
  };
}

/**
 * Calculates a complete set of 8 thresholds for a player in a given context.
 */
export function calculateAllPlayerThresholds(
  records: PlayerSessionRecord[],
  player: Player,
  context: 'GAME' | 'PRACTICE' = 'GAME'
): Record<keyof CoreMetrics, PlayerMetricThreshold> {
  const result = {} as Record<keyof CoreMetrics, PlayerMetricThreshold>;
  CORE_METRIC_KEYS.forEach((m) => {
    result[m] = calculatePlayerMetricThreshold(records, player, m, context);
  });
  return result;
}

export interface ExposureEvaluation {
  currentValue: number;
  pctOfHighThreshold: number | null;
  pctChangeFromMean: number | null;
  zScore: number | null;
  percentileRank: number | null;
  status: ExposureStatus;
  statusLabel: string;
  statusBadgeClasses: string;
  threshold: PlayerMetricThreshold;
}

/**
 * Evaluates an observed current metric value against a player's threshold.
 */
export function evaluateExposureAgainstThreshold(
  currentVal: number | null | undefined,
  threshold: PlayerMetricThreshold
): ExposureEvaluation | null {
  if (currentVal === null || currentVal === undefined || isNaN(currentVal)) {
    return null;
  }

  const { p25, p75, p90, p95, mean, sd, highThreshold } = threshold;

  const pctOfHigh = highThreshold && highThreshold > 0
    ? Number(((currentVal / highThreshold) * 100).toFixed(1))
    : null;

  const pctChangeFromMean = mean && mean > 0
    ? Number((((currentVal - mean) / mean) * 100).toFixed(1))
    : null;

  const zScore = calcZScore(currentVal, mean, sd);
  const percentileRank = threshold.n >= 3 ? calcPercentileRank(threshold.n > 0 ? [currentVal] : [], currentVal) : null;

  let status: ExposureStatus = 'TYPICAL';
  let statusLabel = 'Typical Exposure';
  let statusBadgeClasses = 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80';

  if (p95 !== null && currentVal > p95) {
    status = 'VERY_HIGH_HISTORICAL';
    statusLabel = 'Very High Historical Exposure';
    statusBadgeClasses = 'bg-rose-950/90 text-rose-300 border-rose-800 shadow-rose-950/50 shadow-md';
  } else if (p90 !== null && currentVal >= p90) {
    status = 'HIGH_EXPOSURE';
    statusLabel = 'High Exposure Zone';
    statusBadgeClasses = 'bg-purple-950/90 text-purple-300 border-purple-800 shadow-purple-950/50 shadow-md';
  } else if (p75 !== null && currentVal > p75) {
    status = 'ABOVE_TYPICAL';
    statusLabel = 'Above Typical';
    statusBadgeClasses = 'bg-amber-950/80 text-amber-300 border-amber-800/80';
  } else if (p25 !== null && currentVal < p25) {
    status = 'BELOW_TYPICAL';
    statusLabel = 'Below Typical';
    statusBadgeClasses = 'bg-blue-950/80 text-blue-300 border-blue-800/80';
  }

  return {
    currentValue: currentVal,
    pctOfHighThreshold: pctOfHigh,
    pctChangeFromMean,
    zScore,
    percentileRank,
    status,
    statusLabel,
    statusBadgeClasses,
    threshold,
  };
}

/**
 * Minute Management Analysis: Minutes vs KINEXON Load
 */
export interface MinuteLoadEstimate {
  metric: keyof CoreMetrics;
  r: number | null;
  r2: number | null;
  slope: number | null; // Load per minute played
  intercept: number | null;
  estimates: { minutes: number; expectedLoad: number | null }[];
  isLinearDataReliable: boolean;
  message: string;
}

export function calculateMinuteLoadEstimates(
  records: PlayerSessionRecord[],
  playerId: string,
  metric: keyof CoreMetrics
): MinuteLoadEstimate {
  const gameRecs = records.filter(
    (r) => r.player_id === playerId && isGameSession(r.session_type, r.session_name)
  );

  const validPairs = gameRecs
    .filter(
      (r) =>
        r.game_minutes !== null &&
        r.game_minutes !== undefined &&
        r.game_minutes > 0 &&
        r[metric] !== null &&
        r[metric] !== undefined &&
        !isNaN(r[metric]!)
    )
    .map((r) => ({ x: r.game_minutes!, y: r[metric]! }));

  if (validPairs.length < 3) {
    return {
      metric,
      r: null,
      r2: null,
      slope: null,
      intercept: null,
      estimates: [15, 20, 25, 30].map((m) => ({ minutes: m, expectedLoad: null })),
      isLinearDataReliable: false,
      message: 'Insufficient historical game observations to calculate minute-based load estimates.',
    };
  }

  const xArr = validPairs.map((p) => p.x);
  const yArr = validPairs.map((p) => p.y);
  const reg = calcLinearRegression(xArr, yArr);
  const pR = calcPearsonR(xArr, yArr);

  const rVal = pR.r;
  const isReliable = rVal !== null && Math.abs(rVal) >= 0.50 && validPairs.length >= 4;

  const targetMinutes = [15, 20, 25, 30];
  const estimates = targetMinutes.map((m) => {
    let expectedLoad: number | null = null;
    if (reg.slope !== null && reg.intercept !== null && isReliable) {
      expectedLoad = Number((reg.slope * m + reg.intercept).toFixed(1));
      if (expectedLoad < 0) expectedLoad = 0;
    }
    return { minutes: m, expectedLoad };
  });

  return {
    metric,
    r: rVal,
    r2: reg.r2,
    slope: reg.slope,
    intercept: reg.intercept,
    estimates,
    isLinearDataReliable: isReliable,
    message: isReliable
      ? `Historical association (r = ${rVal}, R² = ${reg.r2}) between game minutes and ${METRIC_LABELS[metric].shortLabel}.`
      : 'Low empirical correlation between minutes and load for this metric; rely on total cumulative exposure targets.',
  };
}

/**
 * Back-to-Back Game Monitor comparison logic
 */
export interface BackToBackComparison {
  game1: PlayerSessionRecord | null;
  game2: PlayerSessionRecord | null;
  date1: string;
  date2: string;
  opponent1?: string;
  opponent2?: string;
  metricComparisons: {
    metric: keyof CoreMetrics;
    game1Val: number | null;
    game2Val: number | null;
    diff: number | null;
    pctDiff: number | null;
    cumulative2GameVal: number | null;
  }[];
  minutes1: number | null;
  minutes2: number | null;
  rpe1: number | null;
  rpe2: number | null;
}

export interface SeasonB2BSet {
  id: string;
  index: number;
  title: string;
  date1: string;
  date2: string;
  session1Name: string;
  session2Name: string;
}

export function findAllSeasonBackToBackPairs(
  sessions: SessionMeta[]
): SeasonB2BSet[] {
  const gameSessions = sessions
    .filter((s) => isGameSession(s.session_type, s.session_name))
    .sort((a, b) => a.date.localeCompare(b.date));

  const result: SeasonB2BSet[] = [];
  let counter = 1;

  for (let i = 0; i < gameSessions.length - 1; i++) {
    const s1 = gameSessions[i];
    const s2 = gameSessions[i + 1];

    const d1 = new Date(s1.date).getTime();
    const d2 = new Date(s2.date).getTime();
    const dayDiff = (d2 - d1) / (1000 * 60 * 60 * 24);

    if (dayDiff <= 2 && dayDiff >= 1) {
      result.push({
        id: `b2b-${counter}`,
        index: counter,
        title: `Back-to-Back #${counter} (${s1.date} vs ${s2.date})`,
        date1: s1.date,
        date2: s2.date,
        session1Name: s1.session_name || `Game on ${s1.date}`,
        session2Name: s2.session_name || `Game on ${s2.date}`,
      });
      counter++;
    }
  }

  return result;
}

export function findBackToBackGamePairs(
  records: PlayerSessionRecord[],
  playerId: string
): BackToBackComparison[] {
  const gameRecs = records
    .filter((r) => r.player_id === playerId && isGameSession(r.session_type, r.session_name))
    .sort((a, b) => a.date.localeCompare(b.date));

  const b2bPairs: BackToBackComparison[] = [];

  for (let i = 0; i < gameRecs.length - 1; i++) {
    const g1 = gameRecs[i];
    const g2 = gameRecs[i + 1];

    const d1 = new Date(g1.date).getTime();
    const d2 = new Date(g2.date).getTime();
    const dayDiff = (d2 - d1) / (1000 * 60 * 60 * 24);

    if (dayDiff <= 2 && dayDiff >= 1) {
      const metricComps = CORE_METRIC_KEYS.map((m) => {
        const v1 = g1[m];
        const v2 = g2[m];
        const g1Val = v1 !== null && v1 !== undefined && !isNaN(v1) ? v1 : null;
        const g2Val = v2 !== null && v2 !== undefined && !isNaN(v2) ? v2 : null;

        let diff: number | null = null;
        let pctDiff: number | null = null;
        let cum: number | null = null;

        if (g1Val !== null && g2Val !== null) {
          diff = Number((g2Val - g1Val).toFixed(1));
          pctDiff = g1Val > 0 ? Number((((g2Val - g1Val) / g1Val) * 100).toFixed(1)) : null;
          cum = Number((g1Val + g2Val).toFixed(1));
        }

        return {
          metric: m,
          game1Val: g1Val,
          game2Val: g2Val,
          diff,
          pctDiff,
          cumulative2GameVal: cum,
        };
      });

      b2bPairs.push({
        game1: g1,
        game2: g2,
        date1: g1.date,
        date2: g2.date,
        opponent1: g1.session_name,
        opponent2: g2.session_name,
        metricComparisons: metricComps,
        minutes1: g1.game_minutes ?? null,
        minutes2: g2.game_minutes ?? null,
        rpe1: g1.RPE ?? null,
        rpe2: g2.RPE ?? null,
      });
    }
  }

  return b2bPairs;
}

/**
 * Rolling Cumulative Load Targets (3-day, 7-day, 14-day, 28-day)
 */
export interface RollingLoadSummary {
  metric: keyof CoreMetrics;
  days3: number;
  days7: number;
  days14: number;
  days28: number;
  typical7Day: number | null;
  pctOfTypical7Day: number | null;
}

export function calculateRollingLoadSummaries(
  records: PlayerSessionRecord[],
  playerId: string,
  referenceDateStr: string = '2026-08-11'
): RollingLoadSummary[] {
  const playerRecs = records
    .filter((r) => r.player_id === playerId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const refTime = new Date(referenceDateStr).getTime();

  return CORE_METRIC_KEYS.map((m) => {
    let days3 = 0;
    let days7 = 0;
    let days14 = 0;
    let days28 = 0;

    playerRecs.forEach((r) => {
      const val = r[m];
      if (val === null || val === undefined || isNaN(val)) return;

      const rTime = new Date(r.date).getTime();
      const diffDays = Math.floor((refTime - rTime) / (1000 * 60 * 60 * 24));

      if (diffDays >= 0) {
        if (diffDays <= 3) days3 += val;
        if (diffDays <= 7) days7 += val;
        if (diffDays <= 14) days14 += val;
        if (diffDays <= 28) days28 += val;
      }
    });

    const allVals = playerRecs.map((r) => r[m]).filter((v): v is number => v !== null && !isNaN(v));
    const meanVal = calcMean(allVals);
    const typical7Day = meanVal !== null ? Number((meanVal * 2.5).toFixed(1)) : null;
    const pctOfTypical7Day = typical7Day && typical7Day > 0
      ? Number(((days7 / typical7Day) * 100).toFixed(1))
      : null;

    return {
      metric: m,
      days3: Number(days3.toFixed(1)),
      days7: Number(days7.toFixed(1)),
      days14: Number(days14.toFixed(1)),
      days28: Number(days28.toFixed(1)),
      typical7Day,
      pctOfTypical7Day,
    };
  });
}

/**
 * Weekly Exposure Gap Analysis
 */
export interface WeeklyExposureGapResult {
  metric: keyof CoreMetrics;
  currentWeeklyLoad: number;
  typicalWeeklyLoad: number | null;
  gapPct: number | null;
  statusText: string;
  guidanceText: string;
}

export function calculateWeeklyExposureGaps(
  records: PlayerSessionRecord[],
  playerId: string,
  referenceDateStr: string = '2026-08-11'
): WeeklyExposureGapResult[] {
  const rolling = calculateRollingLoadSummaries(records, playerId, referenceDateStr);

  return rolling.map((r) => {
    const currentWeeklyLoad = r.days7;
    const typicalWeeklyLoad = r.typical7Day;

    let gapPct: number | null = null;
    let statusText = 'Within Typical Range';
    let guidanceText = 'Weekly exposure aligned with historical targets.';

    if (typicalWeeklyLoad && typicalWeeklyLoad > 0) {
      gapPct = Number((((currentWeeklyLoad - typicalWeeklyLoad) / typicalWeeklyLoad) * 100).toFixed(1));

      if (gapPct <= -15) {
        statusText = `「Typical Exposureを${Math.abs(gapPct)}%下回る」`;
        guidanceText = '「Potential Additional Loading — Review Context」';
      } else if (gapPct >= 25) {
        statusText = `「Typical Exposureを+${gapPct}%上回る」`;
        guidanceText = '「High Weekly Cumulative Exposure — Coaching Review」';
      }
    }

    return {
      metric: r.metric,
      currentWeeklyLoad,
      typicalWeeklyLoad,
      gapPct,
      statusText,
      guidanceText,
    };
  });
}
