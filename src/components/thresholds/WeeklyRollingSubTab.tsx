import React, { useState, useMemo } from 'react';
import { Player, PlayerSessionRecord } from '../../types';
import { CORE_METRIC_KEYS, METRIC_LABELS } from '../../lib/contextBaseline';
import { calculatePlayerDynamicLoadProfile, RollingWindowDays } from '../../lib/dynamicLoadEngine';
import { calculateWeeklyExposureGaps } from '../../lib/loadThresholdEngine';
import { formatPlayerNumber } from '../../lib/positionalUtils';
import {
  Calendar,
  Activity,
  AlertTriangle,
  Info,
  CheckCircle2,
  TrendingUp,
  Layers,
  Sparkles,
  Sliders,
  Filter,
} from 'lucide-react';

interface WeeklyRollingSubTabProps {
  player: Player;
  records: PlayerSessionRecord[];
}

export const WeeklyRollingSubTab: React.FC<WeeklyRollingSubTabProps> = ({
  player,
  records,
}) => {
  // Sort player records by date
  const playerRecs = useMemo(() => {
    return records
      .filter((r) => r.player_id === player.id)
      .sort((a, b) => b.date.localeCompare(a.date)); // descending
  }, [records, player.id]);

  // Available dates for reference date picker
  const availableDates = useMemo(() => {
    return Array.from(new Set(playerRecs.map((r) => r.date)));
  }, [playerRecs]);

  const [selectedReferenceDate, setSelectedReferenceDate] = useState<string>(
    availableDates[0] || '2026-08-11'
  );

  // Load category filter: COMBINED | PRACTICE | GAME
  const [loadCategory, setLoadCategory] = useState<'COMBINED' | 'PRACTICE' | 'GAME'>('COMBINED');

  // Model formula info expansion
  const [showFormulaDetails, setShowFormulaDetails] = useState<boolean>(false);

  // Compute dynamic acute & chronic load profile
  const dynamicProfile = useMemo(() => {
    return calculatePlayerDynamicLoadProfile(records, player, selectedReferenceDate);
  }, [records, player, selectedReferenceDate]);

  // Weekly gaps from threshold engine
  const weeklyGaps = useMemo(() => {
    return calculateWeeklyExposureGaps(records, player.id, selectedReferenceDate);
  }, [records, player.id, selectedReferenceDate]);

  return (
    <div className="space-y-6 text-zinc-100">
      {/* Top Header Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase text-orange-400 tracking-wider">
                DYNAMIC ACUTE & CHRONIC WORKLOAD ENGINE
              </span>
              <span className="text-[10px] bg-sky-950 text-sky-400 font-extrabold px-2 py-0.5 rounded border border-sky-800">
                EWMA + ROLLING 3, 7, 14, 28-DAY
              </span>
            </div>
            <h2 className="text-2xl font-black text-white mt-1 flex items-center space-x-3">
              <Calendar className="w-6 h-6 text-orange-500" />
              <span>{player.displayName} ({formatPlayerNumber(player.number)})</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-3xl">
              Deterministic player-specific external and internal workload accumulation across rolling 3-, 7-, 14-, and 28-day windows, separating games and practices with coupled/uncoupled EWMA modeling.
            </p>
          </div>

          {/* Reference Date & Session Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
              <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">
                As of Date:
              </label>
              <select
                value={selectedReferenceDate}
                onChange={(e) => setSelectedReferenceDate(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 text-white font-bold text-xs rounded-lg px-3 py-1.5 outline-none focus:border-orange-500"
              >
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Load Category Toggle */}
            <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
              <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">
                Exposure Category:
              </label>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setLoadCategory('COMBINED')}
                  className={`px-2.5 py-1 rounded text-xs font-extrabold transition-all ${
                    loadCategory === 'COMBINED'
                      ? 'bg-orange-600 text-zinc-950 shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Combined
                </button>
                <button
                  onClick={() => setLoadCategory('PRACTICE')}
                  className={`px-2.5 py-1 rounded text-xs font-extrabold transition-all ${
                    loadCategory === 'PRACTICE'
                      ? 'bg-orange-500 text-zinc-950 shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Practice
                </button>
                <button
                  onClick={() => setLoadCategory('GAME')}
                  className={`px-2.5 py-1 rounded text-xs font-extrabold transition-all ${
                    loadCategory === 'GAME'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Game
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Monitoring Completeness & Incomplete Monitoring Accounting */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                28-Day Monitored Sessions
              </span>
              <span className="text-lg font-black text-white">
                {dynamicProfile.completeness.monitoredSessionsCount} Sessions
              </span>
            </div>
            <span className="text-xs bg-zinc-900 text-zinc-300 font-mono font-bold px-2.5 py-1 rounded border border-zinc-800">
              {dynamicProfile.completeness.coveragePct}% Coverage
            </span>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                Internal Load (7-Day sRPE-TL)
              </span>
              <span className="text-lg font-black text-amber-400">
                {dynamicProfile.internalLoad.sRPE7d.toLocaleString()} AU
              </span>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              28d: {dynamicProfile.internalLoad.sRPE28d.toLocaleString()} AU
            </span>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                Internal sRPE ACWR
              </span>
              <span className="text-lg font-black text-purple-400">
                {dynamicProfile.internalLoad.sRPE_ACWR !== null ? dynamicProfile.internalLoad.sRPE_ACWR : 'N/A'}
              </span>
            </div>
            <span className="text-xs text-zinc-400">
              Avg RPE: {dynamicProfile.internalLoad.avgRecentRPE ? `${dynamicProfile.internalLoad.avgRecentRPE}/10` : '-'}
            </span>
          </div>
        </div>

        {/* Missing Session Alert if incomplete */}
        {dynamicProfile.completeness.incompleteNotice && (
          <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl flex items-center space-x-2 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{dynamicProfile.completeness.incompleteNotice}</span>
          </div>
        )}
      </div>

      {/* Scientific Guidance & ACWR Descriptive Disclaimer Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-300 flex items-start space-x-3">
        <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-black text-white uppercase tracking-wider block text-[11px]">
            SCIENTIFIC MONITORING GOVERNANCE & STATISTICAL PARAMETERS
          </span>
          <p className="text-zinc-400 leading-relaxed">
            {dynamicProfile.scientificDisclaimer}
          </p>
          <button
            onClick={() => setShowFormulaDetails(!showFormulaDetails)}
            className="text-[11px] font-bold text-orange-400 hover:text-orange-300 underline pt-1 block"
          >
            {showFormulaDetails ? 'Hide Mathematical Formulas' : 'View EWMA (λ) & Rolling Window Formulation'}
          </button>
        </div>
      </div>

      {/* Expandable Mathematical Formulas & Parameters Callout */}
      {showFormulaDetails && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-xs text-zinc-300 space-y-3 font-mono">
          <div className="font-sans font-black text-white text-sm uppercase">
            Mathematical Equations & Modeling Specifications
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800 space-y-1">
              <div className="text-orange-400 font-bold font-sans">
                1. Exponentially Weighted Moving Average (EWMA)
              </div>
              <p className="text-[11px] text-zinc-400">
                EWMA_t = λ × Load_t + (1 - λ) × EWMA_(t-1)
              </p>
              <p className="text-[11px] text-zinc-400">
                Decay factor λ = 2 / (N + 1)
              </p>
              <p className="text-[11px] text-zinc-500">
                • Acute (N = 7): λ = 2 / 8 = 0.250<br />
                • Chronic (N = 28): λ = 2 / 29 ≈ 0.069<br />
                • Natural decay (0 load) applied on unmonitored rest days.
              </p>
            </div>

            <div className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800 space-y-1">
              <div className="text-orange-400 font-bold font-sans">
                2. Rolling Average ACWR & Individual Deviations
              </div>
              <p className="text-[11px] text-zinc-400">
                ACWR_RA = Acute_7d_Daily_Mean / Chronic_28d_Daily_Mean
              </p>
              <p className="text-[11px] text-zinc-400">
                Individual Z-Score = (Acute_Daily_Mean - μ_chronic) / σ_chronic
              </p>
              <p className="text-[11px] text-zinc-500">
                • Separates practice and game contributions.<br />
                • sRPE-TL = RPE (CR10) × Session Duration (minutes).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Acute:Chronic & EWMA Workload Matrix Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-black uppercase text-white tracking-wider">
              ACUTE & CHRONIC EXTERNAL LOAD ACCUMULATION ({loadCategory})
            </span>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Across all 8 core tracking metrics showing 3d, 7d, 14d, 28d windows, EWMA, and descriptive ACWR.
            </p>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">
            Reference Date: {selectedReferenceDate}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="bg-zinc-950 text-[10px] font-black uppercase text-zinc-400 border-b border-zinc-800">
                <th className="p-3.5 font-sans">Metric</th>
                <th className="p-3.5 text-right">3-Day Sum</th>
                <th className="p-3.5 text-right text-orange-400">7-Day Acute</th>
                <th className="p-3.5 text-right">14-Day Sum</th>
                <th className="p-3.5 text-right text-sky-400">28-Day Chronic</th>
                <th className="p-3.5 text-right text-purple-300">EWMA Acute</th>
                <th className="p-3.5 text-right text-purple-300">EWMA Chronic</th>
                <th className="p-3.5 text-center text-amber-400">EWMA ACWR</th>
                <th className="p-3.5 text-center">Z-Score</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/50">
              {CORE_METRIC_KEYS.map((m) => {
                const s = dynamicProfile.metrics[m];
                const meta = METRIC_LABELS[m];

                // Value helper based on selected category
                const getVal = (w: typeof s.days3) => {
                  if (loadCategory === 'PRACTICE') return w.practiceSum;
                  if (loadCategory === 'GAME') return w.gameSum;
                  return w.combinedSum;
                };

                const val3 = getVal(s.days3);
                const val7 = getVal(s.days7);
                const val14 = getVal(s.days14);
                const val28 = getVal(s.days28);

                return (
                  <tr key={m} className="hover:bg-zinc-950 transition-colors">
                    <td className="p-3.5 font-sans font-bold text-white flex items-center space-x-1.5">
                      <span>{meta.shortLabel}</span>
                      <span className="text-[10px] text-zinc-500 font-normal">({meta.unit})</span>
                    </td>

                    <td className="p-3.5 text-right text-zinc-300">
                      {val3.toLocaleString()}
                    </td>

                    <td className="p-3.5 text-right font-black text-orange-400">
                      {val7.toLocaleString()}
                    </td>

                    <td className="p-3.5 text-right text-zinc-300">
                      {val14.toLocaleString()}
                    </td>

                    <td className="p-3.5 text-right font-bold text-sky-400">
                      {val28.toLocaleString()}
                    </td>

                    <td className="p-3.5 text-right font-mono text-purple-300">
                      {s.ewmaAcute !== null ? s.ewmaAcute.toLocaleString() : '-'}
                    </td>

                    <td className="p-3.5 text-right font-mono text-purple-300">
                      {s.ewmaChronic !== null ? s.ewmaChronic.toLocaleString() : '-'}
                    </td>

                    <td className="p-3.5 text-center font-black text-amber-400">
                      {s.ewmaACWR !== null ? s.ewmaACWR : s.rollingAverageACWR ?? '-'}
                    </td>

                    <td className="p-3.5 text-center text-zinc-400 text-[11px]">
                      {s.zScoreToChronic !== null ? `${s.zScoreToChronic >= 0 ? '+' : ''}${s.zScoreToChronic}` : '-'}
                    </td>

                    <td className="p-3.5 text-center">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                          s.acwrStatus === 'HIGH'
                            ? 'text-rose-300 bg-rose-950/80 border-rose-800'
                            : s.acwrStatus === 'ELEVATED'
                            ? 'text-amber-300 bg-amber-950/80 border-amber-800'
                            : s.acwrStatus === 'UNDER_TYPICAL'
                            ? 'text-blue-300 bg-blue-950/80 border-blue-800'
                            : 'text-emerald-300 bg-emerald-950/80 border-emerald-800'
                        }`}
                      >
                        {s.acwrStatus === 'HIGH'
                          ? 'HIGH'
                          : s.acwrStatus === 'ELEVATED'
                          ? 'ELEVATED'
                          : s.acwrStatus === 'UNDER_TYPICAL'
                          ? 'UNDER'
                          : 'BALANCED'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weekly Exposure Gaps & Loading Signals Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center space-x-2">
          <Activity className="w-4 h-4 text-orange-400" />
          <span>Weekly Exposure Gap Guidance vs Typical 7-Day Target</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {weeklyGaps.map((gap) => {
            const meta = METRIC_LABELS[gap.metric];
            const isUnderloaded = gap.gapPct !== null && gap.gapPct <= -15;
            const isOverloaded = gap.gapPct !== null && gap.gapPct >= 25;

            return (
              <div
                key={gap.metric}
                className={`p-4 rounded-2xl border text-xs space-y-2 ${
                  isUnderloaded
                    ? 'bg-blue-950/40 border-blue-800/80 text-blue-200'
                    : isOverloaded
                    ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                }`}
              >
                <div className="flex justify-between items-center font-bold">
                  <span className="text-white text-sm">{meta.label}</span>
                  <span className="font-mono text-orange-400">
                    7-Day Total: {Math.round(gap.currentWeeklyLoad)} {meta.unit}
                  </span>
                </div>

                <div className="flex justify-between text-[11px] font-mono">
                  <span>Typical Weekly Benchmark:</span>
                  <span className="font-bold">
                    {gap.typicalWeeklyLoad !== null ? `${Math.round(gap.typicalWeeklyLoad)} ${meta.unit}` : 'N/A'}
                  </span>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 font-bold flex justify-between items-center">
                  <span className="text-[10px] uppercase">{gap.statusText}</span>
                  <span className="text-[11px]">{gap.guidanceText}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
