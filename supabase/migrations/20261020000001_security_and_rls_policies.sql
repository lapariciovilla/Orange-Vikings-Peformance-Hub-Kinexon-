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

-- 1. PLAYERS (Public roster info; anon and authenticated can manage)
DROP POLICY IF EXISTS "Anyone view players" ON public.players;
CREATE POLICY "Anyone view players" ON public.players
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone manage players" ON public.players;
CREATE POLICY "Anyone manage players" ON public.players
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. SESSIONS (Schedules & session metadata; anon and authenticated can manage)
DROP POLICY IF EXISTS "Anyone view sessions" ON public.sessions;
CREATE POLICY "Anyone view sessions" ON public.sessions
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone manage sessions" ON public.sessions;
CREATE POLICY "Anyone manage sessions" ON public.sessions
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. PLAYER SESSION RECORDS (External Load Tracking - Staff & Client Access)
DROP POLICY IF EXISTS "Staff select records" ON public.player_session_records;
CREATE POLICY "Staff select records" ON public.player_session_records
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Staff insert records" ON public.player_session_records;
CREATE POLICY "Staff insert records" ON public.player_session_records
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Staff update records" ON public.player_session_records;
CREATE POLICY "Staff update records" ON public.player_session_records
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff delete records" ON public.player_session_records;
CREATE POLICY "Staff delete records" ON public.player_session_records
    FOR DELETE TO anon, authenticated USING (true);

-- 4. RAW IMPORTED CSV AUDIT (Immutable Audit Trail & Tracking Records)
DROP POLICY IF EXISTS "Staff select raw_csv" ON public.raw_imported_csv_records;
CREATE POLICY "Staff select raw_csv" ON public.raw_imported_csv_records
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Staff insert raw_csv" ON public.raw_imported_csv_records;
CREATE POLICY "Staff insert raw_csv" ON public.raw_imported_csv_records
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Staff update raw_csv" ON public.raw_imported_csv_records;
CREATE POLICY "Staff update raw_csv" ON public.raw_imported_csv_records
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff delete raw_csv" ON public.raw_imported_csv_records;
CREATE POLICY "Staff delete raw_csv" ON public.raw_imported_csv_records
    FOR DELETE TO anon, authenticated USING (true);

-- 5. RPE ENTRIES (Subjective Internal Load - Staff & Operational Access)
DROP POLICY IF EXISTS "Staff select rpe" ON public.rpe_entries;
CREATE POLICY "Staff select rpe" ON public.rpe_entries
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Staff insert rpe" ON public.rpe_entries;
CREATE POLICY "Staff insert rpe" ON public.rpe_entries
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Staff update rpe" ON public.rpe_entries;
CREATE POLICY "Staff update rpe" ON public.rpe_entries
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff delete rpe" ON public.rpe_entries;
CREATE POLICY "Staff delete rpe" ON public.rpe_entries
    FOR DELETE TO anon, authenticated USING (true);

-- 6. GAME APPEARANCES
DROP POLICY IF EXISTS "Staff select game_appearances" ON public.game_appearances;
CREATE POLICY "Staff select game_appearances" ON public.game_appearances
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Staff insert game_appearances" ON public.game_appearances;
CREATE POLICY "Staff insert game_appearances" ON public.game_appearances
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Staff update game_appearances" ON public.game_appearances;
CREATE POLICY "Staff update game_appearances" ON public.game_appearances
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff delete game_appearances" ON public.game_appearances;
CREATE POLICY "Staff delete game_appearances" ON public.game_appearances
    FOR DELETE TO authenticated USING (true);

-- 7. PLAYER STATUS & INJURY CLEARANCE (Medical Records - Staff Only)
DROP POLICY IF EXISTS "Staff select status_assessments" ON public.player_status_assessments;
CREATE POLICY "Staff select status_assessments" ON public.player_status_assessments
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Staff insert status_assessments" ON public.player_status_assessments;
CREATE POLICY "Staff insert status_assessments" ON public.player_status_assessments
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Staff update status_assessments" ON public.player_status_assessments;
CREATE POLICY "Staff update status_assessments" ON public.player_status_assessments
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff delete status_assessments" ON public.player_status_assessments;
CREATE POLICY "Staff delete status_assessments" ON public.player_status_assessments
    FOR DELETE TO authenticated USING (true);

-- 8. COACH SETTINGS
DROP POLICY IF EXISTS "Anyone select coach_settings" ON public.coach_settings;
CREATE POLICY "Anyone select coach_settings" ON public.coach_settings
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone manage coach_settings" ON public.coach_settings;
CREATE POLICY "Anyone manage coach_settings" ON public.coach_settings
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 9. COMPETITION SCHEDULE
DROP POLICY IF EXISTS "Anyone select schedules" ON public.competition_schedules;
CREATE POLICY "Anyone select schedules" ON public.competition_schedules
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone manage schedules" ON public.competition_schedules;
CREATE POLICY "Anyone manage schedules" ON public.competition_schedules
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 10. IMPORT HISTORY & AUDIT LOGS
DROP POLICY IF EXISTS "Staff select import_history" ON public.import_history;
CREATE POLICY "Staff select import_history" ON public.import_history
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Staff insert import_history" ON public.import_history;
CREATE POLICY "Staff insert import_history" ON public.import_history
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Staff update import_history" ON public.import_history;
CREATE POLICY "Staff update import_history" ON public.import_history
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff delete import_history" ON public.import_history;
CREATE POLICY "Staff delete import_history" ON public.import_history
    FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Staff select audit_logs" ON public.audit_logs;
CREATE POLICY "Staff select audit_logs" ON public.audit_logs
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Staff insert audit_logs" ON public.audit_logs;
CREATE POLICY "Staff insert audit_logs" ON public.audit_logs
    FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Schema reload
NOTIFY pgrst, 'reload schema';
