import React, { useState } from 'react';
import { Player, CoreMetrics, PlayerSessionRecord } from '../../types';
import { CORE_METRIC_KEYS, METRIC_LABELS } from '../../lib/contextBaseline';
import { calculateAllPlayerThresholds, evaluateExposureAgainstThreshold } from '../../lib/loadThresholdEngine';
import { WhyModal } from './WhyModal';
import { Info, HelpCircle } from 'lucide-react';

interface TargetCardSubTabProps {
  player: Player;
  records: PlayerSessionRecord[];
  targetContext: 'GAME' | 'PRACTICE';
}

export const TargetCardSubTab: React.FC<TargetCardSubTabProps> = ({
  player,
  records,
  targetContext,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<keyof CoreMetrics | null>(null);

  const thresholds = calculateAllPlayerThresholds(records, player, targetContext);

  // Find the player's most recent session in this context for current comparison
  const contextRecs = records.filter((r) => {
    if (r.player_id !== player.id) return false;
    const isG = r.session_type.toUpperCase().includes('GAME') || r.session_name.toUpperCase().includes('GAME') || r.session_type.toUpperCase().includes('VS');
    return targetContext === 'GAME' ? isG : !isG;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const latestRecord = contextRecs[0] || null;

  return (
    <div className="space-y-6">
      {/* Header Context Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black uppercase text-orange-400 tracking-wider">
              INDIVIDUAL TARGET CARD ({targetContext})
            </span>
            <span className="text-[10px] bg-orange-950/80 text-orange-400 font-bold px-2 py-0.5 rounded border border-orange-800">
              {player.position}
            </span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">{player.displayName} (#{player.number})</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Deterministic percentile targets calculated exclusively from historical {targetContext.toLowerCase()} records.
          </p>
        </div>

        {latestRecord && (
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 text-right">
            <span className="text-[10px] font-bold text-zinc-500 uppercase block">Latest Context Session</span>
            <span className="text-xs font-mono font-bold text-zinc-200">{latestRecord.date}</span>
            <span className="text-[10px] text-zinc-400 block truncate max-w-[200px]">{latestRecord.session_name}</span>
          </div>
        )}
      </div>

      {/* Grid of 8 Metric Target Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {CORE_METRIC_KEYS.map((metricKey) => {
          const t = thresholds[metricKey];
          const meta = METRIC_LABELS[metricKey];
          const currentVal = latestRecord ? latestRecord[metricKey] : null;
          const evaluation = currentVal !== null ? evaluateExposureAgainstThreshold(currentVal, t) : null;

          return (
            <div
              key={metricKey}
              className="bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 rounded-2xl p-4 transition-all flex flex-col justify-between space-y-4"
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

              {/* Observed Comparison & Progress Gauge */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-bold uppercase text-[10px]">Current Session:</span>
                  <span className="font-mono font-black text-white">
                    {currentVal !== null && currentVal !== undefined ? `${Math.round(currentVal)} ${meta.unit}` : 'N/A'}
                  </span>
                </div>

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
                      <span>100% High ({Math.round(t.highThreshold)})</span>
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
          currentValue={latestRecord ? latestRecord[selectedMetric] : null}
        />
      )}
    </div>
  );
};
