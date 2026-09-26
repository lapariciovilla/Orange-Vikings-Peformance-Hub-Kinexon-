import React, { useState, useMemo } from 'react';
import { Player, CoreMetrics } from '../types';
import { DataStore } from '../lib/dataStore';
import { formatWholeNumber, formatPlayerNumber } from '../lib/positionalUtils';
import { SessionCalendarPicker } from './SessionCalendarPicker';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { GitCompare, Info, Check, Plus, X, Calendar } from 'lucide-react';

interface PlayerComparisonViewProps {
  players: Player[];
}

type CompareMetricKey = keyof CoreMetrics | 'RPE';

const METRIC_CONFIG: Record<CompareMetricKey, { label: string; unit: string; color: string }> = {
  distance_m: { label: 'Total Distance', unit: 'm', color: '#f59e0b' },
  accumulated_acceleration_load: { label: 'Accumulated Accel Load', unit: 'au', color: '#ea580c' },
  accumulated_acceleration_load_per_min: { label: 'Accel Load / min', unit: 'au/min', color: '#f97316' },
  anaerobic_activity_time: { label: 'Anaerobic Activity Time', unit: 'min', color: '#eab308' },
  deceleration_load: { label: 'Deceleration Load', unit: 'au', color: '#f43f5e' },
  deceleration_load_per_min: { label: 'Decel Load / min', unit: 'au/min', color: '#e11d48' },
  jump_load: { label: 'Jump Load', unit: 'au', color: '#a855f7' },
  mechanical_load: { label: 'Mechanical Load', unit: 'au', color: '#38bdf8' },
  RPE: { label: 'Subjective RPE', unit: '1-10', color: '#c084fc' },
};

export const PlayerComparisonView: React.FC<PlayerComparisonViewProps> = ({ players }) => {
  const sessionsMeta = DataStore.getSessionsMeta();
  const allRecords = DataStore.getPlayerRecords();

  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    sessionsMeta[0]?.id || 'session-2026-08-12'
  );

  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(
    players.length >= 2 ? [players[0].id, players[1].id] : [players[0]?.id || '']
  );

  const [normMode, setNormMode] = useState<'TOTAL' | 'NORMALIZED'>('TOTAL');
  const [activeMetric, setActiveMetric] = useState<CompareMetricKey>('distance_m');

  const selectedSession = useMemo(() => {
    return sessionsMeta.find((s) => s.id === selectedSessionId) || sessionsMeta[0];
  }, [sessionsMeta, selectedSessionId]);

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

  const sessionRecords = useMemo(() => {
    return allRecords.filter((r) => r.session_id === selectedSessionId);
  }, [allRecords, selectedSessionId]);

  const isGame = selectedSession?.session_type === 'Game';

  const compareData = useMemo(() => {
    return selectedPlayerIds.map((pId) => {
      const p = players.find((pl) => pl.id === pId) || {
        id: pId,
        displayName: 'Unknown Player',
        number: '?',
        position: 'G/F',
        status: 'Active' as const,
        aliases: [],
      };
      const rec = sessionRecords.find((r) => r.player_id === pId);

      const minutes = isGame && rec?.game_minutes && rec.game_minutes > 0
        ? rec.game_minutes
        : (rec?.duration_min && rec.duration_min > 0 ? rec.duration_min : null);

      const getVal = (mKey: CompareMetricKey) => {
        if (!rec) return null;
        if (mKey === 'RPE') return rec.RPE ?? null;
        const raw = rec[mKey];
        if (raw === null || raw === undefined) return null;
        if (normMode === 'NORMALIZED' && minutes && minutes > 0) {
          return raw / minutes;
        }
        return raw;
      };

      return {
        player: p,
        record: rec || null,
        minutes,
        distance: getVal('distance_m'),
        accel: getVal('accumulated_acceleration_load'),
        accelMin: getVal('accumulated_acceleration_load_per_min'),
        anaerobic: getVal('anaerobic_activity_time'),
        decel: getVal('deceleration_load'),
        decelMin: getVal('deceleration_load_per_min'),
        jump: getVal('jump_load'),
        mech: getVal('mechanical_load'),
        rpe: rec?.RPE ?? null,
        activeValue: getVal(activeMetric),
      };
    });
  }, [selectedPlayerIds, players, sessionRecords, isGame, normMode, activeMetric]);

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
            Compare 2 to 4 Orange Vikings athletes across KINEXON external-load metrics and RPE.
          </p>
        </div>

        {/* Date / Session Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
          <span className="text-xs font-black text-zinc-300 uppercase whitespace-nowrap">Session Date:</span>
          <SessionCalendarPicker
            sessions={sessionsMeta}
            selectedDate={selectedSession?.date || '2026-08-11'}
            onSelectDate={(dateStr) => {
              const matched = sessionsMeta.find((s) => s.date === dateStr);
              if (matched) setSelectedSessionId(matched.id);
            }}
          />
        </div>
      </div>

      {/* Prominent Session Display Banner */}
      <div className="bg-gradient-to-r from-orange-950/40 via-zinc-900 to-zinc-900 border-2 border-orange-500/60 rounded-xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-500 text-zinc-950 px-3 py-1 rounded font-black text-xs uppercase tracking-wider">
            {selectedSession?.session_type || 'PRACTICE'}
          </div>
          <div>
            <div className="text-sm font-black text-white">
              Selected Session Date: <span className="text-orange-400">{selectedSession?.date}</span>
            </div>
            <div className="text-xs text-zinc-400 font-bold">
              {selectedSession?.session_name || 'Orange Vikings Team Session'} • {isGame ? 'Game Minutes Denominator' : 'Total Practice Session Duration Denominator'}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-bold">
          <span className="text-zinc-400">Mode:</span>
          <div className="bg-zinc-950 p-1 rounded-lg border border-zinc-800 flex space-x-1">
            <button
              onClick={() => setNormMode('TOTAL')}
              className={`px-2.5 py-1 rounded text-xs transition-all ${
                normMode === 'TOTAL' ? 'bg-orange-500 text-zinc-950 font-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Total Load
            </button>
            <button
              onClick={() => setNormMode('NORMALIZED')}
              className={`px-2.5 py-1 rounded text-xs transition-all ${
                normMode === 'NORMALIZED' ? 'bg-orange-500 text-zinc-950 font-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Density ({isGame ? 'Per Played Min' : 'Per Session Min'})
            </button>
          </div>
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
                  {formatPlayerNumber(p.number)} {p.displayName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {compareData.map((item) => (
          <div
            key={item.player.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded bg-orange-600/20 text-orange-400 font-black text-xs flex items-center justify-center border border-orange-500/30">
                  {formatPlayerNumber(item.player.number)}
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

            <div className="text-[10px] font-bold text-zinc-500 border-b border-zinc-800 pb-1">
              {isGame
                ? (item.record?.game_minutes ? `Played: ${item.record.game_minutes} min` : 'Game min N/A')
                : (item.record?.duration_min ? `Duration: ${item.record.duration_min} min` : 'Duration N/A')}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-zinc-800/60 pb-1">
                <span className="text-zinc-400">Total Distance:</span>
                <span className="font-extrabold text-amber-400">
                  {item.distance !== null ? `${formatWholeNumber(item.distance)} ${normMode === 'NORMALIZED' ? (isGame ? 'm/min' : 'm/min') : 'm'}` : 'No data'}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-1">
                <span className="text-zinc-400">Accel Load:</span>
                <span className="font-extrabold text-orange-400">
                  {item.accel !== null ? formatWholeNumber(item.accel) : 'No data'}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-1">
                <span className="text-zinc-400">Decel Load:</span>
                <span className="font-extrabold text-rose-400">
                  {item.decel !== null ? formatWholeNumber(item.decel) : 'No data'}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-1">
                <span className="text-zinc-400">Jump Load:</span>
                <span className="font-extrabold text-purple-400">
                  {item.jump !== null ? formatWholeNumber(item.jump) : 'No data'}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-1">
                <span className="text-zinc-400">Mech Load:</span>
                <span className="font-extrabold text-sky-400">
                  {item.mech !== null ? formatWholeNumber(item.mech) : 'No data'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Subjective RPE:</span>
                <span className="font-extrabold text-purple-300">
                  {item.rpe !== null && item.rpe !== undefined ? `${formatWholeNumber(item.rpe)} / 10` : 'Not logged'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Visual Bar Comparison Charts */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-2">
          <h2 className="text-lg font-black text-white tracking-tight flex items-center space-x-2">
            <span>METRIC COMPARISON GRAPHICS</span>
            <span className="text-xs font-extrabold text-orange-400">
              (Session Date: {selectedSession?.date})
            </span>
          </h2>

          <div className="flex flex-wrap gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs font-bold">
            {(Object.keys(METRIC_CONFIG) as CompareMetricKey[]).map((mKey) => (
              <button
                key={mKey}
                onClick={() => setActiveMetric(mKey)}
                className={`px-3 py-1 rounded transition-colors ${
                  activeMetric === mKey ? 'bg-orange-500 text-zinc-950 font-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {METRIC_CONFIG[mKey].label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h3 className="text-sm font-black text-white uppercase tracking-wider" style={{ color: METRIC_CONFIG[activeMetric].color }}>
              {METRIC_CONFIG[activeMetric].label} {normMode === 'NORMALIZED' ? `Density (${isGame ? 'Per Played Min' : 'Per Session Min'})` : 'Total'}
            </h3>
            <span className="text-xs text-zinc-400 font-bold">Date: {selectedSession?.date}</span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={compareData.map((d) => ({
                  name: `${d.player.number} ${d.player.displayName}`,
                  value: d.activeValue !== null && d.activeValue !== undefined ? Number(d.activeValue.toFixed(1)) : 0,
                  rawVal: d.activeValue,
                  playerName: d.player.displayName,
                  date: selectedSession?.date || 'N/A',
                }))}
                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={11} tick={{ fill: '#d4d4d8' }} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickFormatter={(v) => Math.round(v).toString()} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0].payload;
                    const cfg = METRIC_CONFIG[activeMetric];
                    return (
                      <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg text-xs space-y-1 shadow-2xl text-white">
                        <div className="font-black text-orange-400 border-b border-zinc-800 pb-1">
                          {item.playerName}
                        </div>
                        <div>Session Date: <span className="font-bold text-zinc-300">{item.date}</span></div>
                        <div>Metric: <span className="font-bold text-zinc-300">{cfg.label}</span></div>
                        <div>
                          Value: <span className="font-black text-amber-400">
                            {item.rawVal !== null ? `${formatWholeNumber(item.rawVal)} ${cfg.unit}` : 'No data available'}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="value" fill={METRIC_CONFIG[activeMetric].color} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sports Science Disclaimer */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center space-x-3 text-xs text-zinc-400">
        <Info className="w-5 h-5 text-orange-500 shrink-0" />
        <p>
          <strong className="text-zinc-200">Sports Science Principle:</strong> Physical load metrics should be compared within context of playing position, tactical role, and session duration or minutes played during session {selectedSession?.date}.
        </p>
      </div>
    </div>
  );
};
