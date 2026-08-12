import React, { useState } from 'react';
import { Player, CoachSettings, AuditLog } from '../types';
import { DataStore } from '../lib/dataStore';
import {
  Sliders,
  Users,
  Download,
  RotateCcw,
  Plus,
  Save,
  CheckCircle2,
  FileSpreadsheet,
  History,
  Trash2,
} from 'lucide-react';

interface SettingsViewProps {
  roster: Player[];
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ roster, onRefresh }) => {
  const [settings, setSettings] = useState<CoachSettings>(DataStore.getSettings());
  const [toast, setToast] = useState<string | null>(null);

  // New Player Form
  const [newNum, setNewNum] = useState('#');
  const [newName, setNewName] = useState('');
  const [newPos, setNewPos] = useState('SF/PF');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSaveSettings = () => {
    DataStore.saveSettings(settings);
    showToast('Coach settings updated!');
  };

  const handleAddPlayer = () => {
    if (!newName.trim()) return;
    DataStore.addPlayer({
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
      'session_id',
      'date',
      'season',
      'session_type',
      'player_number',
      'player_name',
      'position',
      'distance_m',
      'accumulated_acceleration_load',
      'deceleration_load',
      'jump_load',
      'mechanical_load',
      'source',
    ];

    const rows = records.map((r) => [
      r.session_id,
      r.date,
      r.season,
      r.session_type,
      r.player_number,
      `"${r.player_name}"`,
      r.position,
      r.distance_m ?? '',
      r.accumulated_acceleration_load ?? '',
      r.deceleration_load ?? '',
      r.jump_load ?? '',
      r.mechanical_load ?? '',
      r.source,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Orange_Vikings_KINEXON_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Exported KINEXON CSV dataset!');
  };

  const handleResetData = () => {
    if (confirm('Reset database to initial August 11, 2026 preseason data? All custom sessions will be cleared.')) {
      DataStore.resetToInitialData();
      onRefresh();
      showToast('Database reset to official August 11, 2026 baseline!');
    }
  };

  const auditLogs = DataStore.getAuditLogs();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-zinc-100">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-zinc-950 font-black px-4 py-2.5 rounded-lg shadow-2xl flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-1">
            APPLICATION ADMINISTRATION
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Sliders className="w-6 h-6 text-orange-500" />
            <span>SETTINGS & DATA MANAGEMENT</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage roster members, load status thresholds, data exports, and audit logs.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-4 py-2 rounded-lg text-xs flex items-center space-x-2 shadow-lg"
          >
            <Download className="w-4 h-4" />
            <span>EXPORT DATABASE (CSV)</span>
          </button>
        </div>
      </div>

      {/* Roster Admin */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-black text-white">ORANGE VIKINGS ROSTER ({roster.length} ATHLETES)</h2>
          </div>

          <button
            onClick={() => setIsAddingPlayer(!isAddingPlayer)}
            className="bg-zinc-800 hover:bg-zinc-700 text-orange-400 font-bold px-3 py-1.5 rounded text-xs flex items-center space-x-1"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add 13th Athlete</span>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          {roster.map((p) => (
            <div key={p.id} className="bg-zinc-950 border border-zinc-800/80 p-3 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-orange-400 font-black text-sm mr-2">{p.number}</span>
                <span className="text-white font-bold">{p.displayName}</span>
                <div className="text-[10px] text-zinc-500">{p.position}</div>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                ACTIVE
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Threshold Config */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-black text-white">S&C LOAD THRESHOLDS CONFIGURATION</h2>
        <p className="text-xs text-zinc-400">
          Configure percentage deviation boundaries for Green, Yellow (Elevated), and Red (High) traffic-light alerts.
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
                setSettings({ ...settings, min_sessions_for_baseline: parseInt(e.target.value) || 5 })
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
                setSettings({ ...settings, yellow_threshold_pct: parseInt(e.target.value) || 25 })
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
                setSettings({ ...settings, red_threshold_pct: parseInt(e.target.value) || 35 })
              }
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white font-bold"
            />
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-5 py-2.5 rounded-lg text-xs shadow-lg"
        >
          SAVE THRESHOLDS
        </button>
      </div>

      {/* Audit Logs & Reset */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-black text-white">SYSTEM AUDIT LOGS</h2>
          </div>

          <button
            onClick={handleResetData}
            className="bg-rose-950 text-rose-400 border border-rose-800 hover:bg-rose-900 font-bold px-3 py-1.5 rounded text-xs flex items-center space-x-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Database to Aug 11 Baseline</span>
          </button>
        </div>

        <div className="space-y-2 text-xs max-h-48 overflow-y-auto">
          {auditLogs.length === 0 ? (
            <div className="text-zinc-500 text-xs py-4 text-center">No audit logs recorded yet.</div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80 flex items-center justify-between text-[11px]">
                <div>
                  <span className="font-extrabold text-orange-400 mr-2">[{log.action}]</span>
                  <span className="text-zinc-300">{log.details}</span>
                </div>
                <div className="text-zinc-500 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
