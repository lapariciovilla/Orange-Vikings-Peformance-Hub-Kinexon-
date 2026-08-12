import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { CSVImportView } from './components/CSVImportView';
import { SessionHistoryView } from './components/SessionHistoryView';
import { PlayerProfileView } from './components/PlayerProfileView';
import { TeamAnalyticsView } from './components/TeamAnalyticsView';
import { PlayerComparisonView } from './components/PlayerComparisonView';
import { AIPerformanceAnalystView } from './components/AIPerformanceAnalystView';
import { FutureModulesView } from './components/FutureModulesView';
import { SettingsView } from './components/SettingsView';

import { DataStore } from './lib/dataStore';
import { Player, SessionMeta, PlayerSessionRecord } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [currentDate, setCurrentDate] = useState<string>('2026-08-11');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('p4'); // #8 Ryuji Aoki

  // Data Store State
  const [roster, setRoster] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [records, setRecords] = useState<PlayerSessionRecord[]>([]);

  // Refresh data from DataStore
  const refreshData = () => {
    const currentRoster = DataStore.getRoster();
    const currentSessions = DataStore.getSessionsMeta();
    const currentRecords = DataStore.getPlayerRecords();

    setRoster(currentRoster);
    setSessions(currentSessions);
    setRecords(currentRecords);

    // If currentDate has no session, pick the latest session date if available
    if (currentSessions.length > 0) {
      const match = currentSessions.find((s) => s.date === currentDate);
      if (!match) {
        setCurrentDate(currentSessions[0].date);
      }
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Filter records for currentDate
  const sessionMetaForDate = sessions.find((s) => s.date === currentDate) || null;
  const recordsForDate = records.filter((r) => r.date === currentDate);

  const availableDates = Array.from(new Set(sessions.map((s) => s.date))).sort().reverse();

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden select-none">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sessionCount={sessions.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto min-w-0 bg-zinc-950">
        <Header
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          availableDates={availableDates.length > 0 ? availableDates : ['2026-08-11']}
          onOpenImport={() => setActiveTab('import')}
        />

        <main className="flex-1 pb-12">
          {activeTab === 'dashboard' && (
            <DashboardView
              sessionMeta={sessionMetaForDate}
              records={recordsForDate}
              allSessions={sessions}
              onSelectPlayer={(pId) => {
                setSelectedPlayerId(pId);
                setActiveTab('players');
              }}
              onNavigateImport={() => setActiveTab('import')}
            />
          )}

          {activeTab === 'import' && (
            <CSVImportView
              roster={roster}
              onImportComplete={(sessionId) => {
                refreshData();
                setActiveTab('dashboard');
              }}
            />
          )}

          {activeTab === 'sessions' && (
            <SessionHistoryView
              sessions={sessions}
              roster={roster}
              onSelectSession={(sId) => {
                const s = sessions.find((item) => item.id === sId);
                if (s) setCurrentDate(s.date);
              }}
              onRefresh={refreshData}
            />
          )}

          {activeTab === 'players' && (
            <PlayerProfileView
              players={roster}
              selectedPlayerId={selectedPlayerId}
              onSelectPlayer={setSelectedPlayerId}
            />
          )}

          {activeTab === 'analytics' && (
            <TeamAnalyticsView sessions={sessions} records={records} />
          )}

          {activeTab === 'comparison' && <PlayerComparisonView players={roster} />}

          {activeTab === 'ai_analyst' && (
            <AIPerformanceAnalystView roster={roster} sessions={sessions} records={records} />
          )}

          {activeTab === 'future_modules' && <FutureModulesView roster={roster} />}

          {activeTab === 'settings' && <SettingsView roster={roster} onRefresh={refreshData} />}
        </main>
      </div>
    </div>
  );
}
