import { supabase, isSupabaseConfigured, SUPABASE_URL } from './supabaseClient';
import {
  Player,
  PlayerSessionRecord,
  SessionMeta,
  RPEEntry,
  CoachSettings,
  AuditLog,
  PlayerStatusAssessment,
} from '../types';

export interface DatabaseConnectionStatus {
  isConfigured: boolean;
  isConnected: boolean;
  hasSchema: boolean;
  authenticatedUser: string | null;
  tableStatuses: Record<string, boolean>;
  message: string;
  checkedAt: string;
}

export interface BackupManifest {
  exportTimestamp: string;
  projectId: string;
  schemaVersion: string;
  appVersion: string;
  counts: {
    players: number;
    sessions: number;
    playerSessionRecords: number;
    rpeEntries: number;
    statusAssessments: number;
    auditLogs: number;
  };
  earliestDate: string | null;
  latestDate: string | null;
  checksum: string;
}

export interface BackupPayload {
  manifest: BackupManifest;
  data: {
    players: Player[];
    sessions: SessionMeta[];
    playerSessionRecords: PlayerSessionRecord[];
    rpeEntries: RPEEntry[];
    statusAssessments: PlayerStatusAssessment[];
    settings?: CoachSettings;
    auditLogs?: AuditLog[];
  };
}

export class SupabaseService {
  // ==========================================
  // AUTHENTICATION
  // ==========================================
  static async getCurrentUser() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      return data?.user || null;
    } catch {
      return null;
    }
  }

  static async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return null;
      return data?.session || null;
    } catch {
      return null;
    }
  }

  static async signIn(email: string, password: string) {
    return await supabase.auth.signInWithPassword({ email, password });
  }

  static async signUp(email: string, password: string) {
    return await supabase.auth.signUp({ email, password });
  }

  static async signOut() {
    return await supabase.auth.signOut();
  }

  static onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }

  // ==========================================
  // CONNECTION & SCHEMA PROBING
  // ==========================================
  static async checkConnection(): Promise<DatabaseConnectionStatus> {
    const timestamp = new Date().toISOString();
    const result: DatabaseConnectionStatus = {
      isConfigured: isSupabaseConfigured,
      isConnected: false,
      hasSchema: false,
      authenticatedUser: null,
      tableStatuses: {
        players: false,
        sessions: false,
        player_session_records: false,
        rpe_entries: false,
        player_status_assessments: false,
        coach_settings: false,
        audit_logs: false,
      },
      message: 'Checking connection...',
      checkedAt: timestamp,
    };

    if (!isSupabaseConfigured) {
      result.message = 'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY) are not configured.';
      return result;
    }

    try {
      const user = await this.getCurrentUser();
      result.authenticatedUser = user ? user.email || user.id : null;

      // Probe standard tables to check if migration schema has been executed
      const probeTables = ['players', 'sessions', 'player_session_records', 'rpe_entries', 'player_status_assessments', 'coach_settings', 'audit_logs'];
      let existingTablesCount = 0;

      for (const table of probeTables) {
        try {
          const { error } = await supabase.from(table).select('*').limit(1);
          if (!error) {
            result.tableStatuses[table] = true;
            existingTablesCount++;
          } else if (
            error.code === 'PGRST205' ||
            error.code === '42P01' ||
            error.message?.includes('schema cache') ||
            error.message?.includes('does not exist')
          ) {
            // Table definitely does not exist in schema cache
            result.tableStatuses[table] = false;
          } else if (
            error.code === '42501' ||
            error.message?.includes('permission') ||
            error.message?.includes('policy') ||
            error.message?.includes('row-level security')
          ) {
            // Table exists in database, but RLS denied access to anon role
            result.tableStatuses[table] = true;
            existingTablesCount++;
          } else {
            result.tableStatuses[table] = false;
          }
        } catch {
          result.tableStatuses[table] = false;
        }
      }

      result.isConnected = true;
      result.hasSchema = existingTablesCount === probeTables.length;

      if (result.hasSchema) {
        result.message = `Connected to Supabase PostgreSQL database (${SUPABASE_URL}). All ${probeTables.length} tables verified.`;
      } else if (existingTablesCount > 0) {
        result.message = `Connected to Supabase. Partial schema detected (${existingTablesCount}/${probeTables.length} tables). Migration recommended.`;
      } else {
        result.message = `Connected to Supabase project, but public tables have not yet been migrated. Run supabase/schema.sql in Supabase SQL editor.`;
      }

      return result;
    } catch (err: any) {
      result.message = `Connection failed: ${err.message || String(err)}`;
      return result;
    }
  }

  // ==========================================
  // PLAYERS / ROSTER
  // ==========================================
  static async fetchRoster(): Promise<{ data: Player[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('number', { ascending: true });

      if (error) return { data: null, error };
      if (!data) return { data: [], error: null };

      const mapped: Player[] = data.map((row: any) => ({
        id: row.id,
        number: row.number,
        displayName: row.display_name,
        position: row.position,
        aliases: row.aliases || [],
        status: row.status as any,
        isConfirmed: row.is_confirmed,
        notes: row.notes || undefined,
      }));

      return { data: mapped, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  static async savePlayer(player: Player): Promise<{ data: Player | null; error: any }> {
    try {
      const payload = {
        id: player.id,
        number: player.number,
        display_name: player.displayName,
        position: player.position,
        aliases: player.aliases,
        status: player.status,
        is_confirmed: player.isConfirmed,
        notes: player.notes || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('players')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

      if (error) return { data: null, error };
      return { data: player, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  // Explicit, validated roster initialization workflow (Phase 2, 3, & 6)
  static async initializeRoster(roster: Player[]): Promise<{ count: number; verified: boolean; verifiedPlayers?: any[]; error: any }> {
    try {
      if (!roster || roster.length === 0) {
        return { count: 0, verified: false, error: new Error('Cannot initialize an empty roster.') };
      }

      // Check if table public.players exists in the schema cache first
      const { error: probeError } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true });

      if (probeError) {
        if (probeError.code === 'PGRST205' || probeError.message?.includes('schema cache') || probeError.message?.includes('does not exist')) {
          return {
            count: 0,
            verified: false,
            error: new Error(
              "Table 'public.players' does not exist in Supabase project ukyvteijkvxmouoksdca. Please run the SQL migration (supabase/schema.sql) in your Supabase Dashboard SQL Editor."
            ),
          };
        }
      }

      // Filter and deduplicate only verified athletes with stable IDs
      const uniquePlayersMap = new Map<string, Player>();
      for (const p of roster) {
        if (p.id && p.displayName && p.number) {
          uniquePlayersMap.set(p.id, p);
        }
      }

      const validList = Array.from(uniquePlayersMap.values());
      if (validList.length === 0) {
        return { count: 0, verified: false, error: new Error('No valid athlete records with stable IDs found to initialize.') };
      }

      const payloads = validList.map((p) => ({
        id: p.id,
        number: p.number,
        display_name: p.displayName,
        position: p.position,
        aliases: p.aliases || [p.displayName],
        status: p.status || 'ACTIVE',
        is_confirmed: p.isConfirmed ?? true,
        notes: p.notes || null,
        updated_at: new Date().toISOString(),
      }));

      // Execute upsert using stable player primary key
      const { error: upsertError } = await supabase
        .from('players')
        .upsert(payloads, { onConflict: 'id' });

      if (upsertError) {
        if (upsertError.code === '42501' || upsertError.message?.includes('row-level security')) {
          return {
            count: 0,
            verified: false,
            error: new Error(
              'Row Level Security prevented saving players. Coaching staff authentication is required. Please sign in or create an account in the Coaching Staff panel.'
            ),
          };
        }
        return { count: 0, verified: false, error: upsertError };
      }

      // Verification Step: Read back from Supabase to confirm persistence
      const { data: readBack, error: readError } = await supabase
        .from('players')
        .select('id, number, display_name, position, status')
        .order('number', { ascending: true });

      if (readError) {
        return {
          count: 0,
          verified: false,
          error: new Error(`Roster was written, but verification read-back failed: ${readError.message}`),
        };
      }

      if (!readBack || readBack.length === 0) {
        return {
          count: 0,
          verified: false,
          error: new Error('Database write reported success, but 0 records were found when verifying public.players.'),
        };
      }

      return { count: readBack.length, verified: true, verifiedPlayers: readBack, error: null };
    } catch (err: any) {
      return { count: 0, verified: false, error: err };
    }
  }

  // ==========================================
  // SESSIONS META
  // ==========================================
  static async fetchSessions(): Promise<{ data: SessionMeta[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('date', { ascending: false });

      if (error) return { data: null, error };
      if (!data) return { data: [], error: null };

      const mapped: SessionMeta[] = data.map((row: any) => ({
        id: row.id,
        date: row.date,
        season: row.season,
        session_type: row.session_type as any,
        session_name: row.session_name || undefined,
        duration_min: row.duration_min ? Number(row.duration_min) : undefined,
        monitored_players_count: row.monitored_players_count || 0,
        opponent: row.opponent || undefined,
        game_number: row.game_number || undefined,
        location: row.location || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      return { data: mapped, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  static async saveSession(meta: SessionMeta): Promise<{ data: SessionMeta | null; error: any }> {
    try {
      const payload = {
        id: meta.id,
        date: meta.date,
        season: meta.season || '2026–2027',
        session_type: meta.session_type,
        session_name: meta.session_name || null,
        duration_min: meta.duration_min || null,
        monitored_players_count: meta.monitored_players_count || 0,
        opponent: meta.opponent || null,
        game_number: meta.game_number || null,
        location: meta.location || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('sessions')
        .upsert(payload, { onConflict: 'id' });

      if (error) return { data: null, error };
      return { data: meta, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  static async deleteSession(sessionId: string): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);

      if (error) return { success: false, error };
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  // ==========================================
  // PLAYER SESSION RECORDS (8 Core Metrics)
  // ==========================================
  static async fetchPlayerRecords(): Promise<{ data: PlayerSessionRecord[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('player_session_records')
        .select('*')
        .order('date', { ascending: false });

      if (error) return { data: null, error };
      if (!data) return { data: [], error: null };

      const mapped: PlayerSessionRecord[] = data.map((row: any) => ({
        id: row.id,
        session_id: row.session_id,
        date: row.date,
        season: row.season,
        session_type: row.session_type as any,
        session_name: row.session_name || undefined,
        player_id: row.player_id,
        player_number: row.player_number,
        player_name: row.player_name,
        position: row.position,

        // Core 8 external metrics
        distance_m: row.distance_m !== null ? Number(row.distance_m) : null,
        accumulated_acceleration_load: row.accumulated_acceleration_load !== null ? Number(row.accumulated_acceleration_load) : null,
        accumulated_acceleration_load_per_min: row.accumulated_acceleration_load_per_min !== null ? Number(row.accumulated_acceleration_load_per_min) : null,
        anaerobic_activity_time: row.anaerobic_activity_time !== null ? Number(row.anaerobic_activity_time) : null,
        deceleration_load: row.deceleration_load !== null ? Number(row.deceleration_load) : null,
        deceleration_load_per_min: row.deceleration_load_per_min !== null ? Number(row.deceleration_load_per_min) : null,
        jump_load: row.jump_load !== null ? Number(row.jump_load) : null,
        mechanical_load: row.mechanical_load !== null ? Number(row.mechanical_load) : null,

        // Exposure & Internal
        duration_min: row.duration_min !== null ? Number(row.duration_min) : null,
        game_minutes: row.game_minutes !== null ? Number(row.game_minutes) : null,
        RPE: row.rpe !== null ? Number(row.rpe) : null,
        sRPE: row.srpe !== null ? Number(row.srpe) : null,

        source: row.source || 'CSV',
        notes: row.notes || undefined,
        edited_by: row.edited_by || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      return { data: mapped, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  static async savePlayerRecords(records: PlayerSessionRecord[]): Promise<{ count: number; error: any }> {
    try {
      const payloads = records.map((r) => ({
        id: r.id,
        session_id: r.session_id,
        player_id: r.player_id,
        date: r.date,
        season: r.season || '2026–2027',
        session_type: r.session_type,
        session_name: r.session_name || null,
        player_number: r.player_number,
        player_name: r.player_name,
        position: r.position,

        distance_m: r.distance_m,
        accumulated_acceleration_load: r.accumulated_acceleration_load,
        accumulated_acceleration_load_per_min: r.accumulated_acceleration_load_per_min,
        anaerobic_activity_time: r.anaerobic_activity_time,
        deceleration_load: r.deceleration_load,
        deceleration_load_per_min: r.deceleration_load_per_min,
        jump_load: r.jump_load,
        mechanical_load: r.mechanical_load,

        duration_min: r.duration_min || null,
        game_minutes: r.game_minutes || null,
        rpe: r.RPE || null,
        srpe: r.sRPE || null,

        distance_per_min: r.relative?.distance_per_min || null,
        mechanical_load_per_min: r.relative?.mechanical_load_per_min || null,
        jump_load_per_min: r.relative?.jump_load_per_min || null,

        source: r.source || 'CSV',
        notes: r.notes || null,
        edited_by: r.edited_by || null,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('player_session_records')
        .upsert(payloads, { onConflict: 'id' });

      if (error) return { count: 0, error };
      return { count: payloads.length, error: null };
    } catch (err) {
      return { count: 0, error: err };
    }
  }

  static async updateSingleRecord(
    recordId: string,
    updates: Partial<PlayerSessionRecord>,
    editorName = 'Luis Aparicio Villa (S&C)'
  ): Promise<{ data: any; error: any }> {
    try {
      const dbUpdates: any = {
        updated_at: new Date().toISOString(),
        edited_by: editorName,
      };

      if (updates.game_minutes !== undefined) dbUpdates.game_minutes = updates.game_minutes;
      if (updates.duration_min !== undefined) dbUpdates.duration_min = updates.duration_min;
      if (updates.RPE !== undefined) dbUpdates.rpe = updates.RPE;
      if (updates.sRPE !== undefined) dbUpdates.srpe = updates.sRPE;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.distance_m !== undefined) dbUpdates.distance_m = updates.distance_m;
      if (updates.accumulated_acceleration_load !== undefined) {
        dbUpdates.accumulated_acceleration_load = updates.accumulated_acceleration_load;
      }
      if (updates.deceleration_load !== undefined) {
        dbUpdates.deceleration_load = updates.deceleration_load;
      }
      if (updates.jump_load !== undefined) dbUpdates.jump_load = updates.jump_load;
      if (updates.mechanical_load !== undefined) dbUpdates.mechanical_load = updates.mechanical_load;

      const { data, error } = await supabase
        .from('player_session_records')
        .update(dbUpdates)
        .eq('id', recordId)
        .select()
        .single();

      if (error) return { data: null, error };
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  // ==========================================
  // RPE ENTRIES
  // ==========================================
  static async fetchRPEEntries(): Promise<{ data: RPEEntry[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('rpe_entries')
        .select('*')
        .order('date', { ascending: false });

      if (error) return { data: null, error };
      if (!data) return { data: [], error: null };

      const mapped: RPEEntry[] = data.map((row: any) => ({
        id: row.id,
        player_id: row.player_id,
        player_number: row.player_number || undefined,
        session_id: row.session_id,
        date: row.date,
        rpe_score: Number(row.rpe_score),
        duration_min: row.duration_min ? Number(row.duration_min) : undefined,
        sRPE: row.srpe ? Number(row.srpe) : undefined,
        notes: row.notes || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      return { data: mapped, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  static async saveRPEEntry(entry: RPEEntry): Promise<{ data: RPEEntry | null; error: any }> {
    try {
      const payload: any = {
        id: entry.id,
        player_id: entry.player_id,
        player_number: entry.player_number || null,
        session_id: entry.session_id || null,
        date: entry.date,
        rpe_score: Number(entry.rpe_score),
        duration_min: entry.duration_min ? Number(entry.duration_min) : null,
        srpe: entry.sRPE || (entry.duration_min ? Number(entry.rpe_score) * Number(entry.duration_min) : null),
        notes: entry.notes || null,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase
        .from('rpe_entries')
        .upsert(payload, { onConflict: 'id' });

      // If foreign key constraint failed on session_id (PostgreSQL error 23503), retry with null session_id
      if (
        error &&
        payload.session_id &&
        (error.code === '23503' || error.message?.includes('session_id') || error.message?.includes('foreign key constraint'))
      ) {
        console.warn('[SupabaseService] Foreign key constraint on session_id; retrying with session_id = null');
        payload.session_id = null;
        const retryRes = await supabase
          .from('rpe_entries')
          .upsert(payload, { onConflict: 'id' });
        error = retryRes.error;
      }

      // If unique constraint violation on (player_id, date, session_id), find existing row ID and update
      if (
        error &&
        (error.code === '23505' || error.message?.includes('uq_rpe_player_date_session') || error.message?.includes('duplicate key'))
      ) {
        console.warn('[SupabaseService] Duplicate entry on (player_id, date); fetching existing ID to update');
        let query = supabase
          .from('rpe_entries')
          .select('id')
          .eq('player_id', payload.player_id)
          .eq('date', payload.date);

        if (payload.session_id) {
          query = query.eq('session_id', payload.session_id);
        }

        const { data: existingRows } = await query.limit(1);

        if (existingRows && existingRows.length > 0) {
          payload.id = existingRows[0].id;
          const retryRes = await supabase
            .from('rpe_entries')
            .upsert(payload, { onConflict: 'id' });
          error = retryRes.error;
        }
      }

      if (error) {
        console.error('[SupabaseService.saveRPEEntry] Database error:', error);
        if (error.code === '42501' || error.message?.includes('violates row-level security')) {
          (error as any).friendlyMessage =
            'Database permission denied (Row Level Security). The "rpe_entries" table requires the RLS policy update in Supabase SQL editor.';
        } else if (error.code === '23503') {
          (error as any).friendlyMessage =
            `Foreign key constraint error: Athlete or Session reference not found in database (${error.message}).`;
        }
        return { data: null, error };
      }

      return { data: { ...entry, id: payload.id, session_id: payload.session_id }, error: null };
    } catch (err: any) {
      console.error('[SupabaseService.saveRPEEntry] Exception during save:', err);
      return { data: null, error: err };
    }
  }

  static async deleteRPEEntry(id: string): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await supabase
        .from('rpe_entries')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[SupabaseService.deleteRPEEntry] Database error:', error);
        if (error.code === '42501' || error.message?.includes('violates row-level security')) {
          (error as any).friendlyMessage =
            'Database permission denied (Row Level Security) when deleting RPE entry. Update RLS policy in Supabase SQL editor.';
        }
        return { success: false, error };
      }
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[SupabaseService.deleteRPEEntry] Exception during delete:', err);
      return { success: false, error: err };
    }
  }

  // ==========================================
  // PLAYER STATUS & INJURY ASSESSMENTS
  // ==========================================
  static async fetchPlayerStatusAssessments(): Promise<{ data: PlayerStatusAssessment[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('player_status_assessments')
        .select('*')
        .order('date', { ascending: false });

      if (error) return { data: null, error };
      if (!data) return { data: [], error: null };

      const mapped: PlayerStatusAssessment[] = data.map((row: any) => ({
        id: row.id,
        player_id: row.player_id,
        player_name: row.player_name || undefined,
        player_number: row.player_number || undefined,
        date: row.date,
        timestamp: row.timestamp || row.created_at,
        assessed_by: row.assessed_by,
        clearance_status: row.clearance_status,
        wellness_score: row.wellness_score !== null ? Number(row.wellness_score) : null,
        rpe_score: row.rpe_score !== null ? Number(row.rpe_score) : null,
        soreness_score: row.soreness_score !== null ? Number(row.soreness_score) : null,
        soreness_body_area: row.soreness_body_area || null,
        has_active_injury: Boolean(row.has_active_injury),
        injury_type: row.injury_type || null,
        injury_date: row.injury_date || null,
        affected_side: row.affected_side || 'N/A',
        rtp_stage: row.rtp_stage || null,
        medical_restrictions: row.medical_restrictions || null,
        max_minutes_restriction: row.max_minutes_restriction !== null ? Number(row.max_minutes_restriction) : null,
        notes: row.notes || null,
      }));

      return { data: mapped, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  static async savePlayerStatusAssessment(assessment: PlayerStatusAssessment): Promise<{ data: PlayerStatusAssessment | null; error: any }> {
    try {
      const payload = {
        id: assessment.id,
        player_id: assessment.player_id,
        player_name: assessment.player_name || null,
        player_number: assessment.player_number || null,
        date: assessment.date,
        timestamp: assessment.timestamp || new Date().toISOString(),
        assessed_by: assessment.assessed_by,
        clearance_status: assessment.clearance_status,
        wellness_score: assessment.wellness_score ?? null,
        rpe_score: assessment.rpe_score ?? null,
        soreness_score: assessment.soreness_score ?? null,
        soreness_body_area: assessment.soreness_body_area || null,
        has_active_injury: assessment.has_active_injury,
        injury_type: assessment.injury_type || null,
        injury_date: assessment.injury_date || null,
        affected_side: assessment.affected_side || 'N/A',
        rtp_stage: assessment.rtp_stage || null,
        medical_restrictions: assessment.medical_restrictions || null,
        max_minutes_restriction: assessment.max_minutes_restriction ?? null,
        notes: assessment.notes || null,
      };

      const { error } = await supabase
        .from('player_status_assessments')
        .upsert(payload, { onConflict: 'id' });

      if (error) return { data: null, error };
      return { data: assessment, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  // ==========================================
  // COACH SETTINGS
  // ==========================================
  static async fetchCoachSettings(): Promise<{ data: CoachSettings | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('coach_settings')
        .select('*')
        .eq('id', 'default')
        .single();

      if (error) return { data: null, error };
      if (!data) return { data: null, error: null };

      return {
        data: {
          yellow_threshold_pct: Number(data.yellow_threshold_pct),
          red_threshold_pct: Number(data.red_threshold_pct),
          min_sessions_for_baseline: Number(data.min_sessions_for_baseline),
        },
        error: null,
      };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  static async saveCoachSettings(settings: CoachSettings): Promise<{ data: CoachSettings | null; error: any }> {
    try {
      const payload = {
        id: 'default',
        yellow_threshold_pct: settings.yellow_threshold_pct,
        red_threshold_pct: settings.red_threshold_pct,
        min_sessions_for_baseline: settings.min_sessions_for_baseline,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('coach_settings')
        .upsert(payload, { onConflict: 'id' });

      if (error) return { data: null, error };
      return { data: settings, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  // ==========================================
  // AUDIT LOGS
  // ==========================================
  static async fetchAuditLogs(): Promise<{ data: AuditLog[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) return { data: null, error };
      if (!data) return { data: [], error: null };

      const mapped: AuditLog[] = data.map((row: any) => ({
        id: row.id,
        timestamp: row.timestamp,
        action: row.action,
        user: row.user_name,
        details: row.details,
      }));

      return { data: mapped, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  static async saveAuditLog(log: AuditLog): Promise<{ data: AuditLog | null; error: any }> {
    try {
      const payload = {
        id: log.id,
        timestamp: log.timestamp,
        action: log.action,
        user_name: log.user,
        details: log.details,
      };

      const { error } = await supabase
        .from('audit_logs')
        .insert(payload);

      if (error) return { data: null, error };
      return { data: log, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  // ==========================================
  // RAW IMPORTED CSV & IMPORT HISTORY
  // ==========================================
  static async saveImportHistory(history: {
    id: string;
    filename: string;
    sessionId?: string;
    sessionDate?: string;
    acceptedRows: number;
    rejectedRows: number;
    duplicateRows: number;
    status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
    checksum?: string;
    metadata?: any;
  }) {
    try {
      const payload = {
        id: history.id,
        filename: history.filename,
        imported_at: new Date().toISOString(),
        imported_by: 'Luis Aparicio Villa (S&C)',
        session_id: history.sessionId || null,
        session_date: history.sessionDate || null,
        accepted_rows: history.acceptedRows,
        rejected_rows: history.rejectedRows,
        duplicate_rows: history.duplicateRows,
        status: history.status,
        file_checksum: history.checksum || null,
        metadata: history.metadata || null,
      };

      const { error } = await supabase
        .from('import_history')
        .insert(payload);

      return { error };
    } catch (err) {
      return { error: err };
    }
  }

  static async saveRawCsvRows(rows: {
    importId: string;
    filename: string;
    rowIndex: number;
    sessionDate?: string;
    playerIdentifier?: string;
    rawData: any;
    parsedStatus: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE';
    validationNotes?: string;
  }[]) {
    try {
      const payloads = rows.map((r, idx) => ({
        id: `raw_${r.importId}_${r.rowIndex || idx}`,
        import_id: r.importId,
        filename: r.filename,
        row_index: r.rowIndex,
        session_date: r.sessionDate || null,
        player_identifier: r.playerIdentifier || null,
        raw_data: r.rawData,
        parsed_status: r.parsedStatus,
        validation_notes: r.validationNotes || null,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('raw_imported_csv_records')
        .insert(payloads);

      return { error };
    } catch (err) {
      return { error: err };
    }
  }

  // ==========================================
  // PHASE 7: COMPLETE BACKUP & RECOVERY WORKFLOW
  // ==========================================
  static generateChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  static async exportFullBackup(
    players: Player[],
    sessions: SessionMeta[],
    records: PlayerSessionRecord[],
    rpe: RPEEntry[],
    statusAssessments: PlayerStatusAssessment[],
    settings?: CoachSettings,
    logs?: AuditLog[]
  ): Promise<BackupPayload> {
    const dates = [
      ...sessions.map((s) => s.date),
      ...records.map((r) => r.date),
    ].filter(Boolean).sort();

    const earliestDate = dates[0] || null;
    const latestDate = dates[dates.length - 1] || null;

    const dataContent = JSON.stringify({
      players,
      sessions,
      records,
      rpe,
      statusAssessments,
    });

    const manifest: BackupManifest = {
      exportTimestamp: new Date().toISOString(),
      projectId: 'ukyvteijkvxmouoksdca',
      schemaVersion: '1.0.0',
      appVersion: '2026–2027',
      counts: {
        players: players.length,
        sessions: sessions.length,
        playerSessionRecords: records.length,
        rpeEntries: rpe.length,
        statusAssessments: statusAssessments.length,
        auditLogs: (logs || []).length,
      },
      earliestDate,
      latestDate,
      checksum: this.generateChecksum(dataContent),
    };

    return {
      manifest,
      data: {
        players,
        sessions,
        playerSessionRecords: records,
        rpeEntries: rpe,
        statusAssessments,
        settings,
        auditLogs: logs,
      },
    };
  }

  static validateBackupPayload(payload: any): { isValid: boolean; message: string; manifest?: BackupManifest } {
    if (!payload || typeof payload !== 'object') {
      return { isValid: false, message: 'Invalid backup file: Not a valid JSON object.' };
    }

    if (!payload.manifest || typeof payload.manifest !== 'object') {
      return { isValid: false, message: 'Invalid backup: Missing backup manifest metadata.' };
    }

    if (!payload.data || typeof payload.data !== 'object') {
      return { isValid: false, message: 'Invalid backup: Missing payload data container.' };
    }

    const { manifest, data } = payload;
    if (!Array.isArray(data.players) || !Array.isArray(data.sessions) || !Array.isArray(data.playerSessionRecords)) {
      return { isValid: false, message: 'Invalid backup: Corrupted data arrays for players, sessions, or records.' };
    }

    return {
      isValid: true,
      message: `Verified Orange Vikings Backup v${manifest.schemaVersion || '1.0'}: Contains ${data.players.length} players, ${data.sessions.length} sessions, ${data.playerSessionRecords.length} records.`,
      manifest,
    };
  }
}
