import React, { useState } from 'react';
import { Player, PlayerSessionRecord } from '../types';
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
import { GitCompare, Info, Check, Plus, X } from 'lucide-react';

interface PlayerComparisonViewProps {
  players: Player[];
}

export const PlayerComparisonView: React.FC<PlayerComparisonViewProps> = ({ players }) => {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(
    players.length >= 2 ? [players[0].id, players[1].id] : [players[0]?.id || '']
  );

  const togglePlayerSelect = (id: string) => {
    if (selectedPlayerIds.includes(id)) {
      if (selectedPlayerIds.length > 1) {
        setSelectedPlayerIds(selectedPlayerIds.filter((pId) => pId !== id));
      }
    } else {
      if (selectedPlayerIds.length < 4) {
        setSelectedPlayerIds([...selectedPlayerIds, id]);
      }
    }
  };

  // Compile stats for each selected player
  const compareData = selectedPlayerIds.map((pId) => {
    const p = players.find((pl) => pl.id === pId)!;
    const pRecords = DataStore.getRecordsForPlayer(pId);
    const latestRec = pRecords.length > 0 ? pRecords[0] : null;

    const calculateAvg = (key: keyof PlayerSessionRecord) => {
      const vals = pRecords
        .map((r) => r[key])
        .filter((v): v is number => typeof v === 'number');
      if (vals.length === 0) return null;
      return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
    };

    return {
      player: p,
      latest: latestRec,
      avgDistance: calculateAvg('distance_m'),
      avgAccel: calculateAvg('accumulated_acceleration_load'),
      avgDecel: calculateAvg('deceleration_load'),
      avgJump: calculateAvg('jump_load'),
      avgMech: calculateAvg('mechanical_load'),
    };
  });

  // Recharts multi-bar dataset
  const chartDataset = [
    {
      metric: 'Distance (m / 10)',
      ...Object.fromEntries(
        compareData.map((d) => [
          d.player.displayName,
          d.latest?.distance_m ? Math.round(d.latest.distance_m / 10) : 0,
        ])
      ),
    },
    {
      metric: 'Accel Load',
      ...Object.fromEntries(
        compareData.map((d) => [d.player.displayName, d.latest?.accumulated_acceleration_load || 0])
      ),
    },
    {
      metric: 'Decel Load',
      ...Object.fromEntries(
        compareData.map((d) => [d.player.displayName, d.latest?.deceleration_load || 0])
      ),
    },
    {
      metric: 'Jump Load',
      ...Object.fromEntries(
        compareData.map((d) => [d.player.displayName, d.latest?.jump_load || 0])
      ),
    },
    {
      metric: 'Mech Load',
      ...Object.fromEntries(
        compareData.map((d) => [d.player.displayName, d.latest?.mechanical_load || 0])
      ),
    },
  ];

  const BAR_COLORS = ['#f97316', '#38bdf8', '#a855f7', '#34d399'];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-1">
            SIDE-BY-SIDE LOAD COMPARISON
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <GitCompare className="w-6 h-6 text-orange-500" />
            <span>PLAYER COMPARISON</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Compare 2 to 4 Orange Vikings athletes across KINEXON external-load metrics.
          </p>
        </div>
      </div>

      {/* Roster Selector Pills */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-lg">
        <span className="text-xs font-black text-zinc-400 uppercase block mb-2">
          SELECT ATHLETES TO COMPARE (UP TO 4)
        </span>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => {
            const isSel = selectedPlayerIds.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePlayerSelect(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
                  isSel
                    ? 'bg-orange-600 text-zinc-950 font-black shadow'
                    : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {isSel ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Plus className="w-3.5 h-3.5 text-zinc-500" />}
                <span>
                  {p.number} {p.displayName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {compareData.map((item, idx) => (
          <div
            key={item.player.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded bg-orange-600/20 text-orange-400 font-black text-xs flex items-center justify-center border border-orange-500/30">
                  {item.player.number}
                </span>
                <div>
                  <h3 className="font-black text-white text-sm">{item.player.displayName}</h3>
                  <span className="text-[10px] text-zinc-400">{item.player.position}</span>
                </div>
              </div>

              {selectedPlayerIds.length > 1 && (
                <button
                  onClick={() => togglePlayerSelect(item.player.id)}
                  className="text-zinc-500 hover:text-rose-400"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-zinc-800/60 pb-1">
                <span className="text-zinc-400">Distance:</span>
                <span className="font-extrabold text-amber-400">
                  {item.latest?.distance_m ? `${item.latest.distance_m.toLocaleString()} m` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-1">
                <span className="text-zinc-400">Accel Load:</span>
                <span className="font-extrabold text-orange-400">
                  {item.latest?.accumulated_acceleration_load ?? 'N/A'}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-1">
                <span className="text-zinc-400">Decel Load:</span>
                <span className="font-extrabold text-rose-400">
                  {item.latest?.deceleration_load ?? 'N/A'}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-1">
                <span className="text-zinc-400">Jump Load:</span>
                <span className="font-extrabold text-purple-400">
                  {item.latest?.jump_load ?? 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Mech Load:</span>
                <span className="font-extrabold text-sky-400">
                  {item.latest?.mechanical_load ?? 'N/A'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Visual Bar Comparison */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-black text-white tracking-tight">
          COMPARATIVE EXTERNAL LOAD PROFILE
        </h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartDataset} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="metric" stroke="#71717a" fontSize={11} />
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
              <Legend />
              {compareData.map((d, i) => (
                <Bar
                  key={d.player.id}
                  dataKey={d.player.displayName}
                  fill={BAR_COLORS[i % BAR_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sports Science Disclaimer */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center space-x-3 text-xs text-zinc-400">
        <Info className="w-5 h-5 text-orange-500 shrink-0" />
        <p>
          <strong className="text-zinc-200">Sports Science Principle:</strong> Higher external load numbers reflect greater movement demands or positional roles, and do not directly imply superior or inferior performance capability.
        </p>
      </div>
    </div>
  );
};
