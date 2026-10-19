import React, { useState } from 'react';
import { Player, PlayerSessionRecord } from '../types';
import { TargetCardSubTab } from './thresholds/TargetCardSubTab';
import { MonitorSubTab } from './thresholds/MonitorSubTab';
import { GameMinutesExposureSubTab } from './thresholds/GameMinutesExposureSubTab';
import { TeamOverviewSubTab } from './thresholds/TeamOverviewSubTab';
import { CoachViewSubTab } from './thresholds/CoachViewSubTab';
import { BackToBackSubTab } from './thresholds/BackToBackSubTab';
import { MinutesDensitySubTab } from './thresholds/MinutesDensitySubTab';
import { WeeklyRollingSubTab } from './thresholds/WeeklyRollingSubTab';
import { PlayerStatusInjurySubTab } from './thresholds/PlayerStatusInjurySubTab';
import { formatPlayerNumber } from '../lib/positionalUtils';
import { Target, Activity, Users, ShieldAlert, Repeat, Clock, Calendar, Sliders, Stethoscope } from 'lucide-react';

interface LoadThresholdsViewProps {
  players: Player[];
  records: PlayerSessionRecord[];
}

type SubTabKey =
  | 'TARGET_CARDS'
  | 'EXPOSURE_MONITOR'
  | 'GAME_MINUTES_EXPOSURE'
  | 'PLAYER_STATUS_INJURY'
  | 'TEAM_OVERVIEW'
  | 'COACH_VIEW'
  | 'B2B_MONITOR'
  | 'MINUTES_DENSITY'
  | 'WEEKLY_ROLLING';

export const LoadThresholdsView: React.FC<LoadThresholdsViewProps> = ({
  players,
  records,
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(players[0]?.id || 'p1');
  const [targetContext, setTargetContext] = useState<'GAME' | 'PRACTICE' | 'POST_B2B_PRACTICE'>('GAME');
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('TARGET_CARDS');

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) || players[0];

  return (
    <div className="space-y-6">
      {/* Top Page Control Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black uppercase text-orange-400 tracking-wider">
              PLAYER-SPECIFIC LOAD THRESHOLDS
            </span>
            <span className="text-[10px] bg-orange-950 text-orange-400 font-extrabold px-2 py-0.5 rounded border border-orange-800">
              DETERMINISTIC
            </span>
          </div>
          <h1 className="text-3xl font-black text-white mt-1">Player Load Targets & Exposure</h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Individualized P50, P90, and P95 exposure thresholds calculated from player-specific historical data across 8 core tracking metrics.
          </p>
        </div>

        {/* Player & Context Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Practice vs Game vs Post B2B Context Toggle */}
          <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-800 flex items-center space-x-1">
            <button
              onClick={() => setTargetContext('GAME')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                targetContext === 'GAME'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              GAME
            </button>
            <button
              onClick={() => setTargetContext('PRACTICE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                targetContext === 'PRACTICE'
                  ? 'bg-orange-600 text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              PRACTICE
            </button>
            <button
              onClick={() => setTargetContext('POST_B2B_PRACTICE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                targetContext === 'POST_B2B_PRACTICE'
                  ? 'bg-amber-500 text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Practice load evaluation following a Back-to-Back game weekend"
            >
              POST B2B PRACTICE
            </button>
          </div>

          {/* Player Dropdown */}
          <div className="flex items-center space-x-2">
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 text-white font-bold text-xs rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none"
            >
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatPlayerNumber(p.number)} {p.displayName} ({p.position})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs Navigation Bar */}
      <div className="flex items-center space-x-2 border-b border-zinc-800 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setActiveSubTab('TARGET_CARDS')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeSubTab === 'TARGET_CARDS'
              ? 'bg-orange-950/80 text-orange-400 border border-orange-800 shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Player Load Targets</span>
        </button>

        <button
          onClick={() => setActiveSubTab('EXPOSURE_MONITOR')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeSubTab === 'EXPOSURE_MONITOR'
              ? 'bg-orange-950/80 text-orange-400 border border-orange-800 shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Individual Exposure Monitor</span>
        </button>

        <button
          onClick={() => setActiveSubTab('GAME_MINUTES_EXPOSURE')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeSubTab === 'GAME_MINUTES_EXPOSURE'
              ? 'bg-purple-950/90 text-purple-300 border border-purple-700 shadow-lg shadow-purple-950/50'
              : 'text-purple-400 hover:text-white hover:bg-zinc-900 border border-purple-900/50'
          }`}
        >
          <Sliders className="w-4 h-4 text-purple-400" />
          <span>Game Minutes & Exposure</span>
        </button>

        <button
          onClick={() => setActiveSubTab('PLAYER_STATUS_INJURY')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeSubTab === 'PLAYER_STATUS_INJURY'
              ? 'bg-orange-600 text-zinc-950 font-black shadow-md shadow-orange-950/40'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>Player Medical Status & Injury</span>
        </button>

        <button
          onClick={() => setActiveSubTab('TEAM_OVERVIEW')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeSubTab === 'TEAM_OVERVIEW'
              ? 'bg-orange-950/80 text-orange-400 border border-orange-800 shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team Roster Matrix</span>
        </button>

        <button
          onClick={() => setActiveSubTab('COACH_VIEW')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeSubTab === 'COACH_VIEW'
              ? 'bg-orange-950/80 text-orange-400 border border-orange-800 shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-purple-400" />
          <span>Game Load Target (Coach View)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('B2B_MONITOR')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeSubTab === 'B2B_MONITOR'
              ? 'bg-orange-950/80 text-orange-400 border border-orange-800 shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Repeat className="w-4 h-4" />
          <span>Back-to-Back Monitor</span>
        </button>

        <button
          onClick={() => setActiveSubTab('MINUTES_DENSITY')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeSubTab === 'MINUTES_DENSITY'
              ? 'bg-orange-950/80 text-orange-400 border border-orange-800 shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Minutes & Load Density</span>
        </button>

        <button
          onClick={() => setActiveSubTab('WEEKLY_ROLLING')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            activeSubTab === 'WEEKLY_ROLLING'
              ? 'bg-orange-950/80 text-orange-400 border border-orange-800 shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Acute & Chronic Workload (EWMA & 3/7/14/28d)</span>
        </button>
      </div>

      {/* Active Sub-Tab View Rendering */}
      {activeSubTab === 'TARGET_CARDS' && selectedPlayer && (
        <TargetCardSubTab
          player={selectedPlayer}
          records={records}
          targetContext={targetContext}
        />
      )}

      {activeSubTab === 'EXPOSURE_MONITOR' && selectedPlayer && (
        <MonitorSubTab
          player={selectedPlayer}
          records={records}
          targetContext={targetContext}
        />
      )}

      {activeSubTab === 'GAME_MINUTES_EXPOSURE' && selectedPlayer && (
        <GameMinutesExposureSubTab
          player={selectedPlayer}
          players={players}
          records={records}
          onSelectPlayer={setSelectedPlayerId}
        />
      )}

      {activeSubTab === 'PLAYER_STATUS_INJURY' && (
        <PlayerStatusInjurySubTab
          players={players}
          selectedPlayerId={selectedPlayerId}
          onSelectPlayer={setSelectedPlayerId}
        />
      )}

      {activeSubTab === 'TEAM_OVERVIEW' && (
        <TeamOverviewSubTab
          players={players}
          records={records}
          targetContext={targetContext}
        />
      )}

      {activeSubTab === 'COACH_VIEW' && (
        <CoachViewSubTab
          players={players}
          records={records}
          selectedPlayerId={selectedPlayerId}
          onSelectPlayer={setSelectedPlayerId}
        />
      )}

      {activeSubTab === 'B2B_MONITOR' && selectedPlayer && (
        <BackToBackSubTab
          player={selectedPlayer}
          players={players}
          records={records}
          onSelectPlayer={setSelectedPlayerId}
        />
      )}

      {activeSubTab === 'MINUTES_DENSITY' && selectedPlayer && (
        <MinutesDensitySubTab
          player={selectedPlayer}
          records={records}
        />
      )}

      {activeSubTab === 'WEEKLY_ROLLING' && selectedPlayer && (
        <WeeklyRollingSubTab
          player={selectedPlayer}
          records={records}
        />
      )}
    </div>
  );
};
