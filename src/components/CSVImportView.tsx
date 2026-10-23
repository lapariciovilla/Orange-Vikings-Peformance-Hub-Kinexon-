import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { Player, SessionType, SessionMeta, PlayerSessionRecord } from '../types';
import { DataStore } from '../lib/dataStore';
import { SAMPLE_EXTERNAL_LOAD_CSV_CONTENT } from '../data/initialData';
import { parseAnaerobicTimeToMinutes } from '../lib/positionalUtils';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
  Save,
  HelpCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  Calendar,
  Layers,
  Check,
  ExternalLink,
  Plus,
} from 'lucide-react';

interface CSVImportViewProps {
  roster: Player[];
  onImportComplete: (sessionId: string) => void;
  isAuthenticated?: boolean;
  onNavigateSettings?: () => void;
}

export interface ColumnMapping {
  player: string;
  jersey: string;
  distance: string;
  accel: string;
  accelMin: string;
  anaerobic: string;
  decel: string;
  decelMin: string;
  jump: string;
  mech: string;
}

export interface ParsedRow {
  raw: Record<string, string>;
  matchedPlayer: Player | null;
  playerIdentifier: string;
  distance: number | null;
  accelLoad: number | null;
  accelLoadPerMin: number | null;
  anaerobicTime: number | null;
  decelLoad: number | null;
  decelLoadPerMin: number | null;
  jumpLoad: number | null;
  mechLoad: number | null;
  status: 'MATCHED' | 'REVIEW' | 'UNMATCHED';
}

export interface FileImportSessionConfig {
  id: string; // unique internal tracking ID
  fileName: string;
  rawContent: string;
  headers: string[];
  rawRows: Record<string, string>[];
  
  // Independent session metadata
  sessionDate: string;
  isDateAutoDetected: boolean;
  sessionType: SessionType;
  sessionName: string;

  // Independent column mapping
  mapping: ColumnMapping;

  // Parsed and matched athlete rows
  parsedRows: ParsedRow[];

  // Session conflict detection & coach resolution
  isExistingConflict: boolean;
  conflictAction: 'replace' | 'rename' | 'skip';

  // Persistence result
  resultStatus?: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  resultSessionId?: string;
  resultError?: string;
  savedPlayerCount?: number;
  savedRawRowCount?: number;
}

// -------------------------------------------------------------
// Auto-Detection Helper Utilities
// -------------------------------------------------------------

function extractDateFromFilenameOrContent(filename: string, content: string): { date: string; isAutoDetected: boolean } {
  const todayStr = new Date().toISOString().split('T')[0];

  // Try YYYY-MM-DD or YYYY_MM_DD in filename
  const ymdMatch = filename.match(/(20\d{2})[-_](0[1-9]|1[0-2])[-_](0[1-9]|[12]\d|3[01])/);
  if (ymdMatch) {
    return { date: `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`, isAutoDetected: true };
  }

  // Try compact YYYYMMDD in filename
  const compactMatch = filename.match(/(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
  if (compactMatch) {
    return { date: `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`, isAutoDetected: true };
  }

  // Try MM-DD-YYYY in filename
  const mdyMatch = filename.match(/(0[1-9]|1[0-2])[-_](0[1-9]|[12]\d|3[01])[-_](20\d{2})/);
  if (mdyMatch) {
    return { date: `${mdyMatch[3]}-${mdyMatch[1]}-${mdyMatch[2]}`, isAutoDetected: true };
  }

  // Search first 1500 characters of CSV for a date header or timestamp
  const sample = content.slice(0, 1500);
  const contentDateMatch = sample.match(/(20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])/);
  if (contentDateMatch) {
    return { date: `${contentDateMatch[1]}-${contentDateMatch[2]}-${contentDateMatch[3]}`, isAutoDetected: true };
  }

  return { date: todayStr, isAutoDetected: false };
}

function autoDetectSessionTypeAndName(filename: string, content: string, detectedDate: string): {
  sessionType: SessionType;
  sessionName: string;
} {
  const lower = `${filename} ${content.slice(0, 1000)}`.toLowerCase();
  let sessionType: SessionType = 'Practice';
  let sessionName = `Tactical Load Session (${detectedDate})`;

  if (
    lower.includes('game') ||
    lower.includes(' vs ') ||
    lower.includes('match') ||
    lower.includes('opponent') ||
    lower.includes('bleague') ||
    lower.includes('b.league')
  ) {
    sessionType = 'Game';
    sessionName = `B.LEAGUE Game Session (${detectedDate})`;
  } else if (lower.includes('conditioning') || lower.includes('s&c') || lower.includes('strength')) {
    sessionType = 'Conditioning';
    sessionName = `Conditioning & High-Density Session (${detectedDate})`;
  } else if (lower.includes('recovery') || lower.includes('regen') || lower.includes('mobility')) {
    sessionType = 'Recovery';
    sessionName = `Post-Game Active Recovery (${detectedDate})`;
  } else if (lower.includes('preseason')) {
    sessionType = 'Preseason Practice';
    sessionName = `Preseason Tactical Session (${detectedDate})`;
  }

  // If filename contains a readable descriptive title, suggest it cleanly
  const cleanBase = filename.replace(/\.csv$/i, '').replace(/[_-]/g, ' ').trim();
  if (cleanBase && cleanBase.length > 3 && !cleanBase.match(/^kinexon\s*\d*$/i)) {
    sessionName = cleanBase;
  }

  return { sessionType, sessionName };
}

function autoDetectColumnMappings(fields: string[]): ColumnMapping {
  let player = '';
  let jersey = '';
  let distance = '';
  let accel = '';
  let accelMin = '';
  let anaerobic = '';
  let decel = '';
  let decelMin = '';
  let jump = '';
  let mech = '';

  fields.forEach((f) => {
    const lower = f.toLowerCase();
    if (!player && (lower.includes('player') || lower.includes('name') || lower.includes('athlete'))) {
      player = f;
    }
    if (!jersey && (lower.includes('jersey') || lower.includes('#') || lower.includes('number') || lower.includes('num') || lower.includes('no.'))) {
      jersey = f;
    }
    if (!distance && (lower.includes('distance') || lower.includes('dist') || lower.includes('meter'))) {
      distance = f;
    }
    if (lower.includes('accel') && (lower.includes('min') || lower.includes('/'))) {
      accelMin = f;
    } else if (!accel && lower.includes('accel')) {
      accel = f;
    }
    if (!anaerobic && (lower.includes('anaerobic') || lower.includes('high intensity'))) {
      anaerobic = f;
    }
    if (lower.includes('decel') && (lower.includes('min') || lower.includes('/'))) {
      decelMin = f;
    } else if (!decel && lower.includes('decel')) {
      decel = f;
    }
    if (!jump && lower.includes('jump')) {
      jump = f;
    }
    if (!mech && (lower.includes('mech') || lower.includes('mechanical'))) {
      mech = f;
    }
  });

  return { player, jersey, distance, accel, accelMin, anaerobic, decel, decelMin, jump, mech };
}

function parseFileRows(
  rawRows: Record<string, string>[],
  mapping: ColumnMapping
): ParsedRow[] {
  const parseNum = (val?: string) => {
    if (!val) return null;
    const cleaned = val.replace(/,/g, '').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  };

  return rawRows.map((row) => {
    const nameVal = mapping.player ? row[mapping.player] || '' : '';
    const jerseyVal = mapping.jersey ? row[mapping.jersey] || '' : '';
    const identifier = `${nameVal} ${jerseyVal}`.trim();

    const matched = DataStore.matchPlayer(identifier, jerseyVal || nameVal);

    const dist = parseNum(row[mapping.distance]);
    const accel = parseNum(row[mapping.accel]);
    const accelMin = parseNum(row[mapping.accelMin]);
    const anaerobic = parseAnaerobicTimeToMinutes(row[mapping.anaerobic]);
    const decel = parseNum(row[mapping.decel]);
    const decelMin = parseNum(row[mapping.decelMin]);
    const jump = parseNum(row[mapping.jump]);
    const mech = parseNum(row[mapping.mech]);

    let status: 'MATCHED' | 'REVIEW' | 'UNMATCHED' = 'MATCHED';
    if (!matched) {
      status = 'UNMATCHED';
    } else if (dist === null && accel === null && mech === null) {
      status = 'REVIEW';
    }

    return {
      raw: row,
      matchedPlayer: matched,
      playerIdentifier: identifier || 'Unknown Row',
      distance: dist,
      accelLoad: accel,
      accelLoadPerMin: accelMin,
      anaerobicTime: anaerobic,
      decelLoad: decel,
      decelLoadPerMin: decelMin,
      jumpLoad: jump,
      mechLoad: mech,
      status,
    };
  });
}

export const CSVImportView: React.FC<CSVImportViewProps> = ({
  roster,
  onImportComplete,
  isAuthenticated = false,
  onNavigateSettings,
}) => {
  // Navigation Steps:
  // 1: File Selection & Demo Loader
  // 2: Independent Session Configuration & Column Mapping
  // 3: Pre-Import Multi-Session Review & Athlete Roster Preview
  // 4: Final Ingestion Audit & Summary
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Independent multi-file session configs
  const [fileSessions, setFileSessions] = useState<FileImportSessionConfig[]>([]);
  
  // UI Accordion / Active File selection for Steps 2 & 3
  const [expandedMappingFileId, setExpandedMappingFileId] = useState<string | null>(null);
  const [activePreviewFileId, setActivePreviewFileId] = useState<string | null>(null);

  // Notification and Error state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{
    totalFiles: number;
    successCount: number;
    skippedCount: number;
    failedCount: number;
    totalPlayersSaved: number;
    totalRawRowsSaved: number;
    firstSuccessfulSessionId?: string;
  } | null>(null);

  // Existing sessions in database/store for conflict checking
  const existingSessions = useMemo(() => DataStore.getSessionsMeta(), []);

  // Show transient toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Helper to initialize a FileImportSessionConfig from text content
  const createSessionConfig = (fileName: string, content: string): Promise<FileImportSessionConfig> => {
    return new Promise((resolve) => {
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          const rawRows = results.data as Record<string, string>[];
          const dateResult = extractDateFromFilenameOrContent(fileName, content);
          const metaResult = autoDetectSessionTypeAndName(fileName, content, dateResult.date);
          const mapping = autoDetectColumnMappings(headers);
          const parsedRows = parseFileRows(rawRows, mapping);

          // Check if session conflict exists for this date and type
          const conflict = existingSessions.some(
            (s) => s.date === dateResult.date && (s.session_type === metaResult.sessionType || s.id === `session-${dateResult.date}`)
          );

          resolve({
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            fileName,
            rawContent: content,
            headers,
            rawRows,
            sessionDate: dateResult.date,
            isDateAutoDetected: dateResult.isAutoDetected,
            sessionType: metaResult.sessionType,
            sessionName: metaResult.sessionName,
            mapping,
            parsedRows,
            isExistingConflict: conflict,
            conflictAction: conflict ? 'replace' : 'rename',
          });
        },
      });
    });
  };

  // -------------------------------------------------------------
  // STEP 1 HANDLERS: File Upload & Demo
  // -------------------------------------------------------------

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const sessionPromises = files.map((file) => {
      return new Promise<FileImportSessionConfig>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const content = (evt.target?.result as string) || '';
          const config = await createSessionConfig(file.name, content);
          resolve(config);
        };
        reader.readAsText(file);
      });
    });

    const loadedConfigs = await Promise.all(sessionPromises);
    setFileSessions(loadedConfigs);
    if (loadedConfigs.length > 0) {
      setExpandedMappingFileId(loadedConfigs[0].id);
      setActivePreviewFileId(loadedConfigs[0].id);
    }
    setStep(2);
  };

  const handleLoadSampleCSV = async () => {
    const sampleName = 'Sample_Tracking_2026-08-11_Preseason.csv';
    const config = await createSessionConfig(sampleName, SAMPLE_EXTERNAL_LOAD_CSV_CONTENT);
    setFileSessions([config]);
    setExpandedMappingFileId(config.id);
    setActivePreviewFileId(config.id);
    setStep(2);
  };

  // -------------------------------------------------------------
  // STEP 2 HANDLERS: Per-File Session Metadata & Column Mapping
  // -------------------------------------------------------------

  const updateFileConfig = (fileId: string, updates: Partial<FileImportSessionConfig>) => {
    setFileSessions((prev) =>
      prev.map((item) => {
        if (item.id !== fileId) return item;
        const updated = { ...item, ...updates };

        // If date, type, or name changed, re-evaluate conflict detection
        if (updates.sessionDate !== undefined || updates.sessionType !== undefined) {
          const conflict = existingSessions.some(
            (s) => s.date === updated.sessionDate && (s.session_type === updated.sessionType || s.id === `session-${updated.sessionDate}`)
          );
          updated.isExistingConflict = conflict;
        }

        // If column mapping changed, re-parse rows
        if (updates.mapping !== undefined) {
          updated.parsedRows = parseFileRows(updated.rawRows, updated.mapping);
        }

        return updated;
      })
    );
  };

  const handleApplyMappingToAllCompatible = (sourceFileId: string) => {
    const source = fileSessions.find((f) => f.id === sourceFileId);
    if (!source) return;

    let appliedCount = 0;
    setFileSessions((prev) =>
      prev.map((item) => {
        if (item.id === sourceFileId) return item;

        // Check if item has the columns used in source.mapping
        const activeCols = Object.values(source.mapping).filter(Boolean);
        const hasAllCols = activeCols.every((col) => item.headers.includes(col));

        if (hasAllCols) {
          appliedCount++;
          const newMapping = { ...source.mapping };
          return {
            ...item,
            mapping: newMapping,
            parsedRows: parseFileRows(item.rawRows, newMapping),
          };
        }
        return item;
      })
    );

    triggerToast(`Applied mapping to ${appliedCount} compatible CSV file(s)`);
  };

  const handleRemoveFile = (fileId: string) => {
    setFileSessions((prev) => {
      const filtered = prev.filter((f) => f.id !== fileId);
      if (filtered.length === 0) {
        setStep(1);
      } else if (activePreviewFileId === fileId) {
        setActivePreviewFileId(filtered[0].id);
      }
      return filtered;
    });
  };

  // -------------------------------------------------------------
  // STEP 3 HANDLERS: Athlete Overrides & Pre-Flight Review
  // -------------------------------------------------------------

  const handlePlayerOverride = (fileId: string, rowIndex: number, playerId: string) => {
    const player = roster.find((p) => p.id === playerId) || null;
    setFileSessions((prev) =>
      prev.map((item) => {
        if (item.id !== fileId) return item;
        const updatedRows = [...item.parsedRows];
        updatedRows[rowIndex] = {
          ...updatedRows[rowIndex],
          matchedPlayer: player,
          status: player ? 'MATCHED' : 'UNMATCHED',
        };
        return {
          ...item,
          parsedRows: updatedRows,
        };
      })
    );
  };

  // -------------------------------------------------------------
  // STEP 4 PERSISTENCE: Save Each File Session Independently
  // -------------------------------------------------------------

  const handleExecuteImport = async () => {
    if (isSaving) return;
    setSaveError(null);

    // Pre-flight check: Ensure all non-skipped files have a valid date and at least 1 valid row
    const nonSkippedFiles = fileSessions.filter((f) => f.conflictAction !== 'skip');
    if (nonSkippedFiles.length === 0) {
      alert('All selected files are marked as skipped. Please adjust conflict settings or select files to import.');
      return;
    }

    for (const file of nonSkippedFiles) {
      if (!file.sessionDate || !file.sessionDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        alert(`File "${file.fileName}" has an invalid or missing session date. Please select a valid date.`);
        return;
      }
      const validRows = file.parsedRows.filter((r) => r.matchedPlayer !== null);
      if (validRows.length === 0) {
        const proceed = confirm(
          `File "${file.fileName}" has 0 matched players. Import will skip saving player metrics for this file. Continue?`
        );
        if (!proceed) return;
      }
    }

    setIsSaving(true);

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let totalPlayersSaved = 0;
    let totalRawRowsSaved = 0;
    let firstSuccessfulSessionId: string | undefined = undefined;

    const updatedConfigs: FileImportSessionConfig[] = [];

    // Process each file session sequentially and independently
    for (let i = 0; i < fileSessions.length; i++) {
      const fileConfig = fileSessions[i];

      if (fileConfig.conflictAction === 'skip') {
        skippedCount++;
        updatedConfigs.push({
          ...fileConfig,
          resultStatus: 'SKIPPED',
        });
        continue;
      }

      // Compute distinct session ID
      let sessionId = `session-${fileConfig.sessionDate}`;
      if (fileConfig.conflictAction === 'rename' || fileConfig.isExistingConflict) {
        const slug = (fileConfig.sessionName || fileConfig.sessionType)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 20);
        sessionId = `session-${fileConfig.sessionDate}-${slug || i + 1}`;
      }

      const validRows = fileConfig.parsedRows.filter((r) => r.matchedPlayer !== null);

      // Check duplicates within this file
      const seenPlayerIds = new Set<string>();
      const duplicateIds = new Set<string>();
      for (const r of validRows) {
        if (r.matchedPlayer) {
          if (seenPlayerIds.has(r.matchedPlayer.id)) {
            duplicateIds.add(r.matchedPlayer.displayName);
          } else {
            seenPlayerIds.add(r.matchedPlayer.id);
          }
        }
      }

      const meta: Omit<SessionMeta, 'monitored_players_count'> = {
        id: sessionId,
        date: fileConfig.sessionDate,
        season: '2026–2027',
        session_type: fileConfig.sessionType,
        session_name: fileConfig.sessionName,
        created_at: new Date().toISOString(),
      };

      const records: Omit<PlayerSessionRecord, 'id' | 'session_id' | 'created_at'>[] = validRows.map(
        (r) => {
          const player = r.matchedPlayer!;
          return {
            date: fileConfig.sessionDate,
            season: '2026–2027',
            session_type: fileConfig.sessionType,
            session_name: fileConfig.sessionName,
            player_id: player.id,
            player_number: player.number,
            player_name: player.displayName,
            position: player.position,
            distance_m: r.distance,
            accumulated_acceleration_load: r.accelLoad,
            accumulated_acceleration_load_per_min: r.accelLoadPerMin,
            anaerobic_activity_time: r.anaerobicTime,
            deceleration_load: r.decelLoad,
            deceleration_load_per_min: r.decelLoadPerMin,
            jump_load: r.jumpLoad,
            mechanical_load: r.mechLoad,
            source: 'CSV',
          };
        }
      );

      const rawRowsToSave = fileConfig.parsedRows.map((r, idx) => ({
        raw: r.raw,
        rowIndex: idx + 1,
        playerIdentifier: r.playerIdentifier,
        parsedStatus: (r.matchedPlayer !== null ? 'ACCEPTED' : 'REJECTED') as 'ACCEPTED' | 'REJECTED' | 'DUPLICATE',
        validationNotes: r.matchedPlayer
          ? `Matched to ${r.matchedPlayer.displayName} (#${r.matchedPlayer.number})`
          : 'Unmatched athlete',
      }));

      try {
        const result = await DataStore.saveSessionDataAsync(meta, records, {
          filename: fileConfig.fileName,
          rawRows: rawRowsToSave,
          acceptedCount: validRows.length,
          rejectedCount: fileConfig.parsedRows.length - validRows.length,
          duplicateCount: duplicateIds.size,
        });

        if (result.error) {
          failedCount++;
          const errText = result.error.message || result.error.friendlyMessage || JSON.stringify(result.error);
          updatedConfigs.push({
            ...fileConfig,
            resultStatus: 'FAILED',
            resultError: errText,
          });
        } else {
          successCount++;
          totalPlayersSaved += validRows.length;
          totalRawRowsSaved += rawRowsToSave.length;
          if (!firstSuccessfulSessionId) {
            firstSuccessfulSessionId = result.meta.id;
          }
          updatedConfigs.push({
            ...fileConfig,
            resultStatus: 'SUCCESS',
            resultSessionId: result.meta.id,
            savedPlayerCount: validRows.length,
            savedRawRowCount: rawRowsToSave.length,
          });
        }
      } catch (err: any) {
        failedCount++;
        updatedConfigs.push({
          ...fileConfig,
          resultStatus: 'FAILED',
          resultError: err.message || String(err),
        });
      }
    }

    setFileSessions(updatedConfigs);
    setIsSaving(false);

    setImportSummary({
      totalFiles: fileSessions.length,
      successCount,
      skippedCount,
      failedCount,
      totalPlayersSaved,
      totalRawRowsSaved,
      firstSuccessfulSessionId,
    });

    setStep(4);

    if (successCount > 0) {
      triggerToast(`Successfully imported ${successCount} session(s) into database!`);
    } else if (failedCount > 0) {
      setSaveError(`Encountered errors importing files. Review the detailed error breakdown below.`);
    }
  };

  // Helper metric counter
  const getMappedMetricsCount = (m: ColumnMapping) => {
    return [m.distance, m.accel, m.accelMin, m.anaerobic, m.decel, m.decelMin, m.jump, m.mech].filter(Boolean).length;
  };

  const activePreviewFile = fileSessions.find((f) => f.id === activePreviewFileId) || fileSessions[0];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-zinc-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-zinc-950 px-5 py-3 rounded-lg shadow-2xl font-black flex items-center space-x-2 border border-emerald-400 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Step Wizard Breadcrumbs */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-1">
            DATA INGESTION PIPELINE
          </div>
          <h1 className="text-xl font-black text-white tracking-wide">
            TRACKING CSV INGESTION ENGINE
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Multi-file, independent session ingestion with automatic column mapping, athlete matching, and Supabase database persistence.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center space-x-2 text-xs font-bold">
          <div
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              step === 1
                ? 'bg-orange-600 text-zinc-950 border-orange-500 font-black'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            1. Select CSVs
          </div>
          <span className="text-zinc-600">→</span>
          <div
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              step === 2
                ? 'bg-orange-600 text-zinc-950 border-orange-500 font-black'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            2. Configure Sessions
          </div>
          <span className="text-zinc-600">→</span>
          <div
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              step === 3
                ? 'bg-orange-600 text-zinc-950 border-orange-500 font-black'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            3. Review & Match
          </div>
          <span className="text-zinc-600">→</span>
          <div
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              step === 4
                ? 'bg-orange-600 text-zinc-950 border-orange-500 font-black'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            4. Ingestion Audit
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* STEP 1: Multi-File Selection & Preseason Demo Loader */}
      {/* ------------------------------------------------------------------ */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border-2 border-dashed border-zinc-800 hover:border-orange-500/60 rounded-xl p-10 text-center transition-all bg-zinc-950/40">
            <FileSpreadsheet className="w-12 h-12 text-orange-500 mx-auto mb-3" />
            <h3 className="text-lg font-black text-white">Select One or Multiple CSV Files</h3>
            <p className="text-xs text-zinc-400 max-w-lg mx-auto mt-1 mb-6">
              Upload single or batch tracking export files. Each CSV file is processed and persisted as its own independent session.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <label className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-extrabold px-6 py-3 rounded-lg text-xs cursor-pointer shadow-lg transition-colors flex items-center space-x-2">
                <Upload className="w-4 h-4" />
                <span>SELECT CSV FILES (BATCH SUPPORTED)</span>
                <input
                  type="file"
                  accept=".csv"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                id="load-sample-csv-btn"
                onClick={handleLoadSampleCSV}
                className="bg-zinc-800 hover:bg-zinc-700 text-orange-400 border border-orange-800/60 font-bold px-6 py-3 rounded-lg text-xs flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>LOAD DEMO TRACKING PRESEASON CSV</span>
              </button>
            </div>
          </div>

          {/* Guidelines Box */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 text-xs text-zinc-400 space-y-2">
            <div className="font-bold text-zinc-200 flex items-center space-x-2">
              <HelpCircle className="w-4 h-4 text-orange-500" />
              <span>Multi-File Ingestion Architecture</span>
            </div>
            <p>
              Each selected CSV file maintains an independent configuration lifecycle:
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-2">
              <li><strong className="text-zinc-300">Independent Sessions:</strong> Distinct date picker, session type, session name, and session ID per file.</li>
              <li><strong className="text-zinc-300">Isolated Column Mapping:</strong> Each CSV file has its own column mapping and athlete recognition without row merging.</li>
              <li><strong className="text-zinc-300">Smart Date & Type Detection:</strong> File names with dates (e.g. <code className="text-orange-400">2026-08-11</code>) and game/practice keywords are auto-detected.</li>
              <li><strong className="text-zinc-300">Conflict Management:</strong> If a session already exists for the date, you can overwrite, skip, or create an additional session with a unique ID.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STEP 2: Independent Session Configuration & Column Mapping */}
      {/* ------------------------------------------------------------------ */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div>
              <h2 className="text-base font-black text-white flex items-center space-x-2">
                <span>CONFIGURE INDEPENDENT SESSIONS</span>
                <span className="bg-orange-950 text-orange-400 border border-orange-800/80 text-[10px] px-2 py-0.5 rounded font-black">
                  {fileSessions.length} {fileSessions.length === 1 ? 'FILE' : 'FILES'} QUEUED
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Each file below represents a separate training or game session. Configure dates, types, and column mappings individually.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <label className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-3 py-1.5 rounded text-xs cursor-pointer border border-zinc-700 flex items-center space-x-1.5">
                <Plus className="w-3.5 h-3.5 text-orange-400" />
                <span>Add More Files</span>
                <input
                  type="file"
                  accept=".csv"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => setStep(1)}
                className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded hover:bg-zinc-800 transition-colors"
              >
                Reset All
              </button>
            </div>
          </div>

          {/* List of Independent Session Cards */}
          <div className="space-y-4">
            {fileSessions.map((fileItem, idx) => {
              const mappedMetricCount = getMappedMetricsCount(fileItem.mapping);
              const validRowsCount = fileItem.parsedRows.filter((r) => r.matchedPlayer !== null).length;
              const isExpanded = expandedMappingFileId === fileItem.id;

              return (
                <div
                  key={fileItem.id}
                  className={`bg-zinc-900 border rounded-xl transition-all shadow-lg overflow-hidden ${
                    fileItem.conflictAction === 'skip'
                      ? 'border-zinc-800/60 opacity-60'
                      : fileItem.isExistingConflict
                      ? 'border-amber-700/80 ring-1 ring-amber-500/20'
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {/* Card Header Bar */}
                  <div className="p-4 bg-zinc-950/70 border-b border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-orange-950/80 border border-orange-800/60 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black text-orange-400 truncate max-w-xs md:max-w-md">
                            {fileItem.fileName}
                          </span>
                          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono shrink-0">
                            Session #{idx + 1}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center space-x-2 mt-0.5">
                          <span>{fileItem.rawRows.length} data rows</span>
                          <span>•</span>
                          <span className={validRowsCount > 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                            {validRowsCount} / {fileItem.rawRows.length} athletes recognized
                          </span>
                          <span>•</span>
                          <span className={mappedMetricCount >= 6 ? 'text-emerald-400' : 'text-amber-400'}>
                            {mappedMetricCount}/8 metrics mapped
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badges & Action */}
                    <div className="flex items-center space-x-2 shrink-0">
                      {fileItem.isExistingConflict && (
                        <span className="bg-amber-950/80 text-amber-300 border border-amber-700/70 text-[10px] px-2 py-1 rounded font-black flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>Session Conflict Detected</span>
                        </span>
                      )}

                      <button
                        onClick={() => handleRemoveFile(fileItem.id)}
                        className="text-zinc-500 hover:text-rose-400 p-1.5 rounded hover:bg-zinc-800 transition-colors"
                        title="Remove this file from import"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Card Metadata Configuration Body */}
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Session Date */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-zinc-300 flex items-center space-x-1">
                            <Calendar className="w-3 h-3 text-orange-400" />
                            <span>SESSION DATE</span>
                          </label>
                          {fileItem.isDateAutoDetected ? (
                            <span className="text-[9px] text-emerald-400 font-bold">Auto-detected</span>
                          ) : (
                            <span className="text-[9px] text-amber-400 font-bold">Manual selection</span>
                          )}
                        </div>
                        <input
                          type="date"
                          value={fileItem.sessionDate}
                          onChange={(e) => updateFileConfig(fileItem.id, { sessionDate: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      {/* Session Type */}
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                          SESSION TYPE
                        </label>
                        <select
                          value={fileItem.sessionType}
                          onChange={(e) => updateFileConfig(fileItem.id, { sessionType: e.target.value as SessionType })}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                        >
                          <option value="Practice">Practice</option>
                          <option value="Preseason Practice">Preseason Practice</option>
                          <option value="Game">Game (Official / Scrimmage)</option>
                          <option value="Conditioning">Conditioning / Strength Training</option>
                          <option value="Recovery">Recovery & Mobility</option>
                          <option value="Other">Other Monitored Session</option>
                        </select>
                      </div>

                      {/* Session Name / Description */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                          SESSION NAME / DESCRIPTION
                        </label>
                        <input
                          type="text"
                          value={fileItem.sessionName}
                          onChange={(e) => updateFileConfig(fileItem.id, { sessionName: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                          placeholder="e.g. Morning Tactical & Speed Ingestion"
                        />
                      </div>
                    </div>

                    {/* Conflict Handling Notice (if date conflict detected) */}
                    {fileItem.isExistingConflict && (
                      <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-xs space-y-2">
                        <div className="flex items-center space-x-2 text-amber-300 font-bold">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>
                            A session already exists in Supabase for date <strong>{fileItem.sessionDate}</strong>. Choose conflict action:
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          <label className={`flex items-center space-x-2 p-2 rounded border cursor-pointer ${
                            fileItem.conflictAction === 'replace'
                              ? 'bg-orange-950/60 border-orange-600 text-white font-bold'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}>
                            <input
                              type="radio"
                              name={`conflict-${fileItem.id}`}
                              checked={fileItem.conflictAction === 'replace'}
                              onChange={() => updateFileConfig(fileItem.id, { conflictAction: 'replace' })}
                              className="text-orange-500"
                            />
                            <span className="text-[11px]">Update / Replace Existing</span>
                          </label>

                          <label className={`flex items-center space-x-2 p-2 rounded border cursor-pointer ${
                            fileItem.conflictAction === 'rename'
                              ? 'bg-orange-950/60 border-orange-600 text-white font-bold'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}>
                            <input
                              type="radio"
                              name={`conflict-${fileItem.id}`}
                              checked={fileItem.conflictAction === 'rename'}
                              onChange={() => updateFileConfig(fileItem.id, { conflictAction: 'rename' })}
                              className="text-orange-500"
                            />
                            <span className="text-[11px]">Import as Additional Session</span>
                          </label>

                          <label className={`flex items-center space-x-2 p-2 rounded border cursor-pointer ${
                            fileItem.conflictAction === 'skip'
                              ? 'bg-rose-950/60 border-rose-600 text-rose-300 font-bold'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}>
                            <input
                              type="radio"
                              name={`conflict-${fileItem.id}`}
                              checked={fileItem.conflictAction === 'skip'}
                              onChange={() => updateFileConfig(fileItem.id, { conflictAction: 'skip' })}
                              className="text-rose-500"
                            />
                            <span className="text-[11px]">Skip this CSV File</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Column Mapping Toggle Header */}
                    <div className="border-t border-zinc-800/80 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <button
                        onClick={() => setExpandedMappingFileId(isExpanded ? null : fileItem.id)}
                        className="flex items-center space-x-2 text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <span>
                          {isExpanded ? 'Hide Independent Column Mapping' : 'Customize Column Mapping & Preview Details'}
                        </span>
                        <span className="text-zinc-500 text-[10px]">
                          ({mappedMetricCount}/8 metrics mapped)
                        </span>
                      </button>

                      {/* Apply Mapping to All Files Button */}
                      {fileSessions.length > 1 && (
                        <button
                          onClick={() => handleApplyMappingToAllCompatible(fileItem.id)}
                          className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 px-2.5 py-1 rounded font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                          title="Copies this file's column mapping to any other file with matching column names"
                        >
                          <Copy className="w-3 h-3 text-orange-400" />
                          <span>Apply mapping to compatible files</span>
                        </button>
                      )}
                    </div>

                    {/* Expandable Column Mapping Form */}
                    {isExpanded && (
                      <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 space-y-4 animate-in fade-in duration-150">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {/* Player Column */}
                          <div>
                            <label className="block text-[11px] font-bold text-orange-400 mb-1">
                              Player Name / Identifier Column
                            </label>
                            <select
                              value={fileItem.mapping.player}
                              onChange={(e) =>
                                updateFileConfig(fileItem.id, {
                                  mapping: { ...fileItem.mapping, player: e.target.value },
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white"
                            >
                              <option value="">-- Select Column --</option>
                              {fileItem.headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Jersey # */}
                          <div>
                            <label className="block text-[11px] font-bold text-orange-400 mb-1">
                              Jersey # Column (Optional)
                            </label>
                            <select
                              value={fileItem.mapping.jersey}
                              onChange={(e) =>
                                updateFileConfig(fileItem.id, {
                                  mapping: { ...fileItem.mapping, jersey: e.target.value },
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white"
                            >
                              <option value="">-- Select Column --</option>
                              {fileItem.headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Distance */}
                          <div>
                            <label className="block text-[11px] font-bold text-amber-400 mb-1">
                              Distance (m) Column
                            </label>
                            <select
                              value={fileItem.mapping.distance}
                              onChange={(e) =>
                                updateFileConfig(fileItem.id, {
                                  mapping: { ...fileItem.mapping, distance: e.target.value },
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white"
                            >
                              <option value="">-- Select Column --</option>
                              {fileItem.headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Accel Load */}
                          <div>
                            <label className="block text-[11px] font-bold text-orange-400 mb-1">
                              Accumulated Accel Load
                            </label>
                            <select
                              value={fileItem.mapping.accel}
                              onChange={(e) =>
                                updateFileConfig(fileItem.id, {
                                  mapping: { ...fileItem.mapping, accel: e.target.value },
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white"
                            >
                              <option value="">-- Select Column --</option>
                              {fileItem.headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Accel Load / min */}
                          <div>
                            <label className="block text-[11px] font-bold text-orange-300 mb-1">
                              Accel Load / min (Optional)
                            </label>
                            <select
                              value={fileItem.mapping.accelMin}
                              onChange={(e) =>
                                updateFileConfig(fileItem.id, {
                                  mapping: { ...fileItem.mapping, accelMin: e.target.value },
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white"
                            >
                              <option value="">-- Auto-Calculated if empty --</option>
                              {fileItem.headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Anaerobic Time */}
                          <div>
                            <label className="block text-[11px] font-bold text-yellow-400 mb-1">
                              Anaerobic Activity Time (s)
                            </label>
                            <select
                              value={fileItem.mapping.anaerobic}
                              onChange={(e) =>
                                updateFileConfig(fileItem.id, {
                                  mapping: { ...fileItem.mapping, anaerobic: e.target.value },
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white"
                            >
                              <option value="">-- Select Column --</option>
                              {fileItem.headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Decel Load */}
                          <div>
                            <label className="block text-[11px] font-bold text-rose-400 mb-1">
                              Deceleration Load
                            </label>
                            <select
                              value={fileItem.mapping.decel}
                              onChange={(e) =>
                                updateFileConfig(fileItem.id, {
                                  mapping: { ...fileItem.mapping, decel: e.target.value },
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white"
                            >
                              <option value="">-- Select Column --</option>
                              {fileItem.headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Decel Load / min */}
                          <div>
                            <label className="block text-[11px] font-bold text-rose-300 mb-1">
                              Decel Load / min (Optional)
                            </label>
                            <select
                              value={fileItem.mapping.decelMin}
                              onChange={(e) =>
                                updateFileConfig(fileItem.id, {
                                  mapping: { ...fileItem.mapping, decelMin: e.target.value },
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white"
                            >
                              <option value="">-- Auto-Calculated if empty --</option>
                              {fileItem.headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Jump Load */}
                          <div>
                            <label className="block text-[11px] font-bold text-purple-400 mb-1">
                              Jump Load Column
                            </label>
                            <select
                              value={fileItem.mapping.jump}
                              onChange={(e) =>
                                updateFileConfig(fileItem.id, {
                                  mapping: { ...fileItem.mapping, jump: e.target.value },
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white"
                            >
                              <option value="">-- Select Column --</option>
                              {fileItem.headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Mechanical Load */}
                          <div>
                            <label className="block text-[11px] font-bold text-sky-400 mb-1">
                              Mechanical Load Column
                            </label>
                            <select
                              value={fileItem.mapping.mech}
                              onChange={(e) =>
                                updateFileConfig(fileItem.id, {
                                  mapping: { ...fileItem.mapping, mech: e.target.value },
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white"
                            >
                              <option value="">-- Select Column --</option>
                              {fileItem.headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Step 2 Bottom Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <button
              onClick={() => setStep(1)}
              className="text-xs text-zinc-400 hover:text-white font-bold cursor-pointer"
            >
              ← Back to File Selection
            </button>

            <button
              id="proceed-to-review-btn"
              onClick={() => {
                if (fileSessions.length > 0) {
                  setActivePreviewFileId(fileSessions[0].id);
                }
                setStep(3);
              }}
              className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-6 py-2.5 rounded-lg text-xs flex items-center space-x-2 shadow-lg shadow-orange-950/40 cursor-pointer transition-colors"
            >
              <span>PROCEED TO ATHLETE REVIEW & AUDIT</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STEP 3: Pre-Import Multi-Session Review & Athlete Roster Preview */}
      {/* ------------------------------------------------------------------ */}
      {step === 3 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6 shadow-xl">
          {/* Header Summary Across All Queued Files */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-white">PRE-IMPORT MULTI-SESSION AUDIT</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Review auto-matched roster members and verify metrics for each independent session prior to database persistence.
              </p>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="flex items-center text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded">
                <Layers className="w-3.5 h-3.5 mr-1" />
                {fileSessions.filter((f) => f.conflictAction !== 'skip').length} Sessions Queued
              </span>
              <span className="flex items-center text-zinc-300 font-bold bg-zinc-800/80 border border-zinc-700 px-2.5 py-1 rounded">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                {fileSessions.reduce(
                  (acc, f) => acc + (f.conflictAction !== 'skip' ? f.parsedRows.filter((r) => r.matchedPlayer).length : 0),
                  0
                )}{' '}
                Athletes
              </span>
            </div>
          </div>

          {/* Session Switcher Tabs (for reviewing each file separately) */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-zinc-800">
            {fileSessions.map((fItem, idx) => {
              const isActive = activePreviewFileId === fItem.id;
              const validCount = fItem.parsedRows.filter((r) => r.matchedPlayer).length;
              const unmatchedCount = fItem.parsedRows.filter((r) => !r.matchedPlayer).length;

              return (
                <button
                  key={fItem.id}
                  onClick={() => setActivePreviewFileId(fItem.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center space-x-2 border cursor-pointer ${
                    isActive
                      ? 'bg-orange-600 text-zinc-950 border-orange-500 font-black shadow-lg shadow-orange-950/40'
                      : fItem.conflictAction === 'skip'
                      ? 'bg-zinc-950 text-zinc-500 border-zinc-800 line-through'
                      : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <FileText className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950' : 'text-orange-400'}`} />
                  <span className="truncate max-w-[140px]">{fItem.fileName}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      isActive
                        ? 'bg-zinc-950/30 text-zinc-950'
                        : unmatchedCount > 0
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    {validCount}p
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active File Inspection Card */}
          {activePreviewFile && (
            <div className="space-y-4">
              {/* Meta Checklist Card for Active File */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black text-white uppercase tracking-wider">
                      FILE AUDIT: {activePreviewFile.fileName}
                    </span>
                    <span className="text-[10px] bg-orange-950 text-orange-400 border border-orange-800 px-2 py-0.5 rounded font-black">
                      {activePreviewFile.sessionDate} • {activePreviewFile.sessionType}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 italic truncate max-w-sm">
                    "{activePreviewFile.sessionName}"
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
                  <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                    <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Rows Detected</span>
                    <span className="text-white font-black text-sm">{activePreviewFile.parsedRows.length}</span>
                  </div>
                  <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                    <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Valid Athletes</span>
                    <span className="text-emerald-400 font-black text-sm">
                      {activePreviewFile.parsedRows.filter((r) => r.matchedPlayer !== null).length}
                    </span>
                  </div>
                  <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                    <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Unmatched Rows</span>
                    <span className="text-rose-400 font-black text-sm">
                      {activePreviewFile.parsedRows.filter((r) => r.matchedPlayer === null).length}
                    </span>
                  </div>
                  <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                    <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Metrics Mapped</span>
                    <span className="text-amber-400 font-black text-sm">
                      {getMappedMetricsCount(activePreviewFile.mapping)} / 8
                    </span>
                  </div>
                  <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                    <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Session Type</span>
                    <span className="text-sky-400 font-black text-xs uppercase truncate block">
                      {activePreviewFile.sessionType}
                    </span>
                  </div>
                  <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                    <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Conflict Action</span>
                    <span className="text-purple-400 font-black text-xs uppercase truncate block">
                      {activePreviewFile.conflictAction}
                    </span>
                  </div>
                  <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                    <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Distance Sum</span>
                    <span className="text-orange-400 font-black text-xs truncate block">
                      {activePreviewFile.parsedRows
                        .reduce((sum, r) => sum + (r.distance || 0), 0)
                        .toLocaleString()}{' '}
                      m
                    </span>
                  </div>
                </div>
              </div>

              {/* Roster Matching Table */}
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-950 text-zinc-400 font-black uppercase text-[10px] tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="p-3">CSV Row Identifier</th>
                      <th className="p-3">Matched Roster Player</th>
                      <th className="p-3">Distance (m)</th>
                      <th className="p-3">Accel Load</th>
                      <th className="p-3">Anaerobic (min)</th>
                      <th className="p-3">Decel Load</th>
                      <th className="p-3">Jump Load</th>
                      <th className="p-3">Mech Load</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/60">
                    {activePreviewFile.parsedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/40">
                        <td className="p-3 font-medium text-white truncate max-w-[150px]">
                          {row.playerIdentifier}
                        </td>

                        <td className="p-3">
                          <select
                            value={row.matchedPlayer?.id || ''}
                            onChange={(e) => handlePlayerOverride(activePreviewFile.id, idx, e.target.value)}
                            className={`bg-zinc-950 border text-xs rounded px-2.5 py-1 font-bold ${
                              row.matchedPlayer
                                ? 'border-emerald-700 text-emerald-300'
                                : 'border-rose-700 text-rose-400'
                            }`}
                          >
                            <option value="">-- Unassigned (Skip Row) --</option>
                            {roster.map((p) => (
                              <option key={p.id} value={p.id}>
                                #{p.number} {p.displayName} ({p.position})
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-3 font-extrabold text-amber-400">
                          {row.distance !== null ? `${row.distance.toLocaleString()} m` : 'N/A'}
                        </td>
                        <td className="p-3 font-semibold text-zinc-300">
                          {row.accelLoad !== null ? row.accelLoad : 'N/A'}
                        </td>
                        <td className="p-3 font-bold text-yellow-400">
                          {row.anaerobicTime !== null ? `${row.anaerobicTime} min` : 'N/A'}
                        </td>
                        <td className="p-3 font-semibold text-zinc-300">
                          {row.decelLoad !== null ? row.decelLoad : 'N/A'}
                        </td>
                        <td className="p-3 font-semibold text-zinc-300">
                          {row.jumpLoad !== null ? row.jumpLoad : 'N/A'}
                        </td>
                        <td className="p-3 font-semibold text-zinc-300">
                          {row.mechLoad !== null ? row.mechLoad : 'N/A'}
                        </td>

                        <td className="p-3">
                          {row.status === 'MATCHED' ? (
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded">
                              MATCHED
                            </span>
                          ) : row.status === 'REVIEW' ? (
                            <span className="text-[10px] font-black text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded">
                              REVIEW
                            </span>
                          ) : (
                            <span className="text-[10px] font-black text-rose-400 bg-rose-950/80 border border-rose-800 px-2 py-0.5 rounded">
                              UNMATCHED
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Unauthenticated / Guest Notice */}
          {!isAuthenticated && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-amber-300 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Staff Notice: Operating in unauthenticated mode. Full PostgreSQL persistence requires staff login or the updated RLS policies.
                </span>
              </div>
              {onNavigateSettings && (
                <button
                  type="button"
                  onClick={onNavigateSettings}
                  className="text-xs text-orange-400 hover:text-orange-300 font-bold underline ml-2 shrink-0"
                >
                  Sign In / RLS Fix →
                </button>
              )}
            </div>
          )}

          {/* Save Error Alert Banner */}
          {saveError && (
            <div className="p-4 bg-rose-950/80 border border-rose-600 rounded-lg text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block mb-1">Persistence Notice:</span>
                  <span>{saveError}</span>
                </div>
              </div>
              {onNavigateSettings && (
                <button
                  type="button"
                  onClick={onNavigateSettings}
                  className="bg-rose-900/60 hover:bg-rose-800 text-white font-bold px-3 py-1.5 rounded text-xs shrink-0 border border-rose-500 flex items-center space-x-1"
                >
                  <span>Settings & Database</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Step 3 Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <button
              onClick={() => setStep(2)}
              disabled={isSaving}
              className="text-xs text-zinc-400 hover:text-white font-bold disabled:opacity-50 cursor-pointer"
            >
              ← Back to Session Setup
            </button>

            <button
              id="confirm-save-all-btn"
              onClick={handleExecuteImport}
              disabled={isSaving}
              className="bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 text-zinc-950 font-black px-6 py-2.5 rounded-lg text-xs flex items-center space-x-2 shadow-lg shadow-orange-950/40 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-900" />
                  <span>PERSISTING SESSIONS TO SUPABASE...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>
                    CONFIRM & PERSIST {fileSessions.filter((f) => f.conflictAction !== 'skip').length} SESSION(S) TO SUPABASE
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STEP 4: Ingestion Audit & Final Database Summary Report */}
      {/* ------------------------------------------------------------------ */}
      {step === 4 && importSummary && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6 shadow-xl">
          {/* Banner Status */}
          <div
            className={`p-6 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              importSummary.failedCount === 0
                ? 'bg-emerald-950/50 border-emerald-700/80 text-emerald-200'
                : 'bg-amber-950/50 border-amber-700/80 text-amber-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                  importSummary.failedCount === 0
                    ? 'bg-emerald-900/60 border-emerald-500 text-emerald-300'
                    : 'bg-amber-900/60 border-amber-500 text-amber-300'
                }`}
              >
                {importSummary.failedCount === 0 ? (
                  <CheckCircle2 className="w-7 h-7" />
                ) : (
                  <AlertTriangle className="w-7 h-7" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-black text-white">
                  {importSummary.failedCount === 0
                    ? 'MULTI-SESSION CSV INGESTION COMPLETED'
                    : 'INGESTION COMPLETED WITH NOTICES'}
                </h2>
                <p className="text-xs mt-0.5 opacity-90">
                  {importSummary.successCount} of {importSummary.totalFiles} sessions successfully written and verified in Supabase PostgreSQL database.
                </p>
              </div>
            </div>

            {importSummary.firstSuccessfulSessionId && (
              <button
                onClick={() => onImportComplete(importSummary.firstSuccessfulSessionId!)}
                className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-5 py-2.5 rounded-lg text-xs flex items-center space-x-2 shrink-0 shadow-lg cursor-pointer transition-colors"
              >
                <span>VIEW IN TODAY'S LOAD</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Metric Tiles Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
              <span className="text-zinc-500 text-[10px] font-extrabold uppercase block">Files Selected</span>
              <span className="text-white font-black text-lg">{importSummary.totalFiles}</span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
              <span className="text-zinc-500 text-[10px] font-extrabold uppercase block">Sessions Created</span>
              <span className="text-emerald-400 font-black text-lg">{importSummary.successCount}</span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
              <span className="text-zinc-500 text-[10px] font-extrabold uppercase block">Player Records</span>
              <span className="text-amber-400 font-black text-lg">{importSummary.totalPlayersSaved}</span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
              <span className="text-zinc-500 text-[10px] font-extrabold uppercase block">Raw CSV Rows</span>
              <span className="text-sky-400 font-black text-lg">{importSummary.totalRawRowsSaved}</span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
              <span className="text-zinc-500 text-[10px] font-extrabold uppercase block">Skipped Files</span>
              <span className="text-zinc-400 font-black text-lg">{importSummary.skippedCount}</span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
              <span className="text-zinc-500 text-[10px] font-extrabold uppercase block">Failed Files</span>
              <span className={importSummary.failedCount > 0 ? 'text-rose-400 font-black text-lg' : 'text-zinc-500 font-black text-lg'}>
                {importSummary.failedCount}
              </span>
            </div>
          </div>

          {/* Per-File Ingestion Audit Table */}
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 text-zinc-400 font-black uppercase text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="p-3">CSV Filename</th>
                  <th className="p-3">Session Date</th>
                  <th className="p-3">Session Type</th>
                  <th className="p-3">Assigned Session Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Athletes Saved</th>
                  <th className="p-3">Database Verification Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/60">
                {fileSessions.map((file) => (
                  <tr key={file.id} className="hover:bg-zinc-800/40">
                    <td className="p-3 font-bold text-white max-w-[180px] truncate">
                      {file.fileName}
                    </td>
                    <td className="p-3 font-mono text-zinc-200">
                      {file.sessionDate}
                    </td>
                    <td className="p-3">
                      <span className="bg-zinc-950 text-zinc-300 border border-zinc-800 px-2 py-0.5 rounded text-[10px] font-bold">
                        {file.sessionType}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-300 max-w-[200px] truncate">
                      {file.sessionName}
                    </td>
                    <td className="p-3">
                      {file.resultStatus === 'SUCCESS' ? (
                        <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2.5 py-1 rounded flex items-center space-x-1 w-max">
                          <Check className="w-3 h-3 mr-0.5" />
                          <span>PERSISTED</span>
                        </span>
                      ) : file.resultStatus === 'SKIPPED' ? (
                        <span className="text-[10px] font-black text-zinc-400 bg-zinc-800/80 border border-zinc-700 px-2.5 py-1 rounded w-max">
                          SKIPPED
                        </span>
                      ) : (
                        <span className="text-[10px] font-black text-rose-400 bg-rose-950/80 border border-rose-800 px-2.5 py-1 rounded flex items-center space-x-1 w-max">
                          <XCircle className="w-3 h-3 mr-0.5" />
                          <span>FAILED</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-extrabold text-amber-400">
                      {file.savedPlayerCount ?? (file.conflictAction === 'skip' ? '—' : 0)}
                    </td>
                    <td className="p-3 text-zinc-400 text-[11px]">
                      {file.resultError ? (
                        <span className="text-rose-400">{file.resultError}</span>
                      ) : file.resultStatus === 'SUCCESS' ? (
                        <span className="text-emerald-400">
                          Verified in public.sessions & public.player_session_records ({file.resultSessionId})
                        </span>
                      ) : (
                        <span>Coach selected to skip this file during import</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-800">
            <button
              onClick={() => {
                setFileSessions([]);
                setStep(1);
              }}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Import More CSV Files
            </button>

            <div className="flex items-center space-x-3">
              {importSummary.firstSuccessfulSessionId && (
                <button
                  onClick={() => onImportComplete(importSummary.firstSuccessfulSessionId!)}
                  className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-6 py-2.5 rounded-lg text-xs flex items-center space-x-2 shadow-lg shadow-orange-950/40 cursor-pointer transition-colors"
                >
                  <span>GO TO DASHBOARD (TODAY'S LOAD)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
