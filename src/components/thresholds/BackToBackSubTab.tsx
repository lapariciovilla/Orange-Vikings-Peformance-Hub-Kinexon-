import React from 'react';
import { Player, PlayerSessionRecord } from '../../types';
import { CORE_METRIC_KEYS, METRIC_LABELS } from '../../lib/contextBaseline';
import { findBackToBackGamePairs } from '../../lib/loadThresholdEngine';
import { Calendar, Repeat, Activity, AlertCircle } from 'lucide-react';

interface BackToBackSubTabProps {
  player: Player;
  records: PlayerSessionRecord[];
}

export const BackToBackSubTab: React.FC<BackToBackSubTabProps> = ({
  player,
  records,
}) => {
  const b2bPairs = findBackToBackGamePairs(records, player.id);

  return (
    <div className="space-y-6">
      {/* Header Context */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Repeat className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-black uppercase text-orange-400 tracking-wider">
              BACK-TO-BACK GAME EXPOSURE MONITOR
            </span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">{player.displayName} (#{player.number})</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Comparative analysis of mechanical and acceleration load drop-off during back-to-back game schedules.
          </p>
        </div>

        <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 text-right font-mono">
          <span className="text-[10px] font-bold text-zinc-500 uppercase block font-sans">Identified B2B Sets</span>
          <span className="text-lg font-black text-orange-400">{b2bPairs.length} Pairings</span>
        </div>
      </div>

      {b2bPairs.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500 space-y-2">
          <Calendar className="w-8 h-8 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-bold text-zinc-300">No Back-to-Back Game Sets Detected</h3>
          <p className="text-xs max-w-md mx-auto">
            No consecutive games (played within 24-48 hours) were identified in this player's historical game logs.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {b2bPairs.map((pair, idx) => (
            <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              {/* Pair Header */}
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
                    <span className="text-zinc-500 text-[10px] uppercase block">Game 1 RPE</span>
                    <span className="font-bold text-amber-400">{pair.rpe1 ?? 'N/A'}</span>
                  </div>
                  <div className="bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800">
                    <span className="text-zinc-500 text-[10px] uppercase block">Game 2 RPE</span>
                    <span className="font-bold text-amber-400">{pair.rpe2 ?? 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* B2B Metrics Comparison Table */}
              <div className="overflow-x-auto">
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
                  <tbody className="divide-y divide-zinc-800/60">
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
          ))}
        </div>
      )}
    </div>
  );
};
