import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { CSVImportView } from './components/CSVImportView';
import { GamesView } from './components/GamesView';
import { CalendarView } from './components/CalendarView';
import { ReportGeneratorView } from './components/ReportGeneratorView';
import { SessionHistoryView } from './components/SessionHistoryView';
import { PlayerProfileView } from './components/PlayerProfileView';
import { TeamAnalyticsView } from './components/TeamAnalyticsView';
import { PlayerComparisonView } from './components/PlayerComparisonView';
import { LoadThresholdsView } from './components/LoadThresholdsView';
import { FutureModulesView } from './components/FutureModulesView';
import { SettingsView } from './components/SettingsView';
import { ErrorBoundary } from './components/ErrorBoundary';

import { DataStore } from './lib/dataStore';
import { Player, SessionMeta, PlayerSessionRecord } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [currentDate, setCurrentDate] = useState<string>(() => {
    const s = DataStore.getSessionsMeta();
    const sorted = [...s].sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0]?.date || '2026-08-11';
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('p4'); // #8 Ryuji Aoki
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data Store State
  const [roster, setRoster] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [records, setRecords] = useState<PlayerSessionRecord[]>([]);

  // Refresh data from DataStore
  const refreshData = () => {
    const currentRoster = DataStore.getRoster();
    const currentSessions = DataStore.getSessionsMeta();
    const currentRecords = DataStore.getPlayerRecords();

    const sortedSessions = [...currentSessions].sort((a, b) => b.date.localeCompare(a.date));

    setRoster(currentRoster);
    setSessions(sortedSessions);
    setRecords(currentRecords);

    // Always default to chronologically latest valid session in the database
    if (sortedSessions.length > 0) {
      const latestDate = sortedSessions[0].date;
      const match = sortedSessions.find((s) => s.date === currentDate);
      if (!match) {
        setCurrentDate(latestDate);
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

  // Show date picker only on views where session date context is relevant
  const showHeaderDatePicker = ['dashboard', 'sessions', 'analytics'].includes(activeTab);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden select-none">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sessionCount={sessions.length}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto min-w-0 bg-zinc-950">
        <Header
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          availableDates={availableDates.length > 0 ? availableDates : ['2026-08-11']}
          onOpenImport={() => setActiveTab('import')}
          showDatePicker={showHeaderDatePicker}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />

        <main className="flex-1 pb-12">
          <ErrorBoundary
            fallbackTitle="Unable to render selected view"
            fallbackDescription="An unexpected error occurred in this section of the application."
            onReset={refreshData}
          >
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

            {activeTab === 'thresholds' && (
              <LoadThresholdsView players={roster} records={records} />
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

            {activeTab === 'games' && <GamesView roster={roster} />}

            {activeTab === 'calendar' && <CalendarView roster={roster} />}

            {activeTab === 'reports' && <ReportGeneratorView roster={roster} />}

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
              <ErrorBoundary
                fallbackTitle="Unable to load this player profile"
                fallbackDescription="An unexpected error occurred while processing this player's metrics."
                onBackToProfiles={() => setSelectedPlayerId(roster[0]?.id || '')}
                onReset={refreshData}
              >
                <PlayerProfileView
                  players={roster}
                  selectedPlayerId={selectedPlayerId}
                  onSelectPlayer={setSelectedPlayerId}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'analytics' && (
              <TeamAnalyticsView sessions={sessions} records={records} />
            )}

            {activeTab === 'comparison' && <PlayerComparisonView players={roster} />}

            {activeTab === 'future_modules' && <FutureModulesView roster={roster} />}

            {activeTab === 'settings' && <SettingsView roster={roster} onRefresh={refreshData} />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
