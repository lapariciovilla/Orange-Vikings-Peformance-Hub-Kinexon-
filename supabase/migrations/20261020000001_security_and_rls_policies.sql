-- ==============================================================================
-- Migration: 20261020000001_security_and_rls_policies.sql
-- Project: Orange Vikings Load Engine (Ehime Orange Vikings B.League 2026–2027)
-- Description: Security hardening, Row Level Security (RLS) enforcement, and
--              coaching staff authorization policies.
-- ==============================================================================

-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_session_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_imported_csv_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpe_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_appearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_status_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. COACHING STAFF POLICIES (AUTHENTICATED USERS)
-- Authorized coaching staff members signed into Supabase have full access to manage operational records.

-- PLAYERS
CREATE POLICY "Staff select players" ON public.players
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert players" ON public.players
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update players" ON public.players
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff delete players" ON public.players
    FOR DELETE TO authenticated USING (true);

-- SESSIONS
CREATE POLICY "Staff select sessions" ON public.sessions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert sessions" ON public.sessions
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update sessions" ON public.sessions
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff delete sessions" ON public.sessions
    FOR DELETE TO authenticated USING (true);

-- PLAYER SESSION RECORDS (Sensitive Performance & Load Data)
CREATE POLICY "Staff select records" ON public.player_session_records
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert records" ON public.player_session_records
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update records" ON public.player_session_records
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff delete records" ON public.player_session_records
    FOR DELETE TO authenticated USING (true);

-- RAW IMPORTED CSV AUDIT
CREATE POLICY "Staff select raw_csv" ON public.raw_imported_csv_records
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert raw_csv" ON public.raw_imported_csv_records
    FOR INSERT TO authenticated WITH CHECK (true);

-- RPE ENTRIES (Internal Load)
CREATE POLICY "Staff select rpe" ON public.rpe_entries
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert rpe" ON public.rpe_entries
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update rpe" ON public.rpe_entries
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff delete rpe" ON public.rpe_entries
    FOR DELETE TO authenticated USING (true);

-- GAME APPEARANCES
CREATE POLICY "Staff select game_appearances" ON public.game_appearances
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert game_appearances" ON public.game_appearances
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update game_appearances" ON public.game_appearances
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff delete game_appearances" ON public.game_appearances
    FOR DELETE TO authenticated USING (true);

-- PLAYER STATUS, WELLNESS & INJURY (Highly Sensitive Medical & RTP Data)
CREATE POLICY "Staff select status_assessments" ON public.player_status_assessments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert status_assessments" ON public.player_status_assessments
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update status_assessments" ON public.player_status_assessments
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff delete status_assessments" ON public.player_status_assessments
    FOR DELETE TO authenticated USING (true);

-- COACH SETTINGS
CREATE POLICY "Staff select coach_settings" ON public.coach_settings
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert coach_settings" ON public.coach_settings
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update coach_settings" ON public.coach_settings
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- COMPETITION SCHEDULE
CREATE POLICY "Staff select schedules" ON public.competition_schedules
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert schedules" ON public.competition_schedules
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update schedules" ON public.competition_schedules
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff delete schedules" ON public.competition_schedules
    FOR DELETE TO authenticated USING (true);

-- IMPORT HISTORY & AUDIT LOGS
CREATE POLICY "Staff select import_history" ON public.import_history
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert import_history" ON public.import_history
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff select audit_logs" ON public.audit_logs
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert audit_logs" ON public.audit_logs
    FOR INSERT TO authenticated WITH CHECK (true);

-- Public / Anonymous Access Rules:
-- Disallow public read/write to all sensitive player, session, wellness, and RPE tables.
-- Public anon users are granted ZERO access to sensitive tables by default.
