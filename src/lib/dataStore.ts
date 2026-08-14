import {
  Player,
  PlayerSessionRecord,
  SessionMeta,
  CoreMetrics,
  RelativeMetrics,
  RPEEntry,
  CoachSettings,
  AuditLog,
  IndividualBaseline,
  MetricFlag,
  SessionFlagSummary,
  FlagStatus,
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
  static getMatchingRPE(playerId: string, playerNumber?: string, date?: string, sessionId?: string): RPEEntry | undefined {
    const entries = this.getRPEEntries();
    const cleanNum = playerNumber ? playerNumber.replace(/[^0-9]/g, '') : null;

    return entries.find((e) => {
      // 1. Player match
      const pMatch =
        e.player_id === playerId ||
        (cleanNum && e.player_number && e.player_number.replace(/[^0-9]/g, '') === cleanNum);

      if (!pMatch) return false;

      // 2. Date match
      if (date && e.date !== date) return false;

      // 3. Session ID match if present in both
      if (sessionId && e.session_id && e.session_id !== sessionId) {
        return false;
      }

      return true;
    });
  }

  static getPlayerRecords(): PlayerSessionRecord[] {
    const records = getStored<PlayerSessionRecord[]>(STORAGE_KEYS.PLAYER_RECORDS, INITIAL_PLAYER_RECORDS);

    return records.map((r) => {
      const matchingRPE = this.getMatchingRPE(r.player_id, r.player_number, r.date, r.session_id);

      const rpeVal = matchingRPE ? matchingRPE.rpe_score : (r.RPE ?? null);
      const srpeVal = matchingRPE && matchingRPE.duration_min
        ? matchingRPE.rpe_score * matchingRPE.duration_min
        : (r.sRPE ?? (rpeVal !== null && r.duration_min ? rpeVal * r.duration_min : null));

      const enrichedRecord: PlayerSessionRecord = {
        ...r,
        RPE: rpeVal,
        sRPE: srpeVal,
      };

      return this.enrichRecordWithRelative(enrichedRecord);
    });
  }

  static enrichRecordWithRelative(r: PlayerSessionRecord): PlayerSessionRecord {
    const minutes = r.session_type === 'Game' && r.game_minutes && r.game_minutes > 0
      ? r.game_minutes
      : (r.duration_min && r.duration_min > 0 ? r.duration_min : null);

    if (!minutes || minutes <= 0) {
      return { ...r, relative: undefined };
    }

    const relative: RelativeMetrics = {
      distance_per_min: r.distance_m !== null ? Number((r.distance_m / minutes).toFixed(1)) : null,
      accel_load_per_min: r.accumulated_acceleration_load !== null ? Number((r.accumulated_acceleration_load / minutes).toFixed(2)) : null,
      mechanical_load_per_min: r.mechanical_load !== null ? Number((r.mechanical_load / minutes).toFixed(2)) : null,
      decel_load_per_min: r.deceleration_load !== null ? Number((r.deceleration_load / minutes).toFixed(2)) : null,
      jump_load_per_min: r.jump_load !== null ? Number((r.jump_load / minutes).toFixed(2)) : null,
    };

    return { ...r, relative };
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

  // --- RPE DATA MANAGEMENT ---
  static getRPEEntries(): RPEEntry[] {
    const entries = getStored<RPEEntry[]>(STORAGE_KEYS.RPE_ENTRIES, INITIAL_RPE_ENTRIES);
    // Ensure default initial August 11 and August 12 entries are preserved
    const existingKeys = new Set(entries.map((e) => `${e.player_id}_${e.date}`));
    let updated = false;
    const merged = [...entries];

    INITIAL_RPE_ENTRIES.forEach((init) => {
      const key = `${init.player_id}_${init.date}`;
      if (!existingKeys.has(key)) {
        merged.push(init);
        updated = true;
      }
    });

    if (updated) {
      setStored(STORAGE_KEYS.RPE_ENTRIES, merged);
    }

    return merged;
  }

  static saveRPEEntry(entry: Omit<RPEEntry, 'id' | 'created_at'>): RPEEntry {
    const entries = this.getRPEEntries();

    // Check if entry already exists for player_id + date (+ session_id if provided)
    const existingIdx = entries.findIndex((e) => {
      const pMatch = e.player_id === entry.player_id;
      const dMatch = e.date === entry.date;
      if (entry.session_id && e.session_id) {
        return pMatch && dMatch && e.session_id === entry.session_id;
      }
      return pMatch && dMatch;
    });

    let savedEntry: RPEEntry;
    if (existingIdx >= 0) {
      savedEntry = {
        ...entries[existingIdx],
        ...entry,
        sRPE: entry.rpe_score && entry.duration_min ? entry.rpe_score * entry.duration_min : entries[existingIdx].sRPE,
        updated_at: new Date().toISOString(),
      };
      entries[existingIdx] = savedEntry;
    } else {
      savedEntry = {
        ...entry,
        id: `rpe_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sRPE: entry.rpe_score && entry.duration_min ? entry.rpe_score * entry.duration_min : undefined,
        created_at: new Date().toISOString(),
      };
      entries.push(savedEntry);
    }

    setStored(STORAGE_KEYS.RPE_ENTRIES, entries);

    // Also update matching record directly in PLAYER_RECORDS
    const records = getStored<PlayerSessionRecord[]>(STORAGE_KEYS.PLAYER_RECORDS, INITIAL_PLAYER_RECORDS);
    const recIdx = records.findIndex((r) => r.player_id === entry.player_id && r.date === entry.date);
    if (recIdx >= 0) {
      records[recIdx].RPE = entry.rpe_score;
      if (entry.duration_min) records[recIdx].sRPE = entry.rpe_score * entry.duration_min;
      this.savePlayerRecords(records);
    }

    this.addAuditLog('SAVE_RPE', `Recorded RPE ${entry.rpe_score}/10 for date ${entry.date}`);
    return savedEntry;
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

  static clearAllRPEData(): void {
    setStored(STORAGE_KEYS.RPE_ENTRIES, []);
    this.addAuditLog('RESET_RPE', 'Cleared all RPE records for fresh coach entry');
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
    setStored(STORAGE_KEYS.AUDIT_LOGS, logs.slice(0, 100));
  }

  // --- ANALYTICS & BASELINES ---

  static calculateTeamAverages(records: PlayerSessionRecord[]) {
    if (records.length === 0) {
      return {
        avg_distance: null,
        avg_accel: null,
        avg_decel: null,
        avg_jump: null,
        avg_mechanical: null,
        avg_rpe: null,
        total_distance: 0,
        player_count: 0,
      };
    }

    let distSum = 0, distCount = 0;
    let accelSum = 0, accelCount = 0;
    let decelSum = 0, decelCount = 0;
    let jumpSum = 0, jumpCount = 0;
    let mechSum = 0, mechCount = 0;
    let rpeSum = 0, rpeCount = 0;

    records.forEach((r) => {
      if (r.distance_m !== null) { distSum += r.distance_m; distCount++; }
      if (r.accumulated_acceleration_load !== null) { accelSum += r.accumulated_acceleration_load; accelCount++; }
      if (r.deceleration_load !== null) { decelSum += r.deceleration_load; decelCount++; }
      if (r.jump_load !== null) { jumpSum += r.jump_load; jumpCount++; }
      if (r.mechanical_load !== null) { mechSum += r.mechanical_load; mechCount++; }
      if (r.RPE !== null && r.RPE !== undefined) { rpeSum += r.RPE; rpeCount++; }
    });

    return {
      avg_distance: distCount > 0 ? Math.round(distSum / distCount) : null,
      avg_accel: accelCount > 0 ? Number((accelSum / accelCount).toFixed(1)) : null,
      avg_decel: decelCount > 0 ? Number((decelSum / decelCount).toFixed(1)) : null,
      avg_jump: jumpCount > 0 ? Number((jumpSum / jumpCount).toFixed(1)) : null,
      avg_mechanical: mechCount > 0 ? Number((mechSum / mechCount).toFixed(1)) : null,
      avg_rpe: rpeCount > 0 ? Number((rpeSum / rpeCount).toFixed(1)) : null,
      total_distance: distSum,
      player_count: records.length,
    };
  }

  // Calculate long-term & recent individual baseline for a player
  static calculatePlayerBaseline(
    playerId: string,
    metric: keyof CoreMetrics | 'RPE'
  ): IndividualBaseline {
    const playerRecords = this.getRecordsForPlayer(playerId);
    const validValues = playerRecords
      .map((r) => metric === 'RPE' ? r.RPE : r[metric])
      .filter((val): val is number => val !== null && val !== undefined);

    if (validValues.length === 0) {
      return { metric, longTermAvg: null, recentAvg: null, sampleSize: 0 };
    }

    const sumAll = validValues.reduce((a, b) => a + b, 0);
    const longTermAvg = Number((sumAll / validValues.length).toFixed(1));

    const recentSlice = validValues.slice(0, 3);
    const sumRecent = recentSlice.reduce((a, b) => a + b, 0);
    const recentAvg = Number((sumRecent / recentSlice.length).toFixed(1));

    return {
      metric,
      longTermAvg,
      recentAvg,
      sampleSize: validValues.length,
    };
  }

  // Evaluate Flag for a specific metric vs baseline
  static evaluateMetricFlag(
    playerId: string,
    currentValue: number | null,
    metric: keyof CoreMetrics | 'RPE'
  ): MetricFlag {
    const settings = this.getSettings();
    const baselineInfo = this.calculatePlayerBaseline(playerId, metric);

    if (baselineInfo.sampleSize < settings.min_sessions_for_baseline || currentValue === null) {
      return {
        metric,
        status: 'INSUFFICIENT_HISTORY',
        currentValue,
        baselineValue: baselineInfo.recentAvg,
        pctChange: null,
        reason: 'Insufficient individual history (< 3 sessions logged)',
      };
    }

    const baseline = baselineInfo.recentAvg!;
    if (baseline === 0) {
      return {
        metric,
        status: 'GREEN',
        currentValue,
        baselineValue: baseline,
        pctChange: 0,
        reason: 'Baseline is zero',
      };
    }

    const pctChange = Number((((currentValue - baseline) / baseline) * 100).toFixed(1));

    const metricLabels: Record<string, string> = {
      distance_m: 'Total Distance',
      accumulated_acceleration_load: 'Accumulated Accel Load',
      mechanical_load: 'Mechanical Load',
      deceleration_load: 'Mechanical Deceleration Load',
      jump_load: 'Jump Load',
      RPE: 'Subjective RPE',
    };

    const label = metricLabels[metric] || metric;

    if (pctChange > settings.red_threshold_pct) {
      return {
        metric,
        status: 'RED',
        currentValue,
        baselineValue: baseline,
        pctChange,
        reason: `RED: ${label} (+${pctChange}%) is unusually high compared with recent individual baseline (${baseline}).`,
      };
    } else if (pctChange > settings.yellow_threshold_pct) {
      return {
        metric,
        status: 'YELLOW',
        currentValue,
        baselineValue: baseline,
        pctChange,
        reason: `YELLOW: ${label} (+${pctChange}%) is elevated compared with recent individual baseline (${baseline}).`,
      };
    } else {
      return {
        metric,
        status: 'GREEN',
        currentValue,
        baselineValue: baseline,
        pctChange,
        reason: `GREEN: ${label} is within expected individual range (${baseline}).`,
      };
    }
  }

  // Get full session flag summary for a player record
  static getSessionFlagSummary(record: PlayerSessionRecord): SessionFlagSummary {
    const metrics: (keyof CoreMetrics)[] = [
      'distance_m',
      'accumulated_acceleration_load',
      'mechanical_load',
      'deceleration_load',
      'jump_load',
    ];

    const flags: MetricFlag[] = metrics.map((m) =>
      this.evaluateMetricFlag(record.player_id, record[m], m)
    );

    if (record.RPE !== undefined && record.RPE !== null) {
      flags.push(this.evaluateMetricFlag(record.player_id, record.RPE, 'RPE'));
    }

    const redFlags = flags.filter((f) => f.status === 'RED');
    const yellowFlags = flags.filter((f) => f.status === 'YELLOW');
    const insufficientFlags = flags.filter((f) => f.status === 'INSUFFICIENT_HISTORY');

    let overallStatus: FlagStatus = 'GREEN';
    if (redFlags.length > 0) {
      overallStatus = 'RED';
    } else if (yellowFlags.length > 0) {
      overallStatus = 'YELLOW';
    } else if (insufficientFlags.length === flags.length) {
      overallStatus = 'INSUFFICIENT_HISTORY';
    }

    const triggerReasons = flags
      .filter((f) => f.status === 'RED' || f.status === 'YELLOW')
      .map((f) => f.reason);

    return {
      overallStatus,
      flags,
      triggerReasons,
    };
  }

  // Reset data back to initial demo data
  static resetToInitialData(): void {
    setStored(STORAGE_KEYS.ROSTER, INITIAL_ROSTER);
    setStored(STORAGE_KEYS.SESSIONS_META, INITIAL_SESSIONS_META);
    setStored(STORAGE_KEYS.PLAYER_RECORDS, INITIAL_PLAYER_RECORDS);
    setStored(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    setStored(STORAGE_KEYS.RPE_ENTRIES, INITIAL_RPE_ENTRIES);
    this.addAuditLog('RESET_DATA', 'Reset database to official August 11, 2026 preseason initial state');
  }
}
