import React, { useState } from 'react';
import { Player, RPEEntry } from '../types';
import { DataStore } from '../lib/dataStore';
import { isGameSession, getSessionTypeBadgeClasses } from '../lib/contextBaseline';
import {
  Activity,
  Plus,
  CheckCircle2,
  Calendar,
  Edit2,
  Trash2,
  Save,
  X,
  TrendingUp,
  BarChart2,
  Filter,
  AlertTriangle,
  Loader2,
  ScanLine,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

interface FutureModulesViewProps {
  roster: Player[];
  onNavigateBulkImport?: () => void;
}

export const FutureModulesView: React.FC<FutureModulesViewProps> = ({ roster, onNavigateBulkImport }) => {
  const [toast, setToast] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');

  // New RPE Form State
  const [rpePlayerId, setRpePlayerId] = useState(roster[0]?.id || '');
  const [rpeScore, setRpeScore] = useState<number>(7);
  const [rpeDate, setRpeDate] = useState('2026-08-11');
  const [rpeNotes, setRpeNotes] = useState('');

  // Async operation & error states
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editing state for RPE logs
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<RPEEntry>>({});

  // Refresh trigger state
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveRPE = async () => {
    const athlete = roster.find((p) => p.id === rpePlayerId) || roster[0];
    if (!athlete) {
      setErrorMessage('Please select a valid athlete from the roster.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    // Verify if a session exists for this date to avoid foreign key errors on session_id
    const allSessions = DataStore.getSessionsMeta();
    const existingSession = allSessions.find((s) => s.id === `session-${rpeDate}` || s.date === rpeDate);
    const validSessionId = existingSession ? existingSession.id : null;

    try {
      const res = await DataStore.saveRPEEntryAsync({
        player_id: athlete.id,
        player_number: athlete.number,
        session_id: validSessionId,
        date: rpeDate,
        rpe_score: rpeScore,
        duration_min: existingSession?.duration_min,
        notes: rpeNotes || 'Regular training session',
      });

      if (res.error) {
        console.error('[FutureModulesView] RPE save failed:', res.error);
        const errorText =
          res.error.friendlyMessage ||
          res.error.message ||
          (res.error.code === '42501'
            ? 'Supabase RLS Policy error: Table "rpe_entries" requires RLS permissions for anon/authenticated roles. Check Settings > Database.'
            : 'Failed to persist RPE score to Supabase database.');
        setErrorMessage(errorText);
        // Do NOT clear user input or show success toast on failure
        return;
      }

      setRpeNotes('');
      showToast('RPE score successfully recorded & persisted to Supabase!');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      console.error('[FutureModulesView] Unexpected error:', err);
      setErrorMessage(err.message || 'Unexpected error while recording RPE score.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (entry: RPEEntry) => {
    setEditingId(entry.id);
    setEditForm({ ...entry });
    setErrorMessage(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setIsUpdating(true);
    setErrorMessage(null);

    try {
      const res = await DataStore.updateRPEEntryAsync(editingId, editForm);
      if (res.error) {
        console.error('[FutureModulesView] RPE update failed:', res.error);
        const errorText =
          res.error.friendlyMessage ||
          res.error.message ||
          'Failed to update RPE entry in Supabase.';
        setErrorMessage(errorText);
        return;
      }

      setEditingId(null);
      showToast('RPE entry updated & persisted to Supabase!');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      console.error('[FutureModulesView] Error updating RPE:', err);
      setErrorMessage(err.message || 'Unexpected error updating RPE entry.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this RPE log entry?')) return;
    setDeletingId(id);
    setErrorMessage(null);

    try {
      const res = await DataStore.deleteRPEEntryAsync(id);
      if (res.error) {
        console.error('[FutureModulesView] RPE delete failed:', res.error);
        const errorText =
          res.error.friendlyMessage ||
          res.error.message ||
          'Failed to delete RPE entry from Supabase.';
        setErrorMessage(errorText);
        return;
      }

      showToast('RPE log deleted from Supabase');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      console.error('[FutureModulesView] Error deleting RPE:', err);
      setErrorMessage(err.message || 'Unexpected error deleting RPE log.');
    } finally {
      setDeletingId(null);
    }
  };

  const allEntries = DataStore.getRPEEntries();

  // Date constants for history filtering
  const todayStr = '2026-08-11';
  const yesterdayStr = '2026-08-10';

  const filteredEntries = allEntries.filter((e) => {
    if (timeFilter === 'today') return e.date === todayStr;
    if (timeFilter === 'yesterday') return e.date === yesterdayStr;
    if (timeFilter === 'week') {
      const eDate = new Date(e.date).getTime();
      const weekAgo = new Date('2026-08-04').getTime();
      return eDate >= weekAgo;
    }
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const allSessionsMeta = DataStore.getSessionsMeta();

  // Compute Team Average RPE per Date for Graphic
  const dateGroups: { [date: string]: number[] } = {};
  allEntries.forEach((e) => {
    if (!dateGroups[e.date]) dateGroups[e.date] = [];
    dateGroups[e.date].push(e.rpe_score);
  });

  const teamRPEChartData = Object.keys(dateGroups)
    .sort()
    .map((d) => {
      const scores = dateGroups[d];
      const avg = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));
      const sMeta = allSessionsMeta.find((s) => s.date === d);
      const isGame = isGameSession(sMeta?.session_type, sMeta?.session_name);
      return {
        date: d,
        'Team Avg RPE': avg,
        entriesCount: scores.length,
        isGame,
        sessionType: sMeta?.session_type || (isGame ? 'Game' : 'Practice'),
        sessionName: sMeta?.session_name || (isGame ? 'Game Session' : 'Practice Session'),
      };
    });

  const getRPELabel = (score: number) => {
    if (score <= 3) return { text: 'Very Light', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800' };
    if (score <= 5) return { text: 'Moderate', color: 'text-amber-400 bg-amber-950/60 border-amber-800' };
    if (score <= 7) return { text: 'Hard', color: 'text-orange-400 bg-orange-950/60 border-orange-800' };
    if (score <= 9) return { text: 'Very Hard', color: 'text-rose-400 bg-rose-950/60 border-rose-800' };
    return { text: 'Maximal Effort', color: 'text-purple-400 bg-purple-950/60 border-purple-800' };
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-zinc-950 font-black px-4 py-2.5 rounded-lg shadow-2xl flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Main Module Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-1">
            SUBJECTIVE INTERNAL LOAD TRACKER
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Activity className="w-6 h-6 text-orange-500" />
            <span>SESSION RPE TRACKER (BORG CR10)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Track, edit, and analyze player-reported Rating of Perceived Exertion (RPE) to monitor internal load.
          </p>
        </div>

        {onNavigateBulkImport && (
          <button
            onClick={onNavigateBulkImport}
            className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-4 py-2.5 rounded-lg text-xs flex items-center space-x-2 shadow-lg shadow-orange-950/40 cursor-pointer transition-colors shrink-0"
          >
            <ScanLine className="w-4 h-4" />
            <span>BULK IMPORT FROM SCREENSHOT (AI OCR)</span>
          </button>
        )}
      </div>

      {/* Team Average RPE Graphic */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-3 gap-2">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-black text-white">TEAM AVERAGE RPE TREND GRAPHIC</h2>
          </div>
          
          <div className="flex items-center space-x-4 text-xs font-bold">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-orange-500 inline-block"></span>
              <span className="text-zinc-300">Practice RPE</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-500 inline-block"></span>
              <span className="text-purple-300 font-extrabold">Game RPE</span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full">
          {teamRPEChartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-zinc-500">
              No RPE session data logged yet to display trend graphic.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamRPEChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#a1a1aa" fontSize={11} tick={{ fill: '#d4d4d8' }} />
                <YAxis domain={[0, 10]} stroke="#a1a1aa" fontSize={11} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg shadow-xl text-xs space-y-1">
                          <div className="font-extrabold text-white flex items-center justify-between gap-3">
                            <span>{label}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                              data.isGame ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-orange-950 text-orange-400 border border-orange-800'
                            }`}>
                              {data.sessionType}
                            </span>
                          </div>
                          <div className="text-zinc-400 font-medium">{data.sessionName}</div>
                          <div className="text-amber-400 font-bold pt-1 border-t border-zinc-800">
                            Team Avg RPE: {data['Team Avg RPE']} / 10
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="Team Avg RPE" radius={[6, 6, 0, 0]}>
                  {teamRPEChartData.map((entry, idx) => (
                    <Cell key={`bar-cell-${idx}`} fill={entry.isGame ? '#a855f7' : '#f97316'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Interactive Logging & History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Log New RPE Entry Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4 shadow-xl">
          <h2 className="text-base font-black text-white flex items-center space-x-2 border-b border-zinc-800 pb-3">
            <Plus className="w-5 h-5 text-orange-500" />
            <span>LOG NEW ATHLETE RPE</span>
          </h2>

          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-600/60 rounded-lg text-xs text-rose-200 flex items-start justify-between gap-2 shadow-lg">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-300">Persistence Notice</p>
                  <p className="text-rose-200 mt-0.5 leading-relaxed">{errorMessage}</p>
                </div>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-white shrink-0 p-1 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-zinc-400 font-bold mb-1">Athlete</label>
              <select
                value={rpePlayerId}
                onChange={(e) => setRpePlayerId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-white font-bold"
              >
                {roster.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number} {p.displayName} ({p.position})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 font-bold mb-1">Session Date</label>
              <input
                type="date"
                value={rpeDate}
                onChange={(e) => setRpeDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-white font-bold"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-zinc-400 font-bold">RPE Score (1–10 Borg CR10):</label>
                <span className="text-lg font-black text-orange-400">{rpeScore} / 10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={rpeScore}
                onChange={(e) => setRpeScore(parseInt(e.target.value))}
                className="w-full accent-orange-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-bold">
                <span>1 (Rest/Easy)</span>
                <span>5 (Hard)</span>
                <span>10 (Maximal)</span>
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 font-bold mb-1">Notes / Player Feedback</label>
              <input
                type="text"
                value={rpeNotes}
                onChange={(e) => setRpeNotes(e.target.value)}
                placeholder="e.g. Heavy legs post scrimmages, good cardio"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-white"
              />
            </div>

            <button
              id="log-rpe-submit-btn"
              onClick={handleSaveRPE}
              disabled={isSaving}
              className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-zinc-950 font-black py-3 rounded-lg text-xs shadow-lg transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>PERSISTING TO SUPABASE...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>RECORD RPE SCORE</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* RPE History Log Table (Editable) */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <h2 className="text-base font-black text-white flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-orange-500" />
              <span>RPE HISTORY & EDIT LOGS</span>
            </h2>

            {/* Time Filter Tabs */}
            <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs font-bold">
              <button
                onClick={() => setTimeFilter('all')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  timeFilter === 'all' ? 'bg-orange-600 text-zinc-950 font-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setTimeFilter('today')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  timeFilter === 'today' ? 'bg-orange-600 text-zinc-950 font-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setTimeFilter('yesterday')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  timeFilter === 'yesterday' ? 'bg-orange-600 text-zinc-950 font-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setTimeFilter('week')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  timeFilter === 'week' ? 'bg-orange-600 text-zinc-950 font-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Last 7 Days
              </button>
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="text-xs text-zinc-500 py-12 text-center">
              No RPE entries found for selected filter timeframe.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950 text-zinc-400 font-black uppercase text-[10px] border-b border-zinc-800">
                  <tr>
                    <th className="p-3">Athlete</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Session Context</th>
                    <th className="p-3">RPE Score</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Notes</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 bg-zinc-900">
                  {filteredEntries.map((e) => {
                    const isEditing = editingId === e.id;
                    const p = roster.find((pl) => pl.id === e.player_id);
                    const tag = getRPELabel(e.rpe_score);
                    const sMeta = allSessionsMeta.find((s) => s.date === e.date || s.id === e.session_id);
                    const isGame = isGameSession(sMeta?.session_type, sMeta?.session_name);

                    return (
                      <tr key={e.id} className="hover:bg-zinc-800/50 transition-colors">
                        <td className="p-3 font-extrabold text-white">
                          <span className="text-orange-400 mr-1.5">{p?.number || ''}</span>
                          {p?.displayName || 'Unknown Athlete'}
                        </td>

                        {isEditing ? (
                          <>
                            <td className="p-2">
                              <input
                                type="date"
                                value={editForm.date || e.date}
                                onChange={(evt) => setEditForm({ ...editForm, date: evt.target.value })}
                                className="bg-zinc-950 border border-orange-500 rounded px-2 py-1 text-xs text-white"
                              />
                            </td>
                            <td className="p-2 text-zinc-500">—</td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={editForm.rpe_score ?? e.rpe_score}
                                onChange={(evt) =>
                                  setEditForm({
                                    ...editForm,
                                    rpe_score: parseInt(evt.target.value) || 1,
                                  })
                                }
                                className="w-16 bg-zinc-950 border border-orange-500 rounded px-2 py-1 text-xs text-white font-bold"
                              />
                            </td>
                            <td className="p-2 text-zinc-500">—</td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={editForm.notes ?? e.notes ?? ''}
                                onChange={(evt) => setEditForm({ ...editForm, notes: evt.target.value })}
                                className="w-full bg-zinc-950 border border-orange-500 rounded px-2 py-1 text-xs text-white"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <div className="flex items-center justify-end space-x-1">
                                <button
                                  onClick={handleSaveEdit}
                                  disabled={isUpdating}
                                  className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-zinc-950 font-black px-2.5 py-1 rounded text-[11px] flex items-center space-x-1"
                                >
                                  {isUpdating ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Save className="w-3.5 h-3.5" />
                                  )}
                                  <span>{isUpdating ? 'Saving...' : 'Save'}</span>
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  disabled={isUpdating}
                                  className="text-zinc-400 hover:text-white p-1"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-3 text-zinc-400 font-medium">{e.date}</td>
                            <td className="p-3">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                                isGame ? 'bg-purple-950/80 border-purple-800 text-purple-300' : 'bg-orange-950/80 border-orange-800 text-orange-400'
                              }`}>
                                {isGame ? 'GAME' : (sMeta?.session_type?.toUpperCase() || 'PRACTICE')}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="font-black text-white text-sm bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                                {e.rpe_score} / 10
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${tag.color}`}>
                                {tag.text}
                              </span>
                            </td>
                            <td className="p-3 text-zinc-300 max-w-xs truncate">{e.notes || '—'}</td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => handleStartEdit(e)}
                                  className="text-zinc-400 hover:text-orange-400 p-1 transition-colors"
                                  title="Edit RPE entry"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(e.id)}
                                  disabled={deletingId === e.id}
                                  className="text-zinc-500 hover:text-rose-400 p-1 transition-colors disabled:opacity-50"
                                  title="Delete entry"
                                >
                                  {deletingId === e.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
