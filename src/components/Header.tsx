import React from 'react';
import { Calendar, Plus, Menu, X } from 'lucide-react';

interface HeaderProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  availableDates: string[];
  onOpenImport: () => void;
  showDatePicker?: boolean;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentDate,
  onDateChange,
  availableDates,
  onOpenImport,
  showDatePicker = true,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
}) => {
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
        {/* Date Selector - Only shown on relevant views like Dashboard / Sessions */}
        {showDatePicker && (
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300">
            <Calendar className="w-3.5 h-3.5 text-orange-500 mr-1.5 shrink-0" />
            <span className="text-zinc-500 font-medium mr-1.5 hidden lg:inline">Session Date:</span>
            <select
              id="header-date-selector"
              value={currentDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
            >
              {availableDates.map((d) => (
                <option key={d} value={d} className="bg-zinc-900 text-white">
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Quick Import Button */}
        <button
          id="header-import-button"
          onClick={onOpenImport}
          className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span className="hidden sm:inline">IMPORT KINEXON</span>
          <span className="sm:hidden">IMPORT</span>
        </button>
      </div>
    </header>
  );
};
