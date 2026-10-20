-- ==============================================================================
-- Migration: 20261020000000_create_orange_vikings_schema.sql
-- Project: Orange Vikings Load Engine (Ehime Orange Vikings B.League 2026–2027)
-- Description: Normalized PostgreSQL database schema for basketball external load,
--              player sessions, RPE, game minutes, wellness & injury assessments,
--              coach thresholds, competition schedule, and audit logs.
-- ==============================================================================

-- 1. PLAYERS TABLE
CREATE TABLE IF NOT EXISTS public.players (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    display_name TEXT NOT NULL,
    position TEXT NOT NULL,
    aliases TEXT[] DEFAULT '{}'::TEXT[],
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INJURED', 'LIMITED')) DEFAULT 'ACTIVE',
    is_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_players_number ON public.players(number);
CREATE INDEX IF NOT EXISTS idx_players_status ON public.players(status);

-- 2. SESSIONS META TABLE
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY, -- Stable session identifier, e.g. session-2026-08-11
    date DATE NOT NULL,
    season TEXT NOT NULL DEFAULT '2026–2027',
    session_type TEXT NOT NULL CHECK (session_type IN ('Preseason Practice', 'Practice', 'Game', 'Recovery', 'Conditioning', 'Other')),
    session_name TEXT,
    duration_min NUMERIC,
    monitored_players_count INTEGER NOT NULL DEFAULT 0,
    opponent TEXT,
    game_number INTEGER,
    location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_session_date_type_name UNIQUE (date, session_type, session_name)
);

CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.sessions(date DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_season ON public.sessions(season);

-- 3. PLAYER SESSION RECORDS TABLE (External & Internal Load)
CREATE TABLE IF NOT EXISTS public.player_session_records (
    id TEXT PRIMARY KEY, -- Stable record identifier, e.g. rec-20260811-p4
    session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    season TEXT NOT NULL DEFAULT '2026–2027',
    session_type TEXT NOT NULL,
    session_name TEXT,
    player_number TEXT NOT NULL,
    player_name TEXT NOT NULL,
    position TEXT NOT NULL,

    -- 8 Core External Load Metrics (Preserving exact original units)
    distance_m NUMERIC,
    accumulated_acceleration_load NUMERIC,
    accumulated_acceleration_load_per_min NUMERIC,
    anaerobic_activity_time NUMERIC, -- Raw seconds from tracking exports
    deceleration_load NUMERIC,
    deceleration_load_per_min NUMERIC,
    jump_load NUMERIC,
    mechanical_load NUMERIC,

    -- Exposure & Internal Load
    duration_min NUMERIC,
    game_minutes NUMERIC,
    rpe NUMERIC CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
    srpe NUMERIC, -- RPE * duration_min

    -- Relative metrics calculated cache
    distance_per_min NUMERIC,
    mechanical_load_per_min NUMERIC,
    jump_load_per_min NUMERIC,

    source TEXT NOT NULL CHECK (source IN ('CSV', 'MANUAL', 'INITIAL', 'API')) DEFAULT 'CSV',
    notes TEXT,
    edited_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_session_player UNIQUE (session_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_records_session_id ON public.player_session_records(session_id);
CREATE INDEX IF NOT EXISTS idx_records_player_id ON public.player_session_records(player_id);
CREATE INDEX IF NOT EXISTS idx_records_date ON public.player_session_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_records_player_date ON public.player_session_records(player_id, date DESC);

-- 4. RAW IMPORTED CSV RECORDS TABLE (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS public.raw_imported_csv_records (
    id TEXT PRIMARY KEY,
    import_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    row_index INTEGER NOT NULL,
    session_date DATE,
    player_identifier TEXT,
    raw_data JSONB NOT NULL,
    parsed_status TEXT NOT NULL CHECK (parsed_status IN ('ACCEPTED', 'REJECTED', 'DUPLICATE')),
    validation_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_raw_csv_import_id ON public.raw_imported_csv_records(import_id);
CREATE INDEX IF NOT EXISTS idx_raw_csv_date ON public.raw_imported_csv_records(session_date);

-- 5. RPE ENTRIES TABLE
CREATE TABLE IF NOT EXISTS public.rpe_entries (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    player_number TEXT,
    session_id TEXT REFERENCES public.sessions(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    rpe_score NUMERIC NOT NULL CHECK (rpe_score >= 1 AND rpe_score <= 10),
    duration_min NUMERIC,
    srpe NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_rpe_player_date_session UNIQUE (player_id, date, session_id)
);

CREATE INDEX IF NOT EXISTS idx_rpe_player_date ON public.rpe_entries(player_id, date DESC);

-- 6. GAME APPEARANCES & ACTUAL MINUTES
CREATE TABLE IF NOT EXISTS public.game_appearances (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    actual_game_minutes NUMERIC NOT NULL CHECK (actual_game_minutes >= 0),
    starter BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_game_appearance UNIQUE (session_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_game_app_player ON public.game_appearances(player_id, date DESC);

-- 7. PLAYER WELLNESS, CONDITION & INJURY ASSESSMENTS TABLE
CREATE TABLE IF NOT EXISTS public.player_status_assessments (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    player_name TEXT,
    player_number TEXT,
    date DATE NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    assessed_by TEXT NOT NULL,
    clearance_status TEXT NOT NULL CHECK (clearance_status IN ('FULL_CLEARANCE', 'MODIFIED', 'RTP', 'INJURED', 'UNKNOWN')),
    wellness_score NUMERIC CHECK (wellness_score IS NULL OR (wellness_score >= 1 AND wellness_score <= 5)),
    rpe_score NUMERIC CHECK (rpe_score IS NULL OR (rpe_score >= 1 AND rpe_score <= 10)),
    soreness_score NUMERIC CHECK (soreness_score IS NULL OR (soreness_score >= 1 AND soreness_score <= 5)),
    soreness_body_area TEXT,
    has_active_injury BOOLEAN NOT NULL DEFAULT FALSE,
    injury_type TEXT,
    injury_date DATE,
    affected_side TEXT CHECK (affected_side IS NULL OR affected_side IN ('LEFT', 'RIGHT', 'BILATERAL', 'CENTRAL', 'N/A')),
    rtp_stage TEXT,
    medical_restrictions TEXT,
    max_minutes_restriction NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_status_player_date ON public.player_status_assessments(player_id, date DESC);

-- 8. COACH SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.coach_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    yellow_threshold_pct NUMERIC NOT NULL DEFAULT 15,
    red_threshold_pct NUMERIC NOT NULL DEFAULT 30,
    min_sessions_for_baseline INTEGER NOT NULL DEFAULT 3,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. COMPETITION SCHEDULE TABLE (Asia/Tokyo time zone context)
CREATE TABLE IF NOT EXISTS public.competition_schedules (
    id TEXT PRIMARY KEY,
    season TEXT NOT NULL DEFAULT '2026–2027',
    date DATE NOT NULL,
    tipoff_time_jst TEXT, -- e.g. "14:05" or "19:00" JST
    opponent TEXT NOT NULL,
    location TEXT,
    is_home BOOLEAN NOT NULL DEFAULT TRUE,
    is_back_to_back BOOLEAN NOT NULL DEFAULT FALSE,
    rest_days_before INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_schedule_date ON public.competition_schedules(date ASC);

-- 10. DATA IMPORT HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.import_history (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    imported_by TEXT DEFAULT 'Coaching Staff',
    session_id TEXT,
    session_date DATE,
    accepted_rows INTEGER NOT NULL DEFAULT 0,
    rejected_rows INTEGER NOT NULL DEFAULT 0,
    duplicate_rows INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'PARTIAL', 'FAILED')),
    file_checksum TEXT,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_import_hist_date ON public.import_history(imported_at DESC);

-- 11. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    action TEXT NOT NULL,
    user_name TEXT NOT NULL,
    details TEXT NOT NULL,
    record_id TEXT,
    table_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
