import React, { useState } from 'react';
import { Player, CoreMetrics, PlayerSessionRecord } from '../../types';
import { CORE_METRIC_KEYS, METRIC_LABELS } from '../../lib/contextBaseline';
import { calculateMinuteLoadEstimates } from '../../lib/loadThresholdEngine';
import { formatPlayerNumber } from '../../lib/positionalUtils';
import { Clock, TrendingUp, Info } from 'lucide-react';

interface MinutesDensitySubTabProps {
  player: Player;
  records: PlayerSessionRecord[];
}

export const MinutesDensitySubTab: React.FC<MinutesDensitySubTabProps> = ({
  player,
  records,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<keyof CoreMetrics>('accumulated_acceleration_load');

  const minuteEstimate = calculateMinuteLoadEstimates(records, player.id, selectedMetric);
  const activeMeta = METRIC_LABELS[selectedMetric];

  return (
    <div className="space-y-6">
      {/* Header Context */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-black uppercase text-orange-400 tracking-wider">
              MINUTE MANAGEMENT & LOAD DENSITY ANALYSIS
            </span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">{player.displayName} ({formatPlayerNumber(player.number)})</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Empirical correlation between minutes played and expected external-load tracking metrics to assist minute restriction planning.
          </p>
        </div>

        {/* Metric Selector Dropdown */}
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-zinc-400 uppercase">Select Metric:</span>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as keyof CoreMetrics)}
            className="bg-zinc-950 border border-zinc-700 text-white font-bold text-xs rounded-xl px-4 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
          >
            {CORE_METRIC_KEYS.map((k) => (
              <option key={k} value={k}>
                {METRIC_LABELS[k].label} ({METRIC_LABELS[k].unit})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Regression & Expected Load Display */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase text-orange-400">
              EMPIRICAL REGRESSION MODEL
            </span>
            <h3 className="text-lg font-black text-white">{activeMeta.label} per Minute Played</h3>
          </div>
          <div className="text-right font-mono">
            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Correlation Coefficient</span>
            <span className="text-sm font-extrabold text-orange-400">
              r = {minuteEstimate.r !== null ? minuteEstimate.r : 'N/A'} (R² = {minuteEstimate.r2 !== null ? minuteEstimate.r2 : 'N/A'})
            </span>
          </div>
        </div>

        <p className="text-xs text-zinc-400 bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 leading-relaxed">
          {minuteEstimate.message}
        </p>

        {/* Target Minute Scenarios Grid */}
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase text-zinc-300 tracking-wider">
            Expected Load by Target Minutes Allocation
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {minuteEstimate.estimates.map((est) => (
              <div
                key={est.minutes}
                className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-center space-y-2"
              >
                <div className="text-xs font-bold text-zinc-400 font-sans uppercase">
                  {est.minutes} Game Minutes
                </div>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  {est.expectedLoad !== null ? Math.round(est.expectedLoad) : 'N/A'}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  Expected {activeMeta.shortLabel} ({activeMeta.unit})
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
