import React, { useState, useMemo } from 'react';
import { Player, CoreMetrics, PlayerSessionRecord } from '../../types';
import { CORE_METRIC_KEYS, METRIC_LABELS, isGameSession } from '../../lib/contextBaseline';
import { calculateAllPlayerThresholds, evaluateExposureAgainstThreshold, findBackToBackGamePairs } from '../../lib/loadThresholdEngine';
import { formatPlayerNumber } from '../../lib/positionalUtils';
import { WhyModal } from './WhyModal';
import { HelpCircle, Calendar, ArrowRightLeft, Repeat, ShieldCheck } from 'lucide-react';

interface TargetCardSubTabProps {
  player: Player;
  records: PlayerSessionRecord[];
  targetContext: 'GAME' | 'PRACTICE' | 'POST_B2B_PRACTICE';
}

export const TargetCardSubTab: React.FC<TargetCardSubTabProps> = ({
  player,
  records,
  targetContext,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<keyof CoreMetrics | null>(null);

  // Filter records for this player & context strictly
  const contextRecs = useMemo(() => {
    return records
      .filter((r) => {
        if (r.player_id !== player.id) return false;
        const isG = isGameSession(r.session_type, r.session_name);
        return targetContext === 'GAME' ? isG : !isG;
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Chronologically latest first
  }, [records, player.id, targetContext]);

  // True latest session from database
  const trueLatestRecord = contextRecs[0] || null;

  // Manual Session Selection & Comparison state
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>('');
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [comparisonSessionDate, setComparisonSessionDate] = useState<string>('');

  // Active primary record (defaults to true latest record)
  const activeRecord = useMemo(() => {
    if (!selectedSessionDate) return trueLatestRecord;
    return contextRecs.find((r) => r.date === selectedSessionDate) || trueLatestRecord;
  }, [contextRecs, selectedSessionDate, trueLatestRecord]);

  // Active comparison record
  const comparisonRecord = useMemo(() => {
    if (!isCompareMode) return null;
    if (!comparisonSessionDate) {
      // Default comparison to second latest record
      return contextRecs.find((r) => r.date !== activeRecord?.date) || null;
    }
    return contextRecs.find((r) => r.date === comparisonSessionDate) || null;
  }, [contextRecs, isCompareMode, comparisonSessionDate, activeRecord]);

  // Practice vs Game thresholds remain strictly separate
  const thresholdContext = targetContext === 'GAME' ? 'GAME' : 'PRACTICE';
  const thresholds = calculateAllPlayerThresholds(records, player, thresholdContext);

  // Preceding Back-to-Back weekend context for POST_B2B_PRACTICE
  const b2bPairs = useMemo(() => {
    return findBackToBackGamePairs(records, player.id);
  }, [records, player.id]);

  const latestB2B = b2bPairs[b2bPairs.length - 1] || null;

  return (
    <div className="space-y-6">
      {/* Header Context & Session Selection Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black uppercase text-orange-400 tracking-wider">
              INDIVIDUAL TARGET CARDS ({targetContext.replace('_', ' ')})
            </span>
            <span className="text-[10px] bg-orange-950/80 text-orange-400 font-bold px-2 py-0.5 rounded border border-orange-800">
              {player.position}
            </span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">
            {player.displayName} ({formatPlayerNumber(player.number)})
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Deterministic percentile targets calculated exclusively from historical {thresholdContext.toLowerCase()} records.
          </p>
        </div>

        {/* Session Selector & Comparison Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Primary Session Picker */}
          <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800 flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-orange-400 shrink-0" />
            <select
              value={activeRecord?.date || ''}
              onChange={(e) => setSelectedSessionDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
            >
              {contextRecs.map((r, idx) => (
                <option key={r.session_id} value={r.date} className="bg-zinc-900 text-white">
                  {r.date} — {r.session_name} {idx === 0 ? '(Latest Session)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Compare Toggle Button */}
          <button
            onClick={() => {
              setIsCompareMode(!isCompareMode);
              if (!comparisonSessionDate && contextRecs.length > 1) {
                setComparisonSessionDate(contextRecs[1].date);
              }
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all border ${
              isCompareMode
                ? 'bg-orange-600 text-zinc-950 border-orange-500 font-extrabold'
                : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:text-white'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>{isCompareMode ? 'COMPARING SESSIONS' : 'COMPARE SESSIONS'}</span>
          </button>

          {/* Secondary Comparison Session Picker */}
          {isCompareMode && (
            <div className="bg-zinc-950 p-2 rounded-xl border border-orange-800/80 flex items-center space-x-2">
              <span className="text-[10px] font-bold text-orange-400 uppercase">VS</span>
              <select
                value={comparisonRecord?.date || ''}
                onChange={(e) => setComparisonSessionDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-amber-300 outline-none cursor-pointer"
              >
                {contextRecs.map((r) => (
                  <option key={`comp-${r.session_id}`} value={r.date} className="bg-zinc-900 text-white">
                    {r.date} — {r.session_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Post Back-to-Back Practice Context Banner */}
      {targetContext === 'POST_B2B_PRACTICE' && (
        <div className="bg-gradient-to-r from-amber-950/90 via-zinc-900 to-zinc-900 border-2 border-amber-500/50 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
            <div className="flex items-center space-x-2">
              <Repeat className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider">
                Post Back-to-Back Practice Context & Load Exposure Analysis
              </h3>
            </div>
            <span className="text-xs font-bold bg-amber-500 text-zinc-950 px-2.5 py-0.5 rounded-full">
              POST B2B RECOVERY
            </span>
          </div>

          {latestB2B ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-bold block uppercase">Game 1 Context</span>
                <span className="font-bold text-white block mt-0.5">{latestB2B.date1} ({latestB2B.opponent1 || 'Game 1'})</span>
                <div className="text-[11px] text-amber-400 font-mono mt-1">
                  Min: {latestB2B.minutes1 ?? 'N/A'} | RPE: {latestB2B.rpe1 ?? 'N/A'}/10
                </div>
              </div>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-bold block uppercase">Game 2 Context</span>
                <span className="font-bold text-white block mt-0.5">{latestB2B.date2} ({latestB2B.opponent2 || 'Game 2'})</span>
                <div className="text-[11px] text-amber-400 font-mono mt-1">
                  Min: {latestB2B.minutes2 ?? 'N/A'} | RPE: {latestB2B.rpe2 ?? 'N/A'}/10
                </div>
              </div>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-bold block uppercase">Weekend Combined Load</span>
                <span className="font-bold text-orange-400 block mt-0.5 font-mono">
                  {(latestB2B.minutes1 || 0) + (latestB2B.minutes2 || 0)} Game Minutes Played
                </span>
                <div className="text-[10px] text-zinc-400 mt-1">
                  Avg Weekend RPE: {(((latestB2B.rpe1 || 0) + (latestB2B.rpe2 || 0)) / 2).toFixed(1)}/10
                </div>
              </div>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold block uppercase">Coaching Review Note</span>
                  <p className="text-[11px] text-zinc-300 mt-0.5 leading-tight">
                    Evaluates today's practice external load against individual historical practice baselines following a B2B weekend.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-200/80 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              No preceding Back-to-Back weekend pair detected in recent history for this player. Evaluating against individual practice baseline.
            </div>
          )}
        </div>
      )}

      {/* Grid of 8 Metric Target Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {CORE_METRIC_KEYS.map((metricKey) => {
          const t = thresholds[metricKey];
          const meta = METRIC_LABELS[metricKey];
          const currentVal = activeRecord ? activeRecord[metricKey] : null;
          const compVal = comparisonRecord ? comparisonRecord[metricKey] : null;

          const evaluation = currentVal !== null ? evaluateExposureAgainstThreshold(currentVal, t) : null;

          // % Change if comparing two sessions
          let pctDiffBetweenSessions: number | null = null;
          if (currentVal !== null && compVal !== null && compVal > 0) {
            pctDiffBetweenSessions = Number((((currentVal - compVal) / compVal) * 100).toFixed(1));
          }

          return (
            <div
              key={metricKey}
              className="bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 rounded-2xl p-4 transition-all flex flex-col justify-between space-y-4 shadow-lg"
            >
              {/* Card Title & Unit */}
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-black text-white">{meta.label}</h3>
                    <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{meta.unit}</p>
                  </div>
                  <button
                    onClick={() => setSelectedMetric(metricKey)}
                    className="p-1.5 text-zinc-500 hover:text-orange-400 hover:bg-zinc-800 rounded-lg transition-all"
                    title="View why and calculation breakdown"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>

                {/* Target Threshold Pillars */}
                <div className="grid grid-cols-3 gap-1 mt-4 text-center">
                  <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800/60">
                    <span className="text-[9px] font-bold uppercase text-zinc-500 block">Typical (P50)</span>
                    <span className="text-xs font-mono font-black text-amber-400">
                      {t.typicalTarget !== null ? Math.round(t.typicalTarget) : 'N/A'}
                    </span>
                  </div>

                  <div className="bg-zinc-950 p-2 rounded-xl border border-purple-950/80">
                    <span className="text-[9px] font-bold uppercase text-purple-400 block">High (P90)</span>
                    <span className="text-xs font-mono font-black text-purple-300">
                      {t.highThreshold !== null ? Math.round(t.highThreshold) : 'N/A'}
                    </span>
                  </div>

                  <div className="bg-zinc-950 p-2 rounded-xl border border-rose-950/80">
                    <span className="text-[9px] font-bold uppercase text-rose-400 block">Very High (P95)</span>
                    <span className="text-xs font-mono font-black text-rose-300">
                      {t.veryHighThreshold !== null ? Math.round(t.veryHighThreshold) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Session Load Display & Comparison */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-bold uppercase text-[10px]">
                    {activeRecord?.date || 'Selected Session'}:
                  </span>
                  <span className="font-mono font-black text-white">
                    {currentVal !== null && currentVal !== undefined ? `${Math.round(currentVal)} ${meta.unit}` : 'N/A'}
                  </span>
                </div>

                {/* Secondary Comparison Row */}
                {isCompareMode && comparisonRecord && (
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-zinc-800">
                    <span className="text-amber-400 font-bold uppercase text-[10px]">
                      {comparisonRecord.date}:
                    </span>
                    <div className="font-mono font-extrabold text-amber-300 flex items-center space-x-2">
                      <span>{compVal !== null ? `${Math.round(compVal)} ${meta.unit}` : 'N/A'}</span>
                      {pctDiffBetweenSessions !== null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                          pctDiffBetweenSessions > 0 ? 'bg-amber-950 text-amber-400' : 'bg-blue-950 text-blue-400'
                        }`}>
                          {pctDiffBetweenSessions > 0 ? `+${pctDiffBetweenSessions}%` : `${pctDiffBetweenSessions}%`}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Progress Gauge */}
                {evaluation && t.highThreshold && t.highThreshold > 0 ? (
                  <div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-500 ${
                          evaluation.status === 'VERY_HIGH_HISTORICAL'
                            ? 'bg-rose-500'
                            : evaluation.status === 'HIGH_EXPOSURE'
                            ? 'bg-purple-500'
                            : evaluation.status === 'ABOVE_TYPICAL'
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(5, (currentVal! / (t.highThreshold * 1.15)) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-zinc-500 mt-1">
                      <span>0</span>
                      <span className="text-zinc-300 font-bold">{evaluation.statusLabel}</span>
                      <span>P90 ({Math.round(t.highThreshold)})</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-zinc-500 italic text-center py-1">
                    No active session observed
                  </div>
                )}
              </div>

              {/* Metadata Footer */}
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60">
                <span>Ref: <strong className="text-zinc-300">{t.referenceType}</strong></span>
                <span>n = <strong className="text-orange-400">{t.n}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Why Transparency Modal */}
      {selectedMetric && (
        <WhyModal
          isOpen={!!selectedMetric}
          onClose={() => setSelectedMetric(null)}
          player={player}
          metricKey={selectedMetric}
          threshold={thresholds[selectedMetric]}
          currentValue={activeRecord ? activeRecord[selectedMetric] : null}
        />
      )}
    </div>
  );
};
