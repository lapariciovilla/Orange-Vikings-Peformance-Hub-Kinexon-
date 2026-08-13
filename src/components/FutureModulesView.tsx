import React, { useState } from 'react';
import { Player, RPEEntry } from '../types';
import { DataStore } from '../lib/dataStore';
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
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';

interface FutureModulesViewProps {
  roster: Player[];
}

export const FutureModulesView: React.FC<FutureModulesViewProps> = ({ roster }) => {
  const [toast, setToast] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');

  // New RPE Form State
  const [rpePlayerId, setRpePlayerId] = useState(roster[0]?.id || '');
  const [rpeScore, setRpeScore] = useState<number>(7);
  const [rpeDate, setRpeDate] = useState('2026-08-11');
  const [rpeNotes, setRpeNotes] = useState('');

  // Editing state for RPE logs
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<RPEEntry>>({});

  // Refresh trigger state
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSaveRPE = () => {
    DataStore.saveRPEEntry({
      player_id: rpePlayerId,
      session_id: `session-${rpeDate}`,
      date: rpeDate,
      rpe_score: rpeScore,
      notes: rpeNotes || 'Regular training session',
    });
    setRpeNotes('');
    showToast('RPE score successfully recorded!');
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleStartEdit = (entry: RPEEntry) => {
    setEditingId(entry.id);
    setEditForm({ ...entry });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    DataStore.updateRPEEntry(editingId, editForm);
    setEditingId(null);
    showToast('RPE entry updated!');
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this RPE log entry?')) {
      DataStore.deleteRPEEntry(id);
      showToast('RPE log deleted');
      setRefreshTrigger((prev) => prev + 1);
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
      return {
        date: d,
        'Team Avg RPE': avg,
        entriesCount: scores.length,
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
      </div>

      {/* Team Average RPE Graphic */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-black text-white">TEAM AVERAGE RPE TREND GRAPHIC</h2>
          </div>
          <span className="text-xs text-zinc-400 font-bold">Borg CR10 Scale (1–10)</span>
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
                  contentStyle={{
                    backgroundColor: '#09090b',
                    borderColor: '#27272a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Team Avg RPE" fill="#f97316" radius={[6, 6, 0, 0]} />
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
              className="w-full bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black py-3 rounded-lg text-xs shadow-lg transition-colors flex items-center justify-center space-x-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>RECORD RPE SCORE</span>
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
                                  className="bg-orange-600 text-zinc-950 font-black px-2.5 py-1 rounded text-[11px] flex items-center space-x-1"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  <span>Save</span>
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
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
                                  className="text-zinc-500 hover:text-rose-400 p-1 transition-colors"
                                  title="Delete entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
