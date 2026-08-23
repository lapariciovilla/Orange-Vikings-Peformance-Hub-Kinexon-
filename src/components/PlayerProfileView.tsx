import React, { useState } from 'react';
import { Player, CoreMetrics, PlayerSessionRecord } from '../types';
import { DataStore } from '../lib/dataStore';
import { formatWholeNumber } from '../lib/positionalUtils';
import {
  ResponsiveContainer,
  ComposedChart,
  ScatterChart,
  Scatter,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  LineChart as LineChartIcon,
  HelpCircle,
  TrendingUp,
  BarChart2,
} from 'lucide-react';

interface PlayerProfileViewProps {
  players: Player[];
  selectedPlayerId: string;
  onSelectPlayer: (id: string) => void;
}

type SessionFilter = 'LAST 5' | 'LAST 10' | 'LAST 20' | 'ALL';
type NormalizationMode = 'TOTAL' | 'NORMALIZED';

const METRIC_LABELS: Record<keyof CoreMetrics, { name: string; unit: string; color: string }> = {
  distance_m: { name: 'Total Distance', unit: 'm', color: '#f59e0b' },
  accumulated_acceleration_load: { name: 'Accumulated Accel Load', unit: 'au', color: '#f97316' },
  accumulated_acceleration_load_per_min: { name: 'Accel Load / min', unit: 'au/min', color: '#ea580c' },
  anaerobic_activity_time: { name: 'Anaerobic Activity Time', unit: 's', color: '#eab308' },
  deceleration_load: { name: 'Deceleration Load', unit: 'au', color: '#f43f5e' },
  deceleration_load_per_min: { name: 'Decel Load / min', unit: 'au/min', color: '#e11d48' },
  jump_load: { name: 'Jump Load', unit: 'au', color: '#a855f7' },
  mechanical_load: { name: 'Mechanical Load', unit: 'au', color: '#38bdf8' },
};

function calculatePearsonR(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 3) return null;
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (den === 0) return 0;
  return Number((num / den).toFixed(2));
}

function calculateMedian(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function calculateStdDev(arr: number[], mean: number): number | null {
  if (arr.length < 2) return null;
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function calculatePercentile(val: number, arr: number[]): number | null {
  if (arr.length === 0) return null;
  const countBelow = arr.filter((x) => x < val).length;
  const countEqual = arr.filter((x) => x === val).length;
  return Math.round(((countBelow + 0.5 * countEqual) / arr.length) * 100);
}

export const PlayerProfileView: React.FC<PlayerProfileViewProps> = ({
  players,
  selectedPlayerId,
  onSelectPlayer,
}) => {
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('ALL');
  const [activeMetricTab, setActiveMetricTab] = useState<keyof CoreMetrics>('distance_m');
  const [normMode, setNormMode] = useState<NormalizationMode>('TOTAL');

  const player = players.find((p) => p.id === selectedPlayerId) || players[0];
  const allRecords = DataStore.getRecordsForPlayer(player?.id || '');

  // Filter records based on count
  const filteredRecords = allRecords.slice(
    0,
    sessionFilter === 'LAST 5' ? 5 : sessionFilter === 'LAST 10' ? 10 : sessionFilter === 'LAST 20' ? 20 : allRecords.length
  );

  // Helper to extract metric value (total vs density)
  const getMetricValue = (r: PlayerSessionRecord, metricKey: keyof CoreMetrics, norm: NormalizationMode): number | null => {
    const rawVal = r[metricKey];
    if (rawVal === null || rawVal === undefined) return null;
    if (norm === 'TOTAL') return rawVal;

    // Normalization logic:
    // Game: load / game_minutes
    // Practice: load / duration_min
    const minutes = r.session_type === 'Game' && r.game_minutes && r.game_minutes > 0
      ? r.game_minutes
      : (r.duration_min && r.duration_min > 0 ? r.duration_min : null);

    if (!minutes || minutes <= 0) return null;
    return rawVal / minutes;
  };

  const activeMetricMeta = METRIC_LABELS[activeMetricTab];

  // Calculate current & highest values
  const validMetricVals = filteredRecords
    .map((r) => getMetricValue(r, activeMetricTab, normMode))
    .filter((v): v is number => v !== null && v !== undefined);

  const currentVal = validMetricVals.length > 0 ? validMetricVals[0] : null;
  const highestVal = validMetricVals.length > 0 ? Math.max(...validMetricVals) : null;

  const flagEvaluation = DataStore.evaluateMetricFlag(player?.id || '', currentVal, activeMetricTab);

  // Chronological chart data
  const chartData = [...filteredRecords].reverse().map((r) => {
    const minutes = r.session_type === 'Game' && r.game_minutes && r.game_minutes > 0
      ? r.game_minutes
      : (r.duration_min && r.duration_min > 0 ? r.duration_min : null);

    const extVal = getMetricValue(r, activeMetricTab, normMode);

    let normLabel = 'Total';
    let minutesLabel = 'Duration: N/A';
    if (r.session_type === 'Game') {
      normLabel = normMode === 'NORMALIZED' ? 'Per Played Min' : 'Total Game Load';
      minutesLabel = r.game_minutes ? `${r.game_minutes} played min` : 'Game min N/A';
    } else {
      normLabel = normMode === 'NORMALIZED' ? 'Per Session Min' : 'Total Practice Load';
      minutesLabel = r.duration_min ? `${r.duration_min} session min` : 'Duration N/A';
    }

    return {
      date: r.date,
      session_type: r.session_type,
      session_name: r.session_name || r.session_type,
      extVal: extVal !== null ? Math.round(extVal) : 0,
      rpe: r.RPE ?? null,
      rawDistance: r.distance_m ?? 0,
      rawAccel: r.accumulated_acceleration_load ?? 0,
      rawDecel: r.deceleration_load ?? 0,
      rawJump: r.jump_load ?? 0,
      rawMech: r.mechanical_load ?? 0,
      durationMin: r.duration_min ?? null,
      gameMinutes: r.game_minutes ?? null,
      minutes,
      normLabel,
      minutesLabel,
    };
  });

  const latestRecord = allRecords.length > 0 ? allRecords[0] : null;

  // Scatter plot data for valid points (where both extVal & RPE exist)
  const scatterData = chartData
    .filter((d) => d.rpe !== null && d.extVal !== null)
    .map((d) => ({
      x: d.extVal,
      y: d.rpe!,
      date: d.date,
      session_type: d.session_type,
      durationMin: d.durationMin,
      gameMinutes: d.gameMinutes,
      minutesLabel: d.minutesLabel,
      rawDistance: d.rawDistance,
      rawAccel: d.rawAccel,
      rawDecel: d.rawDecel,
      rawJump: d.rawJump,
      rawMech: d.rawMech,
    }));

  // Pearson Correlation Analysis
  const correlationPairs = chartData.filter((d) => d.rpe !== null && d.extVal !== null);
  const xVals = correlationPairs.map((d) => d.extVal);
  const yVals = correlationPairs.map((d) => d.rpe!);
  const pearsonR = calculatePearsonR(xVals, yVals);

  let corrDirection = 'Weak / Insignificant relationship';
  if (pearsonR !== null) {
    if (pearsonR >= 0.7) corrDirection = 'Strong positive relationship (Higher load → Higher RPE)';
    else if (pearsonR >= 0.3) corrDirection = 'Moderate positive relationship';
    else if (pearsonR <= -0.7) corrDirection = 'Strong inverse relationship (Higher load → Lower RPE)';
    else if (pearsonR <= -0.3) corrDirection = 'Moderate inverse relationship';
  }

  // Individual Response Analysis (Observations)
  let responseObservation = 'Sufficient data logged for individual monitoring.';
  if (correlationPairs.length >= 2) {
    const latest = correlationPairs[correlationPairs.length - 1]; // chronologically newest
    const avgExt = xVals.reduce((a, b) => a + b, 0) / xVals.length;
    const avgRpe = yVals.reduce((a, b) => a + b, 0) / yVals.length;

    if (latest.extVal > avgExt * 1.15 && latest.rpe > avgRpe * 1.15) {
      responseObservation = 'High external load with elevated perceived exertion.';
    } else if (latest.extVal < avgExt * 0.85 && latest.rpe > avgRpe * 1.15) {
      responseObservation = 'Higher perceived exertion despite lower external load.';
    } else if (latest.extVal > avgExt * 1.15 && latest.rpe < avgRpe * 0.85) {
      responseObservation = 'Higher external output with lower perceived exertion.';
    } else {
      responseObservation = 'Proportional perceived exertion response relative to external physical output.';
    }
  }

  // Baseline Statistics (Mean, Median, StdDev, Range, Percentile)
  const baselineValues = filteredRecords
    .map((r) => getMetricValue(r, activeMetricTab, normMode))
    .filter((v): v is number => v !== null && v !== undefined);

  const sampleSize = baselineValues.length;
  const meanVal = sampleSize > 0 ? baselineValues.reduce((a, b) => a + b, 0) / sampleSize : null;
  const medianVal = calculateMedian(baselineValues);
  const stdDev = meanVal !== null ? calculateStdDev(baselineValues, meanVal) : null;
  const recentVal = baselineValues.length > 0 ? baselineValues[0] : null;
  const percentileRank = recentVal !== null && sampleSize >= 3 ? calculatePercentile(recentVal, baselineValues) : null;

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

        {/* Player Selector & Filters */}
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
            {(['LAST 5', 'LAST 10', 'LAST 20', 'ALL'] as SessionFilter[]).map((sf) => (
              <button
                key={sf}
                onClick={() => setSessionFilter(sf)}
                className={`px-2.5 py-1.5 rounded font-bold transition-colors ${
                  sessionFilter === sf
                    ? 'bg-orange-600 text-zinc-950 font-extrabold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {sf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Baseline / Flag Evaluation Banner */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <Activity className="w-5 h-5 text-orange-500" />
          <div>
            <div className="text-xs font-black text-white uppercase tracking-wider">
              INDIVIDUAL BASELINE & MONITORING STATUS
            </div>
            <div className="text-xs text-zinc-400">
              {flagEvaluation.reason}
            </div>
          </div>
        </div>

        <div>
          {flagEvaluation.status === 'INSUFFICIENT_HISTORY' ? (
            <div className="flex items-center space-x-2 bg-amber-950/80 border border-amber-800 text-amber-300 px-3 py-1.5 rounded-lg text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>INSUFFICIENT HISTORY (&lt; 3 SESSIONS)</span>
            </div>
          ) : flagEvaluation.status === 'RED' ? (
            <div className="flex items-center space-x-2 bg-rose-950/80 border border-rose-800 text-rose-300 px-3 py-1.5 rounded-lg text-xs font-black">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>HIGH / UNUSUAL EXPOSURE (+{flagEvaluation.pctChange}%)</span>
            </div>
          ) : flagEvaluation.status === 'YELLOW' ? (
            <div className="flex items-center space-x-2 bg-amber-950/80 border border-amber-800 text-amber-300 px-3 py-1.5 rounded-lg text-xs font-black">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>ELEVATED EXPOSURE (+{flagEvaluation.pctChange}%)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-emerald-950/80 border border-emerald-800 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-black">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>EXPECTED INDIVIDUAL RANGE</span>
            </div>
          )}
        </div>
      </div>

      {/* Metric Selector & Normalization Controls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Metric Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
          <span className="text-zinc-400 mr-1 uppercase text-[10px] tracking-wider">Core Metric:</span>
          {(Object.keys(METRIC_LABELS) as (keyof CoreMetrics)[]).map((mKey) => (
            <button
              key={mKey}
              onClick={() => setActiveMetricTab(mKey)}
              className={`px-3 py-1.5 rounded transition-all ${
                activeMetricTab === mKey
                  ? 'bg-orange-500 text-zinc-950 font-black shadow'
                  : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
              }`}
            >
              {METRIC_LABELS[mKey].name}
            </button>
          ))}
        </div>

        {/* Normalization Mode Selector */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-zinc-400 font-bold uppercase text-[10px] tracking-wider">Value Mode:</span>
          <div className="bg-zinc-950 p-1 rounded-lg border border-zinc-800 flex space-x-1 font-bold">
            <button
              onClick={() => setNormMode('TOTAL')}
              className={`px-3 py-1 rounded transition-all ${
                normMode === 'TOTAL'
                  ? 'bg-orange-500 text-zinc-950 font-black shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Total Load
            </button>
            <button
              onClick={() => setNormMode('NORMALIZED')}
              className={`px-3 py-1 rounded transition-all ${
                normMode === 'NORMALIZED'
                  ? 'bg-orange-500 text-zinc-950 font-black shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Session / Game Density
            </button>
          </div>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase">LATEST EXPOSURE</span>
          <div className="text-xl font-black text-orange-400 mt-1">
            {currentVal !== null ? formatWholeNumber(currentVal) : 'N/A'}
          </div>
          <div className="text-[10px] text-zinc-400 font-semibold mt-1">
            {normMode === 'NORMALIZED'
              ? (latestRecord?.session_type === 'Game' ? 'Per Played Minute' : 'Per Session Minute')
              : 'Absolute Load'}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase">INDIVIDUAL BASELINE</span>
          <div className="text-xl font-black text-amber-400 mt-1">
            {meanVal !== null ? formatWholeNumber(meanVal) : 'Building...'}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">
            {sampleSize >= 3 ? `${sampleSize}-Session Mean` : 'Insufficient History'}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase">PEAK EXPOSURE</span>
          <div className="text-xl font-black text-rose-400 mt-1">
            {highestVal !== null ? formatWholeNumber(highestVal) : 'N/A'}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Session Max</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase">SUBJECTIVE RPE</span>
          <div className="text-xl font-black text-purple-400 mt-1">
            {latestRecord?.RPE !== null && latestRecord?.RPE !== undefined ? `${formatWholeNumber(latestRecord.RPE)} / 10` : 'Not Logged'}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Authoritative RPE</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase">MONITORED SESSIONS</span>
          <div className="text-xl font-black text-white mt-1">{filteredRecords.length}</div>
          <div className="text-[10px] text-zinc-500 mt-1">Full Season Log</div>
        </div>
      </div>

      {/* SECTION 1: LONGITUDINAL TRAJECTORY CHART (RPE & EXTERNAL LOAD TREND) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
          <div className="flex items-center space-x-2">
            <LineChartIcon className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-base font-black text-white tracking-tight uppercase">
                RPE & EXTERNAL LOAD TREND OVER TIME
              </h2>
              <p className="text-xs text-zinc-400">
                Visualizing {activeMetricMeta.name} ({normMode === 'NORMALIZED' ? 'Density' : 'Total'}) alongside Subjective RPE (1–10).
              </p>
            </div>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
              No session data logged for this timeframe.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
                <YAxis
                  yAxisId="left"
                  stroke={activeMetricMeta.color}
                  fontSize={11}
                  tickFormatter={(v) => Math.round(v).toString()}
                  label={{
                    value: `${activeMetricMeta.name} ${normMode === 'NORMALIZED' ? 'Density' : 'Total'}`,
                    angle: -90,
                    position: 'insideLeft',
                    fill: activeMetricMeta.color,
                    fontSize: 10,
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 10]}
                  stroke="#c084fc"
                  fontSize={11}
                  label={{ value: 'RPE (1-10)', angle: 90, position: 'insideRight', fill: '#c084fc', fontSize: 10 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg text-xs space-y-1.5 shadow-2xl text-white">
                        <div className="font-black text-orange-400 border-b border-zinc-800 pb-1">
                          {data.date} ({data.session_type})
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-zinc-400 font-medium">{activeMetricMeta.name}:</span>
                          <span className="font-bold text-amber-400">
                            {formatWholeNumber(data.extVal)} {activeMetricMeta.unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-zinc-400 font-medium">Subjective RPE:</span>
                          <span className="font-bold text-purple-400">
                            {data.rpe !== null && data.rpe !== undefined ? `${data.rpe} / 10` : 'Not Logged'}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/80">
                          Denominator: {data.minutesLabel}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="extVal"
                  name={`${activeMetricMeta.name} (${normMode === 'NORMALIZED' ? 'Density' : 'Total'})`}
                  fill={activeMetricMeta.color}
                  opacity={0.8}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rpe"
                  name="Subjective RPE (1-10)"
                  stroke="#c084fc"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#c084fc' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* SECTION 2 & 3: INTERNAL VS EXTERNAL LOAD SCATTER PLOT & INDIVIDUAL RESPONSE ANALYSIS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scatter Plot */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2 border-b border-zinc-800 pb-3">
            <BarChart2 className="w-5 h-5 text-purple-400" />
            <div>
              <h2 className="text-base font-black text-white tracking-tight uppercase">
                INTERNAL (RPE) VS. EXTERNAL LOAD SCATTER PLOT
              </h2>
              <p className="text-xs text-zinc-400">
                X-axis: {activeMetricMeta.name} ({normMode === 'NORMALIZED' ? 'Density' : 'Total'}) • Y-axis: RPE (1–10)
              </p>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            {scatterData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                Insufficient synchronized RPE and external load session pairs.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name={activeMetricMeta.name}
                    stroke="#71717a"
                    fontSize={11}
                    tickFormatter={(v) => Math.round(v).toString()}
                    label={{
                      value: `${activeMetricMeta.name} (${normMode === 'NORMALIZED' ? 'Density' : 'Total'})`,
                      position: 'insideBottom',
                      offset: -5,
                      fill: '#a1a1aa',
                      fontSize: 10,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="RPE"
                    domain={[0, 10]}
                    stroke="#c084fc"
                    fontSize={11}
                    label={{ value: 'RPE (1-10)', angle: -90, position: 'insideLeft', fill: '#c084fc', fontSize: 10 }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const pt = payload[0].payload;
                      return (
                        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg text-xs space-y-1 shadow-2xl text-white">
                          <div className="font-black text-orange-400 border-b border-zinc-800 pb-1">
                            {pt.date} ({pt.session_type})
                          </div>
                          <div>Subjective RPE: <strong className="text-purple-400">{pt.y} / 10</strong></div>
                          <div>
                            {activeMetricMeta.name}:{' '}
                            <strong className="text-amber-400">{formatWholeNumber(pt.x)}</strong>
                          </div>
                          <div className="text-[10px] text-zinc-400">{pt.minutesLabel}</div>
                          <div className="pt-1 text-[10px] text-zinc-500 space-y-0.5 border-t border-zinc-800/80">
                            <div>Distance: {formatWholeNumber(pt.rawDistance)} m</div>
                            <div>Accel Load: {formatWholeNumber(pt.rawAccel)}</div>
                            <div>Decel Load: {formatWholeNumber(pt.rawDecel)}</div>
                            <div>Jump Load: {formatWholeNumber(pt.rawJump)}</div>
                            <div>Mech Load: {formatWholeNumber(pt.rawMech)}</div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Scatter name="Sessions" data={scatterData} fill="#f97316" radius={6} />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Individual Response Analysis Observation Box */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 border-b border-zinc-800 pb-3">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-black text-white tracking-tight uppercase">
                INDIVIDUAL RESPONSE ANALYSIS
              </h2>
            </div>

            <div className="mt-4 space-y-3">
              <div className="text-xs text-zinc-400">
                Longitudinal internal/external-load response observation for {player.displayName}:
              </div>

              <div className="bg-zinc-950 p-4 rounded-xl border-2 border-orange-500/40 text-xs font-bold text-orange-300 space-y-2">
                <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                  MONITORING OBSERVATION
                </div>
                <p className="text-sm font-black text-white leading-relaxed">
                  "{responseObservation}"
                </p>
              </div>

              {/* Correlation Summary Box */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2 text-xs">
                <div className="text-[10px] font-black text-purple-400 uppercase tracking-wider flex items-center justify-between">
                  <span>RPE VS {activeMetricMeta.name.toUpperCase()} CORRELATION</span>
                  <HelpCircle className="w-3.5 h-3.5" />
                </div>

                {pearsonR === null ? (
                  <div className="text-zinc-500 text-xs font-semibold italic">
                    Insufficient historical data for reliable correlation analysis.
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Sample Size (N):</span>
                      <strong className="text-white">{xVals.length} sessions</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Pearson r:</span>
                      <strong className="text-purple-400 font-mono text-sm">{pearsonR}</strong>
                    </div>
                    <div className="text-[11px] text-zinc-300 font-semibold pt-1 border-t border-zinc-800">
                      {corrDirection}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-zinc-500 font-medium italic border-t border-zinc-800 pt-3">
            Note: Observations reflect statistical workload relationships and do not imply medical diagnosis or fatigue state.
          </div>
        </div>
      </div>

      {/* SECTION 5: INDIVIDUAL BASELINE & PERCENTILE STATISTICS */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-black text-white tracking-tight uppercase border-b border-zinc-800 pb-3">
          INDIVIDUAL BASELINE & LONGITUDINAL PROFILE
        </h2>

        {sampleSize < 3 ? (
          <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-800 text-center text-zinc-400 text-xs font-bold space-y-1">
            <AlertCircle className="w-6 h-6 text-amber-500 mx-auto mb-1" />
            <div>INSUFFICIENT HISTORICAL DATA</div>
            <div className="text-zinc-500 font-normal">
              At least 3 monitored sessions are required to compute reliable individual baselines, standard deviations, and percentile rankings.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-xs">
            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-500 font-extrabold uppercase block">SAMPLE SIZE</span>
              <span className="text-lg font-black text-white mt-1 block">{sampleSize} Sessions</span>
            </div>

            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-500 font-extrabold uppercase block">LONG-TERM MEAN</span>
              <span className="text-lg font-black text-amber-400 mt-1 block">
                {meanVal !== null ? formatWholeNumber(meanVal) : 'N/A'}
              </span>
            </div>

            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-500 font-extrabold uppercase block">MEDIAN VALUE</span>
              <span className="text-lg font-black text-orange-400 mt-1 block">
                {medianVal !== null ? formatWholeNumber(medianVal) : 'N/A'}
              </span>
            </div>

            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-500 font-extrabold uppercase block">STD DEVIATION</span>
              <span className="text-lg font-black text-sky-400 mt-1 block">
                {stdDev !== null ? `±${formatWholeNumber(stdDev)}` : 'N/A'}
              </span>
            </div>

            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-500 font-extrabold uppercase block">TYPICAL RANGE (±1 SD)</span>
              <span className="text-xs font-black text-emerald-400 mt-1 block font-mono">
                {meanVal !== null && stdDev !== null
                  ? `${formatWholeNumber(Math.max(0, meanVal - stdDev))} – ${formatWholeNumber(meanVal + stdDev)}`
                  : 'N/A'}
              </span>
            </div>

            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-500 font-extrabold uppercase block">PERCENTILE RANK</span>
              <span className="text-lg font-black text-purple-400 mt-1 block">
                {percentileRank !== null ? `${percentileRank}th %ile` : 'N/A'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 6: DETAILED SESSION LOAD LOG TABLE */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <h3 className="text-xs font-black text-zinc-300 uppercase tracking-wider border-b border-zinc-800 pb-2">
          SESSION-BY-SESSION LOAD LOG ({filteredRecords.length} SESSIONS)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-950 text-zinc-400 font-extrabold border-b border-zinc-800">
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5">Denominator</th>
                <th className="p-2.5 text-right">Distance (m)</th>
                <th className="p-2.5 text-right">Accel Load</th>
                <th className="p-2.5 text-right">Decel Load</th>
                <th className="p-2.5 text-right">Jump Load</th>
                <th className="p-2.5 text-right">Mech Load</th>
                <th className="p-2.5 text-right">RPE (1-10)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {filteredRecords.map((r) => {
                const isGame = r.session_type === 'Game';
                const minutesText = isGame
                  ? (r.game_minutes ? `${r.game_minutes} played min` : 'Game min N/A')
                  : (r.duration_min ? `${r.duration_min} session min` : 'Duration N/A');

                return (
                  <tr key={`${r.session_id}-${r.player_id}`} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="p-2.5 font-bold text-white">{r.date}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                        isGame ? 'bg-rose-950/80 border-rose-800 text-rose-400' : 'bg-zinc-950 border-zinc-800 text-orange-400'
                      }`}>
                        {r.session_type}
                      </span>
                    </td>
                    <td className="p-2.5 text-zinc-400 font-semibold">{minutesText}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-amber-400">
                      {r.distance_m !== null ? formatWholeNumber(r.distance_m) : 'N/A'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-orange-400">
                      {r.accumulated_acceleration_load !== null ? formatWholeNumber(r.accumulated_acceleration_load) : 'N/A'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-rose-400">
                      {r.deceleration_load !== null ? formatWholeNumber(r.deceleration_load) : 'N/A'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-purple-400">
                      {r.jump_load !== null ? formatWholeNumber(r.jump_load) : 'N/A'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-sky-400">
                      {r.mechanical_load !== null ? formatWholeNumber(r.mechanical_load) : 'N/A'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-purple-300">
                      {r.RPE !== null && r.RPE !== undefined ? `${formatWholeNumber(r.RPE)} / 10` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
