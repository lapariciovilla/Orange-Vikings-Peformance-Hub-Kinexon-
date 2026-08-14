import React, { useState } from 'react';
import { Player, SessionMeta } from '../types';
import { DataStore } from '../lib/dataStore';
import { formatWholeNumber } from '../lib/positionalUtils';
import {
  Calendar as CalendarIcon,
  Award,
  Trophy,
  BarChart2,
} from 'lucide-react';

interface CalendarViewProps {
  roster: Player[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ roster }) => {
  const sessions = DataStore.getSessionsMeta();
  const allRecords = DataStore.getPlayerRecords();

  // Selected date state for inspecting calendar days
  const [selectedDate, setSelectedDate] = useState<string>('2026-08-09');

  // Days in August 2026
  const totalDays = 31;

  // Compute session map by date
  const sessionByDate: { [date: string]: SessionMeta } = {};
  sessions.forEach((s) => {
    sessionByDate[s.date] = s;
  });

  // Calculate Monthly Load Leaders for each of the 5 primary metrics
  const playerMonthlyStats = roster.map((player) => {
    const playerRecs = allRecords.filter((r) => r.player_id === player.id);
    const totalDist = playerRecs.reduce((sum, r) => sum + (r.distance_m || 0), 0);
    const totalAccel = playerRecs.reduce((sum, r) => sum + (r.accumulated_acceleration_load || 0), 0);
    const totalDecel = playerRecs.reduce((sum, r) => sum + (r.deceleration_load || 0), 0);
    const totalJump = playerRecs.reduce((sum, r) => sum + (r.jump_load || 0), 0);
    const totalMech = playerRecs.reduce((sum, r) => sum + (r.mechanical_load || 0), 0);

    return {
      player,
      sessionCount: playerRecs.length,
      totalDist,
      totalAccel,
      totalDecel,
      totalJump,
      totalMech,
    };
  });

  const distLeader = [...playerMonthlyStats].sort((a, b) => b.totalDist - a.totalDist)[0] || { player: roster[0], totalDist: 0 };
  const accelLeader = [...playerMonthlyStats].sort((a, b) => b.totalAccel - a.totalAccel)[0] || { player: roster[0], totalAccel: 0 };
  const decelLeader = [...playerMonthlyStats].sort((a, b) => b.totalDecel - a.totalDecel)[0] || { player: roster[0], totalDecel: 0 };
  const jumpLeader = [...playerMonthlyStats].sort((a, b) => b.totalJump - a.totalJump)[0] || { player: roster[0], totalJump: 0 };
  const mechLeader = [...playerMonthlyStats].sort((a, b) => b.totalMech - a.totalMech)[0] || { player: roster[0], totalMech: 0 };

  const daySelectedSession = sessionByDate[selectedDate];
  const dayRecords = daySelectedSession
    ? allRecords.filter((r) => r.session_id === daySelectedSession.id)
    : [];

  const dayTotalPlayers = dayRecords.length;
  const inspectorAvgDist = dayTotalPlayers > 0 ? Math.round(dayRecords.reduce((sum, r) => sum + (r.distance_m || 0), 0) / dayTotalPlayers) : 0;
  const inspectorAvgAccel = dayTotalPlayers > 0 ? Math.round(dayRecords.reduce((sum, r) => sum + (r.accumulated_acceleration_load || 0), 0) / dayTotalPlayers) : 0;
  const inspectorAvgAccLoad = dayTotalPlayers > 0 ? Math.round(dayRecords.reduce((sum, r) => sum + (r.mechanical_load || 0), 0) / dayTotalPlayers) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-1">
            MONTHLY SCHEDULE & OVERLOAD CALENDAR
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <CalendarIcon className="w-6 h-6 text-orange-500" />
            <span>AUGUST 2026 PERFORMANCE CALENDAR</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Monthly view showing daily team averages for Distance, Acceleration Load, and Accumulated Mechanical Load across games and practices.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 text-xs font-bold">
          <Award className="w-4 h-4 text-amber-400" />
          <span>Season 2026–2027</span>
        </div>
      </div>

      {/* Simplified Monthly Load Leaders */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-2 border-b border-zinc-800 pb-3">
          <Trophy className="w-5 h-5 text-orange-500" />
          <h2 className="text-base font-black text-white tracking-wider uppercase">
            MONTHLY LOAD LEADERS
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Distance Leader</div>
              <div className="font-bold text-white">
                {distLeader.totalDist > 0 ? `${distLeader.player.displayName} (${distLeader.player.number})` : 'No data logged'}
              </div>
            </div>
            <div className="text-right">
              <span className="font-black text-amber-400 text-base">{formatWholeNumber(distLeader.totalDist)} m</span>
            </div>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Accumulated Acceleration Load Leader</div>
              <div className="font-bold text-white">
                {accelLeader.totalAccel > 0 ? `${accelLeader.player.displayName} (${accelLeader.player.number})` : 'No data logged'}
              </div>
            </div>
            <div className="text-right">
              <span className="font-black text-orange-400 text-base">{formatWholeNumber(accelLeader.totalAccel)}</span>
            </div>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Deceleration Load Leader</div>
              <div className="font-bold text-white">
                {decelLeader.totalDecel > 0 ? `${decelLeader.player.displayName} (${decelLeader.player.number})` : 'No data logged'}
              </div>
            </div>
            <div className="text-right">
              <span className="font-black text-rose-400 text-base">{formatWholeNumber(decelLeader.totalDecel)}</span>
            </div>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Jump Load Leader</div>
              <div className="font-bold text-white">
                {jumpLeader.totalJump > 0 ? `${jumpLeader.player.displayName} (${jumpLeader.player.number})` : 'No data logged'}
              </div>
            </div>
            <div className="text-right">
              <span className="font-black text-purple-400 text-base">{formatWholeNumber(jumpLeader.totalJump)}</span>
            </div>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Mechanical Load Leader</div>
              <div className="font-bold text-white">
                {mechLeader.totalMech > 0 ? `${mechLeader.player.displayName} (${mechLeader.player.number})` : 'No data logged'}
              </div>
            </div>
            <div className="text-right">
              <span className="font-black text-sky-400 text-base">{formatWholeNumber(mechLeader.totalMech)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid & Day Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Calendar Grid */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5 text-orange-500" />
              <h2 className="text-base font-black text-white">AUGUST 2026 DAILY AVERAGE METRICS</h2>
            </div>
            <div className="flex items-center space-x-3 text-[11px] font-bold">
              <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-1"></span> Game Day</span>
              <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1"></span> Practice</span>
              <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-zinc-700 mr-1"></span> Off Day</span>
            </div>
          </div>

          {/* Calendar Weekday Header */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-black text-zinc-500 uppercase">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>

          {/* Calendar Day Tiles */}
          <div className="grid grid-cols-7 gap-2 text-xs">
            {/* Blank tiles before Aug 1 (Aug 1, 2026 is Saturday) */}
            <div className="h-28 bg-zinc-950/20 rounded-lg border border-transparent"></div>
            <div className="h-28 bg-zinc-950/20 rounded-lg border border-transparent"></div>
            <div className="h-28 bg-zinc-950/20 rounded-lg border border-transparent"></div>
            <div className="h-28 bg-zinc-950/20 rounded-lg border border-transparent"></div>
            <div className="h-28 bg-zinc-950/20 rounded-lg border border-transparent"></div>
            <div className="h-28 bg-zinc-950/20 rounded-lg border border-transparent"></div>

            {Array.from({ length: totalDays }, (_, i) => {
              const dayNum = i + 1;
              const dateStr = `2026-08-${dayNum < 10 ? '0' + dayNum : dayNum}`;
              const session = sessionByDate[dateStr];
              const isSelected = selectedDate === dateStr;

              // Calculate session team averages for this tile
              let avgDist = 0;
              let avgAccel = 0;
              let avgAccLoad = 0;

              if (session) {
                const recs = allRecords.filter((r) => r.session_id === session.id);
                if (recs.length > 0) {
                  avgDist = Math.round(recs.reduce((sum, r) => sum + (r.distance_m || 0), 0) / recs.length);
                  avgAccel = Math.round(recs.reduce((sum, r) => sum + (r.accumulated_acceleration_load || 0), 0) / recs.length);
                  avgAccLoad = Math.round(recs.reduce((sum, r) => sum + (r.mechanical_load || 0), 0) / recs.length);
                }
              }

              let tileStyle = 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-600';
              if (session) {
                if (session.session_type === 'Game') {
                  tileStyle = 'bg-rose-950/30 border-rose-700/80 text-rose-300 hover:border-rose-500';
                } else {
                  tileStyle = 'bg-amber-950/20 border-amber-800/80 text-amber-300 hover:border-amber-500';
                }
              }

              if (isSelected) {
                tileStyle += ' ring-2 ring-orange-500 scale-[1.02] shadow-xl';
              }

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`h-28 p-1.5 rounded-lg border flex flex-col justify-between transition-all text-left ${tileStyle}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-white">{dayNum}</span>
                    {session && (
                      <span className={`text-[8px] font-black px-1 rounded uppercase ${
                        session.session_type === 'Game' ? 'bg-rose-600 text-zinc-950' : 'bg-amber-500 text-zinc-950'
                      }`}>
                        {session.session_type === 'Game' ? 'GAME' : 'PRACTICE'}
                      </span>
                    )}
                  </div>

                  {session ? (
                    <div className="space-y-0.5 bg-zinc-950/80 p-1 rounded border border-zinc-800/80 text-[9px] font-bold">
                      <div className="flex justify-between text-amber-400">
                        <span className="text-zinc-500">Dist:</span>
                        <span>{formatWholeNumber(avgDist)} m</span>
                      </div>
                      <div className="flex justify-between text-orange-400">
                        <span className="text-zinc-500">Accel:</span>
                        <span>{formatWholeNumber(avgAccel)}</span>
                      </div>
                      <div className="flex justify-between text-sky-400">
                        <span className="text-zinc-500">Mech:</span>
                        <span>{formatWholeNumber(avgAccLoad)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[9px] text-zinc-600 font-semibold italic text-center py-2">
                      Off Day
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Inspector */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
          <h2 className="text-base font-black text-white border-b border-zinc-800 pb-3 flex items-center justify-between">
            <span>DAY INSPECTOR</span>
            <span className="text-orange-400 text-xs font-extrabold">{selectedDate}</span>
          </h2>

          {daySelectedSession ? (
            <div className="space-y-4 text-xs">
              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 space-y-1">
                <div className="text-[10px] text-orange-400 font-extrabold uppercase">
                  {daySelectedSession.session_type} SESSION
                </div>
                <div className="text-sm font-black text-white">{daySelectedSession.session_name}</div>
                <div className="text-zinc-400 text-[11px]">Location: {daySelectedSession.location || 'Matsuyama Gym'}</div>
              </div>

              {/* Day Average Metrics Summary Box */}
              <div className="bg-zinc-950 p-3 rounded-lg border border-orange-500/40 space-y-2">
                <div className="text-[10px] font-black text-orange-400 uppercase tracking-wider flex items-center justify-between">
                  <span>TEAM AVERAGE METRICS</span>
                  <BarChart2 className="w-3.5 h-3.5" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div>
                    <span className="text-zinc-500 block text-[9px] font-bold">AVG DISTANCE</span>
                    <span className="font-extrabold text-amber-400">{formatWholeNumber(inspectorAvgDist)} m</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px] font-bold">ACCEL LOAD</span>
                    <span className="font-extrabold text-orange-400">{formatWholeNumber(inspectorAvgAccel)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px] font-bold">MECH LOAD</span>
                    <span className="font-extrabold text-sky-400">{formatWholeNumber(inspectorAvgAccLoad)}</span>
                  </div>
                </div>
              </div>

              <div className="text-zinc-400 font-bold text-[11px]">
                Monitored Athletes ({dayRecords.length}):
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {dayRecords.map((r) => (
                  <div key={r.id} className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-orange-400 font-black mr-1">{r.player_number}</span>
                      <span className="font-bold text-white">{r.player_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-amber-400 block">{formatWholeNumber(r.distance_m)} m</span>
                      <span className="text-[9px] text-zinc-500 block">Mech: {formatWholeNumber(r.mechanical_load)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-500 py-16 text-center">
              No official Kinexon session recorded on this date.
              <br />
              (Rest / Active Recovery Day)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
