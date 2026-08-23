import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { SessionMeta } from '../types';

interface SessionCalendarPickerProps {
  sessions: SessionMeta[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  label?: string;
  inline?: boolean;
}

export const SessionCalendarPicker: React.FC<SessionCalendarPickerProps> = ({
  sessions,
  selectedDate,
  onSelectDate,
  label,
  inline = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Parse initial date or default to current / first session date
  const parsedSelected = selectedDate ? new Date(selectedDate) : new Date();
  const validSelectedDate = isNaN(parsedSelected.getTime()) ? new Date() : parsedSelected;

  const [currentYear, setCurrentYear] = useState<number>(validSelectedDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(validSelectedDate.getMonth()); // 0 - 11

  // Map of sessions by date YYYY-MM-DD
  const sessionMap = React.useMemo(() => {
    const map = new Map<string, SessionMeta[]>();
    sessions.forEach((s) => {
      const existing = map.get(s.date) || [];
      map.set(s.date, [...existing, s]);
    });
    return map;
  }, [sessions]);

  // Calendar calculations
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const formatPad = (num: number) => String(num).padStart(2, '0');

  const selectedSessionInfo = React.useMemo(() => {
    return sessions.find((s) => s.date === selectedDate);
  }, [sessions, selectedDate]);

  const calendarGrid = React.useMemo(() => {
    const cells = [];
    // Padding for days before start of month
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ type: 'empty' as const, key: `empty-${i}` });
    }
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${formatPad(currentMonth + 1)}-${formatPad(day)}`;
      const daySessions = sessionMap.get(dateStr) || [];
      const isSelected = dateStr === selectedDate;

      cells.push({
        type: 'day' as const,
        key: dateStr,
        dateStr,
        dayNumber: day,
        daySessions,
        isSelected,
      });
    }
    return cells;
  }, [currentYear, currentMonth, firstDayOfWeek, daysInMonth, sessionMap, selectedDate]);

  const renderCalendarContent = () => (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-2xl w-80 text-zinc-100 select-none">
      {/* Calendar Month Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
          title="Previous Month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="font-extrabold text-sm text-orange-400 uppercase tracking-wide">
          {monthNames[currentMonth]} {currentYear}
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
          title="Next Month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-zinc-500 uppercase mb-2">
        <span>Su</span>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarGrid.map((cell) => {
          if (cell.type === 'empty') {
            return <div key={cell.key} className="h-9" />;
          }

          const hasPractice = cell.daySessions.some((s) => s.session_type !== 'Game');
          const hasGame = cell.daySessions.some((s) => s.session_type === 'Game');
          const hasSessions = cell.daySessions.length > 0;

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => {
                onSelectDate(cell.dateStr);
                setIsOpen(false);
              }}
              className={`h-9 rounded-lg flex flex-col items-center justify-center relative transition-all text-xs font-bold ${
                cell.isSelected
                  ? 'bg-orange-600 text-zinc-950 ring-2 ring-orange-400 font-black shadow-lg scale-105 z-10'
                  : hasSessions
                  ? 'bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700/80'
                  : 'text-zinc-600 hover:bg-zinc-900/50 hover:text-zinc-300'
              }`}
            >
              <span>{cell.dayNumber}</span>

              {/* Session Badges / Dots */}
              {hasSessions && !cell.isSelected && (
                <div className="flex items-center space-x-0.5 mt-0.5">
                  {hasGame && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" title="Game Session" />}
                  {hasPractice && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" title="Practice Session" />}
                </div>
              )}

              {cell.isSelected && (
                <Check className="w-3 h-3 text-zinc-950 font-black absolute -top-1 -right-1 bg-amber-400 rounded-full p-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400 font-semibold">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          <span>Practice</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span>Game Match</span>
        </div>
        <div className="text-zinc-500">
          {sessionMap.size} Dates Monitored
        </div>
      </div>
    </div>
  );

  if (inline) {
    return renderCalendarContent();
  }

  return (
    <div className="relative inline-block text-left">
      {label && <label className="block text-[11px] font-bold text-zinc-400 mb-1 uppercase">{label}</label>}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-zinc-950 border border-zinc-700 hover:border-orange-500/80 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-2 transition-all shadow-md group"
      >
        <CalendarIcon className="w-4 h-4 text-orange-500 group-hover:scale-110 transition-transform" />
        <span className="text-orange-400">{selectedDate || 'Select Date'}</span>
        {selectedSessionInfo && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-black ${
            selectedSessionInfo.session_type === 'Game' ? 'bg-purple-900/80 text-purple-200' : 'bg-orange-950 text-orange-300'
          }`}>
            {selectedSessionInfo.session_type}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 z-50">
            {renderCalendarContent()}
          </div>
        </>
      )}
    </div>
  );
};
