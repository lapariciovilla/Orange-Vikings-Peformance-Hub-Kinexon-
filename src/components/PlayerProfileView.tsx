import React, { useState } from 'react';
import { Player, PlayerSessionRecord, CoreMetrics } from '../types';
import { DataStore } from '../lib/dataStore';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import {
  User,
  Activity,
  Zap,
  ArrowDownCircle,
  TrendingUp,
  Shield,
  Calendar,
  AlertCircle,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface PlayerProfileViewProps {
  players: Player[];
  selectedPlayerId: string;
  onSelectPlayer: (id: string) => void;
}

type TimeFrame = 'TODAY' | '7D' | '14D' | '28D' | 'SEASON';

export const PlayerProfileView: React.FC<PlayerProfileViewProps> = ({
  players,
  selectedPlayerId,
  onSelectPlayer,
}) => {
  const [timeframe, setTimeframe] = useState<TimeFrame>('SEASON');
  const [activeMetricTab, setActiveMetricTab] = useState<keyof CoreMetrics>('distance_m');

  const player = players.find((p) => p.id === selectedPlayerId) || players[0];
  const allRecords = DataStore.getRecordsForPlayer(player?.id || '');

  // Filter records based on timeframe
  const filteredRecords = allRecords.filter((r) => {
    if (timeframe === 'TODAY') return r.date === '2026-08-11';
    if (timeframe === '7D') {
      const d = new Date(r.date);
      const limit = new Date('2026-08-11');
      limit.setDate(limit.getDate() - 7);
      return d >= limit;
    }
    if (timeframe === '14D') {
      const d = new Date(r.date);
      const limit = new Date('2026-08-11');
      limit.setDate(limit.getDate() - 14);
      return d >= limit;
    }
    if (timeframe === '28D') {
      const d = new Date(r.date);
      const limit = new Date('2026-08-11');
      limit.setDate(limit.getDate() - 28);
      return d >= limit;
    }
    return true; // SEASON
  });

  // Calculate stats for selected metric
  const validMetricVals = filteredRecords
    .map((r) => r[activeMetricTab])
    .filter((v): v is number => v !== null && v !== undefined);

  const currentVal = validMetricVals.length > 0 ? validMetricVals[0] : null;
  const highestVal = validMetricVals.length > 0 ? Math.max(...validMetricVals) : null;
  const lowestVal = validMetricVals.length > 0 ? Math.min(...validMetricVals) : null;
  const avgVal =
    validMetricVals.length > 0
      ? Number((validMetricVals.reduce((a, b) => a + b, 0) / validMetricVals.length).toFixed(1))
      : null;

  const loadStatus = DataStore.getPlayerLoadStatus(player?.id || '', currentVal, activeMetricTab);

  // Chart Data preparation (chronological order)
  const chartData = [...filteredRecords]
    .reverse()
    .map((r) => ({
      date: r.date,
      distance: r.distance_m || 0,
      accel: r.accumulated_acceleration_load || 0,
      decel: r.deceleration_load || 0,
      jump: r.jump_load || 0,
      mech: r.mechanical_load || 0,
    }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Player Header Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-orange-600/20 border border-orange-500/40 text-orange-400 font-black text-2xl flex items-center justify-center shrink-0">
            {player.number}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-white">{player.displayName}</h1>
              <span className="text-xs font-bold text-orange-400 bg-orange-950/80 border border-orange-800 px-2 py-0.5 rounded">
                {player.position}
              </span>
            </div>
            <div className="text-xs text-zinc-400 mt-1 flex flex-wrap items-center gap-3">
              <span>Status: <strong className="text-emerald-400">{player.status}</strong></span>
              <span>•</span>
              <span>Monitored Sessions: <strong className="text-white">{allRecords.length}</strong></span>
              {player.aliases.length > 1 && (
                <>
                  <span>•</span>
                  <span className="text-zinc-500">Aliases: {player.aliases.join(', ')}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Player Selector & Timeframes */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <select
            id="player-profile-selector"
            value={player.id}
            onChange={(e) => onSelectPlayer(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} {p.displayName} ({p.position})
              </option>
            ))}
          </select>

          <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
            {(['TODAY', '7D', '14D', '28D', 'SEASON'] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1.5 rounded font-bold transition-colors ${
                  timeframe === tf
                    ? 'bg-orange-600 text-zinc-950 font-extrabold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Baseline / Load Status Alert Banner */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <Activity className="w-5 h-5 text-orange-500" />
          <div>
            <div className="text-xs font-black text-white uppercase tracking-wider">
              INDIVIDUAL LOAD MONITORING STATUS
            </div>
            <div className="text-xs text-zinc-400">
              Contextual assessment relative to {player.displayName}'s historical baseline.
            </div>
          </div>
        </div>

        <div>
          {loadStatus.status === 'BASELINE BUILDING' ? (
            <div className="flex items-center space-x-2 bg-amber-950/80 border border-amber-800 text-amber-300 px-3 py-1.5 rounded-lg text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>BASELINE BUILDING ({allRecords.length}/5 minimum sessions collected)</span>
            </div>
          ) : loadStatus.status === 'RED' ? (
            <div className="flex items-center space-x-2 bg-rose-950/80 border border-rose-800 text-rose-300 px-3 py-1.5 rounded-lg text-xs font-black">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>HIGH / UNUSUAL EXPOSURE (+{loadStatus.pctChange}% vs baseline)</span>
            </div>
          ) : loadStatus.status === 'YELLOW' ? (
            <div className="flex items-center space-x-2 bg-amber-950/80 border border-amber-800 text-amber-300 px-3 py-1.5 rounded-lg text-xs font-black">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>ELEVATED LOAD (+{loadStatus.pctChange}% vs baseline)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-emerald-950/80 border border-emerald-800 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-black">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>NORMAL / EXPECTED RANGE</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase">CURRENT SESSION</span>
          <div className="text-xl font-black text-orange-400 mt-1">
            {currentVal !== null
              ? activeMetricTab === 'distance_m'
                ? `${currentVal.toLocaleString()} m`
                : `${currentVal} au`
              : 'N/A'}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase">PERIOD AVERAGE</span>
          <div className="text-xl font-black text-amber-400 mt-1">
            {avgVal !== null
              ? activeMetricTab === 'distance_m'
                ? `${avgVal.toLocaleString()} m`
                : `${avgVal} au`
              : 'N/A'}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase">SEASON HIGHEST</span>
          <div className="text-xl font-black text-rose-400 mt-1">
            {highestVal !== null
              ? activeMetricTab === 'distance_m'
                ? `${highestVal.toLocaleString()} m`
                : `${highestVal} au`
              : 'N/A'}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase">SEASON LOWEST</span>
          <div className="text-xl font-black text-emerald-400 mt-1">
            {lowestVal !== null
              ? activeMetricTab === 'distance_m'
                ? `${lowestVal.toLocaleString()} m`
                : `${lowestVal} au`
              : 'N/A'}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase">TOTAL SESSIONS</span>
          <div className="text-xl font-black text-white mt-1">{filteredRecords.length}</div>
        </div>
      </div>

      {/* Chart Tabs & Area Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-base font-black text-white tracking-tight">
              LONGITUDINAL EXTERNAL LOAD TREND
            </h2>
            <p className="text-xs text-zinc-400">
              Track {player.displayName}'s workload trajectory over time
            </p>
          </div>

          <div className="flex flex-wrap gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs font-bold">
            <button
              onClick={() => setActiveMetricTab('distance_m')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeMetricTab === 'distance_m'
                  ? 'bg-amber-500 text-zinc-950 font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Distance
            </button>
            <button
              onClick={() => setActiveMetricTab('accumulated_acceleration_load')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeMetricTab === 'accumulated_acceleration_load'
                  ? 'bg-orange-500 text-zinc-950 font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Accel Load
            </button>
            <button
              onClick={() => setActiveMetricTab('deceleration_load')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeMetricTab === 'deceleration_load'
                  ? 'bg-rose-500 text-zinc-950 font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Decel Load
            </button>
            <button
              onClick={() => setActiveMetricTab('jump_load')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeMetricTab === 'jump_load'
                  ? 'bg-purple-500 text-zinc-950 font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Jump Load
            </button>
            <button
              onClick={() => setActiveMetricTab('mechanical_load')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeMetricTab === 'mechanical_load'
                  ? 'bg-sky-500 text-zinc-950 font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Mech Load
            </button>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-72 w-full pt-4">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
              No session data logged for this timeframe.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#09090b',
                    borderColor: '#27272a',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#fff',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={
                    activeMetricTab === 'distance_m'
                      ? 'distance'
                      : activeMetricTab === 'accumulated_acceleration_load'
                      ? 'accel'
                      : activeMetricTab === 'deceleration_load'
                      ? 'decel'
                      : activeMetricTab === 'jump_load'
                      ? 'jump'
                      : 'mech'
                  }
                  stroke="#f97316"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorMetric)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
