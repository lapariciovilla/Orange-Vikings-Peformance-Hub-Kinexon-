import React from 'react';
import { Player, CoreMetrics, PlayerMetricThreshold } from '../../types';
import { METRIC_LABELS } from '../../lib/contextBaseline';
import { formatPlayerNumber } from '../../lib/positionalUtils';
import { X, Calculator, ShieldCheck, Database } from 'lucide-react';

interface WhyModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player;
  metricKey: keyof CoreMetrics;
  threshold: PlayerMetricThreshold;
  currentValue?: number | null;
}

export const WhyModal: React.FC<WhyModalProps> = ({
  isOpen,
  onClose,
  player,
  metricKey,
  threshold,
  currentValue,
}) => {
  if (!isOpen) return null;

  const meta = METRIC_LABELS[metricKey];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border-2 border-orange-500/60 rounded-2xl max-w-2xl w-full p-6 text-zinc-100 shadow-2xl relative space-y-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-2 rounded-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 border-b border-zinc-800 pb-4">
          <div className="p-3 bg-orange-950/80 border border-orange-800 text-orange-400 rounded-xl">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
              STATISTICAL TRANSPARENCY BREAKDOWN ("WHY?")
            </div>
            <h2 className="text-xl font-black text-white">
              {player.displayName} ({formatPlayerNumber(player.number)}) — {meta.label}
            </h2>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">
              Deterministic, player-specific distribution calculations derived from historical observations.
            </p>
          </div>
        </div>

        {/* Current Observed Context */}
        {currentValue !== undefined && currentValue !== null && (
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase">Current Session Value:</span>
            <span className="font-mono text-lg font-black text-white">
              {Math.round(currentValue)} <span className="text-xs text-zinc-400">{meta.unit}</span>
            </span>
          </div>
        )}

        {/* Calculated Statistical Parameters */}
        <div className="space-y-3">
          <div className="text-xs font-black text-zinc-300 uppercase tracking-wider flex items-center space-x-2">
            <Database className="w-4 h-4 text-orange-400" />
            <span>Empirical Distribution Parameters ({threshold.context} Context)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">
              <div className="text-[10px] font-sans text-zinc-500 font-bold uppercase">Sample Size (n)</div>
              <div className="text-sm font-extrabold text-orange-400">{threshold.n} sessions</div>
            </div>
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">
              <div className="text-[10px] font-sans text-zinc-500 font-bold uppercase">Mean</div>
              <div className="text-sm font-extrabold text-white">{threshold.mean !== null ? threshold.mean : 'N/A'} {meta.unit}</div>
            </div>
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">
              <div className="text-[10px] font-sans text-zinc-500 font-bold uppercase">Median (P50)</div>
              <div className="text-sm font-extrabold text-white">{threshold.median !== null ? threshold.median : 'N/A'} {meta.unit}</div>
            </div>
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">
              <div className="text-[10px] font-sans text-zinc-500 font-bold uppercase">Std Dev (SD)</div>
              <div className="text-sm font-extrabold text-white">{threshold.sd !== null ? threshold.sd : 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* Derived Percentile Thresholds */}
        <div className="space-y-3">
          <div className="text-xs font-black text-zinc-300 uppercase tracking-wider flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>Target Exposure Bands</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex justify-between items-center">
              <div>
                <div className="font-sans font-bold text-zinc-400">Lower Target (P25)</div>
                <div className="text-[10px] font-sans text-zinc-500">25th Percentile Baseline</div>
              </div>
              <div className="font-extrabold text-blue-400 text-sm">
                {threshold.lowerTarget !== null ? Math.round(threshold.lowerTarget) : 'N/A'} {meta.unit}
              </div>
            </div>

            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex justify-between items-center">
              <div>
                <div className="font-sans font-bold text-amber-400">Typical Target (Median)</div>
                <div className="text-[10px] font-sans text-zinc-500">50th Percentile Baseline</div>
              </div>
              <div className="font-black text-amber-400 text-sm">
                {threshold.typicalTarget !== null ? Math.round(threshold.typicalTarget) : 'N/A'} {meta.unit}
              </div>
            </div>

            <div className="bg-zinc-950 p-3 rounded-xl border border-purple-900/60 flex justify-between items-center">
              <div>
                <div className="font-sans font-bold text-purple-300">High Exposure (P90)</div>
                <div className="text-[10px] font-sans text-zinc-500">90th Percentile Threshold</div>
              </div>
              <div className="font-black text-purple-300 text-sm">
                {threshold.highThreshold !== null ? Math.round(threshold.highThreshold) : 'N/A'} {meta.unit}
              </div>
            </div>

            <div className="bg-zinc-950 p-3 rounded-xl border border-rose-900/60 flex justify-between items-center">
              <div>
                <div className="font-sans font-bold text-rose-300">Very High Hist. (P95)</div>
                <div className="text-[10px] font-sans text-zinc-500">95th Percentile Extreme</div>
              </div>
              <div className="font-black text-rose-300 text-sm">
                {threshold.veryHighThreshold !== null ? Math.round(threshold.veryHighThreshold) : 'N/A'} {meta.unit}
              </div>
            </div>
          </div>
        </div>

        {/* Fallback Hierarchy & Reference Metadata */}
        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold">
            <span className="text-zinc-400 uppercase text-[10px]">Baseline Reference Type:</span>
            <span className="text-orange-400 font-extrabold">{threshold.referenceType}</span>
          </div>
          <div className="flex items-center justify-between font-bold">
            <span className="text-zinc-400 uppercase text-[10px]">Data Confidence Level:</span>
            <span className="text-emerald-400 font-extrabold">{threshold.confidenceLabel}</span>
          </div>
          {threshold.disclaimer && (
            <div className="text-[11px] text-amber-400 font-semibold pt-1 border-t border-zinc-900">
              Note: {threshold.disclaimer}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black rounded-xl text-xs transition-all shadow-lg"
          >
            Close Transparency Log
          </button>
        </div>
      </div>
    </div>
  );
};
