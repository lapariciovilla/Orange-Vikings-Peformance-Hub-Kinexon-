import React from 'react';
import { Player, CoreMetrics, PlayerSessionRecord } from '../../types';
import { CORE_METRIC_KEYS, METRIC_LABELS } from '../../lib/contextBaseline';
import { calculateAllPlayerThresholds, evaluateExposureAgainstThreshold } from '../../lib/loadThresholdEngine';
import { formatPlayerNumber } from '../../lib/positionalUtils';
import { ShieldAlert, Info, Activity, CheckCircle, AlertCircle } from 'lucide-react';

interface CoachViewSubTabProps {
  players: Player[];
  records: PlayerSessionRecord[];
  selectedPlayerId: string;
  onSelectPlayer: (id: string) => void;
}

export const CoachViewSubTab: React.FC<CoachViewSubTabProps> = ({
  players,
  records,
  selectedPlayerId,
  onSelectPlayer,
}) => {
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) || players[0];

  if (!selectedPlayer) return null;

  const thresholds = calculateAllPlayerThresholds(records, selectedPlayer, 'GAME');

  // Find latest game session record
  const gameRecs = records.filter((r) => {
    if (r.player_id !== selectedPlayer.id) return false;
    return r.session_type.toUpperCase().includes('GAME') || r.session_name.toUpperCase().includes('GAME') || r.session_type.toUpperCase().includes('VS');
  }).sort((a, b) => b.date.localeCompare(a.date));

  const activeGame = gameRecs[0] || null;

  return (
    <div className="space-y-6">
      {/* Disclaimer Header Notice */}
      <div className="bg-amber-950/40 border border-amber-800/80 rounded-2xl p-4 flex items-start space-x-3 text-amber-200 text-xs">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-amber-300 uppercase text-[10px] tracking-wider">
            COACHING STAFF DECISION-SUPPORT PROTOCOL
          </div>
          <p>
            This target view provides objective historical load benchmarks for tactical rotation and load management discussions. High exposure flags indicate a requirement for <strong>Coaching Review</strong> — they do NOT indicate injury prediction or automatic player substitution directives.
          </p>
        </div>
      </div>

      {/* Player Selection Header Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider">
            GAME LOAD TARGETS — COACHING SUMMARY
          </span>
          <h2 className="text-2xl font-black text-white mt-1">{selectedPlayer.displayName} ({formatPlayerNumber(selectedPlayer.number)})</h2>
          <div className="flex items-center space-x-3 mt-1 text-xs text-zinc-400 font-mono">
            <span>Position: <strong className="text-zinc-200">{selectedPlayer.position}</strong></span>
            <span>•</span>
            <span>Game History Sample: <strong className="text-orange-400">n={thresholds['accumulated_acceleration_load'].n} games</strong></span>
          </div>
        </div>

        {/* Player Selector dropdown */}
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-zinc-400 uppercase">Select Player:</span>
          <select
            value={selectedPlayer.id}
            onChange={(e) => onSelectPlayer(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 text-white font-bold text-xs rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPlayerNumber(p.number)} {p.displayName} ({p.position})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Game Context Status Banner */}
      {activeGame ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-orange-950/80 border border-orange-800 text-orange-400 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase">Active Session Evaluated</div>
              <div className="text-base font-black text-white">{activeGame.session_name} ({activeGame.date})</div>
              {activeGame.game_minutes && (
                <div className="text-xs text-orange-400 font-mono font-bold mt-0.5">
                  Minutes Played: {activeGame.game_minutes} mins
                </div>
              )}
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Reference Context</span>
            <span className="text-xs font-bold text-emerald-400">{thresholds['accumulated_acceleration_load'].referenceType}</span>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-500 text-xs italic">
          No historical game session available for current exposure comparison. Showing baseline game targets.
        </div>
      )}

      {/* Coaching Decision Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CORE_METRIC_KEYS.map((metricKey) => {
          const t = thresholds[metricKey];
          const meta = METRIC_LABELS[metricKey];
          const currentVal = activeGame ? activeGame[metricKey] : null;
          const evaluation = currentVal !== null ? evaluateExposureAgainstThreshold(currentVal, t) : null;

          return (
            <div
              key={metricKey}
              className={`bg-zinc-900 border rounded-2xl p-5 space-y-4 transition-all ${
                evaluation?.status === 'VERY_HIGH_HISTORICAL'
                  ? 'border-rose-700 shadow-lg shadow-rose-950/40'
                  : evaluation?.status === 'HIGH_EXPOSURE'
                  ? 'border-purple-700 shadow-lg shadow-purple-950/40'
                  : 'border-zinc-800'
              }`}
            >
              {/* Card Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-black text-white">{meta.label}</h3>
                  <span className="text-xs text-zinc-400 font-mono">{meta.unit}</span>
                </div>

                {/* Status Badge */}
                {evaluation ? (
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-black border ${evaluation.statusBadgeClasses}`}>
                    {evaluation.statusLabel}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-zinc-950 text-zinc-500 border border-zinc-800">
                    Baseline Mode
                  </span>
                )}
              </div>

              {/* Game Targets Hierarchy */}
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                  <span className="text-[9px] font-sans font-bold text-zinc-500 uppercase block">Typical Game</span>
                  <span className="text-sm font-black text-amber-400">
                    {t.typicalTarget !== null ? Math.round(t.typicalTarget) : 'N/A'}
                  </span>
                </div>

                <div className="bg-zinc-950 p-2.5 rounded-xl border border-purple-900/60">
                  <span className="text-[9px] font-sans font-bold text-purple-400 uppercase block">High Game (P90)</span>
                  <span className="text-sm font-black text-purple-300">
                    {t.highThreshold !== null ? Math.round(t.highThreshold) : 'N/A'}
                  </span>
                </div>

                <div className="bg-zinc-950 p-2.5 rounded-xl border border-rose-900/60">
                  <span className="text-[9px] font-sans font-bold text-rose-400 uppercase block">Very High (P95)</span>
                  <span className="text-sm font-black text-rose-300">
                    {t.veryHighThreshold !== null ? Math.round(t.veryHighThreshold) : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Observed Current vs High Threshold Progress Bar */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-bold uppercase text-[10px]">Game Exposure Right Now:</span>
                  <span className="font-mono font-black text-white text-sm">
                    {currentVal !== null && currentVal !== undefined ? `${Math.round(currentVal)} ${meta.unit}` : 'N/A'}
                  </span>
                </div>

                {t.highThreshold && currentVal !== null && currentVal !== undefined ? (
                  <div>
                    <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 relative">
                      <div
                        className={`h-full transition-all duration-500 ${
                          evaluation?.status === 'VERY_HIGH_HISTORICAL'
                            ? 'bg-rose-500'
                            : evaluation?.status === 'HIGH_EXPOSURE'
                            ? 'bg-purple-500'
                            : evaluation?.status === 'ABOVE_TYPICAL'
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(5, (currentVal / (t.highThreshold * 1.15)) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-zinc-500 mt-1">
                      <span>0</span>
                      <span className="text-amber-400 font-bold">P50 ({t.typicalTarget ? Math.round(t.typicalTarget) : ''})</span>
                      <span className="text-purple-400 font-bold">High Target ({Math.round(t.highThreshold)})</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-zinc-500 italic text-center py-1">
                    No active game session data loaded
                  </div>
                )}
              </div>

              {/* Non-Alarmist Coaching Action Guidance */}
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs space-y-1 font-sans">
                <div className="font-bold text-zinc-300 text-[11px] uppercase tracking-wider flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5 text-orange-400" />
                  <span>Coaching Decision Context</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  {evaluation?.status === 'VERY_HIGH_HISTORICAL' || evaluation?.status === 'HIGH_EXPOSURE'
                    ? `High Exposure — Coaching Review required. Player has reached ${evaluation.pctOfHighThreshold}% of his historical game P90 target. Review rotation minutes and tactical pacing.`
                    : evaluation?.status === 'ABOVE_TYPICAL'
                    ? `Moderate-High game load. Player is currently at ${evaluation.pctOfHighThreshold}% of his historical high game threshold.`
                    : 'Game load is within typical historical operating baseline. Standard game rotation.'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
