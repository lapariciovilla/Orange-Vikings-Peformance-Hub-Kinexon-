import React, { useState } from 'react';
import { Player, SessionMeta, PlayerSessionRecord } from '../types';
import { DataStore } from '../lib/dataStore';
import {
  Trophy,
  TrendingUp,
  Activity,
  Flame,
  Zap,
  Layers,
  BarChart3,
  Dumbbell,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface GamesViewProps {
  roster: Player[];
}

export const GamesView: React.FC<GamesViewProps> = ({ roster }) => {
  const games = DataStore.getSessionsMeta().filter((s) => s.session_type === 'Game');
  const gameRecords = DataStore.getPlayerRecords().filter((r) => r.session_type === 'Game');

  // Selected game for deep dive
  const [selectedGameId, setSelectedGameId] = useState<string>(games[0]?.id || '');

  const selectedGame = games.find((g) => g.id === selectedGameId) || games[0];
  const selectedRecords = gameRecords.filter((r) => r.session_id === selectedGame?.id);

  // Compute selected game summary metrics
  const totalPlayers = selectedRecords.length;
  const gameTotalDist = selectedRecords.reduce((sum, r) => sum + (r.distance_m || 0), 0);
  const gameAvgDist = totalPlayers > 0 ? Math.round(gameTotalDist / totalPlayers) : 0;
  const gameAvgAccel = totalPlayers > 0 ? (selectedRecords.reduce((sum, r) => sum + (r.accumulated_acceleration_load || 0), 0) / totalPlayers).toFixed(1) : '0';
  const gameAvgDecel = totalPlayers > 0 ? (selectedRecords.reduce((sum, r) => sum + (r.deceleration_load || 0), 0) / totalPlayers).toFixed(1) : '0';
  const gameAvgJump = totalPlayers > 0 ? (selectedRecords.reduce((sum, r) => sum + (r.jump_load || 0), 0) / totalPlayers).toFixed(1) : '0';
  const gameAvgMech = totalPlayers > 0 ? (selectedRecords.reduce((sum, r) => sum + (r.mechanical_load || 0), 0) / totalPlayers).toFixed(1) : '0';

  // Chronological Game Load Progression
  const gamesChronological = [...games].sort((a, b) => a.date.localeCompare(b.date));

  const gameProgressionData = gamesChronological.map((g) => {
    const recs = gameRecords.filter((r) => r.session_id === g.id);
    const count = recs.length || 1;
    const avgDist = Math.round(recs.reduce((sum, r) => sum + (r.distance_m || 0), 0) / count);
    const avgAccel = Math.round(recs.reduce((sum, r) => sum + (r.accumulated_acceleration_load || 0), 0) / count);
    const avgDecel = Math.round(recs.reduce((sum, r) => sum + (r.deceleration_load || 0), 0) / count);
    const avgMech = Math.round(recs.reduce((sum, r) => sum + (r.mechanical_load || 0), 0) / count);

    return {
      gameName: g.session_name || `Game on ${g.date}`,
      date: g.date,
      opponent: g.opponent || 'Game',
      avgDistance: avgDist,
      avgAccelLoad: avgAccel,
      avgDecelLoad: avgDecel,
      avgMechLoad: avgMech,
    };
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-1">
            COMPETITION EXERTION & MATCH DEMAND TRACKER
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Trophy className="w-6 h-6 text-orange-500" />
            <span>GAME LOAD ANALYSIS</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Monitor match physical demands, track player game workloads, and evaluate external load accumulation across B.LEAGUE games.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-zinc-950 px-3.5 py-2 rounded-lg border border-zinc-800 text-xs font-bold text-zinc-300">
          <Layers className="w-4 h-4 text-orange-400" />
          <span>{games.length} Official Games Monitored</span>
        </div>
      </div>

      {/* Game Selection & Overview Cards */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-black text-white">SELECT GAME SESSION</h2>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-zinc-400 font-bold">Monitored Game:</span>
            <select
              value={selectedGameId}
              onChange={(e) => setSelectedGameId(e.target.value)}
              className="bg-zinc-950 border border-orange-500/80 rounded px-3 py-1.5 text-white font-bold"
            >
              {games.length === 0 ? (
                <option value="">No Games Logged Yet</option>
              ) : (
                games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.date} - {g.session_name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Selected Game Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-center">
            <span className="text-zinc-500 text-[10px] block font-black uppercase">ATHLETES MONITORED</span>
            <span className="text-white font-black text-lg">{totalPlayers}</span>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-center">
            <span className="text-zinc-500 text-[10px] block font-black uppercase">AVG DISTANCE</span>
            <span className="text-amber-400 font-black text-lg">{gameAvgDist.toLocaleString()} m</span>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-center">
            <span className="text-zinc-500 text-[10px] block font-black uppercase">ACCEL LOAD</span>
            <span className="text-orange-400 font-black text-lg">{gameAvgAccel}</span>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-center">
            <span className="text-zinc-500 text-[10px] block font-black uppercase">DECEL LOAD</span>
            <span className="text-rose-400 font-black text-lg">{gameAvgDecel}</span>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-center">
            <span className="text-zinc-500 text-[10px] block font-black uppercase">JUMP LOAD</span>
            <span className="text-purple-400 font-black text-lg">{gameAvgJump}</span>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-center">
            <span className="text-zinc-500 text-[10px] block font-black uppercase">MECHANICAL LOAD</span>
            <span className="text-sky-400 font-black text-lg">{gameAvgMech}</span>
          </div>
        </div>

        {/* Player Game Workload Table */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-black text-orange-400 uppercase tracking-wider">
            PLAYER GAME METRICS BREAKDOWN ({selectedGame?.session_name || 'Game'})
          </h3>

          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-xs text-left text-zinc-300">
              <thead className="bg-zinc-950 text-zinc-400 uppercase font-black text-[10px] border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Athlete</th>
                  <th className="py-3 px-3">Position</th>
                  <th className="py-3 px-3 text-center">Game Mins</th>
                  <th className="py-3 px-3 text-right">Distance</th>
                  <th className="py-3 px-3 text-right">Accel Load</th>
                  <th className="py-3 px-3 text-right">Decel Load</th>
                  <th className="py-3 px-3 text-right">Jump Load</th>
                  <th className="py-3 px-3 text-right">Mech Load</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/50">
                {selectedRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-950 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-white flex items-center space-x-2">
                      <span className="text-orange-400 font-black text-xs">{r.player_number}</span>
                      <span>{r.player_name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400 font-bold">{r.position}</td>
                    <td className="py-2.5 px-3 text-center font-extrabold text-amber-400">
                      {r.game_minutes !== null ? `${r.game_minutes} min` : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-amber-400">
                      {r.distance_m?.toLocaleString()} m
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-orange-400">
                      {r.accumulated_acceleration_load || 0}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-400">
                      {r.deceleration_load || 0}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-purple-400">
                      {r.jump_load || 0}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-sky-400">
                      {r.mechanical_load || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cumulative Game Load Progression Across Games */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-black text-white">AVERAGE GAME LOAD PROGRESSION ACROSS GAMES</h2>
          </div>
          <span className="text-xs text-zinc-400 font-bold">Chronological Match Trend</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gameProgressionData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#a1a1aa" fontSize={11} />
              <YAxis stroke="#a1a1aa" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }} />
              <Legend />
              <Bar dataKey="avgDistance" name="Avg Game Distance (m)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgMechLoad" name="Avg Mechanical Load" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgDecelLoad" name="Avg Deceleration Load" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgAccelLoad" name="Avg Acceleration Load" fill="#fb923c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
