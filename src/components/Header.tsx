import React from 'react';
import { Plus, Menu, X } from 'lucide-react';
import { SessionCalendarPicker } from './SessionCalendarPicker';
import { DataStore } from '../lib/dataStore';

interface HeaderProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  availableDates: string[];
  onOpenImport: () => void;
  showDatePicker?: boolean;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  isSupabaseActive?: boolean;
  onOpenDatabaseSettings?: () => void;
  userEmail?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentDate,
  onDateChange,
  availableDates,
  onOpenImport,
  showDatePicker = true,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
  isSupabaseActive = false,
  onOpenDatabaseSettings,
  userEmail,
}) => {
  const sessions = DataStore.getSessionsMeta();

  return (
    <header className="bg-zinc-900/95 border-b border-zinc-800 px-4 md:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-20 backdrop-blur-md">
      <div className="flex items-center space-x-3">
        {/* Mobile Menu Button */}
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden text-zinc-300 hover:text-white p-1.5 rounded-lg bg-zinc-800 border border-zinc-700"
            aria-label="Toggle Navigation"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5 text-orange-500" /> : <Menu className="w-5 h-5 text-orange-500" />}
          </button>
        )}

        <div className="flex items-center space-x-2.5">
          <img
            src="https://i.postimg.cc/QxTv6dV1/icon-ogp.webp"
            alt="Orange Vikings Logo"
            referrerPolicy="no-referrer"
            className="w-7 h-7 object-contain rounded-md bg-zinc-950 p-0.5 border border-orange-500/30"
          />
          <div className="flex items-center space-x-1.5">
            <span className="text-orange-500 font-extrabold text-[11px] md:text-xs tracking-wider uppercase">
              ORANGE VIKINGS
            </span>
            <span className="text-zinc-600 hidden sm:inline">/</span>
            <span className="text-white font-bold text-xs tracking-tight hidden sm:inline">
              2026–2027
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2 md:space-x-3">
        {/* Supabase Status Pill */}
        {onOpenDatabaseSettings && (
          <button
            onClick={onOpenDatabaseSettings}
            title={isSupabaseActive ? "Connected to Supabase PostgreSQL (Live)" : "Supabase: Configured (Click to inspect)"}
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border transition-colors bg-zinc-950/80 hover:bg-zinc-800 border-zinc-700"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isSupabaseActive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="text-zinc-300">
              {isSupabaseActive ? 'SUPABASE LIVE' : 'SUPABASE CONNECTED'}
            </span>
            {userEmail && (
              <span className="text-zinc-500 max-w-[100px] truncate hidden md:inline">
                ({userEmail.split('@')[0]})
              </span>
            )}
          </button>
        )}

        {/* Calendar Session Date Selector */}
        {showDatePicker && (
          <SessionCalendarPicker
            sessions={sessions}
            selectedDate={currentDate}
            onSelectDate={(date) => onDateChange(date)}
          />
        )}

        {/* Quick Import Button */}
        <button
          id="header-import-button"
          onClick={onOpenImport}
          className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span className="hidden sm:inline">IMPORT CSV</span>
          <span className="sm:hidden">IMPORT</span>
        </button>
      </div>
    </header>
  );
};
