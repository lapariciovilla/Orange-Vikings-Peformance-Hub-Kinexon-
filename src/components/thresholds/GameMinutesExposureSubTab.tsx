import React, { useState, useMemo } from 'react';
import { Player, CoreMetrics, PlayerSessionRecord, SessionMeta } from '../../types';
import { DataStore } from '../../lib/dataStore';
import { CORE_METRIC_KEYS, METRIC_LABELS, isGameSession } from '../../lib/contextBaseline';
import { formatPlayerNumber } from '../../lib/positionalUtils';
import {
  GameContextType,
  GAME_CONTEXT_LABELS,
  inferGameContextFromCalendar,
  buildMinuteScenarioModel,
  calculateMetricProjection,
  MinuteScenarioResult,
} from '../../lib/projectedExposureEngine';
import {
  Clock,
  Calendar,
  Activity,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Sliders,
  FileSpreadsheet,
  Info,
} from 'lucide-react';

interface GameMinutesExposureSubTabProps {
  player: Player;
  players: Player[];
  records: PlayerSessionRecord[];
  onSelectPlayer: (playerId: string) => void;
}

export const GameMinutesExposureSubTab: React.FC<GameMinutesExposureSubTabProps> = ({
  player,
  players,
  records,
  onSelectPlayer,
}) => {
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

  // Toggle detailed S&C regression view
  const [showDetailedStats, setShowDetailedStats] = useState<boolean>(true);

  // Default minute scenario list
  const minuteScenariosList = [20, 22, 24, 26, 28, 30, 32, 34, 36];

  // Include custom minutes if user entered a custom value not in list
  const allScenariosList = useMemo(() => {
    const list = [...minuteScenariosList];
    if (!list.includes(selectedMinutes)) {
      list.push(selectedMinutes);
      list.sort((a, b) => a - b);
    }
    return list;
  }, [selectedMinutes]);

  // Build projections for all scenario minutes
  const scenarioModels = useMemo(() => {
    return buildMinuteScenarioModel(records, player, allScenariosList, activeContext);
  }, [records, player, allScenariosList, activeContext]);

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

    // Find Game 1 record (day before target date)
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

  return (
    <div className="space-y-6 text-zinc-100">
      {/* Top Banner & Control Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs font-black uppercase text-orange-400 tracking-wider">
                GAME MINUTES → PROJECTED EXPOSURE MODEL
              </span>
              <span className="text-[10px] bg-purple-950 text-purple-300 font-extrabold px-2 py-0.5 rounded border border-purple-800">
                REGRESSION ENGINE
              </span>
            </div>
            <h2 className="text-2xl font-black text-white flex items-center space-x-3">
              <Clock className="w-6 h-6 text-orange-500" />
              <span>Projected External Load & Minutes Exposure</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-3xl">
              Simulate workload for {player.displayName} ({formatPlayerNumber(player.number)}) across 8 core tracking metrics based on deterministic linear regression models and historical percentile thresholds.
            </p>
          </div>

          {/* Player Switcher */}
          <div className="flex items-center space-x-2 shrink-0">
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

        {/* Schedule Calendar & Game Context Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
          {/* Target Game Date */}
          <div>
            <label className="block text-[11px] font-extrabold text-orange-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-orange-400" />
              <span>Target Game Date (B.LEAGUE Calendar)</span>
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
                {manualContext ? '(Manually Overridden)' : '(Auto-Inferred from Calendar)'}
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

        {/* Minute Scenario Selector Controls */}
        <div className="space-y-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-2">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-black text-white uppercase tracking-wider">
                SELECT PROJECTED GAME MINUTES
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

      {/* SECTION 1: SIMPLE COACH VIEW (EXECUTIVE SUMMARY) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              HEAD COACH DECISION SUMMARY — {player.displayName} ({selectedMinutes} MIN PROJECTION)
            </h3>
          </div>
          <span className="text-xs text-orange-400 font-extrabold uppercase">
            {GAME_CONTEXT_LABELS[activeContext].label}
          </span>
        </div>

        {/* Overall Projected Traffic Light Status Box */}
        <div
          className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
            activeScenarioModel.overallStatus === 'RED'
              ? 'bg-rose-950/50 border-rose-800/80 shadow-2xl shadow-rose-950/30'
              : activeScenarioModel.overallStatus === 'YELLOW'
              ? 'bg-amber-950/50 border-amber-800/80 shadow-2xl shadow-amber-950/30'
              : 'bg-emerald-950/50 border-emerald-800/80 shadow-2xl shadow-emerald-950/30'
          }`}
        >
          <div className="flex items-start space-x-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 font-black shadow-lg ${
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
                OVERALL EXPOSURE CLASSIFICATION
              </div>
              <h4 className="text-xl font-black text-white tracking-tight mt-0.5">
                {activeScenarioModel.overallStatusLabel}
              </h4>
              <p className="text-xs font-bold text-zinc-200 mt-1 leading-relaxed">
                {activeScenarioModel.summarySentence}
              </p>
            </div>
          </div>

          <div className="bg-zinc-950/80 border border-zinc-800/80 p-3.5 rounded-xl text-center shrink-0 min-w-[140px]">
            <span className="text-[10px] font-black text-zinc-400 uppercase block">PROJECTED MIN</span>
            <span className="text-2xl font-black text-amber-400">{selectedMinutes} min</span>
            <span className="text-[10px] text-zinc-400 block font-bold mt-0.5">
              n = {activeScenarioModel.metricProjections.distance_m.n} Historical Games
            </span>
          </div>
        </div>

        {/* Quick Horizontal Scenario Matrix (Head Coach Scan) */}
        <div className="space-y-2">
          <div className="text-xs font-black text-orange-400 uppercase tracking-wider flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            <span>MINUTE SCENARIO EXPOSURE MATRIX (QUICK SCAN FOR HEAD COACH)</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center space-x-3 min-w-max">
              {scenarioModels.map((sc) => (
                <button
                  key={sc.minutes}
                  onClick={() => {
                    setSelectedMinutes(sc.minutes);
                    setCustomMinutes(sc.minutes.toString());
                  }}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    selectedMinutes === sc.minutes
                      ? 'border-orange-500 bg-zinc-900 ring-2 ring-orange-500/50 scale-105'
                      : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900'
                  }`}
                >
                  <span className="text-xs font-black text-zinc-300 block">{sc.minutes} min</span>
                  <span className="text-xl my-1 block">
                    {sc.overallStatus === 'RED' ? '🔴' : sc.overallStatus === 'YELLOW' ? '🟡' : '🟢'}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase block px-2 py-0.5 rounded ${
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
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 8 Core Metrics Traffic-Light Grid */}
        <div className="space-y-3">
          <div className="text-xs font-black text-orange-400 uppercase tracking-wider flex items-center justify-between">
            <span>PROJECTED EXPOSURE BREAKDOWN ACROSS ALL 8 CORE TRACKING METRICS</span>
            <span className="text-[10px] text-zinc-400 font-bold">At {selectedMinutes} Minutes</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CORE_METRIC_KEYS.map((m) => {
              const proj = activeScenarioModel.metricProjections[m];
              const metricInfo = METRIC_LABELS[m];

              let statusBorder = 'border-zinc-800 bg-zinc-950';
              let badgeBg = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
              let iconSymbol = '🟢';

              if (proj.status === 'RED') {
                statusBorder = 'border-rose-800/80 bg-rose-950/20';
                badgeBg = 'bg-rose-950/90 text-rose-300 border-rose-800';
                iconSymbol = '🔴';
              } else if (proj.status === 'YELLOW') {
                statusBorder = 'border-amber-800/80 bg-amber-950/20';
                badgeBg = 'bg-amber-950/90 text-amber-300 border-amber-800';
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
                    <span className="text-zinc-400 font-bold">vs P50 Typical:</span>
                    <span
                      className={`font-black ${
                        proj.pctChangeFromTypical !== null && proj.pctChangeFromTypical >= 0
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {proj.pctChangeFromTypical !== null
                        ? `${proj.pctChangeFromTypical >= 0 ? '+' : ''}${proj.pctChangeFromTypical}%`
                        : '-'}
                    </span>
                  </div>

                  <div className="text-[9px] text-zinc-400 flex items-center justify-between font-bold">
                    <span>P90 High: {proj.p90 !== null ? proj.p90.toLocaleString() : '-'}</span>
                    <span>95% CI: ±{proj.predictionMargin ?? '-'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Back-to-Back Game 2 Prior Context Box (If Applicable) */}
        {activeContext === 'B2B_GAME_2' && (
          <div className="bg-zinc-950 p-4 rounded-xl border border-purple-800/60 space-y-3">
            <div className="flex items-center space-x-2 border-b border-zinc-800 pb-2">
              <Info className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-black text-purple-300 uppercase tracking-wider">
                BACK-TO-BACK GAME 2 CONTEXTUAL WORKLOAD EVALUATION
              </span>
            </div>

            {game1PriorRecord ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-500 font-black block uppercase">Game 1 Mins</span>
                  <span className="text-amber-400 font-black text-sm">{game1PriorRecord.game_minutes || '-'} min</span>
                </div>
                <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-500 font-black block uppercase">Game 1 Accel</span>
                  <span className="text-orange-400 font-black text-sm">{game1PriorRecord.accumulated_acceleration_load || '-'}</span>
                </div>
                <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-500 font-black block uppercase">Game 1 Decel</span>
                  <span className="text-rose-400 font-black text-sm">{game1PriorRecord.deceleration_load || '-'}</span>
                </div>
                <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-500 font-black block uppercase">Game 1 RPE</span>
                  <span className="text-purple-400 font-black text-sm">{game1PriorRecord.RPE || '-'}/10</span>
                </div>
                <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-500 font-black block uppercase">Projected G2 Accel</span>
                  <span className="text-amber-400 font-black text-sm">
                    {activeScenarioModel.metricProjections.accumulated_acceleration_load.projectedValue || '-'}
                  </span>
                </div>
                <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-500 font-black block uppercase">Cum 2-Game Accel</span>
                  <span className="text-emerald-400 font-black text-sm">
                    {(game1PriorRecord.accumulated_acceleration_load || 0) +
                      (activeScenarioModel.metricProjections.accumulated_acceleration_load.projectedValue || 0)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                Evaluating Game 2 projection relative to player's historical back-to-back weekend performance.
              </p>
            )}
          </div>
        )}
      </div>

      {/* SECTION 2: DETAILED S&C STATISTICAL ANALYSIS (S&C STAFF DEEP DIVE) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-orange-500" />
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              S&C REGRESSION & UNCERTAINTY STATISTICAL ANALYSIS
            </h3>
          </div>

          <button
            onClick={() => setShowDetailedStats(!showDetailedStats)}
            className="text-xs font-extrabold text-orange-400 hover:text-orange-300 flex items-center space-x-1"
          >
            <span>{showDetailedStats ? 'Hide Statistical Table' : 'Show Detailed S&C Table'}</span>
            {showDetailedStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showDetailedStats && (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950 text-zinc-400 font-black uppercase text-[10px] tracking-wider border-b border-zinc-800">
                  <tr>
                    <th className="p-3">Core Metric</th>
                    <th className="p-3">Model Formula (Predicted)</th>
                    <th className="p-3 text-center">R²</th>
                    <th className="p-3 text-center">n</th>
                    <th className="p-3 text-right">95% Uncertainty Margin</th>
                    <th className="p-3 text-right">P50 Typical</th>
                    <th className="p-3 text-right">P75 Elevated</th>
                    <th className="p-3 text-right">P90 High</th>
                    <th className="p-3 text-right text-amber-400">Projected ({selectedMinutes}m)</th>
                    <th className="p-3 text-center">Percentile / Z-Score</th>
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
                            ? `${proj.slope}×x ${proj.intercept >= 0 ? '+' : ''}${proj.intercept}`
                            : 'Load/min Mean'}
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

                        <td className="p-3 text-right font-bold text-zinc-300">
                          {proj.p50 !== null ? proj.p50.toLocaleString() : '-'}
                        </td>

                        <td className="p-3 text-right font-bold text-amber-300">
                          {proj.p75 !== null ? proj.p75.toLocaleString() : '-'}
                        </td>

                        <td className="p-3 text-right font-bold text-rose-300">
                          {proj.p90 !== null ? proj.p90.toLocaleString() : '-'}
                        </td>

                        <td className="p-3 text-right font-black text-amber-400 text-sm">
                          {proj.projectedValue !== null ? proj.projectedValue.toLocaleString() : '-'}
                        </td>

                        <td className="p-3 text-center text-[10px] font-bold text-zinc-400">
                          {proj.percentileRank !== null ? `${proj.percentileRank}%ile` : '-'}{' '}
                          {proj.zScore !== null ? `(z=${proj.zScore >= 0 ? '+' : ''}${proj.zScore})` : ''}
                        </td>

                        <td className="p-3 text-center">
                          {proj.status === 'RED' ? (
                            <span className="text-[10px] font-black text-rose-300 bg-rose-950/80 border border-rose-800 px-2 py-0.5 rounded">
                              RED (HIGH)
                            </span>
                          ) : proj.status === 'YELLOW' ? (
                            <span className="text-[10px] font-black text-amber-300 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded">
                              YELLOW (ELEV)
                            </span>
                          ) : (
                            <span className="text-[10px] font-black text-emerald-300 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded">
                              GREEN (TYP)
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
                Confidence intervals (±95% CI) reflect standard forecast prediction uncertainty. Thresholds (P50, P75, P90, P95) derive from historical individual game distributions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
