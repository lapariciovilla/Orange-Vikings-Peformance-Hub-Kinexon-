import React, { useState } from 'react';
import { PlayerSessionRecord, SessionMeta, SessionType } from '../types';
import { DataStore } from '../lib/dataStore';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { LineChart as LineChartIcon, Users, Filter, Layers } from 'lucide-react';

interface TeamAnalyticsViewProps {
  sessions: SessionMeta[];
  records: PlayerSessionRecord[];
}

export const TeamAnalyticsView: React.FC<TeamAnalyticsViewProps> = ({ sessions, records }) => {
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Filter sessions by session type
  const filteredSessions = sessions.filter((s) => {
    if (selectedType === 'ALL') return true;
    return s.session_type === selectedType;
  });

  // Prepare chronological chart data for team session averages
  const teamTrendData = [...filteredSessions].reverse().map((s) => {
    const sRecords = records.filter((r) => r.session_id === s.id);
    const avg = DataStore.calculateTeamAverages(sRecords);

    return {
      date: s.date,
      name: s.session_name || s.date,
      avgDistance: avg.avg_distance || 0,
      avgAccel: avg.avg_accel || 0,
      avgDecel: avg.avg_decel || 0,
      avgJump: avg.avg_jump || 0,
      avgMech: avg.avg_mechanical || 0,
      players: sRecords.length,
    };
  });

  // Positional Breakdown (Guards: PG/SG, Forwards: SF/PF, Centers: C/PF)
  const computePositionalAverage = (positionSubstr: string) => {
    const posRecords = records.filter((r) =>
      r.position.toUpperCase().includes(positionSubstr)
    );
    return DataStore.calculateTeamAverages(posRecords);
  };

  const guardsAvg = computePositionalAverage('PG');
  const forwardsAvg = computePositionalAverage('SF');
  const centersAvg = computePositionalAverage('C');

  const positionalChartData = [
    {
      group: 'GUARDS (PG/SG)',
      distance: guardsAvg.avg_distance || 0,
      accel: guardsAvg.avg_accel || 0,
      decel: guardsAvg.avg_decel || 0,
      jump: guardsAvg.avg_jump || 0,
      mech: guardsAvg.avg_mechanical || 0,
    },
    {
      group: 'FORWARDS (SF/PF)',
      distance: forwardsAvg.avg_distance || 0,
      accel: forwardsAvg.avg_accel || 0,
      decel: forwardsAvg.avg_decel || 0,
      jump: forwardsAvg.avg_jump || 0,
      mech: forwardsAvg.avg_mechanical || 0,
    },
    {
      group: 'CENTERS (C/PF)',
      distance: centersAvg.avg_distance || 0,
      accel: centersAvg.avg_accel || 0,
      decel: centersAvg.avg_decel || 0,
      jump: centersAvg.avg_jump || 0,
      mech: centersAvg.avg_mechanical || 0,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-1">
            LONGITUDINAL TEAM MONITORING
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <LineChartIcon className="w-6 h-6 text-orange-500" />
            <span>TEAM ANALYTICS</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Analyze workload distribution, positional physical demands, and team macrocycles.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center space-x-3">
          <Filter className="w-4 h-4 text-zinc-400" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 text-white font-bold text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
          >
            <option value="ALL">All Session Types</option>
            <option value="Preseason Practice">Preseason Practice</option>
            <option value="Practice">Practice</option>
            <option value="Game">Game</option>
            <option value="Recovery">Recovery</option>
            <option value="Conditioning">Conditioning</option>
          </select>
        </div>
      </div>

      {/* Team Distance & Mechanical Load Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-black text-white tracking-tight">
          TEAM AVERAGE DISTANCE (m) OVER TIME
        </h2>
        <div className="h-72 w-full">
          {teamTrendData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
              No sessions found for selected filter.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#09090b',
                    borderColor: '#27272a',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="avgDistance" name="Team Avg Distance (m)" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Positional Demands Grid */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-orange-500" />
          <h2 className="text-base font-black text-white tracking-tight">
            POSITIONAL GROUP EXPOSURE COMPARISON
          </h2>
        </div>
        <p className="text-xs text-zinc-400">
          Comparing average physical loads across Guards (PG/SG), Forwards (SF/PF), and Centers (C/PF).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {positionalChartData.map((item) => (
            <div key={item.group} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3">
              <span className="text-xs font-black text-orange-400 uppercase tracking-wider block">
                {item.group}
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-zinc-800/80 pb-1">
                  <span className="text-zinc-400">Avg Distance:</span>
                  <span className="font-extrabold text-amber-400">{item.distance ? `${item.distance.toLocaleString()} m` : 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800/80 pb-1">
                  <span className="text-zinc-400">Avg Accel Load:</span>
                  <span className="font-extrabold text-orange-400">{item.accel || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800/80 pb-1">
                  <span className="text-zinc-400">Avg Decel Load:</span>
                  <span className="font-extrabold text-rose-400">{item.decel || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800/80 pb-1">
                  <span className="text-zinc-400">Avg Jump Load:</span>
                  <span className="font-extrabold text-purple-400">{item.jump || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Avg Mech Load:</span>
                  <span className="font-extrabold text-sky-400">{item.mech || 'N/A'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
