import React, { useState } from 'react';
import { PlayerSessionRecord, SessionMeta, CoreMetrics } from '../types';
import { DataStore } from '../lib/dataStore';
import {
  TrendingUp,
  Users,
  Activity,
  Zap,
  Shield,
  ArrowDownCircle,
  HelpCircle,
  Info,
  ChevronRight,
  Upload,
} from 'lucide-react';

interface DashboardViewProps {
  sessionMeta: SessionMeta | null;
  records: PlayerSessionRecord[];
  allSessions: SessionMeta[];
  onSelectPlayer: (playerId: string) => void;
  onNavigateImport: () => void;
}

type MetricKey = keyof CoreMetrics;

const METRIC_CONFIGS: Record<
  MetricKey,
  {
    title: string;
    secondary: string;
    unit: string;
    icon: React.ElementType;
    color: string;
    barColor: string;
  }
> = {
  distance_m: {
    title: 'DISTANCE',
    secondary: 'Total external movement volume',
    unit: 'm',
    icon: Activity,
    color: 'text-amber-500',
    barColor: 'bg-amber-500',
  },
  accumulated_acceleration_load: {
    title: 'ACCUMULATED ACCELERATION LOAD',
    secondary: 'Explosive acceleration demand',
    unit: 'au',
    icon: Zap,
    color: 'text-orange-500',
    barColor: 'bg-orange-500',
  },
  deceleration_load: {
    title: 'DECELERATION LOAD',
    secondary: 'Braking and deceleration demand',
    unit: 'au',
    icon: ArrowDownCircle,
    color: 'text-rose-500',
    barColor: 'bg-rose-500',
  },
  jump_load: {
    title: 'JUMP LOAD',
    secondary: 'Accumulated jump-related exposure',
    unit: 'au',
    icon: TrendingUp,
    color: 'text-purple-400',
    barColor: 'bg-purple-500',
  },
  mechanical_load: {
    title: 'MECHANICAL LOAD',
    secondary: 'Overall mechanical movement demand',
    unit: 'au',
    icon: Shield,
    color: 'text-sky-400',
    barColor: 'bg-sky-500',
  },
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  sessionMeta,
  records,
  onSelectPlayer,
  onNavigateImport,
}) => {
  const [selectedRankMetric, setSelectedRankMetric] = useState<MetricKey>('distance_m');

  const averages = DataStore.calculateTeamAverages(records);

  // Compute rankings for the selected metric
  const sortedRecords = [...records]
    .filter((r) => r[selectedRankMetric] !== null && r[selectedRankMetric] !== undefined)
    .sort((a, b) => (b[selectedRankMetric] as number) - (a[selectedRankMetric] as number));

  const maxRankVal = sortedRecords.length > 0 ? (sortedRecords[0][selectedRankMetric] as number) : 1;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-xs font-black tracking-widest text-orange-500 uppercase mb-1">
              <span>TODAY'S LOAD MONITORING</span>
              <span>•</span>
              <span>{sessionMeta?.season || '2026–2027'}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {sessionMeta ? sessionMeta.session_name || sessionMeta.session_type : 'Session Dashboard'}
            </h1>
            <div className="flex items-center space-x-4 mt-2 text-xs text-zinc-400">
              <span className="bg-zinc-800 px-2.5 py-1 rounded text-zinc-300 font-semibold border border-zinc-700/60">
                {sessionMeta?.session_type || 'Practice'}
              </span>
              <span className="flex items-center text-zinc-300 font-medium">
                <Users className="w-3.5 h-3.5 text-orange-500 mr-1.5" />
                {records.length} Monitored Athletes
              </span>
              <span className="text-zinc-500">Date: {sessionMeta?.date || '2026-08-11'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              id="dash-import-btn"
              onClick={onNavigateImport}
              className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-extrabold px-4 py-2 rounded-lg text-xs flex items-center space-x-2 transition-all shadow-lg shadow-orange-950/40"
            >
              <Upload className="w-4 h-4" />
              <span>IMPORT KINEXON SESSION</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5 Core Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {(Object.keys(METRIC_CONFIGS) as MetricKey[]).map((key) => {
          const cfg = METRIC_CONFIGS[key];
          const Icon = cfg.icon;

          let avgVal: string | number = 'N/A';
          if (key === 'distance_m') {
            avgVal = averages.avg_distance !== null ? `${averages.avg_distance.toLocaleString()} m` : 'N/A';
          } else if (key === 'accumulated_acceleration_load') {
            avgVal = averages.avg_accel !== null ? averages.avg_accel : 'N/A';
          } else if (key === 'deceleration_load') {
            avgVal = averages.avg_decel !== null ? averages.avg_decel : 'N/A';
          } else if (key === 'jump_load') {
            avgVal = averages.avg_jump !== null ? averages.avg_jump : 'N/A';
          } else if (key === 'mechanical_load') {
            avgVal = averages.avg_mechanical !== null ? averages.avg_mechanical : 'N/A';
          }

          const hasData = avgVal !== 'N/A';

          return (
            <div
              key={key}
              className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[11px] font-black tracking-wider uppercase ${cfg.color}`}>
                    {cfg.title}
                  </span>
                  <div className="p-1.5 rounded-md bg-zinc-950 border border-zinc-800">
                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  </div>
                </div>

                <div className="mt-1">
                  <div className="text-2xl font-black text-white tracking-tight">
                    {avgVal}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-medium mt-0.5 leading-tight">
                    {cfg.secondary}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Team Average</span>
                <span className="text-zinc-400 font-semibold">
                  {hasData ? `${records.length} players` : 'Data Pending'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Player Rankings Section */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight flex items-center space-x-2">
              <span>PLAYER LOAD RANKINGS</span>
              <span className="text-xs font-bold text-orange-500 bg-orange-950/60 border border-orange-800/60 px-2 py-0.5 rounded">
                SESSION EXPOSURE
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Ranked individual external load for Coach Luis Aparicio Villa
            </p>
          </div>

          {/* Metric selector tabs */}
          <div className="flex flex-wrap gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            {(Object.keys(METRIC_CONFIGS) as MetricKey[]).map((key) => {
              const cfg = METRIC_CONFIGS[key];
              const isSel = selectedRankMetric === key;
              return (
                <button
                  key={key}
                  id={`rank-tab-${key}`}
                  onClick={() => setSelectedRankMetric(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    isSel
                      ? 'bg-orange-600 text-zinc-950 font-extrabold shadow'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  {cfg.title.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ranking List */}
        {sortedRecords.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs">
            <Info className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            No values available for {METRIC_CONFIGS[selectedRankMetric].title} in this session.
            <div className="mt-2">
              <button
                onClick={onNavigateImport}
                className="text-orange-400 hover:underline font-bold"
              >
                Import Kinexon CSV data to populate full load metrics
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedRecords.map((rec, idx) => {
              const rawVal = rec[selectedRankMetric] as number;
              const formattedVal =
                selectedRankMetric === 'distance_m' ? `${rawVal.toLocaleString()} m` : `${rawVal} au`;
              const barWidthPct = Math.min(100, Math.max(8, (rawVal / maxRankVal) * 100));

              const flag = DataStore.evaluateMetricFlag(rec.player_id, rawVal, selectedRankMetric);

              return (
                <div
                  key={rec.id}
                  onClick={() => onSelectPlayer(rec.player_id)}
                  className="bg-zinc-950/70 border border-zinc-800/80 hover:border-orange-500/50 rounded-lg p-3.5 transition-all cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-center space-x-3 md:w-1/3 min-w-0">
                    <div className="w-7 h-7 rounded bg-zinc-800 group-hover:bg-orange-600 group-hover:text-zinc-950 text-zinc-300 font-extrabold text-xs flex items-center justify-center shrink-0 transition-colors">
                      #{idx + 1}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center space-x-2">
                        <span className="text-orange-400 font-black text-xs">{rec.player_number}</span>
                        <span className="text-white font-bold text-sm truncate group-hover:text-orange-300 transition-colors">
                          {rec.player_name}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500">{rec.position}</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="flex-1 max-w-md">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-zinc-400 font-semibold">{METRIC_CONFIGS[selectedRankMetric].title}</span>
                      <span className="text-white font-extrabold">{formattedVal}</span>
                    </div>
                    <div className="w-full bg-zinc-800/80 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${METRIC_CONFIGS[selectedRankMetric].barColor}`}
                        style={{ width: `${barWidthPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center justify-end space-x-2 md:w-48 shrink-0">
                    {flag.status === 'INSUFFICIENT_HISTORY' ? (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        BASELINE BUILDING
                      </span>
                    ) : flag.status === 'RED' ? (
                      <span className="text-[10px] font-extrabold text-rose-400 bg-rose-950/80 border border-rose-800 px-2.5 py-1 rounded-full uppercase">
                        UNUSUAL (+{flag.pctChange}%)
                      </span>
                    ) : flag.status === 'YELLOW' ? (
                      <span className="text-[10px] font-extrabold text-amber-300 bg-amber-950/80 border border-amber-800 px-2.5 py-1 rounded-full uppercase">
                        ELEVATED (+{flag.pctChange}%)
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2.5 py-1 rounded-full uppercase">
                        NORMAL / EXPECTED
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-orange-400 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scientific Principle & S&C Disclaimer */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-start space-x-3 text-xs text-zinc-400">
        <HelpCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
        <div>
          <div className="text-zinc-200 font-bold mb-1">
            S&C Decision Support Principle — KINEXON External Load
          </div>
          <p className="leading-relaxed">
            KINEXON metrics represent objective external movement exposures (Volume & Intensity). No single metric determines readiness or performance alone. Thresholds are continuously calculated relative to each player's individual historical baseline as sessions accumulate.
          </p>
        </div>
      </div>
    </div>
  );
};
