import React from 'react';
import { Calendar, RefreshCw, Plus, Flame } from 'lucide-react';

interface HeaderProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  availableDates: string[];
  onOpenImport: () => void;
  onResetData?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDate,
  onDateChange,
  availableDates,
  onOpenImport,
}) => {
  return (
    <header className="bg-zinc-900/90 border-b border-zinc-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-10 backdrop-blur-md">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <span className="text-orange-500 font-extrabold text-xs tracking-widest uppercase">
            EHIME ORANGE VIKINGS
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-white font-bold text-sm tracking-tight">
            2026–2027 SEASON
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Date Selector */}
        <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-300">
          <Calendar className="w-3.5 h-3.5 text-orange-500 mr-2" />
          <span className="text-zinc-500 font-medium mr-2">Session Date:</span>
          <select
            id="header-date-selector"
            value={currentDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
          >
            {availableDates.map((d) => (
              <option key={d} value={d} className="bg-zinc-900 text-white">
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Action Button */}
        <button
          id="header-import-button"
          onClick={onOpenImport}
          className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-extrabold px-3.5 py-1.5 rounded-md text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>IMPORT KINEXON</span>
        </button>
      </div>
    </header>
  );
};
