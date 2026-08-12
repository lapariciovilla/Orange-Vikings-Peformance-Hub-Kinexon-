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

export interface CoreMetrics {
  distance_m: number | null;
  accumulated_acceleration_load: number | null;
  deceleration_load: number | null;
  jump_load: number | null;
  mechanical_load: number | null;
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
  
  // Future / extended fields
  game_minutes?: number | null;
  RPE?: number | null;
  wellness?: number | null;
  training_duration_min?: number | null;
  high_speed_running_m?: number | null;
  maximum_speed_kmh?: number | null;
  notes?: string | null;
  coach_notes?: string | null;

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
  session_id: string;
  date: string;
  rpe_score: number; // 1-10
  rpe_scale: string; // "Borg CR10"
  notes?: string;
  created_at: string;
}

export interface WellnessEntry {
  id: string;
  player_id: string;
  date: string;
  sleep_score: number; // 1-10
  fatigue_score: number; // 1-10
  soreness_score: number; // 1-10
  stress_score: number; // 1-10
  readiness_score: number; // 1-10
  created_at: string;
}

export interface SCIntervention {
  id: string;
  player_id: string;
  date: string;
  exercise: string;
  isometric_type: string;
  joint_angle: string;
  duration_s: number;
  sets: number;
  load_kg?: number;
  target_area: string;
  reason: string;
  created_at: string;
}

export interface CoachSettings {
  green_threshold_pct: number; // e.g. 10%
  yellow_threshold_pct: number; // e.g. 25%
  red_threshold_pct: number; // e.g. >25%
  min_sessions_for_baseline: number; // e.g. 5
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details: string;
}

export interface AIChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  dataSummary?: Record<string, any>;
  calculationMethod?: string;
  type?: 'DATA' | 'CALCULATION' | 'INTERPRETATION' | 'RECOMMENDATION';
}
