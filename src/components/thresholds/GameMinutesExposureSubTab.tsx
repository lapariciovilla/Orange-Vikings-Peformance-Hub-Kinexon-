import React, { useState, useMemo } from 'react';
import { Player, CoreMetrics, PlayerSessionRecord, SessionMeta, StaffClearanceStatus } from '../../types';
import { DataStore } from '../../lib/dataStore';
import { CORE_METRIC_KEYS, METRIC_LABELS, isGameSession } from '../../lib/contextBaseline';
import { formatPlayerNumber } from '../../lib/positionalUtils';
import {
  GameContextType,
  GAME_CONTEXT_LABELS,
  inferGameContextFromCalendar,
  buildMinuteScenarioModel,
  MinuteScenarioResult,
} from '../../lib/projectedExposureEngine';
import { analyzeSessionRecoveryContext } from '../../lib/dynamicLoadEngine';
import {
  Clock,
  Calendar,
  Activity,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  TrendingUp,
  Sliders,
  FileSpreadsheet,
  Info,
  Gauge,
  Zap,
  CheckCircle2,
  Stethoscope,
  ShieldAlert,
  Eye,
  BarChart2,
  HelpCircle,
} from 'lucide-react';

interface GameMinutesExposureSubTabProps {
  player: Player;
  players: Player[];
  records: PlayerSessionRecord[];
  onSelectPlayer: (playerId: string) => void;
}

type TabDisplayMode = 'COACH_VIEW' | 'SC_DEEP_DIVE';

const CLEARANCE_CONFIG: Record<
  StaffClearanceStatus,
  { label: string; badgeClass: string; iconColor: string }
> = {
  FULL_CLEARANCE: {
    label: 'Full Clearance',
    badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-800',
    iconColor: 'text-emerald-400',
  },
  MODIFIED: {
    label: 'Modified / Restricted',
    badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-800',
    iconColor: 'text-amber-400',
  },
  RTP: {
    label: 'Return to Play (RTP)',
    badgeClass: 'bg-orange-950/90 text-orange-300 border-orange-800',
    iconColor: 'text-orange-400',
  },
  INJURED: {
    label: 'Out / Injured',
    badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-800',
    iconColor: 'text-rose-400',
  },
  UNKNOWN: {
    label: 'Unknown (Pending Assessment)',
    badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    iconColor: 'text-zinc-500',
  },
};

export const GameMinutesExposureSubTab: React.FC<GameMinutesExposureSubTabProps> = ({
  player,
  players,
  records,
  onSelectPlayer,
}) => {
  // Main view toggle: Coach View vs S&C Statistical Deep Dive
  const [displayMode, setDisplayMode] = useState<TabDisplayMode>('COACH_VIEW');

  const allSessions = useMemo(() => DataStore.getSessionsMeta(), []);

  // Filter game sessions for calendar picker
  const gameSessions = useMemo(() => {
    return allSessions
      .filter((s) => isGameSession(s.session_type, s.session_name))
      .sort((a, b) => b.date.localeCompare(a.date)); // descending
  }, [allSessions]);

  // Selected upcoming or target game date
  const [selectedGameDate, setSelectedGameDate] = useState<string>(
    gameSessions[0]?.date || '2026-08-16'
  );

  // Inferred or manually selected context
  const inferredContext = useMemo(() => {
    return inferGameContextFromCalendar(selectedGameDate, allSessions);
  }, [selectedGameDate, allSessions]);

  const [manualContext, setManualContext] = useState<GameContextType | null>(null);
  const activeContext = manualContext || inferredContext;

  // Selected projected minute value (default 28)
  const [selectedMinutes, setSelectedMinutes] = useState<number>(28);
  const [customMinutes, setCustomMinutes] = useState<string>('28');

  // Toggle view: Total Volume vs Load per Minute (Intensity) in S&C Deep Dive
  const [metricViewMode, setMetricViewMode] = useState<'TOTAL' | 'PER_MINUTE'>('TOTAL');

  // Recovery context analyzer
  const recoveryContext = useMemo(() => {
    return analyzeSessionRecoveryContext(selectedGameDate, records, player.id, allSessions);
  }, [selectedGameDate, records, player.id, allSessions]);

  // Latest player S&C status & medical clearance
  const latestStatus = useMemo(() => {
    return DataStore.getLatestPlayerStatus(player.id);
  }, [player.id]);

  // Key minute scenario list for coaches: 15, 20, 25, 30, 35 min + default 28
  const coachKeyMinuteScenarios = [15, 20, 25, 28, 30, 35];

  // Include custom minutes if user entered a custom value
  const allScenariosList = useMemo(() => {
    const list = Array.from(new Set([...coachKeyMinuteScenarios, selectedMinutes]));
    list.sort((a, b) => a - b);
    return list;
  }, [selectedMinutes]);

  // Build projections for all scenario minutes with genuine context and calendar integration
  const scenarioModels = useMemo(() => {
    return buildMinuteScenarioModel(
      records,
      player,
      allScenariosList,
      activeContext,
      selectedGameDate,
      allSessions
    );
  }, [records, player, allScenariosList, activeContext, selectedGameDate, allSessions]);

  // Active scenario model for the selected minutes
  const activeScenarioModel = useMemo(() => {
    return (
      scenarioModels.find((s) => s.minutes === selectedMinutes) ||
      scenarioModels.find((s) => s.minutes === 28) ||
      scenarioModels[0]
    );
  }, [scenarioModels, selectedMinutes]);

  // Back-to-Back Game 1 Prior Context (if evaluating Game 2)
  const game1PriorRecord = useMemo(() => {
    if (activeContext !== 'B2B_GAME_2') return null;

    const targetTime = new Date(selectedGameDate).getTime();
    const playerGameRecs = records.filter(
      (r) => r.player_id === player.id && isGameSession(r.session_type, r.session_name)
    );

    return (
      playerGameRecs.find((r) => {
        const diffDays = Math.round((targetTime - new Date(r.date).getTime()) / (1000 * 3600 * 24));
        return diffDays === 1;
      }) || playerGameRecs[0] || null
    );
  }, [records, player.id, activeContext, selectedGameDate]);

  // Selected Game Meta Info
  const selectedGameMeta = gameSessions.find((s) => s.date === selectedGameDate);

  // Check if projected minutes exceed medical restriction
  const isOverMedicalRestriction =
    latestStatus?.max_minutes_restriction !== null &&
    latestStatus?.max_minutes_restriction !== undefined &&
    selectedMinutes > latestStatus.max_minutes_restriction;

  const clearanceCfg = CLEARANCE_CONFIG[latestStatus.clearance_status] || CLEARANCE_CONFIG.UNKNOWN;

  return (
    <div className="space-y-6 text-zinc-100">
      {/* View Mode Toggle Header Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs font-black uppercase text-orange-400 tracking-wider">
                ORANGE VIKINGS GAME MINUTES → PROJECTED EXPOSURE MODEL
              </span>
              <span className="text-[10px] bg-purple-950 text-purple-300 font-extrabold px-2 py-0.5 rounded border border-purple-800">
                CONTEXT-AWARE OLS REGRESSION
              </span>
            </div>
            <h2 className="text-2xl font-black text-white flex items-center space-x-3">
              <Clock className="w-6 h-6 text-orange-500" />
              <span>Projected External Load & Minutes Exposure</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-3xl">
              Deterministic player-specific projections for {player.displayName} ({formatPlayerNumber(player.number)}) across 8 core tracking metrics.
              Connects actual game minutes, recovery turnaround, acute workload context, and prediction uncertainty intervals.
            </p>
          </div>

          {/* Top Controls: View Mode Toggle & Athlete Selector */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* View Mode Switcher */}
            <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-800 flex items-center space-x-1">
              <button
                onClick={() => setDisplayMode('COACH_VIEW')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-black transition-all ${
                  displayMode === 'COACH_VIEW'
                    ? 'bg-orange-600 text-zinc-950 shadow-md scale-[1.02]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>Coach View</span>
              </button>
              <button
                onClick={() => setDisplayMode('SC_DEEP_DIVE')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-black transition-all ${
                  displayMode === 'SC_DEEP_DIVE'
                    ? 'bg-purple-600 text-white shadow-md scale-[1.02]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                <span>S&C Deep Dive</span>
              </button>
            </div>

            {/* Player Switcher */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-zinc-400">Athlete:</span>
              <select
                value={player.id}
                onChange={(e) => onSelectPlayer(e.target.value)}
                className="bg-zinc-950 border border-orange-500/80 text-white font-extrabold text-xs rounded-xl px-4 py-2.5 outline-none shadow-lg"
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatPlayerNumber(p.number)} {p.displayName} ({p.position})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Schedule Calendar & Context Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
          {/* Target Game Date */}
          <div>
            <label className="block text-[11px] font-extrabold text-orange-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-orange-400" />
              <span>Target Game Date (B.LEAGUE Schedule)</span>
            </label>
            <select
              value={selectedGameDate}
              onChange={(e) => {
                setSelectedGameDate(e.target.value);
                setManualContext(null); // reset manual context to auto-infer
              }}
              className="w-full bg-zinc-900 border border-zinc-700 text-white font-bold text-xs rounded-lg px-3 py-2 outline-none focus:border-orange-500"
            >
              {gameSessions.map((s) => (
                <option key={s.id} value={s.date}>
                  {s.date} — {s.session_name}
                </option>
              ))}
            </select>
            {selectedGameMeta && (
              <p className="text-[10px] text-zinc-400 mt-1">
                Opponent: <span className="text-amber-400 font-bold">{selectedGameMeta.opponent || 'B.LEAGUE Match'}</span> · {selectedGameMeta.location}
              </p>
            )}
          </div>

          {/* Game Context Selection */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-extrabold text-orange-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-orange-400" />
                <span>Game Schedule Context</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-normal">
                {manualContext ? '(Manually Overridden)' : '(Auto-Inferred from Calendar Spacing)'}
              </span>
            </label>

            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(GAME_CONTEXT_LABELS) as GameContextType[]).map((ctxKey) => {
                const isSelected = activeContext === ctxKey;
                return (
                  <button
                    key={ctxKey}
                    onClick={() => setManualContext(ctxKey)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${
                      isSelected
                        ? 'bg-orange-600 text-zinc-950 border-orange-400 shadow-md scale-[1.02]'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    {GAME_CONTEXT_LABELS[ctxKey].label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              {GAME_CONTEXT_LABELS[activeContext].desc}
            </p>
          </div>
        </div>

        {/* Player Status, Medical Clearance & Recovery Snapshot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 text-xs">
          {/* Clearance Status */}
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-400 font-black uppercase flex items-center space-x-1">
              <Stethoscope className="w-3 h-3 text-orange-400" />
              <span>Medical Clearance Status</span>
            </span>
            <div>
              <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-black uppercase border ${clearanceCfg.badgeClass}`}>
                {clearanceCfg.label}
              </span>
            </div>
            {latestStatus.max_minutes_restriction && (
              <div className="text-[11px] font-bold text-amber-400">
                Limit: Max {latestStatus.max_minutes_restriction} min
              </div>
            )}
          </div>

          {/* Soreness & Symptoms */}
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-400 font-black uppercase block">
              Reported Soreness & Area
            </span>
            <div className="text-sm font-black text-white">
              <span className={latestStatus.soreness_score && latestStatus.soreness_score >= 3 ? 'text-amber-400' : 'text-emerald-400'}>
                {latestStatus.soreness_score ? `${latestStatus.soreness_score} / 5` : 'None'}
              </span>
              <span className="text-[11px] text-zinc-400 font-normal ml-1.5 truncate">
                {latestStatus.soreness_body_area || 'None'}
              </span>
            </div>
            {latestStatus.has_active_injury && (
              <div className="text-[10px] font-bold text-rose-300 truncate">
                RTP: {latestStatus.injury_type || 'Active Rehab'}
              </div>
            )}
          </div>

          {/* Prior Turnaround Spacing */}
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-400 font-black uppercase block">Prior Turnaround</span>
            <span className="text-sm font-black text-white">
              {recoveryContext.daysSinceLastSession !== null
                ? `${recoveryContext.daysSinceLastSession} Day${recoveryContext.daysSinceLastSession === 1 ? '' : 's'} Rest`
                : 'N/A'}
            </span>
            <div className="text-[10px] text-zinc-500">
              {recoveryContext.daysSinceLastGame !== null ? `Last match ${recoveryContext.daysSinceLastGame}d ago` : 'First match'}
            </div>
          </div>

          {/* Prior Strain / sRPE */}
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-400 font-black uppercase block">Prior Session Internal Load</span>
            <span className="text-sm font-black text-purple-400">
              {recoveryContext.priorSessionRPE !== null ? `RPE ${recoveryContext.priorSessionRPE}/10` : 'None logged'}
            </span>
            <div className="text-[10px] text-sky-400 font-mono">
              {recoveryContext.priorSessionSRPE !== null ? `sRPE: ${recoveryContext.priorSessionSRPE} au` : 'sRPE: N/A'}
            </div>
          </div>
        </div>

        {/* Medical Restriction Warning Callout (if selected minutes exceeds staff restriction) */}
        {isOverMedicalRestriction && (
          <div className="bg-rose-950/70 border-2 border-rose-600 rounded-xl p-3.5 flex items-center space-x-3 text-rose-200 text-xs animate-pulse">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <strong className="text-rose-100 uppercase tracking-wider block">
                ROTATION ALERT FOR COACH LUIS: SELECTED MINUTES ({selectedMinutes} MIN) EXCEEDS S&C MEDICAL LIMIT!
              </strong>
              <span>
                {player.displayName} has an active medical restriction of <strong>Max {latestStatus.max_minutes_restriction} minutes</strong> ({latestStatus.medical_restrictions}).
                Review tactical rotation with medical staff before planning higher exposure.
              </span>
            </div>
          </div>
        )}

        {/* Minute Scenario Selector Controls */}
        <div className="space-y-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-2">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-black text-white uppercase tracking-wider">
                SELECT PROJECTED GAME MINUTES SCENARIO
              </span>
            </div>

            {/* Custom Minute Input Box */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-zinc-400 font-bold">Custom Min:</span>
              <input
                type="number"
                min="5"
                max="48"
                value={customMinutes}
                onChange={(e) => {
                  setCustomMinutes(e.target.value);
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val > 0 && val <= 48) {
                    setSelectedMinutes(val);
                  }
                }}
                className="w-16 bg-zinc-900 border border-orange-500/80 rounded px-2.5 py-1 text-center font-black text-amber-400 text-xs outline-none"
              />
              <span className="text-xs text-zinc-400 font-bold">min</span>
            </div>
          </div>

          {/* Scenario Minute Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {allScenariosList.map((m) => {
              const scModel = scenarioModels.find((s) => s.minutes === m);
              const isSelected = selectedMinutes === m;

              let badgeColor = 'border-zinc-800 bg-zinc-900 text-zinc-400';
              if (scModel?.overallStatus === 'RED') {
                badgeColor = isSelected
                  ? 'bg-rose-600 text-white border-rose-400 font-black shadow-lg shadow-rose-950/50'
                  : 'bg-rose-950/60 text-rose-300 border-rose-800/80 hover:bg-rose-900/60';
              } else if (scModel?.overallStatus === 'YELLOW') {
                badgeColor = isSelected
                  ? 'bg-amber-500 text-zinc-950 border-amber-300 font-black shadow-lg shadow-amber-950/50'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800/80 hover:bg-amber-900/60';
              } else {
                badgeColor = isSelected
                  ? 'bg-emerald-600 text-zinc-950 border-emerald-300 font-black shadow-lg shadow-emerald-950/50'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80 hover:bg-emerald-900/60';
              }

              return (
                <button
                  key={m}
                  onClick={() => {
                    setSelectedMinutes(m);
                    setCustomMinutes(m.toString());
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 border transition-all ${badgeColor}`}
                >
                  <span>{m} min</span>
                  <span>
                    {scModel?.overallStatus === 'RED'
                      ? '🔴'
                      : scModel?.overallStatus === 'YELLOW'
                      ? '🟡'
                      : '🟢'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* EXPLICIT NON-PRESCRIPTIVE SCIENTIFIC STATEMENT */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-zinc-400">
        <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-zinc-200 uppercase">Statistical Benchmark Notice:</strong> Exposure categories
          (Typical, Elevated, High) reflect objective statistical percentiles relative to this athlete's individual game history.
          They represent physical workload benchmarks, <strong>NEVER injury probability, risk forecasts, or "safe minutes"</strong>.
        </p>
      </div>

      {/* ======================================================== */}
      {/* MODE 1: COACH VIEW (CLEAN, SCANNABLE, ACTIONABLE CARDS) */}
      {/* ======================================================== */}
      {displayMode === 'COACH_VIEW' && (
        <div className="space-y-6">
          {/* Executive Traffic Light Card for Coach Luis */}
          <div
            className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all ${
              activeScenarioModel.overallStatus === 'RED'
                ? 'bg-rose-950/50 border-rose-800/80 shadow-2xl shadow-rose-950/30'
                : activeScenarioModel.overallStatus === 'YELLOW'
                ? 'bg-amber-950/50 border-amber-800/80 shadow-2xl shadow-amber-950/30'
                : 'bg-emerald-950/50 border-emerald-800/80 shadow-2xl shadow-emerald-950/30'
            }`}
          >
            <div className="flex items-start space-x-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 font-black shadow-lg ${
                  activeScenarioModel.overallStatus === 'RED'
                    ? 'bg-rose-600 text-white'
                    : activeScenarioModel.overallStatus === 'YELLOW'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-emerald-500 text-zinc-950'
                }`}
              >
                {activeScenarioModel.overallStatus === 'RED'
                  ? '🔴'
                  : activeScenarioModel.overallStatus === 'YELLOW'
                  ? '🟡'
                  : '🟢'}
              </div>

              <div>
                <div className="text-[10px] font-black tracking-widest uppercase text-zinc-400">
                  COACH LUIS EXPOSURE ASSESSMENT ({selectedMinutes} MIN PLAYED)
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight mt-0.5">
                  {activeScenarioModel.overallStatusLabel}
                </h3>
                <p className="text-xs font-bold text-zinc-200 mt-1.5 leading-relaxed max-w-2xl">
                  {activeScenarioModel.summarySentence}
                </p>
              </div>
            </div>

            <div className="bg-zinc-950/90 border border-zinc-800/90 p-4 rounded-xl text-center shrink-0 min-w-[170px]">
              <span className="text-[10px] font-black text-zinc-400 uppercase block">PROJECTED LOAD</span>
              <span className="text-2xl font-black text-amber-400">
                {activeScenarioModel.metricProjections.distance_m.projectedValue?.toLocaleString() || '-'} m
              </span>
              <span className="text-[11px] text-orange-400 block font-bold mt-1">
                {activeScenarioModel.metricProjections.accumulated_acceleration_load.projectedValue} au Accel
              </span>
              <span className="text-[10px] text-zinc-500 block font-bold mt-1">
                n = {activeScenarioModel.metricProjections.distance_m.n} Real Games
              </span>
            </div>
          </div>

          {/* Quick Minute Scenarios Matrix (Visual Cards for Coach Scanning) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2 text-xs font-black text-orange-400 uppercase tracking-wider">
                <TrendingUp className="w-4 h-4 text-orange-400" />
                <span>MINUTE SCENARIOS MATRIX — QUICK SCAN FOR ROTATION PLANNING</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-bold">
                Click any scenario to project load across all 8 metrics
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {allScenariosList.map((m) => {
                const sc = scenarioModels.find((s) => s.minutes === m);
                if (!sc) return null;
                const isSelected = selectedMinutes === m;
                const distProj = sc.metricProjections.distance_m;
                const accelProj = sc.metricProjections.accumulated_acceleration_load;

                return (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedMinutes(m);
                      setCustomMinutes(m.toString());
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-orange-500 bg-zinc-950 ring-2 ring-orange-500/50 shadow-xl'
                        : 'border-zinc-800 bg-zinc-950/80 hover:bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-black text-white">{m} MIN</span>
                      <span className="text-base">
                        {sc.overallStatus === 'RED' ? '🔴' : sc.overallStatus === 'YELLOW' ? '🟡' : '🟢'}
                      </span>
                    </div>

                    <div className="text-xs font-black text-amber-400">
                      {distProj.projectedValue?.toLocaleString() || '-'} m
                    </div>
                    <div className="text-[11px] font-bold text-zinc-400 mt-0.5">
                      {accelProj.projectedValue || '-'} au Accel
                    </div>

                    <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[9px] font-black uppercase">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          sc.overallStatus === 'RED'
                            ? 'text-rose-300 bg-rose-950/80'
                            : sc.overallStatus === 'YELLOW'
                            ? 'text-amber-300 bg-amber-950/80'
                            : 'text-emerald-300 bg-emerald-950/80'
                        }`}
                      >
                        {sc.overallStatus === 'RED'
                          ? 'HIGH'
                          : sc.overallStatus === 'YELLOW'
                          ? 'ELEVATED'
                          : 'TYPICAL'}
                      </span>
                      <span className="text-zinc-500">
                        {accelProj.densityProjectedValue} /m
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 8 Core Metrics Simplified Visual Cards */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-xs font-black text-orange-400 uppercase tracking-wider">
                PROJECTED VALUES ACROSS ALL 8 EXTERNAL LOAD METRICS ({selectedMinutes} MIN)
              </span>
              <span className="text-[11px] text-zinc-400">
                Baseline context: <strong>{GAME_CONTEXT_LABELS[activeContext].label}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {CORE_METRIC_KEYS.map((m) => {
                const proj = activeScenarioModel.metricProjections[m];
                const metricInfo = METRIC_LABELS[m];

                let statusBorder = 'border-zinc-800 bg-zinc-950';
                let iconSymbol = '🟢';
                if (proj.status === 'RED') {
                  statusBorder = 'border-rose-800/80 bg-rose-950/20';
                  iconSymbol = '🔴';
                } else if (proj.status === 'YELLOW') {
                  statusBorder = 'border-amber-800/80 bg-amber-950/20';
                  iconSymbol = '🟡';
                }

                return (
                  <div key={m} className={`p-4 rounded-xl border ${statusBorder} space-y-2`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-zinc-300 uppercase truncate">
                        {metricInfo.shortLabel}
                      </span>
                      <span className="text-base">{iconSymbol}</span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-black text-white">
                        {proj.projectedValue !== null ? proj.projectedValue.toLocaleString() : 'N/A'}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-bold">{metricInfo.unit}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-zinc-800/60">
                      <span className="text-zinc-400 font-bold">Density Rate:</span>
                      <span className="text-purple-300 font-mono font-bold">
                        {proj.densityProjectedValue} {proj.densityUnit}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500">Typical P50:</span>
                      <span className="text-zinc-300 font-bold">
                        {proj.p50 !== null ? proj.p50.toLocaleString() : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: S&C DEEP DIVE (FULL REGRESSION & STATISTICS)    */}
      {/* ======================================================== */}
      {displayMode === 'SC_DEEP_DIVE' && (
        <div className="space-y-6">
          {/* Main Influencing Factors Callout */}
          {activeScenarioModel.contextInfluences.length > 0 && (
            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-xs space-y-2">
              <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider block">
                MAIN FACTORS INFLUENCING THIS DYNAMIC ESTIMATE:
              </span>
              <div className="flex flex-wrap gap-2">
                {activeScenarioModel.contextInfluences.map((factor, idx) => (
                  <span
                    key={idx}
                    className="bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-bold px-3 py-1.5 rounded-lg"
                  >
                    • {factor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* S&C Metric View Toggle: Total Volume vs Rate per Minute */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5 text-orange-500" />
                  <span>S&C STATISTICAL REGRESSION & UNCERTAINTY TABLE</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Ordinary least squares (OLS) regression parameters, R², sample size n, residual standard error, and 95% prediction intervals.
                </p>
              </div>

              {/* Total vs Load/Min Mode Selector */}
              <div className="flex items-center space-x-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 self-start sm:self-auto">
                <button
                  onClick={() => setMetricViewMode('TOTAL')}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded transition-all ${
                    metricViewMode === 'TOTAL'
                      ? 'bg-orange-600 text-zinc-950 shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Total Volume
                </button>
                <button
                  onClick={() => setMetricViewMode('PER_MINUTE')}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded transition-all ${
                    metricViewMode === 'PER_MINUTE'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Load / Min (Intensity)
                </button>
              </div>
            </div>

            {/* Comprehensive S&C Table */}
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950 text-zinc-400 font-black uppercase text-[10px] tracking-wider border-b border-zinc-800">
                  <tr>
                    <th className="p-3">Core Metric</th>
                    <th className="p-3">Model Formula</th>
                    <th className="p-3 text-center">R²</th>
                    <th className="p-3 text-center">n</th>
                    <th className="p-3 text-right">95% Uncertainty Margin</th>
                    <th className="p-3 text-right">Projected Value</th>
                    <th className="p-3 text-right text-purple-300">Rate / Min</th>
                    <th className="p-3 text-right">P50</th>
                    <th className="p-3 text-right">P75</th>
                    <th className="p-3 text-right">P90</th>
                    <th className="p-3 text-right">P95</th>
                    <th className="p-3 text-center">Percentile / Z</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/50">
                  {CORE_METRIC_KEYS.map((m) => {
                    const proj = activeScenarioModel.metricProjections[m];
                    const metricInfo = METRIC_LABELS[m];

                    return (
                      <tr key={m} className="hover:bg-zinc-950 transition-colors">
                        <td className="p-3 font-bold text-white flex items-center space-x-1.5">
                          <span>{metricInfo.shortLabel}</span>
                          <span className="text-[10px] text-zinc-500 font-normal">({metricInfo.unit})</span>
                        </td>

                        <td className="p-3 font-mono text-[11px] text-zinc-400">
                          {proj.slope !== null && proj.intercept !== null
                            ? `${proj.slope}×min ${proj.intercept >= 0 ? '+' : ''}${proj.intercept}`
                            : 'Rate Mean'}
                        </td>

                        <td className="p-3 text-center font-bold text-sky-400">
                          {proj.r2 !== null ? proj.r2 : '-'}
                        </td>

                        <td className="p-3 text-center font-bold text-amber-400">
                          {proj.n}
                        </td>

                        <td className="p-3 text-right font-mono text-zinc-300">
                          {proj.predictionMargin !== null ? `±${proj.predictionMargin}` : '-'}
                        </td>

                        <td className="p-3 text-right font-black text-amber-400 text-sm">
                          {proj.projectedValue !== null ? proj.projectedValue.toLocaleString() : '-'}
                        </td>

                        <td className="p-3 text-right font-mono text-purple-300 font-bold">
                          {proj.densityProjectedValue !== null ? `${proj.densityProjectedValue} ${proj.densityUnit}` : '-'}
                        </td>

                        <td className="p-3 text-right font-bold text-zinc-300">
                          {proj.p50 !== null ? proj.p50.toLocaleString() : '-'}
                        </td>

                        <td className="p-3 text-right font-bold text-amber-300">
                          {proj.p75 !== null ? proj.p75.toLocaleString() : '-'}
                        </td>

                        <td className="p-3 text-right font-bold text-rose-300">
                          {proj.p90 !== null ? proj.p90.toLocaleString() : '-'}
                        </td>

                        <td className="p-3 text-right font-bold text-rose-400">
                          {proj.p95 !== null ? proj.p95.toLocaleString() : '-'}
                        </td>

                        <td className="p-3 text-center text-[10px] font-bold text-zinc-400">
                          {proj.percentileRank !== null ? `${proj.percentileRank}%ile` : '-'}{' '}
                          {proj.zScore !== null ? `(z=${proj.zScore >= 0 ? '+' : ''}${proj.zScore})` : ''}
                        </td>

                        <td className="p-3 text-center">
                          {proj.status === 'RED' ? (
                            <span className="text-[10px] font-black text-rose-300 bg-rose-950/80 border border-rose-800 px-2 py-0.5 rounded">
                              HIGH EXPOSURE
                            </span>
                          ) : proj.status === 'YELLOW' ? (
                            <span className="text-[10px] font-black text-amber-300 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded">
                              ELEVATED
                            </span>
                          ) : (
                            <span className="text-[10px] font-black text-emerald-300 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded">
                              TYPICAL
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-xs text-zinc-400 space-y-1">
              <div className="font-bold text-zinc-200 flex items-center space-x-1.5">
                <Info className="w-4 h-4 text-orange-400" />
                <span>Deterministic Statistical Notes & Data Transparency</span>
              </div>
              <p>
                Projections utilize linear ordinary least squares (OLS) regression calculated exclusively from {player.displayName}'s historical B.LEAGUE game records (sample size n = {activeScenarioModel.metricProjections.distance_m.n}).
              </p>
              <p className="text-[11px] text-zinc-400">
                Confidence intervals (±95% PI) reflect standard forecast prediction uncertainty. Thresholds (P50, P75, P90, P95) derive from historical individual game distributions.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
