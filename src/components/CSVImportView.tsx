import React, { useState } from 'react';
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
} from 'lucide-react';

interface CSVImportViewProps {
  roster: Player[];
  onImportComplete: (sessionId: string) => void;
  isAuthenticated?: boolean;
  onNavigateSettings?: () => void;
}

interface ParsedRow {
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

export const CSVImportView: React.FC<CSVImportViewProps> = ({
  roster,
  onImportComplete,
  isAuthenticated = false,
  onNavigateSettings,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [csvText, setCsvText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);

  // Column Mapping for 8 Core Metrics
  const [colPlayer, setColPlayer] = useState<string>('');
  const [colJersey, setColJersey] = useState<string>('');
  const [colDistance, setColDistance] = useState<string>('');
  const [colAccel, setColAccel] = useState<string>('');
  const [colAccelMin, setColAccelMin] = useState<string>('');
  const [colAnaerobic, setColAnaerobic] = useState<string>('');
  const [colDecel, setColDecel] = useState<string>('');
  const [colDecelMin, setColDecelMin] = useState<string>('');
  const [colJump, setColJump] = useState<string>('');
  const [colMech, setColMech] = useState<string>('');

  // Session Metadata for import
  const todayStr = new Date().toISOString().split('T')[0];
  const [importDate, setImportDate] = useState<string>(todayStr);
  const [sessionType, setSessionType] = useState<SessionType>('Practice');
  const [sessionName, setSessionName] = useState<string>('Monitored Practice');

  // Multi-CSV file tracking
  const [loadedFiles, setLoadedFiles] = useState<{ name: string; content: string }[]>([]);

  // Preview Matched Rows
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load sample tracking CSV
  const handleLoadSampleCSV = () => {
    const sampleName = 'Sample_Tracking_Preseason.csv';
    setFileName(sampleName);
    setLoadedFiles([{ name: sampleName, content: SAMPLE_EXTERNAL_LOAD_CSV_CONTENT }]);
    setCsvText(SAMPLE_EXTERNAL_LOAD_CSV_CONTENT);
    parseCSVContent(SAMPLE_EXTERNAL_LOAD_CSV_CONTENT, sampleName);
  };

  // Handle multi-file drop/upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    if (files.length === 1) {
      const file = files[0];
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target?.result as string;
        setCsvText(content);
        setLoadedFiles([{ name: file.name, content }]);
        parseCSVContent(content, file.name);
      };
      reader.readAsText(file);
    } else {
      // Multiple CSV files selected
      setFileName(`${files.length} CSV Files Selected`);
      const filePromises = files.map((f: File) => {
        return new Promise<{ name: string; content: string }>((resolve) => {
          const reader = new FileReader();
          reader.onload = (evt) => {
            resolve({ name: f.name, content: (evt.target?.result as string) || '' });
          };
          reader.readAsText(f);
        });
      });

      Promise.all(filePromises).then((fileDataArr) => {
        setLoadedFiles(fileDataArr);
        // Combine all CSV texts into a single working content for parsing
        const combinedContent = fileDataArr.map((fd) => fd.content).join('\n');
        setCsvText(combinedContent);
        parseCSVContent(combinedContent, `${files.length} CSV Reports`);
      });
    }
  };

  const parseCSVContent = (content: string, name?: string) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields || [];
        setHeaders(fields);
        setRawRows(results.data as Record<string, string>[]);

        // Auto-detect columns
        fields.forEach((f) => {
          const lower = f.toLowerCase();
          if (lower.includes('player') || lower.includes('name')) setColPlayer(f);
          if (lower.includes('jersey') || lower.includes('#') || lower.includes('num')) setColJersey(f);
          if (lower.includes('distance')) setColDistance(f);
          if (lower.includes('accel') && (lower.includes('min') || lower.includes('/'))) setColAccelMin(f);
          else if (lower.includes('accel')) setColAccel(f);
          if (lower.includes('anaerobic')) setColAnaerobic(f);
          if (lower.includes('decel') && (lower.includes('min') || lower.includes('/'))) setColDecelMin(f);
          else if (lower.includes('decel')) setColDecel(f);
          if (lower.includes('jump')) setColJump(f);
          if (lower.includes('mech')) setColMech(f);
        });

        // Automatic Session Type Detection (Game vs Practice vs Conditioning)
        const combinedText = `${name || fileName} ${content.slice(0, 1000)}`.toLowerCase();
        if (
          combinedText.includes('game') ||
          combinedText.includes(' vs ') ||
          combinedText.includes('match') ||
          combinedText.includes('opponent') ||
          combinedText.includes('bleague') ||
          combinedText.includes('b.league')
        ) {
          setSessionType('Game');
          setSessionName('B.LEAGUE Official Game Session (External Tracking)');
        } else if (combinedText.includes('conditioning') || combinedText.includes('s&c')) {
          setSessionType('Conditioning');
          setSessionName('Conditioning & High-Density Session');
        } else {
          setSessionType('Practice');
          setSessionName('Monitored Tactical Practice');
        }

        setStep(2);
      },
    });
  };

  // Build row preview mapping
  const processMappings = () => {
    const processed: ParsedRow[] = rawRows.map((row) => {
      const nameVal = colPlayer ? row[colPlayer] || '' : '';
      const jerseyVal = colJersey ? row[colJersey] || '' : '';
      const identifier = `${nameVal} ${jerseyVal}`.trim();

      const matched = DataStore.matchPlayer(identifier, jerseyVal || nameVal);

      const parseNum = (val?: string) => {
        if (!val) return null;
        const cleaned = val.replace(/,/g, '').trim();
        const n = parseFloat(cleaned);
        return isNaN(n) ? null : n;
      };

      const dist = parseNum(row[colDistance]);
      const accel = parseNum(row[colAccel]);
      const accelMin = parseNum(row[colAccelMin]);
      const anaerobic = parseAnaerobicTimeToMinutes(row[colAnaerobic]);
      const decel = parseNum(row[colDecel]);
      const decelMin = parseNum(row[colDecelMin]);
      const jump = parseNum(row[colJump]);
      const mech = parseNum(row[colMech]);

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

    setParsedRows(processed);
    setStep(3);
  };

  // Handle manual player selection override
  const handlePlayerOverride = (index: number, playerId: string) => {
    const player = roster.find((p) => p.id === playerId) || null;
    setParsedRows((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        matchedPlayer: player,
        status: player ? 'MATCHED' : 'UNMATCHED',
      };
      return updated;
    });
  };

  // Saving state & error tracking for Phase 5 compliance
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Final Save Session with async Supabase verification
  const handleSaveImport = async () => {
    if (isSaving) return;
    setSaveError(null);

    const validRows = parsedRows.filter((r) => r.matchedPlayer !== null);

    if (validRows.length === 0) {
      alert('No matched players found to import. Please assign players to the rows.');
      return;
    }

    // Check for duplicate player entries in this single import
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

    if (duplicateIds.size > 0) {
      const confirmDup = confirm(
        `Duplicate player records detected for: ${Array.from(duplicateIds).join(', ')}. The latest row in this file will take precedence. Continue?`
      );
      if (!confirmDup) return;
    }

    setIsSaving(true);

    try {
      const meta: Omit<SessionMeta, 'monitored_players_count'> = {
        id: `session-${importDate}`,
        date: importDate,
        season: '2026–2027',
        session_type: sessionType,
        session_name: sessionName,
        created_at: new Date().toISOString(),
      };

      const records: Omit<PlayerSessionRecord, 'id' | 'session_id' | 'created_at'>[] = validRows.map(
        (r) => {
          const player = r.matchedPlayer!;
          return {
            date: importDate,
            season: '2026–2027',
            session_type: sessionType,
            session_name: sessionName,
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

      const rawRowsToSave = parsedRows.map((r, idx) => ({
        raw: r.raw,
        rowIndex: idx + 1,
        playerIdentifier: r.playerIdentifier,
        parsedStatus: (r.matchedPlayer !== null ? 'ACCEPTED' : 'REJECTED') as 'ACCEPTED' | 'REJECTED' | 'DUPLICATE',
        validationNotes: r.matchedPlayer ? `Matched to ${r.matchedPlayer.displayName} (#${r.matchedPlayer.number})` : 'Unmatched athlete',
      }));

      const result = await DataStore.saveSessionDataAsync(meta, records, {
        filename: fileName || 'import.csv',
        rawRows: rawRowsToSave,
        acceptedCount: validRows.length,
        rejectedCount: parsedRows.length - validRows.length,
        duplicateCount: duplicateIds.size,
      });

      if (result.error) {
        const errorMsg =
          result.error.friendlyMessage ||
          result.error.message ||
          JSON.stringify(result.error);
        setSaveError(
          `Supabase persistence error: ${errorMsg}. Unsaved data has been preserved in your import preview. Please verify your Coaching Staff sign-in and connection, then retry.`
        );
        setIsSaving(false);
        return;
      }

      setToastMessage(`Session for ${importDate} successfully saved to database with ${validRows.length} players!`);

      setTimeout(() => {
        setIsSaving(false);
        onImportComplete(result.meta.id);
      }, 1200);
    } catch (err: any) {
      setSaveError(`Unexpected error during import: ${err.message || String(err)}`);
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-zinc-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-zinc-950 px-5 py-3 rounded-lg shadow-2xl font-black flex items-center space-x-2 border border-emerald-400 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-1">
            DATA INGESTION PIPELINE
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Upload className="w-6 h-6 text-orange-500" />
            <span>IMPORT CSV SESSION</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Upload external-load reports, map parameters, and match Orange Vikings player numbers/aliases.
          </p>
        </div>

        {/* Step Progress Pills */}
        <div className="flex items-center space-x-2">
          <div
            className={`px-3 py-1.5 rounded-md text-xs font-bold ${
              step === 1 ? 'bg-orange-600 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            1. Select CSV
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
          <div
            className={`px-3 py-1.5 rounded-md text-xs font-bold ${
              step === 2 ? 'bg-orange-600 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            2. Map Fields
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
          <div
            className={`px-3 py-1.5 rounded-md text-xs font-bold ${
              step === 3 ? 'bg-orange-600 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            3. Review & Save
          </div>
        </div>
      </div>

      {/* Step 1: File Selection & Demo Loader */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border-2 border-dashed border-zinc-800 hover:border-orange-500/60 rounded-xl p-10 text-center transition-all bg-zinc-950/40">
            <FileSpreadsheet className="w-12 h-12 text-orange-500 mx-auto mb-3" />
            <h3 className="text-lg font-black text-white">Upload CSV File</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 mb-6">
              Drag & drop your exported tracking CSV report or browse your files.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <label className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-extrabold px-5 py-2.5 rounded-lg text-xs cursor-pointer shadow-lg transition-colors">
                <span>BROWSE CSV FILES (MULTIPLE SUPPORTED)</span>
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
                className="bg-zinc-800 hover:bg-zinc-700 text-orange-400 border border-orange-800/60 font-bold px-5 py-2.5 rounded-lg text-xs flex items-center space-x-2 transition-colors"
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
              <span>Import Matching Rules & Player Aliases</span>
            </div>
            <p>
              The system matches roster members automatically using exact jersey numbers (#1, #8, #14, etc.), display names, or stored aliases:
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-2">
              <li><strong className="text-zinc-300">Takamichi Kodama</strong> (Matches "Takayuki Kodama")</li>
              <li><strong className="text-zinc-300">Matt Harms</strong> (Matches "Matt Haarms")</li>
              <li><strong className="text-zinc-300">Shaquille Hinds</strong> (Matches "Shaquille Hines")</li>
              <li><strong className="text-zinc-300">Takeuchi Riki</strong> (Matches "Riki Takeuchi")</li>
              <li><strong className="text-zinc-300">Tamaki Shogo</strong> (Matches "Shogo Tamaki")</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-white">MAP CSV COLUMNS</h2>
              <p className="text-xs text-zinc-400">
                File: <span className="text-orange-400 font-bold">{fileName}</span> ({rawRows.length} detected rows)
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-zinc-400 hover:text-white underline"
            >
              Change File
            </button>
          </div>

          {/* Session Metadata Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                SESSION DATE
              </label>
              <input
                type="date"
                value={importDate}
                onChange={(e) => setImportDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                SESSION TYPE
              </label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value as SessionType)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
              >
                <option value="Preseason Practice">Preseason Practice</option>
                <option value="Practice">Practice</option>
                <option value="Game">Game</option>
                <option value="Recovery">Recovery</option>
                <option value="Conditioning">Conditioning</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                SESSION NAME / DESCRIPTION
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                placeholder="e.g. Morning Tactical & Load Session"
              />
            </div>
          </div>

          {/* Field Mappings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-orange-400 mb-1">
                Player Name / Identifier Column
              </label>
              <select
                value={colPlayer}
                onChange={(e) => setColPlayer(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-orange-400 mb-1">
                Jersey # / Number Column (Optional)
              </label>
              <select
                value={colJersey}
                onChange={(e) => setColJersey(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-400 mb-1">
                Distance (m) Column
              </label>
              <select
                value={colDistance}
                onChange={(e) => setColDistance(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-orange-400 mb-1">
                Accumulated Accel Load Column
              </label>
              <select
                value={colAccel}
                onChange={(e) => setColAccel(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-orange-300 mb-1">
                Accel Load / min Column (Optional)
              </label>
              <select
                value={colAccelMin}
                onChange={(e) => setColAccelMin(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white"
              >
                <option value="">-- Select Column (or Auto-Calculated) --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-yellow-400 mb-1">
                Anaerobic Activity Time (s) Column
              </label>
              <select
                value={colAnaerobic}
                onChange={(e) => setColAnaerobic(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-rose-400 mb-1">
                Deceleration Load Column
              </label>
              <select
                value={colDecel}
                onChange={(e) => setColDecel(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-rose-300 mb-1">
                Decel Load / min Column (Optional)
              </label>
              <select
                value={colDecelMin}
                onChange={(e) => setColDecelMin(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white"
              >
                <option value="">-- Select Column (or Auto-Calculated) --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-purple-400 mb-1">
                Jump Load Column
              </label>
              <select
                value={colJump}
                onChange={(e) => setColJump(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-sky-400 mb-1">
                Mechanical Load Column
              </label>
              <select
                value={colMech}
                onChange={(e) => setColMech(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-800">
            <button
              id="confirm-mapping-btn"
              onClick={processMappings}
              className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-6 py-2.5 rounded-lg text-xs flex items-center space-x-2 shadow-lg"
            >
              <span>PREVIEW & MATCH PLAYERS</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Player Matching Preview & Correction */}
      {step === 3 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-white">MATCHED PLAYERS PREVIEW</h2>
              <p className="text-xs text-zinc-400">
                Review auto-matched Orange Vikings roster entries before saving into database.
              </p>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {parsedRows.filter((r) => r.status === 'MATCHED').length} Matched
              </span>
              <span className="flex items-center text-amber-400 font-bold bg-amber-950/60 border border-amber-800 px-2.5 py-1 rounded">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                {parsedRows.filter((r) => r.status === 'REVIEW').length} Review
              </span>
              <span className="flex items-center text-rose-400 font-bold bg-rose-950/60 border border-rose-800 px-2.5 py-1 rounded">
                <XCircle className="w-3.5 h-3.5 mr-1" />
                {parsedRows.filter((r) => r.status === 'UNMATCHED').length} Unmatched
              </span>
            </div>
          </div>

          {/* Complete Import Validation Summary Card */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-black text-white uppercase tracking-wider">IMPORT VALIDATION AUDIT</span>
              </div>
              <span className="text-[10px] font-extrabold text-orange-400 uppercase">PRE-FLIGHT CHECKLIST</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center text-xs">
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Rows Detected</span>
                <span className="text-white font-black text-sm">{parsedRows.length}</span>
              </div>
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Valid Import Rows</span>
                <span className="text-emerald-400 font-black text-sm">{parsedRows.filter((r) => r.matchedPlayer !== null).length}</span>
              </div>
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Players Detected</span>
                <span className="text-amber-400 font-black text-sm">
                  {new Set(parsedRows.filter((r) => r.matchedPlayer).map((r) => r.matchedPlayer!.id)).size}
                </span>
              </div>
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Sessions Detected</span>
                <span className="text-orange-400 font-black text-sm">{loadedFiles.length || 1}</span>
              </div>
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Session Type</span>
                <span className="text-sky-400 font-black text-xs uppercase truncate block">{sessionType}</span>
              </div>
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Duplicates Detected</span>
                <span className="text-purple-400 font-black text-sm">
                  {parsedRows.length - new Set(parsedRows.map((r) => r.playerIdentifier)).size}
                </span>
              </div>
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Missing Values</span>
                <span className="text-amber-400 font-black text-sm">
                  {parsedRows.filter((r) => r.distance === null || r.accelLoad === null).length}
                </span>
              </div>
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                <span className="text-zinc-500 text-[9px] block font-extrabold uppercase">Unmatched Players</span>
                <span className="text-rose-400 font-black text-sm">{parsedRows.filter((r) => r.matchedPlayer === null).length}</span>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 text-zinc-400 font-black uppercase text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="p-3">Imported CSV Name</th>
                  <th className="p-3">Matched Roster Player</th>
                  <th className="p-3">Distance (m)</th>
                  <th className="p-3">Accel Load</th>
                  <th className="p-3">Anaerobic Time</th>
                  <th className="p-3">Decel Load</th>
                  <th className="p-3">Jump Load</th>
                  <th className="p-3">Mech Load</th>
                  <th className="p-3">Match Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/60">
                {parsedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-800/40">
                    <td className="p-3 font-medium text-white truncate max-w-[150px]">
                      {row.playerIdentifier}
                    </td>

                    <td className="p-3">
                      <select
                        value={row.matchedPlayer?.id || ''}
                        onChange={(e) => handlePlayerOverride(idx, e.target.value)}
                        className={`bg-zinc-950 border text-xs rounded px-2.5 py-1 font-bold ${
                          row.matchedPlayer
                            ? 'border-emerald-700 text-emerald-300'
                            : 'border-rose-700 text-rose-400'
                        }`}
                      >
                        <option value="">-- Select Roster Member --</option>
                        {roster.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.number} {p.displayName} ({p.position})
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

          {/* Unauthenticated / Guest Notice */}
          {!isAuthenticated && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-amber-300 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Staff Notice: Operating in unauthenticated mode. Full PostgreSQL persistence requires staff login or the updated RLS policies.</span>
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

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <button
              onClick={() => setStep(2)}
              disabled={isSaving}
              className="text-xs text-zinc-400 hover:text-white font-bold disabled:opacity-50"
            >
              ← Back to Mapping
            </button>

            <button
              id="save-import-btn"
              onClick={handleSaveImport}
              disabled={isSaving}
              className="bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 text-zinc-950 font-black px-6 py-2.5 rounded-lg text-xs flex items-center space-x-2 shadow-lg shadow-orange-950/40 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-900" />
                  <span>PERSISTING TO SUPABASE...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>CONFIRM & SAVE TO SUPABASE</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
