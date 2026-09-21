import React, { useState } from 'react';
import { Player, CoreMetrics, PlayerSessionRecord } from '../../types';
import { CORE_METRIC_KEYS, METRIC_LABELS } from '../../lib/contextBaseline';
import { calculateAllPlayerThresholds, evaluateExposureAgainstThreshold } from '../../lib/loadThresholdEngine';
import { WhyModal } from './WhyModal';
import { Search, Filter, HelpCircle, Users } from 'lucide-react';

interface TeamOverviewSubTabProps {
  players: Player[];
  records: PlayerSessionRecord[];
  targetContext: 'GAME' | 'PRACTICE';
}

export const TeamOverviewSubTab: React.FC<TeamOverviewSubTabProps> = ({
  players,
  records,
  targetContext,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<keyof CoreMetrics>('accumulated_acceleration_load');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
  const [modalPlayer, setModalPlayer] = useState<Player | null>(null);

  const filteredPlayers = players.filter((p) => {
    const matchesSearch = p.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || p.number.includes(searchQuery);
    const matchesPos = selectedPosition === 'ALL' || p.position === selectedPosition;
    return matchesSearch && matchesPos;
  });

  const activeMetricMeta = METRIC_LABELS[selectedMetric];

  return (
    <div className="space-y-6">
      {/* Controls Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-black uppercase text-orange-400 tracking-wider">
                TEAM-WIDE LOAD THRESHOLD OVERVIEW ({targetContext})
              </span>
            </div>
            <h2 className="text-xl font-black text-white mt-1">Cross-Roster Individual Targets</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Compare P50, P90, P95 targets and current exposure across all roster players.
            </p>
          </div>

          {/* Metric Selector Dropdown */}
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-zinc-400 uppercase">Focus Metric:</span>
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

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-zinc-800">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search player name or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-white text-xs rounded-xl pl-9 pr-4 py-2 w-full focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-zinc-500" />
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
            >
              <option value="ALL">All Positions</option>
              <option value="PG">Point Guard (PG)</option>
              <option value="SG">Shooting Guard (SG)</option>
              <option value="SF">Small Forward (SF)</option>
              <option value="PF">Power Forward (PF)</option>
              <option value="C">Center (C)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Team Matrix Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex justify-between items-center">
          <span className="text-xs font-black uppercase text-zinc-300">
            Metric: <strong className="text-orange-400">{activeMetricMeta.label}</strong> ({activeMetricMeta.unit})
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            Showing {filteredPlayers.length} / {players.length} Players
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950 text-[10px] font-black uppercase text-zinc-400 border-b border-zinc-800 tracking-wider">
                <th className="p-4">Player</th>
                <th className="p-4 text-center">Pos</th>
                <th className="p-4 text-center">Typical (P50)</th>
                <th className="p-4 text-center">High (P90)</th>
                <th className="p-4 text-center">Very High (P95)</th>
                <th className="p-4 text-right font-mono">Current Session</th>
                <th className="p-4 text-center">% of High Target</th>
                <th className="p-4 text-center">Visual Exposure Bar</th>
                <th className="p-4 text-center">n</th>
                <th className="p-4 text-center">Ref</th>
                <th className="p-4 text-center">Why?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-xs font-mono">
              {filteredPlayers.map((player) => {
                const thresholds = calculateAllPlayerThresholds(records, player, targetContext);
                const t = thresholds[selectedMetric];

                const pRecs = records.filter((r) => {
                  if (r.player_id !== player.id) return false;
                  const isG = r.session_type.toUpperCase().includes('GAME') || r.session_name.toUpperCase().includes('GAME') || r.session_type.toUpperCase().includes('VS');
                  return targetContext === 'GAME' ? isG : !isG;
                }).sort((a, b) => b.date.localeCompare(a.date));

                const latestRecord = pRecs[0] || null;
                const currentVal = latestRecord ? latestRecord[selectedMetric] : null;
                const evalResult = currentVal !== null ? evaluateExposureAgainstThreshold(currentVal, t) : null;
                const pctOfHigh = evalResult?.pctOfHighThreshold ?? null;

                return (
                  <tr key={player.id} className="hover:bg-zinc-800/40 transition-colors">
                    {/* Player Info */}
                    <td className="p-4 font-sans">
                      <div className="font-bold text-white text-sm">{player.displayName}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">#{player.number}</div>
                    </td>

                    {/* Position Badge */}
                    <td className="p-4 text-center font-sans">
                      <span className="text-[10px] bg-zinc-950 text-zinc-400 font-bold px-2 py-0.5 rounded border border-zinc-800">
                        {player.position}
                      </span>
                    </td>

                    {/* P50 */}
                    <td className="p-4 text-center text-amber-400 font-bold">
                      {t.typicalTarget !== null ? Math.round(t.typicalTarget) : 'N/A'}
                    </td>

                    {/* P90 */}
                    <td className="p-4 text-center text-purple-300 font-extrabold">
                      {t.highThreshold !== null ? Math.round(t.highThreshold) : 'N/A'}
                    </td>

                    {/* P95 */}
                    <td className="p-4 text-center text-rose-300 font-black">
                      {t.veryHighThreshold !== null ? Math.round(t.veryHighThreshold) : 'N/A'}
                    </td>

                    {/* Current Session */}
                    <td className="p-4 text-right font-black text-white text-sm">
                      {currentVal !== null && currentVal !== undefined ? (
                        <span>{Math.round(currentVal)}</span>
                      ) : (
                        <span className="text-zinc-600 font-normal">N/A</span>
                      )}
                    </td>

                    {/* % of High */}
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

                    {/* Visual Bar */}
                    <td className="p-4 min-w-[140px]">
                      {t.highThreshold && currentVal !== null && currentVal !== undefined ? (
                        <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
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
                              width: `${Math.min(100, Math.max(5, (currentVal / (t.highThreshold * 1.15)) * 100))}%`,
                            }}
                          />
                        </div>
                      ) : (
                        <div className="text-[10px] text-zinc-600 italic text-center">No Data</div>
                      )}
                    </td>

                    {/* n */}
                    <td className="p-4 text-center text-orange-400 font-bold">
                      n={t.n}
                    </td>

                    {/* Reference Type */}
                    <td className="p-4 text-center text-[10px] text-zinc-400 font-sans">
                      {t.referenceType}
                    </td>

                    {/* Why Button */}
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setModalPlayer(player)}
                        className="p-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-orange-400 border border-zinc-800 rounded-lg transition-all"
                        title="Why? View breakdown"
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

      {/* Why Modal */}
      {modalPlayer && (
        <WhyModal
          isOpen={!!modalPlayer}
          onClose={() => setModalPlayer(null)}
          player={modalPlayer}
          metricKey={selectedMetric}
          threshold={calculateAllPlayerThresholds(records, modalPlayer, targetContext)[selectedMetric]}
        />
      )}
    </div>
  );
};
