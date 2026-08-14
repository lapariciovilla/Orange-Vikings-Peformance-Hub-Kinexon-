export type SessionType = 
  | 'Preseason Practice' 
  | 'Practice' 
  | 'Game' 
  | 'Recovery' 
  | 'Conditioning' 
  | 'Other';

export interface Player {
  id: string;
  number: string;
  displayName: string;
  position: string;
  aliases: string[];
  status: 'ACTIVE' | 'INJURED' | 'LIMITED';
  isConfirmed: boolean;
  notes?: string;
}

// The 5 primary KINEXON external-load metrics
export interface CoreMetrics {
  distance_m: number | null;
  accumulated_acceleration_load: number | null;
  mechanical_load: number | null;
  deceleration_load: number | null;
  jump_load: number | null;
}

export interface RelativeMetrics {
  distance_per_min: number | null;
  accel_load_per_min: number | null;
  mechanical_load_per_min: number | null;
  decel_load_per_min: number | null;
  jump_load_per_min: number | null;
}

export interface PlayerSessionRecord extends CoreMetrics {
  id: string;
  session_id: string;
  date: string; // ISO YYYY-MM-DD
  season: string; // "2026–2027"
  session_type: SessionType;
  session_name?: string;
  player_id: string;
  player_number: string;
  player_name: string;
  position: string;
  
  // Exposure & Internal Load
  duration_min?: number | null;
  game_minutes?: number | null;
  RPE?: number | null;
  sRPE?: number | null;

  // Relative Exposure Metrics
  relative?: RelativeMetrics;

  notes?: string | null;
  source: 'CSV' | 'MANUAL' | 'INITIAL' | 'API';
  created_at: string;
  updated_at?: string;
  edited_by?: string;
}

export interface SessionMeta {
  id: string; // session_id
  date: string;
  season: string;
  session_type: SessionType;
  session_name?: string;
  duration_min?: number;
  monitored_players_count: number;
  opponent?: string;
  game_number?: number;
  location?: string;
  created_at: string;
  updated_at?: string;
}

export interface RPEEntry {
  id: string;
  player_id: string;
  player_number?: string;
  session_id: string;
  date: string;
  rpe_score: number; // 1-10 Borg CR10
  duration_min?: number;
  sRPE?: number; // RPE * duration_min
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface IndividualBaseline {
  metric: keyof CoreMetrics | 'RPE';
  longTermAvg: number | null;
  recentAvg: number | null;
  sampleSize: number;
}

export type FlagStatus = 'GREEN' | 'YELLOW' | 'RED' | 'INSUFFICIENT_HISTORY';

export interface MetricFlag {
  metric: keyof CoreMetrics | 'RPE';
  status: FlagStatus;
  currentValue: number | null;
  baselineValue: number | null;
  pctChange: number | null;
  reason: string;
}

export interface SessionFlagSummary {
  overallStatus: FlagStatus;
  flags: MetricFlag[];
  triggerReasons: string[];
}

export interface CoachSettings {
  yellow_threshold_pct: number; // e.g. 15%
  red_threshold_pct: number; // e.g. 30%
  min_sessions_for_baseline: number; // e.g. 3
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details: string;
}
