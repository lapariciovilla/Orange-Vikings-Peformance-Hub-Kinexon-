import {
  Player,
  PlayerSessionRecord,
  SessionMeta,
  CoreMetrics,
} from '../types';
import { CORE_METRIC_KEYS, METRIC_LABELS, isGameSession } from './contextBaseline';
import {
  calcMean,
  calcMedian,
  calcSD,
  calcPercentiles,
  calcPercentileRank,
  calcZScore,
  calcLinearRegression,
  calcPearsonR,
} from './stats';
import { calculatePlayerMetricThreshold } from './loadThresholdEngine';

export type GameContextType =
  | 'SINGLE_GAME'
  | 'B2B_GAME_1'
  | 'B2B_GAME_2'
  | 'WEDNESDAY_GAME'
  | 'POST_B2B_GAME';

export const GAME_CONTEXT_LABELS: Record<GameContextType, { label: string; desc: string }> = {
  SINGLE_GAME: {
    label: 'Single Game',
    desc: 'Standard game with normal rest (>2 days recovery)',
  },
  B2B_GAME_1: {
    label: 'Back-to-Back Game 1',
    desc: 'First game of a consecutive 2-game weekend set',
  },
  B2B_GAME_2: {
    label: 'Back-to-Back Game 2',
    desc: 'Second game on consecutive days (<24h rest following Game 1)',
  },
  WEDNESDAY_GAME: {
    label: 'Wednesday Midweek Game',
    desc: 'Midweek fixture with condensed turnaround before weekend matches',
  },
  POST_B2B_GAME: {
    label: 'Game Following Back-to-Back',
    desc: 'First game following a heavy 2-game weekend series',
  },
};

/**
 * Automatically infers game context from the B.LEAGUE schedule calendar
 */
export function inferGameContextFromCalendar(
  gameDateStr: string,
  allSessions: SessionMeta[]
): GameContextType {
  const gameSessions = allSessions
    .filter((s) => isGameSession(s.session_type, s.session_name))
    .sort((a, b) => a.date.localeCompare(b.date));

  const targetDate = new Date(gameDateStr);
  const targetTime = targetDate.getTime();
  const dayOfWeek = targetDate.getDay(); // 0 = Sun, 3 = Wed, 6 = Sat

  // Check if day before is a game
  const dayBeforeHasGame = gameSessions.some((s) => {
    const diffDays = Math.round((targetTime - new Date(s.date).getTime()) / (1000 * 3600 * 24));
    return diffDays === 1;
  });

  if (dayBeforeHasGame) {
    return 'B2B_GAME_2';
  }

  // Check if day after is a game
  const dayAfterHasGame = gameSessions.some((s) => {
    const diffDays = Math.round((new Date(s.date).getTime() - targetTime) / (1000 * 3600 * 24));
    return diffDays === 1;
  });

  if (dayAfterHasGame) {
    return 'B2B_GAME_1';
  }

  // Check if Wednesday game
  if (dayOfWeek === 3) {
    return 'WEDNESDAY_GAME';
  }

  // Check if game within 2-3 days after a back-to-back set
  const recentB2B = gameSessions.some((s, idx) => {
    if (idx === 0) return false;
    const prevSession = gameSessions[idx - 1];
    const b2bDiff = Math.round((new Date(s.date).getTime() - new Date(prevSession.date).getTime()) / (1000 * 3600 * 24));
    if (b2bDiff === 1) {
      const daysSinceB2B = Math.round((targetTime - new Date(s.date).getTime()) / (1000 * 3600 * 24));
      return daysSinceB2B >= 2 && daysSinceB2B <= 4;
    }
    return false;
  });

  if (recentB2B) {
    return 'POST_B2B_GAME';
  }

  return 'SINGLE_GAME';
}

export interface MetricProjectionResult {
  metric: keyof CoreMetrics;
  metricLabel: string;
  projectedMinutes: number;
  projectedValue: number | null;
  confidenceLower: number | null;
  confidenceUpper: number | null;
  predictionMargin: number | null;
  status: 'GREEN' | 'YELLOW' | 'RED' | 'INSUFFICIENT_DATA';
  statusLabel: string;
  pctChangeFromTypical: number | null;
  percentileRank: number | null;
  zScore: number | null;
  
  // Statistical Model Info
  n: number;
  slope: number | null;
  intercept: number | null;
  r2: number | null;
  pearsonR: number | null;
  residualSE: number | null;
  isReliableModel: boolean;
  
  // Historical Percentiles & Thresholds
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  historicalMax: number | null;
  confidenceLabel: string;
  disclaimer: string | null;
}

export interface MinuteScenarioResult {
  minutes: number;
  overallStatus: 'GREEN' | 'YELLOW' | 'RED' | 'INSUFFICIENT_DATA';
  overallStatusLabel: string;
  metricProjections: Record<keyof CoreMetrics, MetricProjectionResult>;
  triggeredMetrics: {
    metric: keyof CoreMetrics;
    label: string;
    projectedVal: number;
    pctChange: number;
    status: 'YELLOW' | 'RED';
  }[];
  summarySentence: string;
}

export interface PlayerExposureProjectionModel {
  player: Player;
  targetGameDate: string;
  context: GameContextType;
  contextLabel: string;
  scenarios: MinuteScenarioResult[];
  activeScenario: MinuteScenarioResult;
  game1PriorContext?: {
    game1Date: string;
    game1Name: string;
    game1Minutes: number | null;
    game1TotalAccel: number | null;
    game1TotalDecel: number | null;
    game1TotalDist: number | null;
    game1RPE: number | null;
  } | null;
}

/**
 * Calculates a linear regression projection with prediction uncertainty interval for a single metric
 */
export function calculateMetricProjection(
  records: PlayerSessionRecord[],
  player: Player,
  metric: keyof CoreMetrics,
  projectedMinutes: number,
  context: GameContextType = 'SINGLE_GAME'
): MetricProjectionResult {
  const metricInfo = METRIC_LABELS[metric];

  // 1. Gather historical game records with valid game_minutes and metric values
  const playerGameRecs = records.filter(
    (r) =>
      r.player_id === player.id &&
      isGameSession(r.session_type, r.session_name) &&
      r.game_minutes !== null &&
      r.game_minutes !== undefined &&
      r.game_minutes > 0 &&
      r[metric] !== null &&
      r[metric] !== undefined &&
      !isNaN(r[metric]!)
  );

  const n = playerGameRecs.length;

  // Compute baseline thresholds from historical game records
  const threshold = calculatePlayerMetricThreshold(records, player, metric, 'GAME');
  const p50 = threshold.p50 ?? threshold.mean;
  const p75 = threshold.p75;
  const p90 = threshold.p90;
  const p95 = threshold.p95;
  const max = threshold.historicalMax;

  if (n < 3) {
    return {
      metric,
      metricLabel: metricInfo.shortLabel,
      projectedMinutes,
      projectedValue: null,
      confidenceLower: null,
      confidenceUpper: null,
      predictionMargin: null,
      status: 'INSUFFICIENT_DATA',
      statusLabel: 'Insufficient Data',
      pctChangeFromTypical: null,
      percentileRank: null,
      zScore: null,
      n,
      slope: null,
      intercept: null,
      r2: null,
      pearsonR: null,
      residualSE: null,
      isReliableModel: false,
      p50,
      p75,
      p90,
      p95,
      historicalMax: max,
      confidenceLabel: 'Insufficient Individual Data (n<3)',
      disclaimer: 'Insufficient individual historical game data to build a reliable projection model.',
    };
  }

  const xArr = playerGameRecs.map((r) => r.game_minutes!);
  const yArr = playerGameRecs.map((r) => r[metric]!);

  const meanX = calcMean(xArr)!;
  const meanY = calcMean(yArr)!;
  const reg = calcLinearRegression(xArr, yArr);
  const pR = calcPearsonR(xArr, yArr);

  const slope = reg.slope;
  const intercept = reg.intercept;
  const r2 = reg.r2;
  const pearsonR = pR.r;

  // Determine model validity
  const isReliableModel = slope !== null && slope > 0 && (r2 === null || r2 >= 0.25 || n >= 5);

  let projectedValue: number;

  if (isReliableModel && slope !== null && intercept !== null) {
    projectedValue = Number((slope * projectedMinutes + intercept).toFixed(1));
    if (projectedValue < 0) projectedValue = 0;
  } else {
    // Fallback if metric is load/min or slope is non-positive
    const meanPerMin = meanY / meanX;
    projectedValue = Number((meanPerMin * projectedMinutes).toFixed(1));
  }

  // Calculate prediction standard error (residual SE)
  let sumSqResiduals = 0;
  let sumSqX = 0;
  for (let i = 0; i < n; i++) {
    const yHat = (slope ?? 0) * xArr[i] + (intercept ?? 0);
    sumSqResiduals += Math.pow(yArr[i] - yHat, 2);
    sumSqX += Math.pow(xArr[i] - meanX, 2);
  }

  const df = n - 2;
  const residualSE = df > 0 ? Math.sqrt(sumSqResiduals / df) : 0;

  // Forecast standard error for individual prediction at x_proj
  const sePred =
    sumSqX > 0 && df > 0
      ? residualSE * Math.sqrt(1 + 1 / n + Math.pow(projectedMinutes - meanX, 2) / sumSqX)
      : residualSE;

  const tCrit = n >= 10 ? 1.96 : n >= 5 ? 2.13 : 2.35; // approximate t-distribution critical value
  const predictionMargin = Number((tCrit * sePred).toFixed(1));
  const confidenceLower = Math.max(0, Number((projectedValue - predictionMargin).toFixed(1)));
  const confidenceUpper = Number((projectedValue + predictionMargin).toFixed(1));

  // Determine % change from typical P50
  const pctChange = p50 && p50 > 0 ? Number((((projectedValue - p50) / p50) * 100).toFixed(1)) : 0;
  const zScore = calcZScore(projectedValue, threshold.mean, threshold.sd);
  const percentileRank = calcPercentileRank(yArr, projectedValue);

  // Traffic Light Classification
  let status: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
  let statusLabel = 'Within Typical Range';

  if (p95 !== null && projectedValue >= p95) {
    status = 'RED';
    statusLabel = 'Projected Very High Historical Exposure';
  } else if (p90 !== null && projectedValue >= p90) {
    status = 'RED';
    statusLabel = 'Projected High Historical Exposure';
  } else if (p75 !== null && projectedValue >= p75) {
    status = 'YELLOW';
    statusLabel = 'Projected Elevated Exposure';
  }

  let confidenceLabel = 'Individual Model Available';
  if (n < 4) confidenceLabel = 'Exploratory (n=3)';
  else if (n < 8) confidenceLabel = 'Provisional Model (n=4-7)';
  else confidenceLabel = 'High Confidence Model (n>=8)';

  return {
    metric,
    metricLabel: metricInfo.shortLabel,
    projectedMinutes,
    projectedValue,
    confidenceLower,
    confidenceUpper,
    predictionMargin,
    status,
    statusLabel,
    pctChangeFromTypical: pctChange,
    percentileRank,
    zScore,
    n,
    slope,
    intercept,
    r2,
    pearsonR,
    residualSE: Number(residualSE.toFixed(2)),
    isReliableModel,
    p50,
    p75,
    p90,
    p95,
    historicalMax: max,
    confidenceLabel,
    disclaimer: null,
  };
}

/**
 * Calculates minute scenario models across all 8 core metrics for a player
 */
export function buildMinuteScenarioModel(
  records: PlayerSessionRecord[],
  player: Player,
  projectedMinutesList: number[],
  context: GameContextType = 'SINGLE_GAME'
): MinuteScenarioResult[] {
  return projectedMinutesList.map((mins) => {
    const metricProjections = {} as Record<keyof CoreMetrics, MetricProjectionResult>;
    const triggeredMetrics: MinuteScenarioResult['triggeredMetrics'] = [];

    CORE_METRIC_KEYS.forEach((m) => {
      const proj = calculateMetricProjection(records, player, m, mins, context);
      metricProjections[m] = proj;

      if (proj.status === 'RED' || proj.status === 'YELLOW') {
        triggeredMetrics.push({
          metric: m,
          label: METRIC_LABELS[m].shortLabel,
          projectedVal: proj.projectedValue || 0,
          pctChange: proj.pctChangeFromTypical || 0,
          status: proj.status,
        });
      }
    });

    // Overall Status
    let overallStatus: 'GREEN' | 'YELLOW' | 'RED' | 'INSUFFICIENT_DATA' = 'GREEN';
    let overallStatusLabel = 'Within Typical Historical Exposure';

    const redTriggers = triggeredMetrics.filter((t) => t.status === 'RED');
    const yellowTriggers = triggeredMetrics.filter((t) => t.status === 'YELLOW');

    if (redTriggers.length > 0) {
      overallStatus = 'RED';
      overallStatusLabel = 'Projected High Historical Exposure — Coaching Review';
    } else if (yellowTriggers.length > 0) {
      overallStatus = 'YELLOW';
      overallStatusLabel = 'Projected Elevated Exposure';
    }

    // Build automated plain language summary sentence
    let summarySentence = '';
    if (overallStatus === 'RED') {
      const topRed = redTriggers.map((t) => `${t.label} (${t.pctChange >= 0 ? '+' : ''}${t.pctChange}% above typical)`).join(', ');
      summarySentence = `${mins} minutes projects ${player.displayName} into High Historical Exposure in ${topRed}. Consider coaching review regarding additional high-intensity exposure.`;
    } else if (overallStatus === 'YELLOW') {
      const topYellow = yellowTriggers.map((t) => `${t.label} (${t.pctChange >= 0 ? '+' : ''}${t.pctChange}%)`).join(', ');
      summarySentence = `${mins} minutes projects elevated training exposure in ${topYellow}. Review today's additional workload.`;
    } else {
      summarySentence = `${mins} minutes projects all 8 core metrics within ${player.displayName}'s typical individual historical exposure range.`;
    }

    return {
      minutes: mins,
      overallStatus,
      overallStatusLabel,
      metricProjections,
      triggeredMetrics,
      summarySentence,
    };
  });
}
