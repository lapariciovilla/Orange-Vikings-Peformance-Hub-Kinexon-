import React, { useState, useMemo } from 'react';
import {
  Player,
  PlayerStatusAssessment,
  StaffClearanceStatus,
  RTPStage,
} from '../../types';
import { DataStore } from '../../lib/dataStore';
import { formatPlayerNumber } from '../../lib/positionalUtils';
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  UserCheck,
  HeartPulse,
  PlusCircle,
  History,
  Info,
  Calendar,
  AlertCircle,
  FileEdit,
  Stethoscope,
} from 'lucide-react';

interface PlayerStatusInjurySubTabProps {
  players: Player[];
  selectedPlayerId?: string;
  onSelectPlayer?: (id: string) => void;
  onStatusUpdated?: () => void;
}

const CLEARANCE_CONFIG: Record<
  StaffClearanceStatus,
  { label: string; badgeClass: string; bgClass: string; icon: any; desc: string }
> = {
  FULL_CLEARANCE: {
    label: 'Full Clearance',
    badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-800',
    bgClass: 'border-emerald-800/40 hover:border-emerald-500/50',
    icon: CheckCircle2,
    desc: 'Unrestricted game & training participation',
  },
  MODIFIED: {
    label: 'Modified / Restricted',
    badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-800',
    bgClass: 'border-amber-800/40 hover:border-amber-500/50',
    icon: AlertTriangle,
    desc: 'Subject to specific minutes or drill restrictions',
  },
  RTP: {
    label: 'Return to Play (RTP)',
    badgeClass: 'bg-orange-950/90 text-orange-300 border-orange-800',
    bgClass: 'border-orange-800/40 hover:border-orange-500/50',
    icon: HeartPulse,
    desc: 'Progressing through phased rehabilitation protocol',
  },
  INJURED: {
    label: 'Out / Injured',
    badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-800',
    bgClass: 'border-rose-800/40 hover:border-rose-500/50',
    icon: ShieldAlert,
    desc: 'Unavailable for match play; receiving medical care',
  },
  UNKNOWN: {
    label: 'Unknown (Pending Assessment)',
    badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    bgClass: 'border-zinc-800 hover:border-zinc-700',
    icon: AlertCircle,
    desc: 'No assessment on record; never assumed fully fit',
  },
};

const COMMON_BODY_AREAS = [
  'Left Hamstring',
  'Right Hamstring',
  'Patellar Tendon',
  'Left Ankle',
  'Right Ankle',
  'Left Quadriceps',
  'Right Quadriceps',
  'Groin / Adductor',
  'Lower Back',
  'Calf / Achilles',
  'Shoulder',
  'Hip Flexor',
  'None',
];

const RTP_STAGES: { id: RTPStage; label: string }[] = [
  { id: 'STAGE_1_ACUTE', label: 'Stage 1: Acute Protection & Symptom Management' },
  { id: 'STAGE_2_LOW_INTENSITY', label: 'Stage 2: Low-Intensity Rehab & Non-Impact Movement' },
  { id: 'STAGE_3_MODIFIED_NON_CONTACT', label: 'Stage 3: Modified Non-Contact Basketball Drills' },
  { id: 'STAGE_4_FULL_CONTACT', label: 'Stage 4: Full Contact Team Practice' },
  { id: 'STAGE_5_COMPETITION', label: 'Stage 5: Full Competition / Unrestricted Match Exposure' },
  { id: 'CLEARED', label: 'Cleared — Post-Rehab Monitoring' },
  { id: 'NOT_APPLICABLE', label: 'Not Applicable (No Injury)' },
  { id: 'UNKNOWN', label: 'Unknown / Not Assessed' },
];

export const PlayerStatusInjurySubTab: React.FC<PlayerStatusInjurySubTabProps> = ({
  players,
  selectedPlayerId: initialPlayerId,
  onSelectPlayer,
  onStatusUpdated,
}) => {
  const [activePlayerId, setActivePlayerId] = useState<string>(
    initialPlayerId || (players[0]?.id || '')
  );
  const [showNewEntryForm, setShowNewEntryForm] = useState<boolean>(false);
  const [filterClearance, setFilterClearance] = useState<string>('ALL');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // New assessment form state
  const [assessmentDate, setAssessmentDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [assessorName, setAssessorName] = useState<string>(
    'Coach Luis Aparicio Villa (S&C)'
  );
  const [clearanceStatus, setClearanceStatus] = useState<StaffClearanceStatus>('FULL_CLEARANCE');
  const [wellnessScore, setWellnessScore] = useState<number>(4);
  const [rpeScore, setRpeScore] = useState<number>(5);
  const [sorenessScore, setSorenessScore] = useState<number>(1);
  const [sorenessBodyArea, setSorenessBodyArea] = useState<string>('None');
  const [customBodyArea, setCustomBodyArea] = useState<string>('');
  const [hasActiveInjury, setHasActiveInjury] = useState<boolean>(false);
  const [injuryType, setInjuryType] = useState<string>('');
  const [injuryDate, setInjuryDate] = useState<string>('');
  const [affectedSide, setAffectedSide] = useState<'LEFT' | 'RIGHT' | 'BILATERAL' | 'CENTRAL' | 'N/A'>('N/A');
  const [rtpStage, setRtpStage] = useState<RTPStage>('NOT_APPLICABLE');
  const [medicalRestrictions, setMedicalRestrictions] = useState<string>('None');
  const [maxMinutesRestriction, setMaxMinutesRestriction] = useState<string>('');
  const [clinicalNotes, setClinicalNotes] = useState<string>('');

  const selectedPlayer = useMemo(
    () => players.find((p) => p.id === activePlayerId) || players[0],
    [players, activePlayerId]
  );

  // Get current assessments for all players
  const playerStatusMap = useMemo(() => {
    const map = new Map<string, PlayerStatusAssessment>();
    players.forEach((p) => {
      map.set(p.id, DataStore.getLatestPlayerStatus(p.id));
    });
    return map;
  }, [players, saveSuccessNotice]);

  // History of assessments for selected player
  const playerHistory = useMemo(() => {
    if (!activePlayerId) return [];
    return DataStore.getPlayerStatusAssessments(activePlayerId);
  }, [activePlayerId, saveSuccessNotice]);

  const latestAssessment = selectedPlayer ? playerStatusMap.get(selectedPlayer.id) : null;

  // Clearance breakdown counters
  const counts = useMemo(() => {
    let full = 0;
    let modified = 0;
    let rtp = 0;
    let injured = 0;
    let unknown = 0;

    players.forEach((p) => {
      const st = playerStatusMap.get(p.id)?.clearance_status || 'UNKNOWN';
      if (st === 'FULL_CLEARANCE') full++;
      else if (st === 'MODIFIED') modified++;
      else if (st === 'RTP') rtp++;
      else if (st === 'INJURED') injured++;
      else unknown++;
    });

    return { full, modified, rtp, injured, unknown };
  }, [players, playerStatusMap]);

  // Handle player selection
  const handleSelectPlayer = (id: string) => {
    setActivePlayerId(id);
    if (onSelectPlayer) onSelectPlayer(id);
    setShowNewEntryForm(false);
  };

  // Pre-fill form from latest assessment if available
  const handleOpenNewEntry = () => {
    if (latestAssessment && latestAssessment.clearance_status !== 'UNKNOWN') {
      setClearanceStatus(latestAssessment.clearance_status);
      setWellnessScore(latestAssessment.wellness_score || 4);
      setRpeScore(latestAssessment.rpe_score || 5);
      setSorenessScore(latestAssessment.soreness_score || 1);
      setSorenessBodyArea(latestAssessment.soreness_body_area || 'None');
      setHasActiveInjury(latestAssessment.has_active_injury);
      setInjuryType(latestAssessment.injury_type || '');
      setInjuryDate(latestAssessment.injury_date || '');
      setAffectedSide(latestAssessment.affected_side || 'N/A');
      setRtpStage((latestAssessment.rtp_stage as RTPStage) || 'NOT_APPLICABLE');
      setMedicalRestrictions(latestAssessment.medical_restrictions || 'None');
      setMaxMinutesRestriction(
        latestAssessment.max_minutes_restriction !== null && latestAssessment.max_minutes_restriction !== undefined
          ? String(latestAssessment.max_minutes_restriction)
          : ''
      );
      setClinicalNotes('');
    } else {
      // Default clean slate
      setClearanceStatus('FULL_CLEARANCE');
      setWellnessScore(4);
      setRpeScore(5);
      setSorenessScore(1);
      setSorenessBodyArea('None');
      setHasActiveInjury(false);
      setInjuryType('');
      setInjuryDate('');
      setAffectedSide('N/A');
      setRtpStage('NOT_APPLICABLE');
      setMedicalRestrictions('None');
      setMaxMinutesRestriction('');
      setClinicalNotes('');
    }
    setAssessmentDate(new Date().toISOString().split('T')[0]);
    setShowNewEntryForm(true);
  };

  // Save new assessment (dated, immutable history)
  const handleSaveAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer) return;

    const area = sorenessBodyArea === 'Custom' ? customBodyArea : sorenessBodyArea;
    const maxMin = maxMinutesRestriction.trim() !== '' ? Number(maxMinutesRestriction) : null;

    DataStore.addPlayerStatusAssessment({
      player_id: selectedPlayer.id,
      player_name: selectedPlayer.displayName,
      player_number: selectedPlayer.number,
      date: assessmentDate,
      assessed_by: assessorName,
      clearance_status: clearanceStatus,
      wellness_score: wellnessScore,
      rpe_score: rpeScore,
      soreness_score: sorenessScore,
      soreness_body_area: area || 'None',
      has_active_injury: hasActiveInjury,
      injury_type: hasActiveInjury ? injuryType : null,
      injury_date: hasActiveInjury && injuryDate ? injuryDate : null,
      affected_side: hasActiveInjury ? affectedSide : 'N/A',
      rtp_stage: hasActiveInjury ? rtpStage : 'NOT_APPLICABLE',
      medical_restrictions: medicalRestrictions,
      max_minutes_restriction: maxMin,
      notes: clinicalNotes || undefined,
    });

    setSaveSuccessNotice(`Saved dated assessment for ${selectedPlayer.displayName} (${assessmentDate})`);
    setTimeout(() => setSaveSuccessNotice(null), 4000);
    setShowNewEntryForm(false);
    if (onStatusUpdated) onStatusUpdated();
  };

  // Filtered players list
  const filteredPlayers = players.filter((p) => {
    if (filterClearance === 'ALL') return true;
    const st = playerStatusMap.get(p.id)?.clearance_status || 'UNKNOWN';
    return st === filterClearance;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Metrics */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-black tracking-widest text-orange-500 uppercase mb-1">
              <Stethoscope className="w-4 h-4 text-orange-500" />
              <span>S&C CLINICAL READINESS & RETURN-TO-PLAY ENGINE</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Player Medical Status, Soreness & Clearance Context
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Maintains dated historical S&C assessments before every game and training session.
              Unassessed athletes remain explicitly <strong>Unknown</strong> and are never assumed fully fit.
              Contextualizes exposure projection models without diagnosing injuries.
            </p>
          </div>

          {/* Quick Counter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterClearance('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all ${
                filterClearance === 'ALL'
                  ? 'bg-zinc-100 text-zinc-950 border-white'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              All ({players.length})
            </button>
            <button
              onClick={() => setFilterClearance('FULL_CLEARANCE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border flex items-center space-x-1.5 transition-all ${
                filterClearance === 'FULL_CLEARANCE'
                  ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-black'
                  : 'bg-emerald-950/60 text-emerald-400 border-emerald-800 hover:border-emerald-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{counts.full} Full</span>
            </button>
            <button
              onClick={() => setFilterClearance('MODIFIED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border flex items-center space-x-1.5 transition-all ${
                filterClearance === 'MODIFIED'
                  ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800 hover:border-amber-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>{counts.modified} Modified</span>
            </button>
            <button
              onClick={() => setFilterClearance('RTP')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border flex items-center space-x-1.5 transition-all ${
                filterClearance === 'RTP'
                  ? 'bg-orange-500 text-zinc-950 border-orange-400 font-black'
                  : 'bg-orange-950/60 text-orange-300 border-orange-800 hover:border-orange-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              <span>{counts.rtp} RTP</span>
            </button>
            <button
              onClick={() => setFilterClearance('INJURED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border flex items-center space-x-1.5 transition-all ${
                filterClearance === 'INJURED'
                  ? 'bg-rose-500 text-zinc-950 border-rose-400 font-black'
                  : 'bg-rose-950/60 text-rose-300 border-rose-800 hover:border-rose-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>{counts.injured} Injured</span>
            </button>
            <button
              onClick={() => setFilterClearance('UNKNOWN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border flex items-center space-x-1.5 transition-all ${
                filterClearance === 'UNKNOWN'
                  ? 'bg-zinc-700 text-white border-zinc-500 font-black'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-zinc-500" />
              <span>{counts.unknown} Unknown</span>
            </button>
          </div>
        </div>

        {saveSuccessNotice && (
          <div className="mt-4 bg-emerald-950/90 border border-emerald-600 text-emerald-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveSuccessNotice}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Player Roster Cards & Active Player Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Player Cards Selector (5 Cols) */}
        <div className="lg:col-span-5 space-y-2">
          <div className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Roster Readiness Status ({filteredPlayers.length})</span>
            <span className="text-[10px] text-zinc-500 font-bold">Select player to inspect / edit</span>
          </div>

          <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
            {filteredPlayers.map((p) => {
              const status = playerStatusMap.get(p.id);
              const clearance = status?.clearance_status || 'UNKNOWN';
              const cfg = CLEARANCE_CONFIG[clearance];
              const isSelected = p.id === activePlayerId;

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPlayer(p.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-zinc-900 border-orange-500 shadow-lg shadow-orange-950/30'
                      : 'bg-zinc-950/80 border-zinc-800/80 hover:bg-zinc-900/60 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-700 text-orange-400 font-black text-xs flex items-center justify-center shrink-0">
                        {formatPlayerNumber(p.number)}
                      </div>
                      <div className="min-w-0 truncate">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-black text-white truncate">{p.displayName}</span>
                          <span className="text-[10px] font-bold text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                            {p.position}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5 truncate flex items-center space-x-2">
                          <span>
                            Soreness:{' '}
                            <strong className={status?.soreness_score && status.soreness_score >= 3 ? 'text-amber-400' : 'text-zinc-300'}>
                              {status?.soreness_score ? `${status.soreness_score}/5` : 'Unknown'}
                            </strong>
                          </span>
                          <span>•</span>
                          <span className="truncate">{status?.soreness_body_area || 'None'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-black uppercase border ${cfg.badgeClass}`}>
                        {cfg.label.split(' ')[0]}
                      </span>
                      {status?.max_minutes_restriction && (
                        <div className="text-[10px] font-black text-amber-400 mt-1">
                          Max {status.max_minutes_restriction} min
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Player Detail & Assessment Module (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedPlayer ? (
            <>
              {/* Selected Player Header Card */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-600/20 border border-orange-500/40 text-orange-400 font-black text-xl flex items-center justify-center shrink-0">
                      {formatPlayerNumber(selectedPlayer.number)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-xl font-black text-white">{selectedPlayer.displayName}</h3>
                        <span className="text-xs font-bold text-orange-400 bg-orange-950/80 border border-orange-800 px-2 py-0.5 rounded">
                          {selectedPlayer.position}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Latest Assessment: <strong>{latestAssessment?.date || 'None Recorded'}</strong>
                        {latestAssessment?.assessed_by && (
                          <span className="text-zinc-500"> — {latestAssessment.assessed_by}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleOpenNewEntry}
                      className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black text-xs px-4 py-2 rounded-xl flex items-center space-x-2 transition-all shadow-lg shadow-orange-950/40"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Record Assessment</span>
                    </button>
                  </div>
                </div>

                {/* Status Snapshot Grid */}
                {latestAssessment && latestAssessment.clearance_status !== 'UNKNOWN' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3">
                      <div className="text-[10px] font-black text-zinc-400 uppercase">Clearance</div>
                      <div className="text-xs font-black text-white mt-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                            CLEARANCE_CONFIG[latestAssessment.clearance_status].badgeClass
                          }`}
                        >
                          {CLEARANCE_CONFIG[latestAssessment.clearance_status].label}
                        </span>
                      </div>
                    </div>

                    <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3">
                      <div className="text-[10px] font-black text-zinc-400 uppercase">Readiness / Wellness</div>
                      <div className="text-base font-black text-white mt-0.5">
                        {latestAssessment.wellness_score ? `${latestAssessment.wellness_score} / 5` : 'N/A'}
                        <span className="text-[10px] text-zinc-400 font-normal ml-1">
                          {latestAssessment.wellness_score && latestAssessment.wellness_score >= 4
                            ? 'Optimal'
                            : latestAssessment.wellness_score === 3
                            ? 'Moderate'
                            : 'Sub-optimal'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3">
                      <div className="text-[10px] font-black text-zinc-400 uppercase">Reported Soreness</div>
                      <div className="text-base font-black text-white mt-0.5">
                        <span className={latestAssessment.soreness_score && latestAssessment.soreness_score >= 3 ? 'text-amber-400' : 'text-emerald-400'}>
                          {latestAssessment.soreness_score ? `${latestAssessment.soreness_score} / 5` : 'None'}
                        </span>
                        <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                          {latestAssessment.soreness_body_area || 'None'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3">
                      <div className="text-[10px] font-black text-zinc-400 uppercase">Medical Limits</div>
                      <div className="text-xs font-black text-amber-400 mt-1 truncate">
                        {latestAssessment.max_minutes_restriction
                          ? `Max ${latestAssessment.max_minutes_restriction} min`
                          : latestAssessment.medical_restrictions && latestAssessment.medical_restrictions !== 'None'
                          ? latestAssessment.medical_restrictions
                          : 'Unrestricted'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 text-center space-y-2">
                    <AlertCircle className="w-6 h-6 text-zinc-500 mx-auto" />
                    <div className="text-xs font-black text-zinc-300">
                      NO DATED S&C ASSESSMENT ON FILE FOR {selectedPlayer.displayName.toUpperCase()}
                    </div>
                    <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
                      Per Orange Vikings S&C protocols, unassessed athletes remain explicitly <strong>Unknown</strong>.
                      They must never be assumed fully fit without staff evaluation.
                    </p>
                    <button
                      onClick={handleOpenNewEntry}
                      className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black text-xs px-3.5 py-1.5 rounded-lg inline-flex items-center space-x-1.5 transition-all"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Record Initial Assessment</span>
                    </button>
                  </div>
                )}

                {/* Additional Clinical Context if injury / restriction exists */}
                {latestAssessment && latestAssessment.has_active_injury && (
                  <div className="bg-rose-950/30 border border-rose-800/60 rounded-xl p-4 space-y-2">
                    <div className="flex items-center space-x-2 text-xs font-black text-rose-300 uppercase">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <span>Active Injury & Return-To-Play Monitoring</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-zinc-300">
                      <div>
                        <span className="text-zinc-500">Diagnosis:</span>{' '}
                        <strong className="text-white">{latestAssessment.injury_type || 'Unspecified Strain'}</strong>
                      </div>
                      <div>
                        <span className="text-zinc-500">Side:</span>{' '}
                        <strong className="text-white">{latestAssessment.affected_side || 'N/A'}</strong>
                      </div>
                      <div>
                        <span className="text-zinc-500">Onset Date:</span>{' '}
                        <strong className="text-white">{latestAssessment.injury_date || 'Unknown'}</strong>
                      </div>
                    </div>
                    <div className="text-xs text-zinc-300">
                      <span className="text-zinc-500">RTP Stage:</span>{' '}
                      <span className="font-bold text-amber-300">
                        {RTP_STAGES.find((s) => s.id === latestAssessment.rtp_stage)?.label || latestAssessment.rtp_stage}
                      </span>
                    </div>
                    {latestAssessment.notes && (
                      <div className="text-xs text-zinc-400 bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
                        <span className="font-bold text-zinc-300">S&C Notes:</span> {latestAssessment.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Assessment Form Modal / Expansion */}
              {showNewEntryForm && (
                <div className="bg-zinc-900 border-2 border-orange-500/60 rounded-2xl p-5 shadow-2xl space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div className="flex items-center space-x-2 text-sm font-black text-white">
                      <FileEdit className="w-4 h-4 text-orange-500" />
                      <span>New S&C Assessment: {selectedPlayer.displayName}</span>
                    </div>
                    <button
                      onClick={() => setShowNewEntryForm(false)}
                      className="text-xs font-bold text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleSaveAssessment} className="space-y-4 text-xs">
                    {/* Date and Assessor */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-zinc-400 font-bold mb-1">Assessment Date</label>
                        <input
                          type="date"
                          value={assessmentDate}
                          onChange={(e) => setAssessmentDate(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white font-bold"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-400 font-bold mb-1">Assessed By (Staff)</label>
                        <input
                          type="text"
                          value={assessorName}
                          onChange={(e) => setAssessorName(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white font-bold"
                          required
                        />
                      </div>
                    </div>

                    {/* Staff Clearance Status */}
                    <div>
                      <label className="block text-zinc-400 font-bold mb-1">Staff Clearance Status</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(['FULL_CLEARANCE', 'MODIFIED', 'RTP', 'INJURED', 'UNKNOWN'] as StaffClearanceStatus[]).map(
                          (st) => {
                            const cfg = CLEARANCE_CONFIG[st];
                            const isSel = clearanceStatus === st;
                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setClearanceStatus(st)}
                                className={`p-2.5 rounded-lg border text-left transition-all ${
                                  isSel
                                    ? 'bg-orange-950/80 border-orange-500 text-white font-black'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                              >
                                <div className="text-[11px] font-black">{cfg.label}</div>
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {/* Readiness, RPE & Soreness */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <div>
                        <label className="block text-zinc-400 font-bold mb-1">
                          Wellness / Readiness (1–5)
                        </label>
                        <select
                          value={wellnessScore}
                          onChange={(e) => setWellnessScore(Number(e.target.value))}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white font-bold"
                        >
                          <option value={5}>5 — Optimal / Peak Readiness</option>
                          <option value={4}>4 — Good / Fully Ready</option>
                          <option value={3}>3 — Moderate / Some Fatigue</option>
                          <option value={2}>2 — Poor / Heavy Fatigue</option>
                          <option value={1}>1 — Severely Fatigued / Depleted</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-zinc-400 font-bold mb-1">Session RPE (1–10)</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={rpeScore}
                          onChange={(e) => setRpeScore(Number(e.target.value))}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-400 font-bold mb-1">
                          Reported Soreness (1–5)
                        </label>
                        <select
                          value={sorenessScore}
                          onChange={(e) => setSorenessScore(Number(e.target.value))}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white font-bold"
                        >
                          <option value={1}>1 — None / Fresh</option>
                          <option value={2}>2 — Mild localized tightness</option>
                          <option value={3}>3 — Moderate soreness</option>
                          <option value={4}>4 — High soreness / discomfort</option>
                          <option value={5}>5 — Severe / Limiting movement</option>
                        </select>
                      </div>
                    </div>

                    {/* Affected Body Area Selection */}
                    <div>
                      <label className="block text-zinc-400 font-bold mb-1.5">
                        Affected Body Area / Soreness Location
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {COMMON_BODY_AREAS.map((area) => (
                          <button
                            key={area}
                            type="button"
                            onClick={() => setSorenessBodyArea(area)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                              sorenessBodyArea === area
                                ? 'bg-orange-600 text-zinc-950 font-black border-orange-500'
                                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                            }`}
                          >
                            {area}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Injury Details Toggle */}
                    <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="has-injury-toggle"
                            checked={hasActiveInjury}
                            onChange={(e) => setHasActiveInjury(e.target.checked)}
                            className="w-4 h-4 text-orange-600 rounded bg-zinc-900 border-zinc-700 focus:ring-0"
                          />
                          <label htmlFor="has-injury-toggle" className="font-black text-white cursor-pointer">
                            Active Injury Diagnosis or Return-to-Play Protocol
                          </label>
                        </div>
                      </div>

                      {hasActiveInjury && (
                        <div className="space-y-3 pt-2 border-t border-zinc-800">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-zinc-400 font-bold mb-1">Injury Type / Pathology</label>
                              <input
                                type="text"
                                placeholder="e.g. Hamstring Strain Grade 1"
                                value={injuryType}
                                onChange={(e) => setInjuryType(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-white font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-zinc-400 font-bold mb-1">Injury / Onset Date</label>
                              <input
                                type="date"
                                value={injuryDate}
                                onChange={(e) => setInjuryDate(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-white font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-zinc-400 font-bold mb-1">Anatomical Side</label>
                              <select
                                value={affectedSide}
                                onChange={(e) => setAffectedSide(e.target.value as any)}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-white font-bold"
                              >
                                <option value="N/A">N/A</option>
                                <option value="LEFT">Left</option>
                                <option value="RIGHT">Right</option>
                                <option value="BILATERAL">Bilateral</option>
                                <option value="CENTRAL">Central / Axial</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-zinc-400 font-bold mb-1">Rehabilitation / RTP Stage</label>
                            <select
                              value={rtpStage}
                              onChange={(e) => setRtpStage(e.target.value as RTPStage)}
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-white font-bold"
                            >
                              {RTP_STAGES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Medical Restrictions and Minute Cap */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-zinc-400 font-bold mb-1">Medical / Drill Restrictions</label>
                        <input
                          type="text"
                          placeholder="e.g. Max 20 min playing time, No back-to-backs, Non-contact"
                          value={medicalRestrictions}
                          onChange={(e) => setMedicalRestrictions(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-400 font-bold mb-1">Minutes Cap (if numeric)</label>
                        <input
                          type="number"
                          placeholder="e.g. 20"
                          value={maxMinutesRestriction}
                          onChange={(e) => setMaxMinutesRestriction(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white font-bold"
                        />
                      </div>
                    </div>

                    {/* Clinical S&C Notes */}
                    <div>
                      <label className="block text-zinc-400 font-bold mb-1">Clinical / S&C Notes</label>
                      <textarea
                        rows={2}
                        placeholder="Observational context, physical therapy feedback, or next session guidance..."
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white font-medium"
                      />
                    </div>

                    {/* Submit Actions */}
                    <div className="flex items-center justify-end space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowNewEntryForm(false)}
                        className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-5 py-2 rounded-xl shadow-lg shadow-orange-950/40"
                      >
                        Save Dated Assessment
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Assessment Historical Timeline (Preserves Audit Trail) */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex items-center space-x-2 text-xs font-black text-white uppercase tracking-wider">
                  <History className="w-4 h-4 text-orange-500" />
                  <span>Dated Assessment History ({playerHistory.length} Entries)</span>
                </div>

                {playerHistory.length === 0 ? (
                  <div className="py-6 text-center text-zinc-500 text-xs">
                    No historical assessments recorded for this player yet.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {playerHistory.map((h) => {
                      const cfg = CLEARANCE_CONFIG[h.clearance_status] || CLEARANCE_CONFIG.UNKNOWN;
                      return (
                        <div
                          key={h.id}
                          className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-white font-black">{h.date}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${cfg.badgeClass}`}>
                                {cfg.label}
                              </span>
                              {h.has_active_injury && (
                                <span className="bg-rose-950/80 border border-rose-800 text-rose-300 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                                  {h.injury_type || 'Injury'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              Wellness: <strong className="text-zinc-200">{h.wellness_score ?? 'N/A'}/5</strong> • Soreness:{' '}
                              <strong className={h.soreness_score && h.soreness_score >= 3 ? 'text-amber-400' : 'text-zinc-200'}>
                                {h.soreness_score ?? 'N/A'}/5 ({h.soreness_body_area || 'None'})
                              </strong>
                            </div>
                            {h.medical_restrictions && h.medical_restrictions !== 'None' && (
                              <div className="text-[11px] text-amber-300 font-bold">
                                Limit: {h.medical_restrictions}
                              </div>
                            )}
                            {h.notes && (
                              <div className="text-[11px] text-zinc-400 italic">"{h.notes}"</div>
                            )}
                          </div>

                          <div className="text-[10px] text-zinc-500 shrink-0 text-right">
                            <div>{h.assessed_by}</div>
                            <div className="text-zinc-600">
                              {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-400">
              Select a player to view readiness status.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
