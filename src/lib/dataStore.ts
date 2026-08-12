import {
  Player,
  PlayerSessionRecord,
  SessionMeta,
  CoreMetrics,
  RPEEntry,
  WellnessEntry,
  SCIntervention,
  CoachSettings,
  AuditLog,
} from '../types';
import {
  INITIAL_ROSTER,
  INITIAL_SESSIONS_META,
  INITIAL_PLAYER_RECORDS,
  DEFAULT_SETTINGS,
  INITIAL_RPE_ENTRIES,
} from '../data/initialData';

const STORAGE_KEYS = {
  ROSTER: 'ov_roster_v1',
  SESSIONS_META: 'ov_sessions_meta_v1',
  PLAYER_RECORDS: 'ov_player_records_v1',
  RPE_ENTRIES: 'ov_rpe_entries_v1',
  WELLNESS_ENTRIES: 'ov_wellness_entries_v1',
  SC_INTERVENTIONS: 'ov_sc_interventions_v1',
  SETTINGS: 'ov_settings_v1',
  AUDIT_LOGS: 'ov_audit_logs_v1',
};

// Helper for local storage with initial fallback
function getStored<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item) {
      return JSON.parse(item);
    }
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
  }
  return fallback;
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key} to localStorage:`, err);
  }
}

export class DataStore {
  // --- ROSTER ---
  static getRoster(): Player[] {
    return getStored<Player[]>(STORAGE_KEYS.ROSTER, INITIAL_ROSTER);
  }

  static saveRoster(roster: Player[]): void {
    setStored(STORAGE_KEYS.ROSTER, roster);
  }

  static addPlayer(playerData: Omit<Player, 'id'>): Player {
    const roster = this.getRoster();
    const newPlayer: Player = {
      ...playerData,
      id: `p_${Date.now()}`,
    };
    roster.push(newPlayer);
    this.saveRoster(roster);
    this.addAuditLog('ADD_PLAYER', `Added player ${newPlayer.number} ${newPlayer.displayName}`);
    return newPlayer;
  }

  static updatePlayer(id: string, updates: Partial<Player>): Player | null {
    const roster = this.getRoster();
    const idx = roster.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    roster[idx] = { ...roster[idx], ...updates };
    this.saveRoster(roster);
    this.addAuditLog('UPDATE_PLAYER', `Updated player ${roster[idx].displayName}`);
    return roster[idx];
  }

  // Find player by number, display name, or alias
  static matchPlayer(identifier: string, numberStr?: string): Player | null {
    const roster = this.getRoster();
    const cleanId = identifier.trim().toLowerCase();
    const cleanNum = numberStr ? numberStr.replace(/[^0-9]/g, '') : null;

    // 1. Try matching by exact jersey number first
    if (cleanNum) {
      const matchByNum = roster.find((p) => p.number.replace(/[^0-9]/g, '') === cleanNum);
      if (matchByNum) return matchByNum;
    }

    // 2. Check if cleanId matches number format like "#8" or "8"
    const extractedNum = cleanId.replace(/[^0-9]/g, '');
    if (extractedNum) {
      const matchByNum = roster.find((p) => p.number.replace(/[^0-9]/g, '') === extractedNum);
      if (matchByNum) return matchByNum;
    }

    // 3. Try matching display name or aliases
    for (const player of roster) {
      if (player.displayName.toLowerCase() === cleanId) return player;
      for (const alias of player.aliases) {
        if (alias.toLowerCase() === cleanId) return player;
      }
    }

    // 4. Fuzzy check contains
    for (const player of roster) {
      const pName = player.displayName.toLowerCase();
      if (cleanId.includes(pName) || pName.includes(cleanId)) return player;
    }

    return null;
  }

  // --- SESSIONS META ---
  static getSessionsMeta(): SessionMeta[] {
    return getStored<SessionMeta[]>(STORAGE_KEYS.SESSIONS_META, INITIAL_SESSIONS_META);
  }

  static saveSessionsMeta(sessions: SessionMeta[]): void {
    setStored(STORAGE_KEYS.SESSIONS_META, sessions);
  }

  static getSessionMetaById(sessionId: string): SessionMeta | null {
    const sessions = this.getSessionsMeta();
    return sessions.find((s) => s.id === sessionId) || null;
  }

  // --- PLAYER RECORDS ---
  static getPlayerRecords(): PlayerSessionRecord[] {
    return getStored<PlayerSessionRecord[]>(STORAGE_KEYS.PLAYER_RECORDS, INITIAL_PLAYER_RECORDS);
  }

  static savePlayerRecords(records: PlayerSessionRecord[]): void {
    setStored(STORAGE_KEYS.PLAYER_RECORDS, records);
  }

  static getRecordsForSession(sessionId: string): PlayerSessionRecord[] {
    const records = this.getPlayerRecords();
    return records.filter((r) => r.session_id === sessionId);
  }

  static getRecordsForDate(date: string): PlayerSessionRecord[] {
    const records = this.getPlayerRecords();
    return records.filter((r) => r.date === date);
  }

  static getRecordsForPlayer(playerId: string): PlayerSessionRecord[] {
    const records = this.getPlayerRecords();
    return records.filter((r) => r.player_id === playerId).sort((a, b) => b.date.localeCompare(a.date));
  }

  // --- ADD / IMPORT SESSION ---
  static saveSessionData(
    meta: Omit<SessionMeta, 'monitored_players_count'>,
    records: Omit<PlayerSessionRecord, 'id' | 'session_id' | 'created_at'>[]
  ): { meta: SessionMeta; records: PlayerSessionRecord[] } {
    const sessionsMeta = this.getSessionsMeta();
    const existingRecords = this.getPlayerRecords();

    // Check for existing session on same date
    const existingSessionIdx = sessionsMeta.findIndex((s) => s.date === meta.date);

    let sessionId = meta.id;
    if (!sessionId) {
      sessionId = `session-${meta.date}`;
    }

    const fullMeta: SessionMeta = {
      ...meta,
      id: sessionId,
      monitored_players_count: records.length,
      created_at: meta.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingSessionIdx >= 0) {
      sessionsMeta[existingSessionIdx] = fullMeta;
    } else {
      sessionsMeta.push(fullMeta);
    }
    // Sort sessions descending by date
    sessionsMeta.sort((a, b) => b.date.localeCompare(a.date));
    this.saveSessionsMeta(sessionsMeta);

    // Filter out previous records for this session ID to overwrite / update cleanly
    const filteredRecords = existingRecords.filter((r) => r.session_id !== sessionId);

    const newFullRecords: PlayerSessionRecord[] = records.map((rec) => ({
      ...rec,
      id: `rec-${meta.date.replace(/-/g, '')}-${rec.player_id}`,
      session_id: sessionId,
      created_at: new Date().toISOString(),
    }));

    const updatedRecords = [...filteredRecords, ...newFullRecords];
    this.savePlayerRecords(updatedRecords);

    this.addAuditLog('IMPORT_SESSION', `Saved session for ${meta.date} with ${records.length} players`);

    return { meta: fullMeta, records: newFullRecords };
  }

  static updateSingleRecord(recordId: string, updates: Partial<PlayerSessionRecord>, editorName = 'Luis'): PlayerSessionRecord | null {
    const records = this.getPlayerRecords();
    const idx = records.findIndex((r) => r.id === recordId);
    if (idx === -1) return null;

    const original = records[idx];
    const updated: PlayerSessionRecord = {
      ...original,
      ...updates,
      updated_at: new Date().toISOString(),
      edited_by: editorName,
    };

    records[idx] = updated;
    this.savePlayerRecords(records);

    this.addAuditLog('EDIT_RECORD', `Edited record for ${original.player_name} on ${original.date} by ${editorName}`);
    return updated;
  }

  static deleteSession(sessionId: string): boolean {
    const sessions = this.getSessionsMeta();
    const records = this.getPlayerRecords();

    const newSessions = sessions.filter((s) => s.id !== sessionId);
    const newRecords = records.filter((r) => r.session_id !== sessionId);

    if (newSessions.length === sessions.length) return false;

    this.saveSessionsMeta(newSessions);
    this.savePlayerRecords(newRecords);
    this.addAuditLog('DELETE_SESSION', `Deleted session ${sessionId}`);

    return true;
  }

  // --- COACH SETTINGS ---
  static getSettings(): CoachSettings {
    return getStored<CoachSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }

  static saveSettings(settings: CoachSettings): void {
    setStored(STORAGE_KEYS.SETTINGS, settings);
    this.addAuditLog('UPDATE_SETTINGS', 'Updated Coach Settings thresholds');
  }

  // --- RPE ---
  static getRPEEntries(): RPEEntry[] {
    return getStored<RPEEntry[]>(STORAGE_KEYS.RPE_ENTRIES, INITIAL_RPE_ENTRIES);
  }

  static saveRPEEntry(entry: Omit<RPEEntry, 'id' | 'created_at'>): RPEEntry {
    const entries = this.getRPEEntries();
    const newEntry: RPEEntry = {
      ...entry,
      id: `rpe_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      created_at: new Date().toISOString(),
    };
    entries.push(newEntry);
    setStored(STORAGE_KEYS.RPE_ENTRIES, entries);
    this.addAuditLog('SAVE_RPE', `Saved RPE ${entry.rpe_score}/10 for date ${entry.date}`);
    return newEntry;
  }

  static updateRPEEntry(id: string, updates: Partial<RPEEntry>): RPEEntry | null {
    const entries = this.getRPEEntries();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    entries[idx] = { ...entries[idx], ...updates };
    setStored(STORAGE_KEYS.RPE_ENTRIES, entries);
    this.addAuditLog('UPDATE_RPE', `Updated RPE entry ${id}`);
    return entries[idx];
  }

  static deleteRPEEntry(id: string): boolean {
    const entries = this.getRPEEntries();
    const filtered = entries.filter((e) => e.id !== id);
    if (filtered.length === entries.length) return false;
    setStored(STORAGE_KEYS.RPE_ENTRIES, filtered);
    this.addAuditLog('DELETE_RPE', `Deleted RPE entry ${id}`);
    return true;
  }

  // --- WELLNESS ---
  static getWellnessEntries(): WellnessEntry[] {
    return getStored<WellnessEntry[]>(STORAGE_KEYS.WELLNESS_ENTRIES, []);
  }

  static saveWellnessEntry(entry: Omit<WellnessEntry, 'id' | 'created_at'>): WellnessEntry {
    const entries = this.getWellnessEntries();
    const newEntry: WellnessEntry = {
      ...entry,
      id: `well_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    entries.push(newEntry);
    setStored(STORAGE_KEYS.WELLNESS_ENTRIES, entries);
    return newEntry;
  }

  // --- S&C INTERVENTIONS ---
  static getSCInterventions(): SCIntervention[] {
    return getStored<SCIntervention[]>(STORAGE_KEYS.SC_INTERVENTIONS, []);
  }

  static saveSCIntervention(intervention: Omit<SCIntervention, 'id' | 'created_at'>): SCIntervention {
    const items = this.getSCInterventions();
    const newItem: SCIntervention = {
      ...intervention,
      id: `sc_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    items.push(newItem);
    setStored(STORAGE_KEYS.SC_INTERVENTIONS, items);
    return newItem;
  }

  // --- AUDIT LOGS ---
  static getAuditLogs(): AuditLog[] {
    return getStored<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
  }

  static addAuditLog(action: string, details: string, user = 'Luis Aparicio Villa (S&C)'): void {
    const logs = this.getAuditLogs();
    logs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      action,
      user,
      details,
    });
    // keep last 100 logs
    setStored(STORAGE_KEYS.AUDIT_LOGS, logs.slice(0, 100));
  }

  // --- ANALYTICS CALCULATORS ---

  // Calculate team averages for a given array of records
  static calculateTeamAverages(records: PlayerSessionRecord[]) {
    if (records.length === 0) {
      return {
        avg_distance: null,
        avg_accel: null,
        avg_decel: null,
        avg_jump: null,
        avg_mechanical: null,
        total_distance: 0,
        player_count: 0,
      };
    }

    let distSum = 0, distCount = 0;
    let accelSum = 0, accelCount = 0;
    let decelSum = 0, decelCount = 0;
    let jumpSum = 0, jumpCount = 0;
    let mechSum = 0, mechCount = 0;

    records.forEach((r) => {
      if (r.distance_m !== null) {
        distSum += r.distance_m;
        distCount++;
      }
      if (r.accumulated_acceleration_load !== null) {
        accelSum += r.accumulated_acceleration_load;
        accelCount++;
      }
      if (r.deceleration_load !== null) {
        decelSum += r.deceleration_load;
        decelCount++;
      }
      if (r.jump_load !== null) {
        jumpSum += r.jump_load;
        jumpCount++;
      }
      if (r.mechanical_load !== null) {
        mechSum += r.mechanical_load;
        mechCount++;
      }
    });

    return {
      avg_distance: distCount > 0 ? Math.round(distSum / distCount) : null,
      avg_accel: accelCount > 0 ? Number((accelSum / accelCount).toFixed(1)) : null,
      avg_decel: decelCount > 0 ? Number((decelSum / decelCount).toFixed(1)) : null,
      avg_jump: jumpCount > 0 ? Number((jumpSum / jumpCount).toFixed(1)) : null,
      avg_mechanical: mechCount > 0 ? Number((mechSum / mechCount).toFixed(1)) : null,
      total_distance: distSum,
      player_count: records.length,
    };
  }

  // Calculate individual baseline for a player across recent records
  static calculatePlayerBaseline(playerId: string, metric: keyof CoreMetrics, limitSessions = 10) {
    const playerRecords = this.getRecordsForPlayer(playerId);
    const validValues = playerRecords
      .map((r) => r[metric])
      .filter((val): val is number => val !== null && val !== undefined);

    if (validValues.length === 0) return null;

    const slice = validValues.slice(0, limitSessions);
    const sum = slice.reduce((a, b) => a + b, 0);
    return Number((sum / slice.length).toFixed(1));
  }

  // Get baseline status: "BASELINE BUILDING" if records < min_sessions_for_baseline, else Green/Yellow/Red
  static getPlayerLoadStatus(
    playerId: string,
    currentValue: number | null,
    metric: keyof CoreMetrics
  ): { status: 'BASELINE BUILDING' | 'GREEN' | 'YELLOW' | 'RED'; label: string; pctChange: number | null; baseline: number | null } {
    const settings = this.getSettings();
    const playerRecords = this.getRecordsForPlayer(playerId);

    const validMetricRecords = playerRecords.filter((r) => r[metric] !== null);

    if (validMetricRecords.length < settings.min_sessions_for_baseline || currentValue === null) {
      return {
        status: 'BASELINE BUILDING',
        label: 'BASELINE BUILDING',
        pctChange: null,
        baseline: null,
      };
    }

    const baseline = this.calculatePlayerBaseline(playerId, metric, 10);
    if (baseline === null || baseline === 0) {
      return {
        status: 'BASELINE BUILDING',
        label: 'BASELINE BUILDING',
        pctChange: null,
        baseline: null,
      };
    }

    const pctChange = Number((((currentValue - baseline) / baseline) * 100).toFixed(1));

    if (pctChange > settings.red_threshold_pct) {
      return { status: 'RED', label: 'HIGH / UNUSUAL', pctChange, baseline };
    } else if (pctChange > settings.yellow_threshold_pct) {
      return { status: 'YELLOW', label: 'ELEVATED', pctChange, baseline };
    } else {
      return { status: 'GREEN', label: 'NORMAL / EXPECTED', pctChange, baseline };
    }
  }

  // Reset data back to initial demo data
  static resetToInitialData(): void {
    setStored(STORAGE_KEYS.ROSTER, INITIAL_ROSTER);
    setStored(STORAGE_KEYS.SESSIONS_META, INITIAL_SESSIONS_META);
    setStored(STORAGE_KEYS.PLAYER_RECORDS, INITIAL_PLAYER_RECORDS);
    setStored(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    setStored(STORAGE_KEYS.RPE_ENTRIES, []);
    setStored(STORAGE_KEYS.WELLNESS_ENTRIES, []);
    setStored(STORAGE_KEYS.SC_INTERVENTIONS, []);
    this.addAuditLog('RESET_DATA', 'Reset database to official August 11, 2026 preseason initial state');
  }
}
