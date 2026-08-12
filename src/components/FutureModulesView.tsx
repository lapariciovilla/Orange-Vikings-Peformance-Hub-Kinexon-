import React, { useState } from 'react';
import { Player } from '../types';
import { DataStore } from '../lib/dataStore';
import {
  Activity,
  Heart,
  Dumbbell,
  Trophy,
  Plus,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

interface FutureModulesViewProps {
  roster: Player[];
}

export const FutureModulesView: React.FC<FutureModulesViewProps> = ({ roster }) => {
  const [activeTab, setActiveTab] = useState<'rpe' | 'wellness' | 'sc' | 'game'>('rpe');
  const [toast, setToast] = useState<string | null>(null);

  // RPE Form
  const [rpePlayerId, setRpePlayerId] = useState(roster[0]?.id || '');
  const [rpeScore, setRpeScore] = useState<number>(7);
  const [rpeDate, setRpeDate] = useState('2026-08-11');
  const [rpeNotes, setRpeNotes] = useState('');

  // Wellness Form
  const [wellPlayerId, setWellPlayerId] = useState(roster[0]?.id || '');
  const [sleepScore, setSleepScore] = useState(8);
  const [fatigueScore, setFatigueScore] = useState(6);
  const [sorenessScore, setSorenessScore] = useState(5);
  const [stressScore, setStressScore] = useState(4);
  const [readinessScore, setReadinessScore] = useState(7);

  // S&C Intervention Form
  const [scPlayerId, setScPlayerId] = useState(roster[0]?.id || '');
  const [scExercise, setScExercise] = useState('Patellar Tendon Yielding Isometric');
  const [scType, setScType] = useState('Yielding Isometric');
  const [scAngle, setScAngle] = useState('60 deg Knee Flexion');
  const [scDuration, setScDuration] = useState(30);
  const [scSets, setScSets] = useState(3);
  const [scTarget, setScTarget] = useState('Patellar Tendon / Extensor Mechanism');
  const [scReason, setScReason] = useState('Targeted tendon stiffness after high deceleration session');

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
      rpe_scale: 'Borg CR10',
      notes: rpeNotes,
    });
    showToast('RPE score successfully recorded!');
  };

  const handleSaveWellness = () => {
    DataStore.saveWellnessEntry({
      player_id: wellPlayerId,
      date: rpeDate,
      sleep_score: sleepScore,
      fatigue_score: fatigueScore,
      soreness_score: sorenessScore,
      stress_score: stressScore,
      readiness_score: readinessScore,
    });
    showToast('Wellness report successfully logged!');
  };

  const handleSaveSC = () => {
    DataStore.saveSCIntervention({
      player_id: scPlayerId,
      date: rpeDate,
      exercise: scExercise,
      isometric_type: scType,
      joint_angle: scAngle,
      duration_s: scDuration,
      sets: scSets,
      target_area: scTarget,
      reason: scReason,
    });
    showToast('S&C Isometric Intervention recorded!');
  };

  const rpeEntries = DataStore.getRPEEntries();
  const wellnessEntries = DataStore.getWellnessEntries();
  const scItems = DataStore.getSCInterventions();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-zinc-100">
      {/* Toast */}
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
            INTERNAL LOAD & S&C INTERVENTIONS
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Activity className="w-6 h-6 text-orange-500" />
            <span>PERFORMANCE & MONITORING MODULES</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Log subjective internal load (RPE), daily wellness metrics, game contexts, and isometric interventions.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('rpe')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'rpe' ? 'bg-orange-600 text-zinc-950 font-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            RPE Scale
          </button>
          <button
            onClick={() => setActiveTab('wellness')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'wellness' ? 'bg-orange-600 text-zinc-950 font-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Wellness
          </button>
          <button
            onClick={() => setActiveTab('sc')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'sc' ? 'bg-orange-600 text-zinc-950 font-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            S&C Interventions
          </button>
        </div>
      </div>

      {/* RPE Tab */}
      {activeTab === 'rpe' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4 shadow-xl">
            <h2 className="text-base font-black text-white flex items-center space-x-2">
              <Activity className="w-5 h-5 text-orange-500" />
              <span>LOG SESSION RPE (BORG CR10)</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 font-bold mb-1">Athlete</label>
                <select
                  value={rpePlayerId}
                  onChange={(e) => setRpePlayerId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white font-bold"
                >
                  {roster.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number} {p.displayName} ({p.position})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 font-bold mb-1">
                  RPE Score (1 = Very Easy, 10 = Maximal Effort): <strong className="text-orange-400">{rpeScore}</strong>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={rpeScore}
                  onChange={(e) => setRpeScore(parseInt(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-bold mb-1">Notes</label>
                <input
                  type="text"
                  value={rpeNotes}
                  onChange={(e) => setRpeNotes(e.target.value)}
                  placeholder="e.g. Felt heavy legs during 4th quarter drills"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"
                />
              </div>

              <button
                onClick={handleSaveRPE}
                className="w-full bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black py-2.5 rounded-lg text-xs shadow-lg"
              >
                LOG RPE SCORE
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4 shadow-xl">
            <h2 className="text-base font-black text-white">RECENT RPE LOGS</h2>
            {rpeEntries.length === 0 ? (
              <div className="text-xs text-zinc-500 py-8 text-center">No RPE entries logged yet.</div>
            ) : (
              <div className="space-y-2 text-xs">
                {rpeEntries.map((e) => {
                  const p = roster.find((pl) => pl.id === e.player_id);
                  return (
                    <div key={e.id} className="bg-zinc-950 p-3 rounded border border-zinc-800 flex justify-between">
                      <div>
                        <span className="font-extrabold text-white">{p?.displayName || 'Athlete'}</span>
                        <div className="text-[10px] text-zinc-500">{e.date} • {e.notes}</div>
                      </div>
                      <span className="text-orange-400 font-black text-base">{e.rpe_score}/10</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wellness Tab */}
      {activeTab === 'wellness' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4 shadow-xl max-w-xl mx-auto">
          <h2 className="text-base font-black text-white flex items-center space-x-2">
            <Heart className="w-5 h-5 text-rose-500" />
            <span>DAILY ATHLETE WELLNESS MONITOR</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-zinc-400 font-bold mb-1">Athlete</label>
              <select
                value={wellPlayerId}
                onChange={(e) => setWellPlayerId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white font-bold"
              >
                {roster.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number} {p.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 font-bold mb-1">Sleep Quality (1-10): {sleepScore}</label>
              <input type="range" min="1" max="10" value={sleepScore} onChange={(e) => setSleepScore(parseInt(e.target.value))} className="w-full accent-orange-500" />
            </div>

            <div>
              <label className="block text-zinc-400 font-bold mb-1">Muscle Soreness (1-10): {sorenessScore}</label>
              <input type="range" min="1" max="10" value={sorenessScore} onChange={(e) => setSorenessScore(parseInt(e.target.value))} className="w-full accent-orange-500" />
            </div>

            <div>
              <label className="block text-zinc-400 font-bold mb-1">Readiness Score (1-10): {readinessScore}</label>
              <input type="range" min="1" max="10" value={readinessScore} onChange={(e) => setReadinessScore(parseInt(e.target.value))} className="w-full accent-orange-500" />
            </div>

            <button
              onClick={handleSaveWellness}
              className="w-full bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black py-2.5 rounded-lg text-xs shadow-lg"
            >
              SAVE WELLNESS REPORT
            </button>
          </div>
        </div>
      )}

      {/* S&C Interventions Tab */}
      {activeTab === 'sc' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4 shadow-xl max-w-2xl mx-auto">
          <h2 className="text-base font-black text-white flex items-center space-x-2">
            <Dumbbell className="w-5 h-5 text-amber-500" />
            <span>RECORD S&C ISOMETRIC INTERVENTION</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-zinc-400 font-bold mb-1">Athlete</label>
              <select
                value={scPlayerId}
                onChange={(e) => setScPlayerId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white font-bold"
              >
                {roster.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number} {p.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-400 font-bold mb-1">Exercise Title</label>
                <input
                  type="text"
                  value={scExercise}
                  onChange={(e) => setScExercise(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-bold mb-1">Joint Angle / Position</label>
                <input
                  type="text"
                  value={scAngle}
                  onChange={(e) => setScAngle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 font-bold mb-1">Target Area / Rationale</label>
              <input
                type="text"
                value={scReason}
                onChange={(e) => setScReason(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"
              />
            </div>

            <button
              onClick={handleSaveSC}
              className="w-full bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black py-2.5 rounded-lg text-xs shadow-lg"
            >
              RECORD S&C INTERVENTION
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
