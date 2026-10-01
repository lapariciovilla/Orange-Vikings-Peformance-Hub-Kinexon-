import React, { useState, useMemo } from 'react';
import { Player, CoreMetrics, PlayerSessionRecord } from '../../types';
import { CORE_METRIC_KEYS, METRIC_LABELS, isGameSession } from '../../lib/contextBaseline';
import { calculateAllPlayerThresholds, evaluateExposureAgainstThreshold, findBackToBackGamePairs } from '../../lib/loadThresholdEngine';
import { formatPlayerNumber } from '../../lib/positionalUtils';
import { WhyModal } from './WhyModal';
import { HelpCircle, Calendar, Repeat, ShieldAlert } from 'lucide-react';

interface MonitorSubTabProps {
  player: Player;
  records: PlayerSessionRecord[];
  targetContext: 'GAME' | 'PRACTICE' | 'POST_B2B_PRACTICE';
}

export const MonitorSubTab: React.FC<MonitorSubTabProps> = ({
  player,
  records,
  targetContext,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<keyof CoreMetrics | null>(null);

  // Filter player sessions for this target context
  const contextRecs = useMemo(() => {
    return records
      .filter((r) => {
        if (r.player_id !== player.id) return false;
        const isG = isGameSession(r.session_type, r.session_name);
        return targetContext === 'GAME' ? isG : !isG;
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Chronologically latest first
  }, [records, player.id, targetContext]);

  const trueLatestRecord = contextRecs[0] || null;

  // Manual Session Picker State
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>('');

  const activeRecord = useMemo(() => {
    if (!selectedSessionDate) return trueLatestRecord;
    return contextRecs.find((r) => r.date === selectedSessionDate) || trueLatestRecord;
  }, [contextRecs, selectedSessionDate, trueLatestRecord]);

  // Practice & Game thresholds remain strictly separate
  const thresholdContext = targetContext === 'GAME' ? 'GAME' : 'PRACTICE';
  const thresholds = calculateAllPlayerThresholds(records, player, thresholdContext);

  // Preceding Back-to-Back weekend context for POST_B2B_PRACTICE
  const b2bPairs = useMemo(() => {
    return findBackToBackGamePairs(records, player.id);
  }, [records, player.id]);

  const latestB2B = b2bPairs[b2bPairs.length - 1] || null;

  return (
    <div className="space-y-6">
      {/* Overview Context Header & Session Selector */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black uppercase text-orange-400 tracking-wider">
              INDIVIDUAL LOAD EXPOSURE MONITOR
            </span>
            <span className="text-[10px] bg-orange-950/80 text-orange-400 font-bold px-2 py-0.5 rounded border border-orange-800">
              {targetContext.replace('_', ' ')} CONTEXT
            </span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">
            {player.displayName} ({formatPlayerNumber(player.number)})
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time session exposure tracking relative to individual P50, P90, and P95 thresholds.
          </p>
        </div>

        {/* Session Calendar / Date Selector */}
        <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex items-center space-x-3">
          <Calendar className="w-4 h-4 text-orange-400 shrink-0" />
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase block font-sans">
              Selected Session Date:
            </span>
            <select
              value={activeRecord?.date || ''}
              onChange={(e) => setSelectedSessionDate(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-orange-400 outline-none cursor-pointer"
            >
              {contextRecs.map((r, idx) => (
                <option key={r.session_id} value={r.date} className="bg-zinc-900 text-white">
                  {r.date} — {r.session_name} {idx === 0 ? '(True Latest)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Post Back-to-Back Context Card */}
      {targetContext === 'POST_B2B_PRACTICE' && (
        <div className="bg-gradient-to-r from-amber-950/90 via-zinc-900 to-zinc-900 border-2 border-amber-500/50 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
            <div className="flex items-center space-x-2">
              <Repeat className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider">
                Post Back-to-Back Practice Exposure
              </h3>
            </div>
            <span className="text-xs font-bold bg-amber-500 text-zinc-950 px-2.5 py-0.5 rounded-full">
              POST B2B RECOVERY
            </span>
          </div>

          {latestB2B ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-bold uppercase block">Game 1</span>
                <span className="font-bold text-white block mt-0.5">{latestB2B.date1} ({latestB2B.opponent1})</span>
                <span className="text-[11px] text-amber-400 font-mono block mt-1">Min: {latestB2B.minutes1 ?? 'N/A'} | RPE: {latestB2B.rpe1 ?? 'N/A'}/10</span>
              </div>
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-bold uppercase block">Game 2</span>
                <span className="font-bold text-white block mt-0.5">{latestB2B.date2} ({latestB2B.opponent2})</span>
                <span className="text-[11px] text-amber-400 font-mono block mt-1">Min: {latestB2B.minutes2 ?? 'N/A'} | RPE: {latestB2B.rpe2 ?? 'N/A'}/10</span>
              </div>
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-bold uppercase block">Weekend Total Load</span>
                <span className="font-bold text-orange-400 font-mono block mt-0.5">{(latestB2B.minutes1 || 0) + (latestB2B.minutes2 || 0)} Total Game Minutes</span>
                <span className="text-[10px] text-zinc-400 block mt-1">Recovery Off-Day Context: Mon Off → Tue/Wed Practice</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-200/80 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              Evaluating practice exposure relative to player's individual historical baseline.
            </div>
          )}
        </div>
      )}

      {/* Main Exposure Monitor Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950 text-[10px] font-black uppercase text-zinc-400 border-b border-zinc-800 tracking-wider">
                <th className="p-4">Metric</th>
                <th className="p-4">Typical (P50)</th>
                <th className="p-4">High (P90)</th>
                <th className="p-4">Very High (P95)</th>
                <th className="p-4 font-mono text-right">Current Value</th>
                <th className="p-4 text-center">% of High Target</th>
                <th className="p-4 text-center">Visual Exposure Bar</th>
                <th className="p-4 text-center">Z-Score / Percentile</th>
                <th className="p-4 text-center">Sample (n)</th>
                <th className="p-4 text-center">Why?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-xs font-mono">
              {CORE_METRIC_KEYS.map((metricKey) => {
                const t = thresholds[metricKey];
                const meta = METRIC_LABELS[metricKey];
                const currentVal = activeRecord ? activeRecord[metricKey] : null;
                const evalResult = currentVal !== null ? evaluateExposureAgainstThreshold(currentVal, t) : null;

                const highThresh = t.highThreshold;
                const pctOfHigh = evalResult?.pctOfHighThreshold ?? null;

                return (
                  <tr key={metricKey} className="hover:bg-zinc-800/40 transition-colors">
                    {/* Metric Name */}
                    <td className="p-4 font-sans font-bold text-white">
                      <div>{meta.label}</div>
                      <div className="text-[10px] text-zinc-500 font-mono font-normal">{meta.unit}</div>
                    </td>

                    {/* Typical P50 */}
                    <td className="p-4 text-amber-400 font-bold">
                      {t.typicalTarget !== null ? Math.round(t.typicalTarget) : 'N/A'}
                    </td>

                    {/* High P90 */}
                    <td className="p-4 text-purple-300 font-extrabold">
                      {t.highThreshold !== null ? Math.round(t.highThreshold) : 'N/A'}
                    </td>

                    {/* Very High P95 */}
                    <td className="p-4 text-rose-300 font-black">
                      {t.veryHighThreshold !== null ? Math.round(t.veryHighThreshold) : 'N/A'}
                    </td>

                    {/* Current Value */}
                    <td className="p-4 text-right font-black text-sm text-white">
                      {currentVal !== null && currentVal !== undefined ? (
                        <span>{Math.round(currentVal)}</span>
                      ) : (
                        <span className="text-zinc-600 font-normal">N/A</span>
                      )}
                    </td>

                    {/* % of High Threshold */}
                    <td className="p-4 text-center">
                      {pctOfHigh !== null ? (
                        <span
                          className={`px-2 py-1 rounded-lg font-black ${
                            pctOfHigh >= 100
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : pctOfHigh >= 85
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-zinc-950 text-zinc-300 border border-zinc-800'
                          }`}
                        >
                          {pctOfHigh}%
                        </span>
                      ) : (
                        <span className="text-zinc-600">N/A</span>
                      )}
                    </td>

                    {/* Visual Exposure Bar */}
                    <td className="p-4 min-w-[160px]">
                      {highThresh && currentVal !== null && currentVal !== undefined ? (
                        <div className="space-y-1">
                          <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 relative">
                            {/* P50 Indicator Line */}
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-amber-500/60 z-10"
                              style={{
                                left: `${Math.min(100, ((t.typicalTarget ?? 0) / (highThresh * 1.15)) * 100)}%`,
                              }}
                              title="P50 Typical Threshold"
                            />
                            {/* P90 Indicator Line */}
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-purple-500/80 z-10"
                              style={{
                                left: `${Math.min(100, (highThresh / (highThresh * 1.15)) * 100)}%`,
                              }}
                              title="P90 High Threshold"
                            />
                            {/* Current Exposure Bar */}
                            <div
                              className={`h-full transition-all duration-300 ${
                                evalResult?.status === 'VERY_HIGH_HISTORICAL'
                                  ? 'bg-rose-500'
                                  : evalResult?.status === 'HIGH_EXPOSURE'
                                  ? 'bg-purple-500'
                                  : evalResult?.status === 'ABOVE_TYPICAL'
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-500'
                              }`}
                              style={{
                                width: `${Math.min(100, Math.max(4, (currentVal / (highThresh * 1.15)) * 100))}%`,
                              }}
                            />
                          </div>
                          <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                            <span>0</span>
                            <span className="text-amber-500 font-bold">P50</span>
                            <span className="text-purple-400 font-bold">P90</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-zinc-600 italic text-center">No Data</div>
                      )}
                    </td>

                    {/* Z-Score / Percentile */}
                    <td className="p-4 text-center">
                      {evalResult && evalResult.zScore !== null ? (
                        <div>
                          <div className="font-bold text-zinc-200">z: {evalResult.zScore > 0 ? `+${evalResult.zScore}` : evalResult.zScore}</div>
                          <div className="text-[10px] text-zinc-500">
                            {evalResult.percentileRank !== null ? `${evalResult.percentileRank}th %ile` : 'N/A'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-600">N/A</span>
                      )}
                    </td>

                    {/* Sample Size n & Ref */}
                    <td className="p-4 text-center font-sans">
                      <div className="font-bold text-orange-400">n={t.n}</div>
                      <div className="text-[9px] text-zinc-500 truncate max-w-[90px]">{t.referenceType}</div>
                    </td>

                    {/* Why Transparency Button */}
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedMetric(metricKey)}
                        className="p-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-orange-400 border border-zinc-800 rounded-lg transition-all"
                        title="Why? View complete transparency calculations"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transparency Modal */}
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
