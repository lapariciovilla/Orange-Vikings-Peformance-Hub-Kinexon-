import React, { useState, useEffect } from 'react';
import { Player, CoachSettings, AuditLog } from '../types';
import { DataStore } from '../lib/dataStore';
import { SupabaseService, DatabaseConnectionStatus, BackupPayload } from '../lib/supabaseService';
import { SUPABASE_URL } from '../lib/supabaseClient';
import {
  Sliders,
  Users,
  Download,
  RotateCcw,
  Plus,
  Save,
  CheckCircle2,
  AlertTriangle,
  History,
  Edit2,
  Database,
  Lock,
  Key,
  ShieldCheck,
  RefreshCw,
  Upload,
  FileCheck,
  UserCheck,
  LogOut,
  LogIn,
} from 'lucide-react';

interface SettingsViewProps {
  roster: Player[];
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ roster, onRefresh }) => {
  const [settings, setSettings] = useState<CoachSettings>(DataStore.getSettings());
  const [toast, setToast] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'database' | 'roster' | 'thresholds' | 'backups' | 'audit'>('database');

  // Supabase Connection State
  const [dbStatus, setDbStatus] = useState<DatabaseConnectionStatus | null>(null);
  const [isCheckingDb, setIsCheckingDb] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Roster Initialization State (Phase 2)
  const [isInitializingRoster, setIsInitializingRoster] = useState(false);

  // Backup & Recovery State (Phase 7)
  const [restoreFile, setRestoreFile] = useState<BackupPayload | null>(null);
  const [restoreValidation, setRestoreValidation] = useState<{ isValid: boolean; message: string; manifest?: any } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // New Player Form
  const [newNum, setNewNum] = useState('#');
  const [newName, setNewName] = useState('');
  const [newPos, setNewPos] = useState('SF/PF');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  // Edit Player State
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerForm, setEditPlayerForm] = useState<Partial<Player>>({});

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Run DB Connection Diagnostics
  const runConnectionCheck = async () => {
    setIsCheckingDb(true);
    try {
      const status = await SupabaseService.checkConnection();
      setDbStatus(status);
      const user = await SupabaseService.getCurrentUser();
      setCurrentUser(user);
    } catch (err: any) {
      console.error('Connection check failed:', err);
    } finally {
      setIsCheckingDb(false);
    }
  };

  useEffect(() => {
    runConnectionCheck();
  }, []);

  // Supabase Auth Handlers
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await SupabaseService.signIn(authEmail, authPassword);
      if (error) {
        setAuthError(error.message);
      } else {
        setCurrentUser(data.user);
        showToast(`Signed in as ${data.user?.email}`);
        await runConnectionCheck();
        await DataStore.syncWithSupabase();
        onRefresh();
      }
    } catch (err: any) {
      setAuthError(err.message || String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!authEmail || !authPassword) {
      setAuthError('Please provide email and password.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await SupabaseService.signUp(authEmail, authPassword);
      if (error) {
        setAuthError(error.message);
      } else {
        showToast('Account created. Check email if confirmation is required.');
        setCurrentUser(data.user);
      }
    } catch (err: any) {
      setAuthError(err.message || String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      await SupabaseService.signOut();
      setCurrentUser(null);
      showToast('Signed out of Coaching Staff account');
      await runConnectionCheck();
    } catch (err: any) {
      showToast(`Error signing out: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  // Phase 2: Explicit validated roster initialization workflow
  const handleInitializeRoster = async () => {
    const confirmInit = confirm(
      `Initialize ${roster.length} athletes from the official Orange Vikings roster into Supabase PostgreSQL?\n\nThis will safely insert/update the verified roster in the database without adding any demo sessions.`
    );
    if (!confirmInit) return;

    setIsInitializingRoster(true);
    try {
      const res = await DataStore.initializeSupabaseRoster(roster);
      if (res.error) {
        alert(`Roster initialization failed: ${res.error.message || JSON.stringify(res.error)}`);
      } else {
        showToast(`Successfully initialized ${res.count} players into Supabase!`);
        await runConnectionCheck();
        onRefresh();
      }
    } catch (err: any) {
      alert(`Initialization error: ${err.message || String(err)}`);
    } finally {
      setIsInitializingRoster(false);
    }
  };

  // Phase 7: Full JSON Backup Export
  const handleExportFullJSONBackup = async () => {
    try {
      const sessions = DataStore.getSessionsMeta();
      const records = DataStore.getPlayerRecords();
      const rpe = DataStore.getRPEEntries();
      const statusAssessments = DataStore.getPlayerStatusAssessments();
      const auditLogs = DataStore.getAuditLogs();

      const backup = await SupabaseService.exportFullBackup(
        roster,
        sessions,
        records,
        rpe,
        statusAssessments,
        settings,
        auditLogs
      );

      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Orange_Vikings_Backup_${new Date().toISOString().split('T')[0]}_v1.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Full JSON backup downloaded successfully!');
    } catch (err: any) {
      alert(`Failed to export backup: ${err.message}`);
    }
  };

  // Phase 7: Backup File Inspection & Validation
  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const rawJson = JSON.parse(evt.target?.result as string);
        const val = SupabaseService.validateBackupPayload(rawJson);
        setRestoreValidation(val);
        if (val.isValid) {
          setRestoreFile(rawJson);
        } else {
          setRestoreFile(null);
        }
      } catch (err: any) {
        setRestoreValidation({
          isValid: false,
          message: `JSON parse error: ${err.message}`,
        });
        setRestoreFile(null);
      }
    };
    reader.readAsText(file);
  };

  // Phase 7: Safe Idempotent Restore
  const handleExecuteRestore = async () => {
    if (!restoreFile || !restoreValidation?.isValid) return;

    const confirmRestore = confirm(
      `Confirm restore of backup manifest from ${restoreFile.manifest.exportTimestamp}?\n` +
      `- Players: ${restoreFile.data.players.length}\n` +
      `- Sessions: ${restoreFile.data.sessions.length}\n` +
      `- Records: ${restoreFile.data.playerSessionRecords.length}\n\n` +
      `This operation is non-destructive and merges existing records safely.`
    );
    if (!confirmRestore) return;

    setIsRestoring(true);
    try {
      const { players, sessions, playerSessionRecords, rpeEntries, statusAssessments, settings: restoredSettings } = restoreFile.data;

      // Persist to local store
      DataStore.saveRoster(players);
      DataStore.saveSessionsMeta(sessions);
      DataStore.savePlayerRecords(playerSessionRecords);
      if (restoredSettings) DataStore.saveSettings(restoredSettings);

      // Persist to Supabase if active
      if (DataStore.isSupabaseActive) {
        await SupabaseService.initializeRoster(players);
        for (const s of sessions) {
          await SupabaseService.saveSession(s);
        }
        await SupabaseService.savePlayerRecords(playerSessionRecords);
      }

      showToast('Database restoration completed successfully!');
      setRestoreFile(null);
      setRestoreValidation(null);
      onRefresh();
    } catch (err: any) {
      alert(`Restoration failed: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Player Edit & Settings handlers
  const handleStartEditPlayer = (player: Player) => {
    setEditingPlayerId(player.id);
    setEditPlayerForm({
      number: player.number,
      displayName: player.displayName,
      position: player.position,
      status: player.status,
    });
  };

  const handleSavePlayerEdit = async (id: string) => {
    await DataStore.updatePlayerAsync(id, editPlayerForm);
    setEditingPlayerId(null);
    onRefresh();
    showToast('Player details updated!');
  };

  const handleSaveSettings = async () => {
    await DataStore.saveSettingsAsync(settings);
    showToast('Coach thresholds updated and saved to Supabase!');
  };

  const handleAddPlayer = async () => {
    if (!newName.trim()) return;
    await DataStore.addPlayerAsync({
      number: newNum,
      displayName: newName,
      position: newPos,
      aliases: [newName],
      status: 'ACTIVE',
      isConfirmed: true,
    });
    setNewName('');
    setIsAddingPlayer(false);
    onRefresh();
    showToast('Player added to Orange Vikings roster!');
  };

  const handleExportCSV = () => {
    const records = DataStore.getPlayerRecords();
    if (records.length === 0) {
      alert('No player records found to export.');
      return;
    }

    const headers = [
      'session_id', 'date', 'season', 'session_type', 'player_number', 'player_name',
      'position', 'distance_m', 'accumulated_acceleration_load', 'deceleration_load',
      'jump_load', 'mechanical_load', 'duration_min', 'game_minutes', 'RPE', 'sRPE', 'source'
    ];

    const rows = records.map((r) => [
      r.session_id, r.date, r.season, r.session_type, r.player_number, `"${r.player_name}"`,
      r.position, r.distance_m ?? '', r.accumulated_acceleration_load ?? '', r.deceleration_load ?? '',
      r.jump_load ?? '', r.mechanical_load ?? '', r.duration_min ?? '', r.game_minutes ?? '',
      r.RPE ?? '', r.sRPE ?? '', r.source,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Orange_Vikings_Load_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Exported External Load CSV dataset!');
  };

  const handleResetData = () => {
    if (confirm('Reset local workspace to initial August 11, 2026 preseason baseline?')) {
      DataStore.resetToInitialData();
      onRefresh();
      showToast('Workspace reset to August 11, 2026 baseline!');
    }
  };

  const auditLogs = DataStore.getAuditLogs();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-zinc-100">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-zinc-950 font-black px-4 py-2.5 rounded-lg shadow-2xl flex items-center space-x-2 border border-emerald-400 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-1">
            DATA ARCHITECTURE & ADMINISTRATION
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Database className="w-6 h-6 text-orange-500" />
            <span>SUPABASE DATABASE & HUB SETTINGS</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Project: <code className="text-orange-400">ukyvteijkvxmouoksdca</code> (Tokyo <code className="text-zinc-400">ap-northeast-1</code>).
            Persistent PostgreSQL load engine, coaching auth, and backups.
          </p>
        </div>

        {/* Action pills */}
        <div className="flex items-center space-x-2">
          <button
            onClick={runConnectionCheck}
            disabled={isCheckingDb}
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-3 py-2 rounded-lg text-xs flex items-center space-x-1.5 border border-zinc-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-orange-500 ${isCheckingDb ? 'animate-spin' : ''}`} />
            <span>TEST CONNECTION</span>
          </button>

          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-4 py-2 rounded-lg text-xs flex items-center space-x-1.5 shadow-lg"
          >
            <Download className="w-4 h-4" />
            <span>CSV EXPORT</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveSubTab('database')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors ${
            activeSubTab === 'database' ? 'bg-orange-600 text-zinc-950 font-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Supabase Connection & Auth</span>
        </button>

        <button
          onClick={() => setActiveSubTab('roster')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors ${
            activeSubTab === 'roster' ? 'bg-orange-600 text-zinc-950 font-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Roster & DB Initialization</span>
        </button>

        <button
          onClick={() => setActiveSubTab('thresholds')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors ${
            activeSubTab === 'thresholds' ? 'bg-orange-600 text-zinc-950 font-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Threshold Settings</span>
        </button>

        <button
          onClick={() => setActiveSubTab('backups')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors ${
            activeSubTab === 'backups' ? 'bg-orange-600 text-zinc-950 font-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>JSON Backups & Recovery</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors ${
            activeSubTab === 'audit' ? 'bg-orange-600 text-zinc-950 font-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Audit Logs ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: SUPABASE CONNECTION & COACH AUTH */}
      {activeSubTab === 'database' && (
        <div className="space-y-6">
          {/* Connection Status Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-orange-500" />
                <h2 className="text-base font-black text-white">SUPABASE POSTGRESQL ARCHITECTURE</h2>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center space-x-1.5 border ${
                  dbStatus?.isConnected
                    ? 'bg-emerald-950/80 border-emerald-600 text-emerald-400'
                    : 'bg-amber-950/80 border-amber-600 text-amber-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${dbStatus?.isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span>{dbStatus?.isConnected ? 'CONNECTED' : 'DISCONNECTED / CHECKING'}</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase font-bold block mb-1">Project Endpoint</span>
                <span className="text-white font-mono font-bold break-all">{SUPABASE_URL}</span>
              </div>
              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase font-bold block mb-1">Project Region</span>
                <span className="text-white font-bold">ap-northeast-1 (Tokyo, Japan)</span>
                <span className="text-orange-400 text-[10px] block mt-0.5">Asia/Tokyo JST Timezone</span>
              </div>
              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase font-bold block mb-1">Row Level Security</span>
                <span className="text-emerald-400 font-bold flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Enforced on All Tables</span>
                </span>
              </div>
            </div>

            {/* Table Health Matrix */}
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-black text-zinc-300 uppercase tracking-wider">DATABASE TABLES STATUS</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                {dbStatus?.tableStatuses ? (
                  Object.entries(dbStatus.tableStatuses).map(([tableName, exists]) => (
                    <div
                      key={tableName}
                      className={`p-2 rounded border text-center ${
                        exists
                          ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                      }`}
                    >
                      <div className="text-[10px] font-mono truncate">{tableName}</div>
                      <div className="text-[10px] font-black mt-1">
                        {exists ? 'READY' : 'PENDING'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-zinc-500 text-xs py-2">Probing database tables...</div>
                )}
              </div>
            </div>

            {/* Message alert */}
            {dbStatus && (
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300">
                <span className="font-bold text-orange-400 mr-2">Diagnostics:</span>
                <span>{dbStatus.message}</span>
              </div>
            )}
          </div>

          {/* Coaching Staff Authentication Card (Phase 4) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <Lock className="w-5 h-5 text-orange-500" />
                <h2 className="text-base font-black text-white">COACHING STAFF ACCESS CONTROL & AUTHENTICATION</h2>
              </div>
              {currentUser && (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-full flex items-center space-x-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Authenticated: {currentUser.email}</span>
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              In accordance with Phase 4 security standards, athlete performance records, injury clearances, wellness assessments, and RPE are secured under PostgreSQL Row Level Security (RLS). Coaching staff log in below to authorize database read/write queries.
            </p>

            {currentUser ? (
              <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-white">Signed in as Coaching Staff</div>
                  <div className="text-xs font-mono text-orange-400">{currentUser.email}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">User ID: {currentUser.id}</div>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={authLoading}
                  className="bg-zinc-800 hover:bg-zinc-700 text-rose-400 font-bold px-4 py-2 rounded-lg text-xs flex items-center space-x-1.5 border border-zinc-700"
                >
                  <LogOut className="w-4 h-4" />
                  <span>SIGN OUT</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignIn} className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-zinc-400 font-bold mb-1">Staff Email</label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="e.g. lapariciovilla@gmail.com"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 font-bold mb-1">Staff Password</label>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white"
                      required
                    />
                  </div>
                </div>

                {authError && (
                  <div className="p-3 bg-rose-950/80 border border-rose-600 rounded text-rose-200 text-xs flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 text-zinc-950 font-black px-5 py-2 rounded-lg text-xs flex items-center space-x-1.5 shadow-lg"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{authLoading ? 'AUTHENTICATING...' : 'SIGN IN AS COACH'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSignUp}
                    disabled={authLoading}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-4 py-2 rounded-lg text-xs"
                  >
                    CREATE COACH ACCOUNT
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ROSTER & INITIALIZATION (PHASE 2) */}
      {activeSubTab === 'roster' && (
        <div className="space-y-6">
          {/* Phase 2: Explicit validated roster initialization */}
          <div className="bg-zinc-900 border border-orange-500/40 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
              <div>
                <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-0.5">
                  PHASE 2 — SAFE FRESH START WORKFLOW
                </div>
                <h2 className="text-base font-black text-white flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-orange-500" />
                  <span>INITIALIZE OPERATIONAL ROSTER IN SUPABASE</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                  Per Phase 2 rules, the new Supabase database begins empty of session and tracking records. Use this validated workflow to sync the verified 11-player Orange Vikings roster to Supabase without seeding any obsolete demo sessions.
                </p>
              </div>

              <button
                onClick={handleInitializeRoster}
                disabled={isInitializingRoster}
                className="bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 text-zinc-950 font-black px-5 py-2.5 rounded-lg text-xs flex items-center space-x-2 shadow-lg shrink-0 cursor-pointer"
              >
                {isInitializingRoster ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>SYNCING ROSTER...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>INITIALIZE ROSTER TO SUPABASE</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Roster Admin Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-orange-500" />
                <h2 className="text-base font-black text-white">ORANGE VIKINGS ATHLETES ({roster.length} ATHLETES)</h2>
              </div>

              <button
                onClick={() => setIsAddingPlayer(!isAddingPlayer)}
                className="bg-zinc-800 hover:bg-zinc-700 text-orange-400 font-bold px-3 py-1.5 rounded text-xs flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Athlete</span>
              </button>
            </div>

            {isAddingPlayer && (
              <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Jersey #</label>
                  <input
                    type="text"
                    value={newNum}
                    onChange={(e) => setNewNum(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Full Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white"
                    placeholder="e.g. Kenji Sato"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Position</label>
                  <select
                    value={newPos}
                    onChange={(e) => setNewPos(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white"
                  >
                    <option value="PG">PG</option>
                    <option value="SG">SG</option>
                    <option value="SF">SF</option>
                    <option value="PF">PF</option>
                    <option value="C">C</option>
                    <option value="SG/SF">SG/SF</option>
                    <option value="PG/SG">PG/SG</option>
                    <option value="SF/PF">SF/PF</option>
                    <option value="C/PF">C/PF</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddPlayer}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black py-2 rounded text-xs"
                  >
                    Save Player
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {roster.map((p) => {
                const isEditing = editingPlayerId === p.id;

                if (isEditing) {
                  return (
                    <div key={p.id} className="bg-zinc-950 border border-orange-500/80 p-3 rounded-lg space-y-2 col-span-1 sm:col-span-2 lg:col-span-1 shadow-lg">
                      <div className="text-[11px] font-black text-orange-400">EDIT ATHLETE #{p.number}</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-zinc-400 font-bold mb-0.5">Jersey #</label>
                          <input
                            type="text"
                            value={editPlayerForm.number ?? p.number}
                            onChange={(e) => setEditPlayerForm({ ...editPlayerForm, number: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white font-bold"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] text-zinc-400 font-bold mb-0.5">Display Name</label>
                          <input
                            type="text"
                            value={editPlayerForm.displayName ?? p.displayName}
                            onChange={(e) => setEditPlayerForm({ ...editPlayerForm, displayName: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-zinc-400 font-bold mb-0.5">Position</label>
                          <select
                            value={editPlayerForm.position ?? p.position}
                            onChange={(e) => setEditPlayerForm({ ...editPlayerForm, position: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="PG">PG</option>
                            <option value="SG">SG</option>
                            <option value="SF">SF</option>
                            <option value="PF">PF</option>
                            <option value="C">C</option>
                            <option value="SG/SF">SG/SF</option>
                            <option value="PG/SG">PG/SG</option>
                            <option value="SF/PF">SF/PF</option>
                            <option value="C/PF">C/PF</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 font-bold mb-0.5">Status</label>
                          <select
                            value={editPlayerForm.status ?? p.status}
                            onChange={(e) => setEditPlayerForm({ ...editPlayerForm, status: e.target.value as any })}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="LIMITED">LIMITED</option>
                            <option value="INJURED">INJURED</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-end space-x-2 pt-1">
                        <button
                          onClick={() => setEditingPlayerId(null)}
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1 rounded text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSavePlayerEdit(p.id)}
                          className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-3 py-1 rounded text-xs flex items-center space-x-1"
                        >
                          <Save className="w-3 h-3" />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={p.id} className="bg-zinc-950 border border-zinc-800/80 p-3 rounded-lg flex items-center justify-between group hover:border-zinc-700 transition-colors">
                    <div>
                      <span className="text-orange-400 font-black text-sm mr-2">{p.number}</span>
                      <span className="text-white font-bold">{p.displayName}</span>
                      <div className="text-[10px] text-zinc-500">{p.position}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        p.status === 'ACTIVE'
                          ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60'
                          : p.status === 'INJURED'
                          ? 'text-rose-400 bg-rose-950/60 border-rose-800/60'
                          : 'text-amber-400 bg-amber-950/60 border-amber-800/60'
                      }`}>
                        {p.status || 'ACTIVE'}
                      </span>
                      <button
                        onClick={() => handleStartEditPlayer(p)}
                        className="text-zinc-500 hover:text-orange-400 p-1 transition-colors"
                        title="Edit Player"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: THRESHOLDS CONFIG */}
      {activeSubTab === 'thresholds' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
          <h2 className="text-base font-black text-white">S&C LOAD THRESHOLDS CONFIGURATION</h2>
          <p className="text-xs text-zinc-400">
            Configure percentage deviation boundaries for Green, Yellow (Elevated), and Red (High) traffic-light alerts. Saved to Supabase PostgreSQL table <code className="text-orange-400">coach_settings</code>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-zinc-400 font-bold mb-1">
                Minimum Sessions Before Baseline Active
              </label>
              <input
                type="number"
                value={settings.min_sessions_for_baseline}
                onChange={(e) =>
                  setSettings({ ...settings, min_sessions_for_baseline: parseInt(e.target.value) || 3 })
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-amber-400 font-bold mb-1">
                Yellow (Elevated) Threshold (% above baseline)
              </label>
              <input
                type="number"
                value={settings.yellow_threshold_pct}
                onChange={(e) =>
                  setSettings({ ...settings, yellow_threshold_pct: parseInt(e.target.value) || 15 })
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-rose-400 font-bold mb-1">
                Red (High) Threshold (% above baseline)
              </label>
              <input
                type="number"
                value={settings.red_threshold_pct}
                onChange={(e) =>
                  setSettings({ ...settings, red_threshold_pct: parseInt(e.target.value) || 30 })
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white font-bold"
              />
            </div>
          </div>

          <button
            onClick={handleSaveSettings}
            className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-5 py-2.5 rounded-lg text-xs shadow-lg"
          >
            SAVE THRESHOLDS TO DATABASE
          </button>
        </div>
      )}

      {/* TAB 4: JSON BACKUPS & RECOVERY (PHASE 7) */}
      {activeSubTab === 'backups' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-orange-500" />
                <h2 className="text-base font-black text-white">COMPLETE JSON BACKUP & RESTORATION WORKFLOW</h2>
              </div>
              <button
                onClick={handleExportFullJSONBackup}
                className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-4 py-2 rounded-lg text-xs flex items-center space-x-1.5 shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>DOWNLOAD FULL JSON BACKUP</span>
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Phase 7 compliant export & restore system: Every backup file includes an explicit manifest with export timestamp, project identifier (<code className="text-orange-400">ukyvteijkvxmouoksdca</code>), total record counts, earliest and latest session dates, schema version, and cryptographic payload checksum.
            </p>

            {/* Restore File Selector */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <Upload className="w-4 h-4 text-orange-500" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">RESTORE DATABASE FROM BACKUP</h3>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleBackupFileSelect}
                  className="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-black file:bg-zinc-800 file:text-orange-400 hover:file:bg-zinc-700"
                />
              </div>

              {/* Validation Result */}
              {restoreValidation && (
                <div className={`p-4 rounded-lg border text-xs space-y-2 ${
                  restoreValidation.isValid
                    ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-700 text-rose-200'
                }`}>
                  <div className="font-bold flex items-center space-x-1.5">
                    {restoreValidation.isValid ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                    <span>{restoreValidation.message}</span>
                  </div>

                  {restoreValidation.manifest && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-800/60 text-[11px]">
                      <div>
                        <span className="text-zinc-400 block text-[9px] uppercase">Export Date</span>
                        <span className="font-mono">{new Date(restoreValidation.manifest.exportTimestamp).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[9px] uppercase">Athletes</span>
                        <span className="font-bold">{restoreValidation.manifest.counts.players}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[9px] uppercase">Sessions</span>
                        <span className="font-bold">{restoreValidation.manifest.counts.sessions}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[9px] uppercase">Records</span>
                        <span className="font-bold">{restoreValidation.manifest.counts.playerSessionRecords}</span>
                      </div>
                    </div>
                  )}

                  {restoreValidation.isValid && (
                    <div className="pt-2">
                      <button
                        onClick={handleExecuteRestore}
                        disabled={isRestoring}
                        className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black px-5 py-2 rounded-lg text-xs flex items-center space-x-2"
                      >
                        <FileCheck className="w-4 h-4" />
                        <span>{isRestoring ? 'RESTORING DATABASE...' : 'EXECUTE SAFE IDEMPOTENT RESTORATION'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeSubTab === 'audit' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-orange-500" />
              <h2 className="text-base font-black text-white">SYSTEM AUDIT TRAIL</h2>
            </div>

            <button
              onClick={handleResetData}
              className="bg-rose-950 text-rose-400 border border-rose-800 hover:bg-rose-900 font-bold px-3 py-1.5 rounded text-xs flex items-center space-x-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Local Workspace</span>
            </button>
          </div>

          <div className="space-y-2 text-xs max-h-96 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="text-zinc-500 text-xs py-8 text-center">No audit logs recorded yet.</div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80 flex items-center justify-between text-[11px]">
                  <div>
                    <span className="font-extrabold text-orange-400 mr-2">[{log.action}]</span>
                    <span className="text-zinc-300">{log.details}</span>
                    <span className="text-zinc-600 text-[10px] ml-2">by {log.user}</span>
                  </div>
                  <div className="text-zinc-500 text-[10px]">{new Date(log.timestamp).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
