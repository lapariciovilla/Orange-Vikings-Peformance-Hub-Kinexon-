import React, { useState } from 'react';
import { Player, CoreMetrics, PlayerSessionRecord } from '../../types';
import { CORE_METRIC_KEYS, METRIC_LABELS } from '../../lib/contextBaseline';
import { calculateAllPlayerThresholds, evaluateExposureAgainstThreshold } from '../../lib/loadThresholdEngine';
import { WhyModal } from './WhyModal';
import { Search, Filter, HelpCircle, ShieldAlert, Activity } from 'lucide-react';

interface MonitorSubTabProps {
  player: Player;
  records: PlayerSessionRecord[];
  targetContext: 'GAME' | 'PRACTICE';
}

export const MonitorSubTab: React.FC<MonitorSubTabProps> = ({
  player,
  records,
  targetContext,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<keyof CoreMetrics | null>(null);

  const thresholds = calculateAllPlayerThresholds(records, player, targetContext);

  // Filter player sessions
  const contextRecs = records.filter((r) => {
    if (r.player_id !== player.id) return false;
    const isG = r.session_type.toUpperCase().includes('GAME') || r.session_name.toUpperCase().includes('GAME') || r.session_type.toUpperCase().includes('VS');
    return targetContext === 'GAME' ? isG : !isG;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const latestRecord = contextRecs[0] || null;

  return (
    <div className="space-y-6">
      {/* Overview Context Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black uppercase text-orange-400 tracking-wider">
              INDIVIDUAL LOAD EXPOSURE MONITOR
            </span>
            <span className="text-[10px] bg-orange-950/80 text-orange-400 font-bold px-2 py-0.5 rounded border border-orange-800">
              {targetContext} CONTEXT
            </span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">{player.displayName} (#{player.number})</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time session exposure tracking relative to individual P50, P90, and P95 thresholds.
          </p>
        </div>

        {latestRecord && (
          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 text-right font-mono">
            <span className="text-[10px] font-bold text-zinc-500 uppercase block font-sans">Active Game Session</span>
            <span className="text-xs font-bold text-orange-400">{latestRecord.date}</span>
            <span className="text-xs text-zinc-300 block font-sans truncate max-w-[220px]">{latestRecord.session_name}</span>
          </div>
        )}
      </div>

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
                const currentVal = latestRecord ? latestRecord[metricKey] : null;
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
          currentValue={latestRecord ? latestRecord[selectedMetric] : null}
        />
      )}
    </div>
  );
};
