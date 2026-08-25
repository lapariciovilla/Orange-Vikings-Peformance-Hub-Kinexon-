import React, { useState, useMemo } from 'react';
import { PlayerSessionRecord, SessionMeta, CoreMetrics } from '../types';
import { getPositionalGroup, formatWholeNumber } from '../lib/positionalUtils';
import { SessionCalendarPicker } from './SessionCalendarPicker';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { LineChart as LineChartIcon, Filter, Layers, Calendar } from 'lucide-react';

interface TeamAnalyticsViewProps {
  sessions: SessionMeta[];
  records: PlayerSessionRecord[];
}

type MetricKey = keyof CoreMetrics;

const METRIC_CONFIG: Record<MetricKey, { label: string; unit: string; color: string }> = {
  distance_m: { label: 'Total Distance', unit: 'm', color: '#f97316' },
  accumulated_acceleration_load: { label: 'Accumulated Acceleration Load', unit: 'au', color: '#f59e0b' },
  accumulated_acceleration_load_per_min: { label: 'Accel Load / min', unit: 'au/min', color: '#ea580c' },
  anaerobic_activity_time: { label: 'Anaerobic Activity Time', unit: 'min', color: '#eab308' },
  deceleration_load: { label: 'Deceleration Load', unit: 'au', color: '#f43f5e' },
  deceleration_load_per_min: { label: 'Decel Load / min', unit: 'au/min', color: '#e11d48' },
  jump_load: { label: 'Jump Load', unit: 'au', color: '#a855f7' },
  mechanical_load: { label: 'Mechanical Load', unit: 'au', color: '#38bdf8' },
};

export const TeamAnalyticsView: React.FC<TeamAnalyticsViewProps> = ({ sessions, records }) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('distance_m');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [positionAggMode, setPositionAggMode] = useState<'Average' | 'Total' | 'Maximum'>('Average');

  // Sorted unique session dates
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(sessions.map((s) => s.date))).sort();
    return dates;
  }, [sessions]);

  const [startDate, setStartDate] = useState<string>(availableDates[0] || '');
  const [endDate, setEndDate] = useState<string>(availableDates[availableDates.length - 1] || '');

  // Filter sessions by type and date range
  const filteredSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        if (selectedType !== 'ALL' && s.session_type !== selectedType) return false;
        if (startDate && s.date < startDate) return false;
        if (endDate && s.date > endDate) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date)); // Chronological order for chart
  }, [sessions, selectedType, startDate, endDate]);

  // Filter records corresponding to filtered sessions
  const filteredSessionIds = useMemo(() => new Set(filteredSessions.map((s) => s.id)), [filteredSessions]);
  const filteredRecords = useMemo(
    () => records.filter((r) => filteredSessionIds.has(r.session_id)),
    [records, filteredSessionIds]
  );

  // Prepare chart data for selected metric across dates
  const teamTrendData = useMemo(() => {
    return filteredSessions.map((s) => {
      const sRecords = filteredRecords.filter((r) => r.session_id === s.id);
      const vals = sRecords
        .map((r) => r[selectedMetric])
        .filter((v): v is number => v !== null && v !== undefined);

      let metricVal = 0;
      if (vals.length > 0) {
        const sum = vals.reduce((a, b) => a + b, 0);
        metricVal = Math.round(sum / vals.length); // Team Average
      }

      return {
        date: s.date,
        name: `${s.date} (${s.session_type})`,
        value: metricVal,
        playerCount: sRecords.length,
      };
    });
  }, [filteredSessions, filteredRecords, selectedMetric]);

  // Compute Positional Group Exposure
  const positionalData = useMemo(() => {
    const groups: Record<'POINT GUARDS' | 'FORWARDS' | 'CENTERS', number[]> = {
      'POINT GUARDS': [],
      FORWARDS: [],
      CENTERS: [],
    };

    filteredRecords.forEach((r) => {
      const group = getPositionalGroup({
        id: r.player_id,
        number: r.player_number,
        player_name: r.player_name,
        position: r.position,
      });

      const val = r[selectedMetric];
      if (val !== null && val !== undefined) {
        groups[group].push(val);
      }
    });

    const computeStat = (vals: number[]): number => {
      if (vals.length === 0) return 0;
      if (positionAggMode === 'Total') {
        return Math.round(vals.reduce((a, b) => a + b, 0));
      }
      if (positionAggMode === 'Maximum') {
        return Math.round(Math.max(...vals));
      }
      // Average
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    };

    return [
      {
        group: 'POINT GUARDS',
        subLabel: 'Furuno (#2), Kodama (#14), Tawatari (#78)',
        value: computeStat(groups['POINT GUARDS']),
        sampleSize: groups['POINT GUARDS'].length,
      },
      {
        group: 'FORWARDS',
        subLabel: 'Hayashi (#1), Aoki (#8), Toshino (#13), Takeuchi (#17), Hines (#44)',
        value: computeStat(groups.FORWARDS),
        sampleSize: groups.FORWARDS.length,
      },
      {
        group: 'CENTERS',
        subLabel: 'Parker (#3), Radovic (#11), Haarms (#16), Watt (#50), Tamaki (#65)',
        value: computeStat(groups.CENTERS),
        sampleSize: groups.CENTERS.length,
      },
    ];
  }, [filteredRecords, selectedMetric, positionAggMode]);

  const activeMetricMeta = METRIC_CONFIG[selectedMetric];

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
            Analyze team physical workloads across sessions, dates, and positional groups.
          </p>
        </div>

        {/* Metric Selector Dropdown */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="text-xs font-extrabold text-orange-400 uppercase tracking-wider whitespace-nowrap">
            Select Metric:
          </label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
            className="bg-zinc-950 border-2 border-orange-500 text-white font-black text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-lg"
          >
            {Object.entries(METRIC_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date Range & Session Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-zinc-300 uppercase">From Date:</span>
            <SessionCalendarPicker
              sessions={sessions}
              selectedDate={startDate}
              onSelectDate={(d) => setStartDate(d)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-zinc-300 uppercase">To Date:</span>
            <SessionCalendarPicker
              sessions={sessions}
              selectedDate={endDate}
              onSelectDate={(d) => setEndDate(d)}
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Filter className="w-4 h-4 text-zinc-400" />
          <span className="font-bold text-zinc-400">Session Type:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 text-white font-bold rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
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

      {/* Main Team Trend Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div>
            <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
              TIMELINE EVOLUTION
            </div>
            <h2 className="text-base font-black text-white tracking-tight">
              TEAM AVERAGE: {activeMetricMeta.label.toUpperCase()} {activeMetricMeta.unit ? `(${activeMetricMeta.unit})` : ''}
            </h2>
          </div>
          <div className="text-xs text-zinc-400 font-bold">
            Displaying actual dates ({filteredSessions.length} sessions selected)
          </div>
        </div>

        <div className="h-72 w-full">
          {teamTrendData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
              No sessions found for selected date range and filter.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#a1a1aa" fontSize={11} fontWeight={700} />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={11}
                  tickFormatter={(val) => Math.round(val).toString()}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#09090b',
                    borderColor: '#3f3f46',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                  formatter={(val: number) => [`${formatWholeNumber(val)} ${activeMetricMeta.unit}`, activeMetricMeta.label]}
                  labelFormatter={(label) => `Session Date: ${label}`}
                />
                <Bar dataKey="value" name={activeMetricMeta.label} fill={activeMetricMeta.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Positional Group Exposure Comparison */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-base font-black text-white tracking-tight uppercase">
                POSITIONAL GROUP EXPOSURE COMPARISON
              </h2>
              <p className="text-xs text-zinc-400">
                Comparing {activeMetricMeta.label} across Guards, Forwards, and Centers.
              </p>
            </div>
          </div>

          {/* Aggregation Mode Selector: Average, Total, Maximum */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-extrabold text-zinc-400 uppercase">Calculation:</span>
            <div className="bg-zinc-950 p-1 rounded-lg border border-zinc-800 flex space-x-1 font-extrabold">
              {(['Average', 'Total', 'Maximum'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPositionAggMode(mode)}
                  className={`px-3 py-1 rounded text-xs transition-all ${
                    positionAggMode === mode
                      ? 'bg-orange-500 text-zinc-950 font-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {positionalData.map((item) => (
            <div
              key={item.group}
              className="bg-zinc-950 border-2 border-zinc-800 hover:border-orange-500/60 rounded-xl p-5 space-y-3 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-black text-orange-400 uppercase tracking-wider block">
                    {item.group}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-bold">{item.subLabel}</span>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                  {positionAggMode.toUpperCase()}
                </span>
              </div>

              <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800/80 text-center space-y-1">
                <div className="text-[10px] font-extrabold text-zinc-400 uppercase">
                  {activeMetricMeta.label}
                </div>
                <div className="text-2xl font-black text-white">
                  {formatWholeNumber(item.value)} {activeMetricMeta.unit}
                </div>
                <div className="text-[10px] text-zinc-500 font-bold">
                  Based on {item.sampleSize} player entries
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Visual Bar Comparison for Positional Groups */}
        <div className="pt-4">
          <div className="text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
            Positional Group Visual Comparison ({positionAggMode}):
          </div>
          <div className="h-48 w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={positionalData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="group" stroke="#a1a1aa" fontSize={11} fontWeight={700} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickFormatter={(val) => Math.round(val).toString()} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#09090b',
                    borderColor: '#3f3f46',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                  formatter={(val: number) => [`${formatWholeNumber(val)} ${activeMetricMeta.unit}`, `${positionAggMode} ${activeMetricMeta.label}`]}
                />
                <Bar dataKey="value" fill={activeMetricMeta.color} radius={[4, 4, 0, 0]}>
                  {positionalData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#f97316' : index === 1 ? '#f59e0b' : '#38bdf8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
