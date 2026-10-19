import {
  Player,
  PlayerSessionRecord,
  SessionMeta,
  CoreMetrics,
  RPEEntry,
} from '../types';
import { CORE_METRIC_KEYS, METRIC_LABELS, isGameSession, isPracticeSession } from './contextBaseline';
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

// ==========================================
// 1. DATA TYPES & INTERFACES
// ==========================================

export type RollingWindowDays = 3 | 7 | 14 | 28;

export interface WindowAccumulation {
  windowDays: RollingWindowDays;
  practiceSum: number;
  gameSum: number;
  combinedSum: number;
  dailyAverage: number;
  practiceSessionCount: number;
  gameSessionCount: number;
  totalSessionCount: number;
  expectedDaysCount: number;
  monitoringCoveragePct: number;
  hasMissingSessions: boolean;
}

export interface MetricWorkloadSummary {
  metric: keyof CoreMetrics;
  metricLabel: string;
  unit: string;
  days3: WindowAccumulation;
  days7: WindowAccumulation;   // Acute Load
  days14: WindowAccumulation;
  days28: WindowAccumulation;  // Chronic Load
  
  // Rolling Average ACWR (7-day daily mean / 28-day daily mean)
  rollingAverageACWR: number | null;
  
  // EWMA (Exponentially Weighted Moving Average)
  ewmaAcute: number | null;    // N = 7 days, lambda = 0.25
  ewmaChronic: number | null;  // N = 28 days, lambda = 0.0689655
  ewmaACWR: number | null;     // ewmaAcute / ewmaChronic
  
  // Individual Variations & Descriptive Norms
  zScoreToChronic: number | null;
  pctDevFromChronic: number | null;
  
  // Descriptive Status Label (Never "Injury Risk")
  acwrStatus: 'UNDER_TYPICAL' | 'TYPICAL' | 'ELEVATED' | 'HIGH';
  acwrStatusLabel: string;
}

export interface InternalLoadSummary {
  sRPE3d: number;
  sRPE7d: number;
  sRPE14d: number;
  sRPE28d: number;
  sRPE_ACWR: number | null;
  avgRecentRPE: number | null;
  reportedSoreness: number | null; // e.g., 1-5 or null
  validSRPECount: number;
}

export interface MonitoringCompleteness {
  monitoredSessionsCount: number;
  windowDays: number;
  coveragePct: number;
  incompleteNotice: string | null;
}

export interface PlayerDynamicLoadProfile {
  player: Player;
  referenceDate: string;
  metrics: Record<keyof CoreMetrics, MetricWorkloadSummary>;
  internalLoad: InternalLoadSummary;
  completeness: MonitoringCompleteness;
  scientificDisclaimer: string;
}

export interface SessionRecoveryContext {
  targetDate: string;
  daysSinceLastSession: number | null;
  daysSinceLastGame: number | null;
  daysSinceLastPractice: number | null;
  priorSessionType: 'Game' | 'Practice' | null;
  priorSessionName?: string;
  priorSessionDurationMin: number | null;
  priorSessionRPE: number | null;
  priorSessionSRPE: number | null;
  priorSessionMetrics: Partial<CoreMetrics> | null;
  upcomingSchedule: {
    nextGameDate: string | null;
    daysToNextGame: number | null;
    isBackToBackWeekend: boolean;
    contextType: 'SINGLE_GAME' | 'B2B_GAME_1' | 'B2B_GAME_2' | 'WEDNESDAY_GAME' | 'POST_B2B_GAME';
    contextDesc: string;
  };
}

// ==========================================
// 2. EWMA (EXPONENTIALLY WEIGHTED MOVING AVERAGE)
// ==========================================

/**
 * Calculates EWMA for a chronological day-by-day load series.
 * Formula: EWMA_t = lambda * Load_t + (1 - lambda) * EWMA_{t-1}
 * where lambda = 2 / (N + 1)
 *
 * For Acute (N = 7): lambda = 2 / (7 + 1) = 0.25
 * For Chronic (N = 28): lambda = 2 / (28 + 1) = 0.0689655
 *
 * On rest days with no session, Load_t = 0 is applied to model natural physiological decay.
 */
export function calculateDailyEWMA(
  dailyLoads: { date: string; load: number }[],
  timeWindowDays: number
): { date: string; ewma: number }[] {
  if (dailyLoads.length === 0) return [];

  const lambda = 2 / (timeWindowDays + 1);
  const result: { date: string; ewma: number }[] = [];

  // Seed with the first day's load
  let prevEWMA = dailyLoads[0].load;
  result.push({ date: dailyLoads[0].date, ewma: Number(prevEWMA.toFixed(1)) });

  for (let i = 1; i < dailyLoads.length; i++) {
    const currentLoad = dailyLoads[i].load;
    const currentEWMA = lambda * currentLoad + (1 - lambda) * prevEWMA;
    result.push({ date: dailyLoads[i].date, ewma: Number(currentEWMA.toFixed(1)) });
    prevEWMA = currentEWMA;
  }

  return result;
}

// ==========================================
// 3. ACUTE & CHRONIC ROLLING WORKLOAD ENGINE
// ==========================================

export function calculatePlayerDynamicLoadProfile(
  records: PlayerSessionRecord[],
  player: Player,
  referenceDateStr: string = '2026-08-11',
  rpeEntries: RPEEntry[] = []
): PlayerDynamicLoadProfile {
  const playerRecs = records
    .filter((r) => r.player_id === player.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  const refTime = new Date(referenceDateStr).getTime();
  const dayMs = 1000 * 60 * 60 * 24;

  // Build calendar day series for 28 days preceding reference date for EWMA & completeness
  const calendarDays28: string[] = [];
  for (let d = 27; d >= 0; d--) {
    const dt = new Date(refTime - d * dayMs);
    calendarDays28.push(dt.toISOString().slice(0, 10));
  }

  // Count monitored sessions in past 28 days
  const monitoredRecsPast28 = playerRecs.filter((r) => {
    const diff = Math.floor((refTime - new Date(r.date).getTime()) / dayMs);
    return diff >= 0 && diff < 28;
  });

  const uniqueMonitoredDates = new Set(monitoredRecsPast28.map((r) => r.date));
  const coveragePct = Number(((uniqueMonitoredDates.size / 28) * 100).toFixed(1));
  const hasIncomplete = uniqueMonitoredDates.size < 4; // e.g. very sparse

  const completeness: MonitoringCompleteness = {
    monitoredSessionsCount: monitoredRecsPast28.length,
    windowDays: 28,
    coveragePct,
    incompleteNotice:
      uniqueMonitoredDates.size < 4
        ? 'Limited monitoring sessions in 28-day window (n < 4). Chronic rolling averages should be interpreted as provisional.'
        : null,
  };

  // Helper to accumulate rolling window for any metric
  function getWindowAccumulation(metric: keyof CoreMetrics, windowDays: RollingWindowDays): WindowAccumulation {
    let practiceSum = 0;
    let gameSum = 0;
    let practiceCount = 0;
    let gameCount = 0;

    playerRecs.forEach((r) => {
      const rTime = new Date(r.date).getTime();
      const diffDays = Math.floor((refTime - rTime) / dayMs);

      if (diffDays >= 0 && diffDays < windowDays) {
        const val = r[metric];
        const isGame = isGameSession(r.session_type, r.session_name);

        if (val !== null && val !== undefined && !isNaN(val)) {
          if (isGame) {
            gameSum += val;
            gameCount++;
          } else {
            practiceSum += val;
            practiceCount++;
          }
        }
      }
    });

    const combinedSum = Number((practiceSum + gameSum).toFixed(1));
    const totalSessions = practiceCount + gameCount;
    const dailyAverage = Number((combinedSum / windowDays).toFixed(1));

    return {
      windowDays,
      practiceSum: Number(practiceSum.toFixed(1)),
      gameSum: Number(gameSum.toFixed(1)),
      combinedSum,
      dailyAverage,
      practiceSessionCount: practiceCount,
      gameSessionCount: gameCount,
      totalSessionCount: totalSessions,
      expectedDaysCount: windowDays,
      monitoringCoveragePct: Number(((totalSessions / windowDays) * 100).toFixed(1)),
      hasMissingSessions: totalSessions === 0,
    };
  }

  // Calculate Internal Load (sRPE-TL = RPE * duration_min)
  let sRPE3d = 0;
  let sRPE7d = 0;
  let sRPE14d = 0;
  let sRPE28d = 0;
  let validSRPECount = 0;
  const recentRPEs: number[] = [];

  playerRecs.forEach((r) => {
    const rTime = new Date(r.date).getTime();
    const diffDays = Math.floor((refTime - rTime) / dayMs);

    // Compute sRPE if valid duration exists
    const rpe = r.RPE ?? null;
    const dur = r.duration_min ?? (r.game_minutes ?? null);

    let sessionSRPE: number | null = null;
    if (rpe !== null && dur !== null && dur > 0) {
      sessionSRPE = rpe * dur;
      validSRPECount++;
    }

    if (diffDays >= 0 && diffDays < 28) {
      if (rpe !== null) recentRPEs.push(rpe);
      if (sessionSRPE !== null) {
        if (diffDays < 3) sRPE3d += sessionSRPE;
        if (diffDays < 7) sRPE7d += sessionSRPE;
        if (diffDays < 14) sRPE14d += sessionSRPE;
        if (diffDays < 28) sRPE28d += sessionSRPE;
      }
    }
  });

  const avgRecentRPE = recentRPEs.length > 0 ? Number((calcMean(recentRPEs) || 0).toFixed(1)) : null;
  const sRPE_ACWR =
    sRPE28d > 0
      ? Number(((sRPE7d / (sRPE28d / 4))).toFixed(2))
      : null;

  const internalLoad: InternalLoadSummary = {
    sRPE3d: Math.round(sRPE3d),
    sRPE7d: Math.round(sRPE7d),
    sRPE14d: Math.round(sRPE14d),
    sRPE28d: Math.round(sRPE28d),
    sRPE_ACWR,
    avgRecentRPE,
    reportedSoreness: null, // default null unless logged in notes
    validSRPECount,
  };

  // Build metrics map across all 8 Core Metrics
  const metrics = {} as Record<keyof CoreMetrics, MetricWorkloadSummary>;

  CORE_METRIC_KEYS.forEach((m) => {
    const days3 = getWindowAccumulation(m, 3);
    const days7 = getWindowAccumulation(m, 7);
    const days14 = getWindowAccumulation(m, 14);
    const days28 = getWindowAccumulation(m, 28);

    // Rolling Average ACWR: Acute 7-day daily mean / Chronic 28-day daily mean
    const rollingAverageACWR =
      days28.dailyAverage > 0
        ? Number((days7.dailyAverage / days28.dailyAverage).toFixed(2))
        : null;

    // Build day-by-day load map for past 28 calendar days for EWMA
    const dailyMap: Record<string, number> = {};
    calendarDays28.forEach((dateStr) => {
      dailyMap[dateStr] = 0;
    });

    playerRecs.forEach((r) => {
      if (dailyMap[r.date] !== undefined) {
        const val = r[m];
        if (val !== null && val !== undefined && !isNaN(val)) {
          dailyMap[r.date] += val;
        }
      }
    });

    const dailyLoadsArray = calendarDays28.map((d) => ({
      date: d,
      load: dailyMap[d],
    }));

    const acuteEWMAHistory = calculateDailyEWMA(dailyLoadsArray, 7);
    const chronicEWMAHistory = calculateDailyEWMA(dailyLoadsArray, 28);

    const ewmaAcute = acuteEWMAHistory.length > 0 ? acuteEWMAHistory[acuteEWMAHistory.length - 1].ewma : null;
    const ewmaChronic = chronicEWMAHistory.length > 0 ? chronicEWMAHistory[chronicEWMAHistory.length - 1].ewma : null;

    const ewmaACWR =
      ewmaChronic && ewmaChronic > 0 && ewmaAcute !== null
        ? Number((ewmaAcute / ewmaChronic).toFixed(2))
        : null;

    // Individual Chronic Deviation (Z-Score relative to 28-day mean)
    const chronicDailyVals = calendarDays28.map((d) => dailyMap[d]).filter((v) => v > 0);
    const chronicMean = calcMean(chronicDailyVals);
    const chronicSD = calcSD(chronicDailyVals);
    const zScoreToChronic =
      days7.dailyAverage && chronicMean && chronicSD && chronicSD > 0
        ? calcZScore(days7.dailyAverage, chronicMean, chronicSD)
        : null;

    const pctDevFromChronic =
      days28.dailyAverage > 0
        ? Number((((days7.dailyAverage - days28.dailyAverage) / days28.dailyAverage) * 100).toFixed(1))
        : null;

    // Descriptive status (strictly non-prescriptive, no "risk" terminology)
    let acwrStatus: MetricWorkloadSummary['acwrStatus'] = 'TYPICAL';
    let acwrStatusLabel = 'Within Typical Chronic Range';

    const testRatio = ewmaACWR ?? rollingAverageACWR;
    if (testRatio !== null) {
      if (testRatio < 0.8) {
        acwrStatus = 'UNDER_TYPICAL';
        acwrStatusLabel = 'Below Typical Chronic Exposure (<0.80)';
      } else if (testRatio <= 1.25) {
        acwrStatus = 'TYPICAL';
        acwrStatusLabel = 'Balanced Workload Accumulation (0.80–1.25)';
      } else if (testRatio <= 1.5) {
        acwrStatus = 'ELEVATED';
        acwrStatusLabel = 'Elevated Acute Workload Accumulation (1.25–1.50)';
      } else {
        acwrStatus = 'HIGH';
        acwrStatusLabel = 'High Acute Acceleration (>1.50) — Review Context';
      }
    }

    metrics[m] = {
      metric: m,
      metricLabel: METRIC_LABELS[m].shortLabel,
      unit: METRIC_LABELS[m].unit,
      days3,
      days7,
      days14,
      days28,
      rollingAverageACWR,
      ewmaAcute,
      ewmaChronic,
      ewmaACWR,
      zScoreToChronic,
      pctDevFromChronic,
      acwrStatus,
      acwrStatusLabel,
    };
  });

  return {
    player,
    referenceDate: referenceDateStr,
    metrics,
    internalLoad,
    completeness,
    scientificDisclaimer:
      'Descriptive workload monitoring measure only. ACWR, Z-scores, and individual load thresholds are NOT validated predictors of injury risk. Intended strictly for training load tracking and preparation.',
  };
}

// ==========================================
// 4. RECOVERY CONTEXT & SCHEDULE ANALYZER
// ==========================================

export function analyzeSessionRecoveryContext(
  targetDateStr: string,
  records: PlayerSessionRecord[],
  playerId: string,
  allSessions: SessionMeta[]
): SessionRecoveryContext {
  const targetTime = new Date(targetDateStr).getTime();
  const dayMs = 1000 * 60 * 60 * 24;

  const playerPriorRecs = records
    .filter((r) => r.player_id === playerId && new Date(r.date).getTime() < targetTime)
    .sort((a, b) => b.date.localeCompare(a.date)); // latest first

  const latestPriorSession = playerPriorRecs[0] || null;
  const latestPriorGame = playerPriorRecs.find((r) => isGameSession(r.session_type, r.session_name)) || null;
  const latestPriorPractice = playerPriorRecs.find((r) => isPracticeSession(r.session_type, r.session_name)) || null;

  const daysSinceLastSession = latestPriorSession
    ? Math.max(0, Math.round((targetTime - new Date(latestPriorSession.date).getTime()) / dayMs))
    : null;

  const daysSinceLastGame = latestPriorGame
    ? Math.max(0, Math.round((targetTime - new Date(latestPriorGame.date).getTime()) / dayMs))
    : null;

  const daysSinceLastPractice = latestPriorPractice
    ? Math.max(0, Math.round((targetTime - new Date(latestPriorPractice.date).getTime()) / dayMs))
    : null;

  // Upcoming game spacing
  const futureGames = allSessions
    .filter((s) => isGameSession(s.session_type, s.session_name) && new Date(s.date).getTime() > targetTime)
    .sort((a, b) => a.date.localeCompare(b.date));

  const nextGame = futureGames[0] || null;
  const daysToNextGame = nextGame
    ? Math.max(0, Math.round((new Date(nextGame.date).getTime() - targetTime) / dayMs))
    : null;

  // Infer context
  const targetDateObj = new Date(targetDateStr);
  const dayOfWeek = targetDateObj.getDay(); // 0 = Sun, 3 = Wed, 6 = Sat

  let contextType: 'SINGLE_GAME' | 'B2B_GAME_1' | 'B2B_GAME_2' | 'WEDNESDAY_GAME' | 'POST_B2B_GAME' = 'SINGLE_GAME';
  let contextDesc = 'Standard single game turnaround (>2 days rest)';

  if (daysSinceLastGame === 1) {
    contextType = 'B2B_GAME_2';
    contextDesc = 'Consecutive day back-to-back Game 2 (<24h recovery)';
  } else if (daysToNextGame === 1) {
    contextType = 'B2B_GAME_1';
    contextDesc = 'Back-to-Back Game 1 with Game 2 scheduled next day';
  } else if (dayOfWeek === 3) {
    contextType = 'WEDNESDAY_GAME';
    contextDesc = 'Midweek Wednesday game with condensed turnaround';
  } else if (daysSinceLastGame !== null && daysSinceLastGame <= 4 && daysSinceLastGame >= 2) {
    contextType = 'POST_B2B_GAME';
    contextDesc = 'Game following a heavy 2-game weekend series';
  }

  const priorSessionMetrics: Partial<CoreMetrics> = {};
  if (latestPriorSession) {
    CORE_METRIC_KEYS.forEach((m) => {
      priorSessionMetrics[m] = latestPriorSession[m];
    });
  }

  return {
    targetDate: targetDateStr,
    daysSinceLastSession,
    daysSinceLastGame,
    daysSinceLastPractice,
    priorSessionType: latestPriorSession
      ? isGameSession(latestPriorSession.session_type, latestPriorSession.session_name)
        ? 'Game'
        : 'Practice'
      : null,
    priorSessionName: latestPriorSession?.session_name,
    priorSessionDurationMin: latestPriorSession?.duration_min ?? (latestPriorSession?.game_minutes ?? null),
    priorSessionRPE: latestPriorSession?.RPE ?? null,
    priorSessionSRPE: latestPriorSession?.sRPE ?? null,
    priorSessionMetrics: latestPriorSession ? priorSessionMetrics : null,
    upcomingSchedule: {
      nextGameDate: nextGame?.date ?? null,
      daysToNextGame,
      isBackToBackWeekend: contextType === 'B2B_GAME_1' || contextType === 'B2B_GAME_2',
      contextType,
      contextDesc,
    },
  };
}
