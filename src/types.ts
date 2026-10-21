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

// The 8 primary external-load tracking metrics
export interface CoreMetrics {
  distance_m: number | null;
  accumulated_acceleration_load: number | null;
  accumulated_acceleration_load_per_min: number | null;
  anaerobic_activity_time: number | null; // in seconds
  deceleration_load: number | null;
  deceleration_load_per_min: number | null;
  jump_load: number | null;
  mechanical_load: number | null;
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
  session_id?: string | null;
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

export type FlagStatus = 'GREEN' | 'YELLOW' | 'RED' | 'LIMITED_PLAYING_TIME' | 'INSUFFICIENT_HISTORY';

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

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | string;

export type ReferenceType =
  | 'Individual Game'
  | 'Individual Practice'
  | 'Position Reference'
  | 'Team Reference'
  | 'Insufficient Data';

export type DataConfidenceLabel =
  | 'Insufficient Data (n<3)'
  | 'Exploratory (n=3-4)'
  | 'Provisional (n=5-7)'
  | 'Individual Threshold (n>=8)'
  | 'Stable Distribution (n>=10)'
  | 'High Confidence (n>=15)';

export type ExposureStatus =
  | 'BELOW_TYPICAL'
  | 'TYPICAL'
  | 'ABOVE_TYPICAL'
  | 'HIGH_EXPOSURE'
  | 'VERY_HIGH_HISTORICAL'
  | 'LIMITED_PLAYING_TIME'
  | 'INSUFFICIENT_DATA';

export interface PlayerMetricThreshold {
  playerId: string;
  playerName: string;
  position: string;
  metric: keyof CoreMetrics;
  context: 'GAME' | 'PRACTICE';
  n: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
  cvPct: number | null;
  min: number | null;
  max: number | null;
  iqr: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  lowerTarget: number | null;
  typicalTarget: number | null;
  highThreshold: number | null;
  veryHighThreshold: number | null;
  historicalMax: number | null;
  referenceType: ReferenceType;
  confidenceLabel: DataConfidenceLabel;
  disclaimer: string | null;
}

// ====================================================
// S&C PLAYER STATUS, INJURY & CLEARANCE DOMAIN MODEL
// ====================================================

export type StaffClearanceStatus =
  | 'FULL_CLEARANCE'
  | 'MODIFIED'
  | 'RTP'
  | 'INJURED'
  | 'UNKNOWN';

export type RTPStage =
  | 'STAGE_1_ACUTE'
  | 'STAGE_2_LOW_INTENSITY'
  | 'STAGE_3_MODIFIED_NON_CONTACT'
  | 'STAGE_4_FULL_CONTACT'
  | 'STAGE_5_COMPETITION'
  | 'CLEARED'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN';

export interface PlayerStatusAssessment {
  id: string;
  player_id: string;
  player_name?: string;
  player_number?: string;
  date: string; // ISO YYYY-MM-DD
  timestamp: string; // ISO datetime
  assessed_by: string; // e.g. "Coach Luis Aparicio Villa (S&C)"
  
  // Clearance status
  clearance_status: StaffClearanceStatus;
  
  // Daily Readiness & Perceived Strain
  wellness_score?: number | null; // 1-5 scale (1=Poor/Fatigued, 5=Optimal)
  rpe_score?: number | null; // 1-10 Borg CR10
  
  // Soreness & Localized Musculoskeletal Symptoms
  soreness_score?: number | null; // 1-5 scale (1=None/Fresh, 5=Severe soreness)
  soreness_body_area?: string | null; // e.g. "Left Hamstring", "Patellar Tendon", "Groin", "Lower Back", "Right Ankle", "None"
  
  // Injury Diagnostics & Tracking
  has_active_injury: boolean;
  injury_type?: string | null; // e.g. "Hamstring Strain", "Ankle Inversion Sprain", "Patellar Tendinopathy", "Contusion"
  injury_date?: string | null; // ISO YYYY-MM-DD
  affected_side?: 'LEFT' | 'RIGHT' | 'BILATERAL' | 'CENTRAL' | 'N/A';
  
  // Rehabilitation / RTP Stage
  rtp_stage?: RTPStage | string | null;
  
  // Medical Restrictions & Minutes Limit
  medical_restrictions?: string | null; // e.g. "Max 18 min game time", "No back-to-backs", "Non-contact shooting drills only", "None"
  max_minutes_restriction?: number | null; // Explicit numeric minutes restriction if specified
  
  // Clinical / S&C Contextual Notes
  notes?: string | null;
}


