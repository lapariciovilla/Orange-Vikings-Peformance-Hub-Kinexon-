import React from 'react';
import { Player, PlayerSessionRecord } from '../../types';
import { CORE_METRIC_KEYS, METRIC_LABELS } from '../../lib/contextBaseline';
import { calculateRollingLoadSummaries, calculateWeeklyExposureGaps } from '../../lib/loadThresholdEngine';
import { Calendar, Activity, AlertCircle, Info } from 'lucide-react';

interface WeeklyRollingSubTabProps {
  player: Player;
  records: PlayerSessionRecord[];
}

export const WeeklyRollingSubTab: React.FC<WeeklyRollingSubTabProps> = ({
  player,
  records,
}) => {
  const rollingSummaries = calculateRollingLoadSummaries(records, player.id);
  const weeklyGaps = calculateWeeklyExposureGaps(records, player.id);

  return (
    <div className="space-y-6">
      {/* Header Context */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-black uppercase text-orange-400 tracking-wider">
              ROLLING CUMULATIVE LOAD TARGETS & WEEKLY GAP ANALYSIS
            </span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">{player.displayName} (#{player.number})</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Tracking 3-day, 7-day, 14-day, and 28-day cumulative exposure to identify under-loading or over-exposure windows.
          </p>
        </div>
      </div>

      {/* Gap Analysis Summary Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center space-x-2">
          <Activity className="w-4 h-4 text-orange-400" />
          <span>Weekly Exposure Gap Guidance</span>
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
                  <span>Typical Weekly Target:</span>
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

      {/* Rolling Multi-Window Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-zinc-950 border-b border-zinc-800">
          <span className="text-xs font-black uppercase text-zinc-300">
            Cumulative Load Windows (3-Day, 7-Day, 14-Day, 28-Day)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="bg-zinc-950 text-[10px] font-black uppercase text-zinc-400 border-b border-zinc-800">
                <th className="p-4 font-sans">Metric</th>
                <th className="p-4 text-center">3-Day Sum</th>
                <th className="p-4 text-center text-amber-400">7-Day Sum</th>
                <th className="p-4 text-center">14-Day Sum</th>
                <th className="p-4 text-center">28-Day Sum</th>
                <th className="p-4 text-center">Typical 7-Day Target</th>
                <th className="p-4 text-center">% of Typical 7-Day Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {rollingSummaries.map((r) => {
                const meta = METRIC_LABELS[r.metric];
                return (
                  <tr key={r.metric} className="hover:bg-zinc-800/40">
                    <td className="p-4 font-sans font-bold text-white">
                      {meta.label} <span className="text-[10px] text-zinc-500 font-mono font-normal">({meta.unit})</span>
                    </td>
                    <td className="p-4 text-center text-zinc-300">{Math.round(r.days3)}</td>
                    <td className="p-4 text-center font-black text-amber-400">{Math.round(r.days7)}</td>
                    <td className="p-4 text-center text-zinc-300">{Math.round(r.days14)}</td>
                    <td className="p-4 text-center text-zinc-300">{Math.round(r.days28)}</td>
                    <td className="p-4 text-center text-zinc-400">
                      {r.typical7Day !== null ? Math.round(r.typical7Day) : 'N/A'}
                    </td>
                    <td className="p-4 text-center font-bold">
                      {r.pctOfTypical7Day !== null ? (
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] ${
                            r.pctOfTypical7Day > 125
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : r.pctOfTypical7Day < 75
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-zinc-950 text-zinc-300'
                          }`}
                        >
                          {r.pctOfTypical7Day}%
                        </span>
                      ) : (
                        'N/A'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
