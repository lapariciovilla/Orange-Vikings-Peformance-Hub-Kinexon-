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
import { analyzeSessionRecoveryContext, calculatePlayerDynamicLoadProfile } from './dynamicLoadEngine';

export type GameContextType =
  | 'SINGLE_GAME'
  | 'B2B_GAME_1'
  | 'B2B_GAME_2'
  | 'WEDNESDAY_GAME'
  | 'POST_B2B_GAME';

export const GAME_CONTEXT_LABELS: Record<GameContextType, { label: string; desc: string }> = {
  SINGLE_GAME: {
    label: 'Single Game',
    desc: 'Standard game turnaround with normal rest (>2 days recovery)',
  },
  B2B_GAME_1: {
    label: 'Back-to-Back Game 1',
    desc: 'First game of a consecutive 2-game weekend set (fresh legs, rotation pacing)',
  },
  B2B_GAME_2: {
    label: 'Back-to-Back Game 2',
    desc: 'Second game on consecutive days (<24h rest following Game 1)',
  },
  WEDNESDAY_GAME: {
    label: 'Wednesday Midweek Game',
    desc: 'Midweek fixture with condensed turnaround between weekend matches',
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

  // Check if game within 2-4 days after a back-to-back set
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
  unit: string;
  projectedMinutes: number;
  
  // Total Exposure Volume
  projectedValue: number | null;
  confidenceLower: number | null;
  confidenceUpper: number | null;
  predictionMargin: number | null;
  
  // Distinct Load per Minute (Intensity / Density Rate)
  densityProjectedValue: number | null;
  densityUnit: string;
  densityConfidenceLower: number | null;
  densityConfidenceUpper: number | null;

  // Status & Deviations (Strictly Non-Prescriptive)
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
  isDirectContextModel: boolean;
  modelTypeLabel: string;
  
  // Historical Percentiles & Thresholds
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  historicalMax: number | null;
  confidenceLabel: string;
  disclaimer: string | null;
  
  // Main Factors Influencing Estimate
  mainInfluencingFactors: string[];
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
  contextInfluences: string[];
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
  recoveryContext?: {
    daysSinceLastSession: number | null;
    daysSinceLastGame: number | null;
    priorSessionType: string | null;
    priorSessionRPE: number | null;
  };
}

/**
 * Calculates a context-aware regression projection with prediction uncertainty interval for a single metric.
 * Uses direct context data when n >= 3, or individual baseline + deterministic context modifier when n < 3.
 */
export function calculateMetricProjection(
  records: PlayerSessionRecord[],
  player: Player,
  metric: keyof CoreMetrics,
  projectedMinutes: number,
  context: GameContextType = 'SINGLE_GAME',
  targetGameDate: string = '2026-08-16',
  allSessions: SessionMeta[] = []
): MetricProjectionResult {
  const metricInfo = METRIC_LABELS[metric];
  const isDensityMetric = metric.includes('_per_min');

  // 1. Gather all historical game records for this player with valid minutes & metric value
  const allPlayerGameRecs = records.filter(
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

  const nTotal = allPlayerGameRecs.length;

  // Compute baseline thresholds from all historical game records
  const threshold = calculatePlayerMetricThreshold(records, player, metric, 'GAME');
  const p50 = threshold.p50 ?? threshold.mean;
  const p75 = threshold.p75;
  const p90 = threshold.p90;
  const p95 = threshold.p95;
  const max = threshold.historicalMax;

  // 2. Identify direct context records
  const contextSpecificRecs = allPlayerGameRecs.filter((r) => {
    const ctx = inferGameContextFromCalendar(r.date, allSessions.length > 0 ? allSessions : [{
      id: r.session_id,
      date: r.date,
      season: r.season,
      session_type: r.session_type,
      session_name: r.session_name,
      monitored_players_count: 10,
      created_at: r.created_at,
    }]);
    return ctx === context;
  });

  const nContext = contextSpecificRecs.length;
  const hasDirectContext = nContext >= 3;
  const activeDataset = hasDirectContext ? contextSpecificRecs : allPlayerGameRecs;
  const n = activeDataset.length;

  // 3. Insufficient individual data check (n < 3)
  if (n < 3) {
    return {
      metric,
      metricLabel: metricInfo.shortLabel,
      unit: metricInfo.unit,
      projectedMinutes,
      projectedValue: null,
      confidenceLower: null,
      confidenceUpper: null,
      predictionMargin: null,
      densityProjectedValue: null,
      densityUnit: `${metricInfo.unit}/min`,
      densityConfidenceLower: null,
      densityConfidenceUpper: null,
      status: 'INSUFFICIENT_DATA',
      statusLabel: 'Insufficient Individual Data (n<3)',
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
      isDirectContextModel: false,
      modelTypeLabel: 'Insufficient Observations',
      p50,
      p75,
      p90,
      p95,
      historicalMax: max,
      confidenceLabel: 'Insufficient Individual Data (n<3)',
      disclaimer: 'Insufficient individual historical game data to build a reliable projection model.',
      mainInfluencingFactors: ['Insufficient historical game records for this athlete (n < 3).'],
    };
  }

  // 4. Run Ordinary Least Squares (OLS) Linear Regression on minutes vs load
  const xArr = activeDataset.map((r) => r.game_minutes!);
  const yArr = activeDataset.map((r) => r[metric]!);

  const meanX = calcMean(xArr)!;
  const meanY = calcMean(yArr)!;
  const reg = calcLinearRegression(xArr, yArr);
  const pR = calcPearsonR(xArr, yArr);

  const slope = reg.slope;
  const intercept = reg.intercept;
  const r2 = reg.r2;
  const pearsonR = pR.r;

  // Determine model reliability
  const isReliableModel = slope !== null && (slope > 0 || isDensityMetric) && (r2 === null || r2 >= 0.20 || n >= 5);

  let rawProjectedValue: number;
  if (isReliableModel && slope !== null && intercept !== null) {
    rawProjectedValue = slope * projectedMinutes + intercept;
    if (rawProjectedValue < 0) rawProjectedValue = 0;
  } else {
    // Fallback: per-minute rate multiplication
    const meanRate = meanY / meanX;
    rawProjectedValue = meanRate * projectedMinutes;
  }

  // 5. Context-Dependent Adaptation Modifier (when using overall dataset for a specific context)
  let contextMultiplier = 1.0;
  const influencingFactors: string[] = [];

  if (hasDirectContext) {
    influencingFactors.push(`Direct ${GAME_CONTEXT_LABELS[context].label} Model (n = ${nContext} context games)`);
  } else {
    // Deterministic empirical modifiers based on sports science & calendar context:
    if (context === 'B2B_GAME_2') {
      // In B2B Game 2 (<24h rest), neuromuscular pacing reduces acceleration density (~-4.5%) while mechanical load rises (+2%)
      if (metric.includes('acceleration')) {
        contextMultiplier = 0.955;
        influencingFactors.push('B2B Game 2: Pacing adaptation applied (-4.5% acceleration density)');
      } else if (metric === 'mechanical_load') {
        contextMultiplier = 1.025;
        influencingFactors.push('B2B Game 2: Ground impact accumulation factor (+2.5% mechanical load)');
      } else {
        contextMultiplier = 0.97;
        influencingFactors.push('B2B Game 2 Turnaround (<24h recovery): -3.0% volume pacing modifier');
      }
    } else if (context === 'WEDNESDAY_GAME') {
      contextMultiplier = 0.975;
      influencingFactors.push('Wednesday Midweek: Condensed preparation modifier (-2.5% pacing adjustment)');
    } else if (context === 'POST_B2B_GAME') {
      contextMultiplier = 0.985;
      influencingFactors.push('Post-B2B Schedule: Residual weekend series turnaround (-1.5% adjustment)');
    } else if (context === 'B2B_GAME_1') {
      contextMultiplier = 1.01;
      influencingFactors.push('Back-to-Back Game 1: Normal opening weekend intensity (+1.0%)');
    } else {
      influencingFactors.push('Single Game Context: Standard recovery (>2 days rest, 1.00x baseline)');
    }
  }

  // 6. Connect Recent Acute / Chronic Workload and Recovery Context
  if (records.length > 0) {
    try {
      const dynProfile = calculatePlayerDynamicLoadProfile(records, player, targetGameDate);
      const metricWorkload = dynProfile.metrics[metric];
      if (metricWorkload && metricWorkload.acwrStatus === 'HIGH') {
        contextMultiplier *= 0.98;
        influencingFactors.push('Recent 7-day Acute Load: High accumulation relative to 28-day chronic baseline');
      }

      if (dynProfile.internalLoad.avgRecentRPE && dynProfile.internalLoad.avgRecentRPE >= 8.0) {
        influencingFactors.push(`Elevated Subjective RPE: Recent average ${dynProfile.internalLoad.avgRecentRPE}/10`);
      }
    } catch {
      // Fallback gracefully without breaking
    }
  }

  const finalProjectedValue = Number((rawProjectedValue * contextMultiplier).toFixed(1));

  // 7. Prediction Standard Error & 95% Prediction Interval (PI)
  let sumSqResiduals = 0;
  let sumSqX = 0;
  for (let i = 0; i < n; i++) {
    const yHat = (slope ?? 0) * xArr[i] + (intercept ?? 0);
    sumSqResiduals += Math.pow(yArr[i] - yHat, 2);
    sumSqX += Math.pow(xArr[i] - meanX, 2);
  }

  const df = n - 2;
  const residualSE = df > 0 ? Math.sqrt(sumSqResiduals / df) : 0;

  // Individual forecast standard error at projectedMinutes:
  const sePred =
    sumSqX > 0 && df > 0
      ? residualSE * Math.sqrt(1 + 1 / n + Math.pow(projectedMinutes - meanX, 2) / sumSqX)
      : residualSE;

  const tCrit = n >= 10 ? 1.96 : n >= 6 ? 2.15 : 2.45;
  const predictionMargin = Number((tCrit * sePred).toFixed(1));
  const confidenceLower = Math.max(0, Number((finalProjectedValue - predictionMargin).toFixed(1)));
  const confidenceUpper = Number((finalProjectedValue + predictionMargin).toFixed(1));

  // 8. Load per Minute (Intensity / Density Rate)
  let densityProjectedValue: number | null = null;
  let densityConfidenceLower: number | null = null;
  let densityConfidenceUpper: number | null = null;

  if (projectedMinutes > 0) {
    if (isDensityMetric) {
      densityProjectedValue = finalProjectedValue;
      densityConfidenceLower = confidenceLower;
      densityConfidenceUpper = confidenceUpper;
    } else {
      densityProjectedValue = Number((finalProjectedValue / projectedMinutes).toFixed(2));
      densityConfidenceLower = Number((confidenceLower / projectedMinutes).toFixed(2));
      densityConfidenceUpper = Number((confidenceUpper / projectedMinutes).toFixed(2));
    }
  }

  // 9. Compare against Historical Individual Percentiles (P50, P75, P90, P95)
  const pctChange = p50 && p50 > 0 ? Number((((finalProjectedValue - p50) / p50) * 100).toFixed(1)) : 0;
  const zScore = calcZScore(finalProjectedValue, threshold.mean, threshold.sd);
  const percentileRank = calcPercentileRank(yArr, finalProjectedValue);

  // Traffic Light Classification (strictly descriptive, no "risk" prescriptions)
  let status: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
  let statusLabel = 'Within Typical Historical Range';

  if (p95 !== null && finalProjectedValue >= p95) {
    status = 'RED';
    statusLabel = 'Projected Very High Historical Exposure (>P95)';
  } else if (p90 !== null && finalProjectedValue >= p90) {
    status = 'RED';
    statusLabel = 'Projected High Historical Exposure (P90–P95)';
  } else if (p75 !== null && finalProjectedValue >= p75) {
    status = 'YELLOW';
    statusLabel = 'Projected Elevated Historical Exposure (P75–P90)';
  } else if (threshold.p25 !== null && finalProjectedValue < threshold.p25) {
    status = 'GREEN';
    statusLabel = 'Under Typical Historical Exposure (<P25)';
  }

  const modelTypeLabel = hasDirectContext
    ? `Direct Context OLS (n = ${nContext})`
    : `Context-Adjusted Individual Model (n = ${n})`;

  let confidenceLabel = 'Individual Model Available';
  if (n < 4) confidenceLabel = 'Exploratory (n=3)';
  else if (n < 8) confidenceLabel = 'Provisional Model (n=4-7)';
  else confidenceLabel = 'High Confidence Model (n>=8)';

  return {
    metric,
    metricLabel: metricInfo.shortLabel,
    unit: metricInfo.unit,
    projectedMinutes,
    projectedValue: finalProjectedValue,
    confidenceLower,
    confidenceUpper,
    predictionMargin,
    densityProjectedValue,
    densityUnit: isDensityMetric ? metricInfo.unit : `${metricInfo.unit}/min`,
    densityConfidenceLower,
    densityConfidenceUpper,
    status,
    statusLabel,
    pctChangeFromTypical: pctChange,
    percentileRank,
    zScore,
    n,
    slope: slope !== null ? Number(slope.toFixed(3)) : null,
    intercept: intercept !== null ? Number(intercept.toFixed(1)) : null,
    r2: r2 !== null ? Number(r2.toFixed(3)) : null,
    pearsonR: pearsonR !== null ? Number(pearsonR.toFixed(3)) : null,
    residualSE: Number(residualSE.toFixed(2)),
    isReliableModel,
    isDirectContextModel: hasDirectContext,
    modelTypeLabel,
    p50,
    p75,
    p90,
    p95,
    historicalMax: max,
    confidenceLabel,
    disclaimer: null,
    mainInfluencingFactors: influencingFactors,
  };
}

/**
 * Calculates minute scenario models across all 8 core metrics for a player
 */
export function buildMinuteScenarioModel(
  records: PlayerSessionRecord[],
  player: Player,
  projectedMinutesList: number[],
  context: GameContextType = 'SINGLE_GAME',
  targetGameDate: string = '2026-08-16',
  allSessions: SessionMeta[] = []
): MinuteScenarioResult[] {
  return projectedMinutesList.map((mins) => {
    const metricProjections = {} as Record<keyof CoreMetrics, MetricProjectionResult>;
    const triggeredMetrics: MinuteScenarioResult['triggeredMetrics'] = [];

    CORE_METRIC_KEYS.forEach((m) => {
      const proj = calculateMetricProjection(
        records,
        player,
        m,
        mins,
        context,
        targetGameDate,
        allSessions
      );
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
      overallStatusLabel = 'Projected Elevated Historical Exposure';
    }

    // Build automated plain language summary sentence
    let summarySentence = '';
    if (overallStatus === 'RED') {
      const topRed = redTriggers.map((t) => `${t.label} (${t.pctChange >= 0 ? '+' : ''}${t.pctChange}% vs typical)`).join(', ');
      summarySentence = `${mins} minutes projects ${player.displayName} into High Historical Exposure in ${topRed}. Review upcoming rotation and training exposure.`;
    } else if (overallStatus === 'YELLOW') {
      const topYellow = yellowTriggers.map((t) => `${t.label} (${t.pctChange >= 0 ? '+' : ''}${t.pctChange}%)`).join(', ');
      summarySentence = `${mins} minutes projects elevated exposure in ${topYellow}. Aligns with moderate load increase.`;
    } else {
      summarySentence = `${mins} minutes projects all 8 core tracking metrics within ${player.displayName}'s typical individual historical exposure range.`;
    }

    // Collect context influences
    const contextInfluences = metricProjections.distance_m?.mainInfluencingFactors || [];

    return {
      minutes: mins,
      overallStatus,
      overallStatusLabel,
      metricProjections,
      triggeredMetrics,
      summarySentence,
      contextInfluences,
    };
  });
}
