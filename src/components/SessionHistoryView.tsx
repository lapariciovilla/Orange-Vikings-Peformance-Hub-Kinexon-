import React, { useState } from 'react';
import { SessionMeta, PlayerSessionRecord, Player } from '../types';
import { DataStore } from '../lib/dataStore';
import { formatWholeNumber } from '../lib/positionalUtils';
import {
  Calendar as CalendarIcon,
  Users,
  Edit2,
  Trash2,
  Plus,
  X,
  Save,
  Clock,
  ShieldCheck,
  ChevronRight,
  Activity,
  AlertCircle,
} from 'lucide-react';

interface SessionHistoryViewProps {
  sessions: SessionMeta[];
  roster: Player[];
  onSelectSession: (sessionId: string) => void;
  onRefresh: () => void;
}

export const SessionHistoryView: React.FC<SessionHistoryViewProps> = ({
  sessions,
  roster,
  onSelectSession,
  onRefresh,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PlayerSessionRecord>>({});
  const [isAddManualOpen, setIsAddManualOpen] = useState<boolean>(false);

  // Manual Session Form state
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualType, setManualType] = useState<any>('Practice');
  const [manualName, setManualName] = useState<string>('Custom S&C Practice');

  const selectedMeta = sessions.find((s) => s.id === selectedSessionId) || null;
  const selectedRecords = selectedSessionId ? DataStore.getRecordsForSession(selectedSessionId) : [];
  const averages = DataStore.calculateTeamAverages(selectedRecords);

  const handleDeleteSession = (sessionId: string) => {
    if (confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      DataStore.deleteSession(sessionId);
      setSelectedSessionId(null);
      onRefresh();
    }
  };

  const handleStartEdit = (rec: PlayerSessionRecord) => {
    setEditingRecordId(rec.id);
    setEditForm({ ...rec });
  };

  const handleSaveEdit = () => {
    if (!editingRecordId) return;
    DataStore.updateSingleRecord(editingRecordId, editForm, 'Luis Aparicio Villa (S&C)');
    setEditingRecordId(null);
    onRefresh();
  };

  const handleAddManualSession = () => {
    const metaMeta = {
      id: `session-${manualDate}`,
      date: manualDate,
      season: '2026–2027',
      session_type: manualType,
      session_name: manualName,
      created_at: new Date().toISOString(),
    };

    // Create record placeholders for all active roster members
    const records = roster.map((p) => ({
      date: manualDate,
      season: '2026–2027',
      session_type: manualType,
      session_name: manualName,
      player_id: p.id,
      player_number: p.number,
      player_name: p.displayName,
      position: p.position,
      distance_m: null,
      accumulated_acceleration_load: null,
      deceleration_load: null,
      jump_load: null,
      mechanical_load: null,
      source: 'MANUAL' as const,
    }));

    DataStore.saveSessionData(metaMeta, records);
    setIsAddManualOpen(false);
    onRefresh();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Top Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-1">
            KINEXON SESSION TIMELINE
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <CalendarIcon className="w-6 h-6 text-orange-500" />
            <span>SESSION HISTORY</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Browse, manage, and edit all recorded team practice and game sessions.
          </p>
        </div>

        <button
          id="add-manual-session-btn"
          onClick={() => setIsAddManualOpen(true)}
          className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-4 py-2 rounded-lg text-xs flex items-center space-x-2 shadow-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>+ ADD SESSION MANUALLY</span>
        </button>
      </div>

      {/* Grid of Sessions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.length === 0 ? (
          <div className="col-span-full bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-500 space-y-3">
            <CalendarIcon className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-zinc-400">No session history records in database.</p>
            <p className="text-xs text-zinc-500">
              Import a Kinexon CSV or add a session manually to start logging performance data for the 2026–2027 season.
            </p>
          </div>
        ) : (
          sessions.map((session) => {
          const recs = DataStore.getRecordsForSession(session.id);
          const stats = DataStore.calculateTeamAverages(recs);

          return (
            <div
              key={session.id}
              className="bg-zinc-900/90 border border-zinc-800 hover:border-orange-500/60 rounded-xl p-5 shadow-lg flex flex-col justify-between transition-all group cursor-pointer"
              onClick={() => setSelectedSessionId(session.id)}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold text-orange-400 bg-orange-950/60 border border-orange-800/60 px-2.5 py-1 rounded uppercase tracking-wider">
                    {session.session_type}
                  </span>
                  <span className="text-xs text-zinc-400 font-bold">{session.date}</span>
                </div>

                <h3 className="text-base font-black text-white group-hover:text-orange-300 transition-colors">
                  {session.session_name || 'KINEXON Monitored Session'}
                </h3>

                <div className="mt-4 pt-3 border-t border-zinc-800/80 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-500 block text-[10px]">MONITORED</span>
                    <span className="text-zinc-200 font-bold flex items-center mt-0.5">
                      <Users className="w-3.5 h-3.5 text-orange-500 mr-1" />
                      {session.monitored_players_count} Players
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-500 block text-[10px]">TEAM AVG DISTANCE</span>
                    <span className="text-amber-400 font-extrabold mt-0.5">
                      {stats.avg_distance !== null ? `${formatWholeNumber(stats.avg_distance)} m` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-orange-400 font-bold">
                <span>VIEW SESSION DETAILS</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })
        )}
      </div>

      {/* Session Details Modal (Centered in the middle of the screen) */}
      {selectedSessionId && selectedMeta && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 md:p-6">
          <div className="w-full max-w-5xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl p-6 overflow-y-auto shadow-2xl space-y-6 text-zinc-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <div className="text-xs font-black text-orange-500 uppercase">SESSION SUMMARY</div>
                <h2 className="text-xl font-black text-white">{selectedMeta.session_name || selectedMeta.session_type}</h2>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Date: {selectedMeta.date} | Monitored: {selectedRecords.length} Athletes
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDeleteSession(selectedSessionId)}
                  className="bg-rose-950 text-rose-400 border border-rose-800 hover:bg-rose-900 font-bold px-3 py-1.5 rounded text-xs flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Session</span>
                </button>
                <button
                  onClick={() => setSelectedSessionId(null)}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Averages Box */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-zinc-900 p-4 rounded-xl border border-zinc-800 text-xs">
              <div>
                <span className="text-zinc-500 text-[10px] block uppercase font-bold">AVG DISTANCE</span>
                <span className="text-base font-black text-amber-400">
                  {averages.avg_distance !== null ? `${formatWholeNumber(averages.avg_distance)} m` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block uppercase font-bold">ACCEL LOAD</span>
                <span className="text-base font-black text-orange-400">
                  {averages.avg_accel !== null ? formatWholeNumber(averages.avg_accel) : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block uppercase font-bold">DECEL LOAD</span>
                <span className="text-base font-black text-rose-400">
                  {averages.avg_decel !== null ? formatWholeNumber(averages.avg_decel) : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block uppercase font-bold">JUMP LOAD</span>
                <span className="text-base font-black text-purple-400">
                  {averages.avg_jump !== null ? formatWholeNumber(averages.avg_jump) : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block uppercase font-bold">MECH LOAD</span>
                <span className="text-base font-black text-sky-400">
                  {averages.avg_mechanical !== null ? formatWholeNumber(averages.avg_mechanical) : 'N/A'}
                </span>
              </div>
            </div>

            {/* Individual Records Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                ATHLETE EXTERNAL LOAD RECORDS
              </h3>

              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900 text-zinc-400 font-black uppercase text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="p-3">Athlete</th>
                      <th className="p-3">Distance (m)</th>
                      <th className="p-3">Accel Load</th>
                      <th className="p-3">Decel Load</th>
                      <th className="p-3">Jump Load</th>
                      <th className="p-3">Mech Load</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                    {selectedRecords.map((rec) => {
                      const isEditing = editingRecordId === rec.id;

                      return (
                        <tr key={rec.id} className="hover:bg-zinc-900/50">
                          <td className="p-3 font-bold text-white">
                            <span className="text-orange-400 mr-1.5">{rec.player_number}</span>
                            {rec.player_name}
                          </td>

                          {isEditing ? (
                            <>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={editForm.distance_m ?? ''}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      distance_m: e.target.value ? parseFloat(e.target.value) : null,
                                    })
                                  }
                                  className="w-20 bg-zinc-900 border border-orange-500 rounded px-2 py-1 text-xs text-white"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={editForm.accumulated_acceleration_load ?? ''}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      accumulated_acceleration_load: e.target.value
                                        ? parseFloat(e.target.value)
                                        : null,
                                    })
                                  }
                                  className="w-16 bg-zinc-900 border border-orange-500 rounded px-2 py-1 text-xs text-white"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={editForm.deceleration_load ?? ''}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      deceleration_load: e.target.value
                                        ? parseFloat(e.target.value)
                                        : null,
                                    })
                                  }
                                  className="w-16 bg-zinc-900 border border-orange-500 rounded px-2 py-1 text-xs text-white"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={editForm.jump_load ?? ''}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      jump_load: e.target.value ? parseFloat(e.target.value) : null,
                                    })
                                  }
                                  className="w-16 bg-zinc-900 border border-orange-500 rounded px-2 py-1 text-xs text-white"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={editForm.mechanical_load ?? ''}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      mechanical_load: e.target.value
                                        ? parseFloat(e.target.value)
                                        : null,
                                    })
                                  }
                                  className="w-16 bg-zinc-900 border border-orange-500 rounded px-2 py-1 text-xs text-white"
                                />
                              </td>
                              <td className="p-2">
                                <button
                                  onClick={handleSaveEdit}
                                  className="bg-orange-600 text-zinc-950 font-black px-2.5 py-1 rounded text-xs flex items-center space-x-1"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  <span>Save</span>
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-3 font-extrabold text-amber-400">
                                {rec.distance_m !== null ? `${formatWholeNumber(rec.distance_m)} m` : 'N/A'}
                              </td>
                              <td className="p-3 font-bold text-orange-400">
                                {rec.accumulated_acceleration_load !== null ? formatWholeNumber(rec.accumulated_acceleration_load) : 'N/A'}
                              </td>
                              <td className="p-3 font-bold text-rose-400">
                                {rec.deceleration_load !== null ? formatWholeNumber(rec.deceleration_load) : 'N/A'}
                              </td>
                              <td className="p-3 font-bold text-purple-400">
                                {rec.jump_load !== null ? formatWholeNumber(rec.jump_load) : 'N/A'}
                              </td>
                              <td className="p-3 font-bold text-sky-400">
                                {rec.mechanical_load !== null ? formatWholeNumber(rec.mechanical_load) : 'N/A'}
                              </td>
                              <td className="p-3">
                                <button
                                  onClick={() => handleStartEdit(rec)}
                                  className="text-zinc-400 hover:text-orange-400 p-1"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Manual Session Modal */}
      {isAddManualOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-black text-white">ADD MANUAL SESSION</h3>
              <button
                onClick={() => setIsAddManualOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 font-bold mb-1">Session Date</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-bold mb-1">Session Type</label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white font-bold"
                >
                  <option value="Practice">Practice</option>
                  <option value="Preseason Practice">Preseason Practice</option>
                  <option value="Game">Game</option>
                  <option value="Recovery">Recovery</option>
                  <option value="Conditioning">Conditioning</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 font-bold mb-1">Session Title</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setIsAddManualOpen(false)}
                className="px-4 py-2 rounded text-xs font-bold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddManualSession}
                className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-4 py-2 rounded text-xs shadow-lg"
              >
                Create Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
