import React, { useState } from 'react';
import { Player, CoreMetrics, PlayerSessionRecord } from '../../types';
import { CORE_METRIC_KEYS, METRIC_LABELS } from '../../lib/contextBaseline';
import {
  findBackToBackGamePairs,
  findAllSeasonBackToBackPairs,
  calculatePlayerMetricThreshold,
  evaluateExposureAgainstThreshold,
} from '../../lib/loadThresholdEngine';
import { DataStore } from '../../lib/dataStore';
import { formatPlayerNumber, formatWholeNumber } from '../../lib/positionalUtils';
import { Calendar, Repeat, Activity, Users, Layers, Zap, ArrowRight, ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface BackToBackSubTabProps {
  player: Player;
  players: Player[];
  records: PlayerSessionRecord[];
  onSelectPlayer?: (id: string) => void;
}

export const BackToBackSubTab: React.FC<BackToBackSubTabProps> = ({
  player,
  players,
  records,
  onSelectPlayer,
}) => {
  const sessions = DataStore.getSessionsMeta();
  const b2bSets = findAllSeasonBackToBackPairs(sessions);
  const allGameRecords = records.filter(
    (r) => r.session_type === 'Game' || (r.session_name || '').toLowerCase().includes('vs')
  );

  const [selectedB2BIndex, setSelectedB2BIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'PLAYER_DEEPDIVE' | 'TEAM_MATRIX' | 'B2B_COMPARE'>('TEAM_MATRIX');
  const [activeMetric, setActiveMetric] = useState<keyof CoreMetrics>('distance_m');
  const [compareB2BIndex2, setCompareB2BIndex2] = useState<number>(b2bSets.length > 1 ? 1 : 0);

  const selectedB2BSet = b2bSets[selectedB2BIndex] || b2bSets[0];
  const playerB2BPairs = findBackToBackGamePairs(records, player.id);

  // Helper to extract player record for a specific date
  const getRecordForPlayerAndDate = (pId: string, dateStr: string) => {
    return allGameRecords.find((r) => r.player_id === pId && r.date === dateStr) || null;
  };

  return (
    <div className="space-y-6 text-zinc-100">
      {/* Header Context & Selector Controls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <Repeat className="w-5 h-5 text-orange-400" />
              <span className="text-xs font-black uppercase text-orange-400 tracking-wider">
                SEASON BACK-TO-BACK GAME EXPOSURE MONITOR
              </span>
              <span className="text-[10px] bg-orange-950 text-orange-400 font-extrabold px-2 py-0.5 rounded border border-orange-800">
                AUTOMATICALLY DETECTED
              </span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1">Back-to-Back Workload & Response Engine</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Analyze mechanical load drop-offs, minute allocations, and RPE response when competing on consecutive days.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-800 text-right">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block font-sans">Detected B2B Sets</span>
              <span className="text-lg font-black text-orange-400">{b2bSets.length} Weekends</span>
            </div>
          </div>
        </div>

        {/* B2B Set Selector & View Mode Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* B2B Weekend Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-zinc-400 uppercase">Select B2B Set:</span>
            {b2bSets.length === 0 ? (
              <span className="text-xs font-bold text-zinc-500 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800">
                No Consecutive Games Logged Yet
              </span>
            ) : (
              <select
                value={selectedB2BIndex}
                onChange={(e) => setSelectedB2BIndex(parseInt(e.target.value))}
                className="bg-zinc-950 border border-orange-500/80 rounded-xl px-4 py-2 font-bold text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {b2bSets.map((b2b, idx) => (
                  <option key={b2b.id} value={idx}>
                    {b2b.title} ({b2b.session1Name} vs {b2b.session2Name})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* View Mode Buttons */}
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-bold">
            <button
              onClick={() => setViewMode('TEAM_MATRIX')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'TEAM_MATRIX'
                  ? 'bg-orange-600 text-zinc-950 font-black shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Team Roster Matrix (Game 1 vs Game 2)
            </button>
            <button
              onClick={() => setViewMode('PLAYER_DEEPDIVE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'PLAYER_DEEPDIVE'
                  ? 'bg-orange-600 text-zinc-950 font-black shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Player Deep-Dive
            </button>
            {b2bSets.length >= 2 && (
              <button
                onClick={() => setViewMode('B2B_COMPARE')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'B2B_COMPARE'
                    ? 'bg-orange-600 text-zinc-950 font-black shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Compare Weekend #1 vs Weekend #2
              </button>
            )}
          </div>
        </div>
      </div>

      {b2bSets.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 space-y-3">
          <Calendar className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-zinc-300">No Back-to-Back Game Sets Detected</h3>
          <p className="text-xs max-w-md mx-auto text-zinc-400">
            No consecutive games (played within 24–48 hours) were identified in the current game database. When new consecutive games are imported, they will automatically appear here.
          </p>
        </div>
      ) : (
        <>
          {/* VIEW MODE 1: TEAM ROSTER MATRIX FOR SELECTED B2B SET */}
          {viewMode === 'TEAM_MATRIX' && selectedB2BSet && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black text-orange-400 uppercase tracking-wider">
                      {selectedB2BSet.title}
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-white mt-0.5">
                    Team Workload & Response Matrix
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Game 1 ({selectedB2BSet.date1}: {selectedB2BSet.session1Name}) vs Game 2 ({selectedB2BSet.date2}: {selectedB2BSet.session2Name})
                  </p>
                </div>

                {/* Metric Selector for Table Focus */}
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-zinc-400 font-bold uppercase text-[10px]">Primary Metric:</span>
                  <select
                    value={activeMetric}
                    onChange={(e) => setActiveMetric(e.target.value as keyof CoreMetrics)}
                    className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 font-bold text-white text-xs"
                  >
                    {CORE_METRIC_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {METRIC_LABELS[k].label} ({METRIC_LABELS[k].unit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="bg-zinc-950 text-[10px] uppercase text-zinc-400 border-b border-zinc-800">
                      <th className="p-3 font-sans">Athlete</th>
                      <th className="p-3 text-center">Game 1 Mins</th>
                      <th className="p-3 text-center">Game 2 Mins</th>
                      <th className="p-3 text-right">Game 1 {METRIC_LABELS[activeMetric].shortLabel}</th>
                      <th className="p-3 text-right">Game 2 {METRIC_LABELS[activeMetric].shortLabel}</th>
                      <th className="p-3 text-center">Difference</th>
                      <th className="p-3 text-center">% Change</th>
                      <th className="p-3 text-center">Game 1 RPE</th>
                      <th className="p-3 text-center">Game 2 RPE</th>
                      <th className="p-3 text-center font-sans">Threshold Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-medium">
                    {players.map((p) => {
                      const r1 = getRecordForPlayerAndDate(p.id, selectedB2BSet.date1);
                      const r2 = getRecordForPlayerAndDate(p.id, selectedB2BSet.date2);

                      const v1 = r1 ? r1[activeMetric] : null;
                      const v2 = r2 ? r2[activeMetric] : null;

                      const m1 = r1?.game_minutes ?? null;
                      const m2 = r2?.game_minutes ?? null;

                      const rpe1 = r1?.RPE ?? null;
                      const rpe2 = r2?.RPE ?? null;

                      let diff: number | null = null;
                      let pctChange: number | null = null;
                      if (v1 !== null && v2 !== null && typeof v1 === 'number' && typeof v2 === 'number') {
                        diff = Number((v2 - v1).toFixed(1));
                        pctChange = v1 > 0 ? Number((((v2 - v1) / v1) * 100).toFixed(1)) : null;
                      }

                      // Evaluate threshold status for Game 2
                      const threshold = calculatePlayerMetricThreshold(records, p, activeMetric, 'GAME');
                      const exposure = v2 !== null && typeof v2 === 'number' ? evaluateExposureAgainstThreshold(v2, threshold) : null;

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-zinc-800/40 cursor-pointer transition-colors"
                          onClick={() => {
                            if (onSelectPlayer) onSelectPlayer(p.id);
                            setViewMode('PLAYER_DEEPDIVE');
                          }}
                        >
                          <td className="p-3 font-sans font-bold text-white flex items-center space-x-2">
                            <span className="text-orange-400 font-black">{formatPlayerNumber(p.number)}</span>
                            <span>{p.displayName}</span>
                            <span className="text-[10px] text-zinc-500">({p.position})</span>
                          </td>

                          <td className="p-3 text-center text-amber-400 font-bold">
                            {m1 !== null ? `${m1} min` : '-'}
                          </td>
                          <td className="p-3 text-center text-amber-400 font-bold">
                            {m2 !== null ? `${m2} min` : '-'}
                          </td>

                          <td className="p-3 text-right font-bold text-zinc-200">
                            {v1 !== null && typeof v1 === 'number' ? formatWholeNumber(v1) : '-'}
                          </td>
                          <td className="p-3 text-right font-bold text-zinc-200">
                            {v2 !== null && typeof v2 === 'number' ? formatWholeNumber(v2) : '-'}
                          </td>

                          <td className="p-3 text-center font-bold">
                            {diff !== null ? (
                              <span className={diff < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>

                          <td className="p-3 text-center font-black">
                            {pctChange !== null ? (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] ${
                                  pctChange < -15
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                    : pctChange > 15
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : 'bg-zinc-950 text-zinc-300'
                                }`}
                              >
                                {pctChange > 0 ? `+${pctChange}%` : `${pctChange}%`}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>

                          <td className="p-3 text-center text-purple-400 font-bold">
                            {rpe1 !== null ? `${rpe1}` : '-'}
                          </td>
                          <td className="p-3 text-center text-purple-400 font-bold">
                            {rpe2 !== null ? `${rpe2}` : '-'}
                          </td>

                          <td className="p-3 text-center font-sans">
                            {exposure ? (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${exposure.statusBadgeClasses}`}>
                                {exposure.statusLabel}
                              </span>
                            ) : (
                              <span className="text-zinc-500 text-[10px]">N/A</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: SINGLE PLAYER DEEP DIVE */}
          {viewMode === 'PLAYER_DEEPDIVE' && (
            <div className="space-y-6">
              {/* Player Header Card */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-orange-600/20 border border-orange-500/40 text-orange-400 font-black text-xl flex items-center justify-center shrink-0">
                    {formatPlayerNumber(player.number)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-xl font-black text-white">{player.displayName}</h2>
                      <span className="text-xs font-bold text-orange-400 bg-orange-950 px-2 py-0.5 rounded border border-orange-800">
                        {player.position}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Individual Back-to-Back Workload Trajectory across {playerB2BPairs.length} logged B2B sets
                    </div>
                  </div>
                </div>

                {/* Player Selector Dropdown */}
                <select
                  value={player.id}
                  onChange={(e) => {
                    if (onSelectPlayer) onSelectPlayer(e.target.value);
                  }}
                  className="bg-zinc-950 border border-zinc-700 text-white font-bold text-xs rounded-xl px-4 py-2"
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatPlayerNumber(p.number)} {p.displayName} ({p.position})
                    </option>
                  ))}
                </select>
              </div>

              {/* Display Pairs for Player */}
              {playerB2BPairs.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                  No back-to-back game observations found for {player.displayName}.
                </div>
              ) : (
                playerB2BPairs.map((pair, idx) => (
                  <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                      <div className="flex items-center space-x-3">
                        <div className="px-3 py-1 bg-orange-950 border border-orange-800 text-orange-400 font-mono text-xs font-black rounded-xl">
                          B2B Set #{idx + 1}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white">
                            {pair.date1} vs {pair.date2}
                          </span>
                          <div className="text-[10px] text-zinc-400">
                            Game 1: {pair.opponent1 || 'N/A'} ({pair.minutes1 ?? 'N/A'} mins) | Game 2: {pair.opponent2 || 'N/A'} ({pair.minutes2 ?? 'N/A'} mins)
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 text-xs font-mono">
                        <div className="bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] uppercase block font-sans">Game 1 RPE</span>
                          <span className="font-bold text-purple-400">{pair.rpe1 ?? 'N/A'}</span>
                        </div>
                        <div className="bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] uppercase block font-sans">Game 2 RPE</span>
                          <span className="font-bold text-purple-400">{pair.rpe2 ?? 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Table of 8 External Load Metrics for this Pair */}
                    <div className="overflow-x-auto rounded-xl border border-zinc-800">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="bg-zinc-950 text-[10px] uppercase text-zinc-400 border-b border-zinc-800">
                            <th className="p-3 font-sans">Metric</th>
                            <th className="p-3 text-center">Game 1 Load</th>
                            <th className="p-3 text-center">Game 2 Load</th>
                            <th className="p-3 text-center">Difference</th>
                            <th className="p-3 text-center">% Change</th>
                            <th className="p-3 text-center font-bold text-orange-400">2-Game Combined Load</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 font-medium">
                          {pair.metricComparisons.map((m) => {
                            const meta = METRIC_LABELS[m.metric];
                            return (
                              <tr key={m.metric} className="hover:bg-zinc-800/30">
                                <td className="p-3 font-sans font-bold text-white">
                                  {meta.label} <span className="text-[10px] text-zinc-500 font-mono font-normal">({meta.unit})</span>
                                </td>
                                <td className="p-3 text-center text-zinc-300">
                                  {m.game1Val !== null ? Math.round(m.game1Val) : 'N/A'}
                                </td>
                                <td className="p-3 text-center text-zinc-300">
                                  {m.game2Val !== null ? Math.round(m.game2Val) : 'N/A'}
                                </td>
                                <td className="p-3 text-center font-bold">
                                  {m.diff !== null ? (
                                    <span className={m.diff < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                      {m.diff > 0 ? `+${m.diff}` : m.diff}
                                    </span>
                                  ) : (
                                    'N/A'
                                  )}
                                </td>
                                <td className="p-3 text-center font-black">
                                  {m.pctDiff !== null ? (
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] ${
                                        m.pctDiff < -10
                                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                          : m.pctDiff > 10
                                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                          : 'bg-zinc-950 text-zinc-300'
                                      }`}
                                    >
                                      {m.pctDiff > 0 ? `+${m.pctDiff}%` : `${m.pctDiff}%`}
                                    </span>
                                  ) : (
                                    'N/A'
                                  )}
                                </td>
                                <td className="p-3 text-center font-black text-amber-400">
                                  {m.cumulative2GameVal !== null ? Math.round(m.cumulative2GameVal) : 'N/A'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* VIEW MODE 3: B2B WEEKEND VS B2B WEEKEND COMPARISON */}
          {viewMode === 'B2B_COMPARE' && b2bSets.length >= 2 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <span className="text-xs font-black text-orange-400 uppercase tracking-wider block">
                    MULTI-WEEKEND COMPARISON
                  </span>
                  <h2 className="text-xl font-black text-white mt-0.5">
                    Compare Back-to-Back Set #1 vs Back-to-Back Set #2
                  </h2>
                </div>

                <div className="flex items-center space-x-3 text-xs font-bold">
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Weekend A:</span>
                    <select
                      value={selectedB2BIndex}
                      onChange={(e) => setSelectedB2BIndex(parseInt(e.target.value))}
                      className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white"
                    >
                      {b2bSets.map((b, i) => (
                        <option key={b.id} value={i}>
                          {b.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-orange-500 font-black mt-4">VS</span>

                  <div>
                    <span className="text-zinc-500 block text-[10px]">Weekend B:</span>
                    <select
                      value={compareB2BIndex2}
                      onChange={(e) => setCompareB2BIndex2(parseInt(e.target.value))}
                      className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white"
                    >
                      {b2bSets.map((b, i) => (
                        <option key={b.id} value={i}>
                          {b.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Side by side summary comparison table across all roster players */}
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="bg-zinc-950 text-[10px] uppercase text-zinc-400 border-b border-zinc-800">
                      <th className="p-3 font-sans">Athlete</th>
                      <th className="p-3 text-center">{b2bSets[selectedB2BIndex]?.title} Drop-Off</th>
                      <th className="p-3 text-center">{b2bSets[compareB2BIndex2]?.title} Drop-Off</th>
                      <th className="p-3 text-center">Response Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {players.map((p) => {
                      const b2b1Set = b2bSets[selectedB2BIndex];
                      const b2b2Set = b2bSets[compareB2BIndex2];

                      const r1a = getRecordForPlayerAndDate(p.id, b2b1Set?.date1 || '');
                      const r1b = getRecordForPlayerAndDate(p.id, b2b1Set?.date2 || '');

                      const r2a = getRecordForPlayerAndDate(p.id, b2b2Set?.date1 || '');
                      const r2b = getRecordForPlayerAndDate(p.id, b2b2Set?.date2 || '');

                      const v1a = r1a?.distance_m ?? null;
                      const v1b = r1b?.distance_m ?? null;
                      const v2a = r2a?.distance_m ?? null;
                      const v2b = r2b?.distance_m ?? null;

                      const drop1 = v1a && v1b ? Number((((v1b - v1a) / v1a) * 100).toFixed(1)) : null;
                      const drop2 = v2a && v2b ? Number((((v2b - v2a) / v2a) * 100).toFixed(1)) : null;

                      return (
                        <tr key={p.id} className="hover:bg-zinc-800/30">
                          <td className="p-3 font-sans font-bold text-white flex items-center space-x-2">
                            <span className="text-orange-400">{formatPlayerNumber(p.number)}</span>
                            <span>{p.displayName}</span>
                          </td>

                          <td className="p-3 text-center font-bold">
                            {drop1 !== null ? (
                              <span className={drop1 < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                {drop1 > 0 ? `+${drop1}%` : `${drop1}%`}
                              </span>
                            ) : (
                              'N/A'
                            )}
                          </td>

                          <td className="p-3 text-center font-bold">
                            {drop2 !== null ? (
                              <span className={drop2 < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                {drop2 > 0 ? `+${drop2}%` : `${drop2}%`}
                              </span>
                            ) : (
                              'N/A'
                            )}
                          </td>

                          <td className="p-3 text-center font-sans">
                            {drop1 !== null && drop2 !== null ? (
                              drop2 > drop1 ? (
                                <span className="text-emerald-400 font-bold flex items-center justify-center space-x-1">
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                  <span>Improved Tolerance</span>
                                </span>
                              ) : (
                                <span className="text-amber-400 font-bold flex items-center justify-center space-x-1">
                                  <ArrowDownRight className="w-3.5 h-3.5" />
                                  <span>Greater Drop-Off</span>
                                </span>
                              )
                            ) : (
                              <span className="text-zinc-500 text-[10px]">Insufficient Data</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
