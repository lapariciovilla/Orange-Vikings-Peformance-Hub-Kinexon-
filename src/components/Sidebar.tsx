import React from 'react';
import {
  LayoutDashboard,
  Upload,
  Calendar,
  User,
  LineChart,
  GitCompare,
  Bot,
  Activity,
  Sliders,
  X,
  Trophy,
  CalendarDays,
  FileText,
  Target,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'thresholds'
  | 'import'
  | 'games'
  | 'calendar'
  | 'reports'
  | 'sessions'
  | 'players'
  | 'analytics'
  | 'comparison'
  | 'future_modules'
  | 'settings';


interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  sessionCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  sessionCount,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const navItems = [
    { id: 'dashboard', label: "TODAY'S LOAD", icon: LayoutDashboard },
    { id: 'thresholds', label: 'LOAD THRESHOLDS', icon: Target, highlight: true },
    { id: 'import', label: 'IMPORT CSV', icon: Upload },
    { id: 'games', label: 'GAME LOAD', icon: Trophy },
    { id: 'calendar', label: 'MONTHLY CALENDAR', icon: CalendarDays },
    { id: 'reports', label: 'S&C REPORT GENERATOR', icon: FileText },
    { id: 'sessions', label: 'SESSION HISTORY', icon: Calendar, badge: sessionCount },
    { id: 'players', label: 'PLAYER PROFILES', icon: User },
    { id: 'analytics', label: 'TEAM ANALYTICS', icon: LineChart },
    { id: 'comparison', label: 'PLAYER COMPARISON', icon: GitCompare },
    { id: 'future_modules', label: 'RPE LOGS & TRENDS', icon: Activity },
    { id: 'settings', label: 'SETTINGS & EXPORT', icon: Sliders },
  ];

  const sidebarContent = (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 text-zinc-300 flex flex-col h-full shrink-0 select-none">
      {/* Branding Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img
            src="https://i.postimg.cc/QxTv6dV1/icon-ogp.webp"
            alt="Orange Vikings Logo"
            referrerPolicy="no-referrer"
            className="w-10 h-10 object-contain rounded-lg bg-zinc-900 p-1 border border-orange-500/40 shadow-lg shadow-orange-950/50"
          />
          <div>
            <div className="text-orange-500 font-extrabold tracking-wider text-[10px] uppercase">
              ORANGE VIKINGS
            </div>
            <div className="text-white font-black text-base tracking-tight leading-none">
              PERFORMANCE HUB
            </div>
            <div className="text-[10px] text-zinc-400 font-bold mt-0.5">
              2026–27 PERFORMANCE S&C
            </div>
          </div>
        </div>

        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden text-zinc-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => {
                setActiveTab(item.id as ActiveTab);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-150 ${
                isActive
                  ? 'bg-orange-600 text-zinc-950 shadow-md shadow-orange-950/30 font-extrabold'
                  : item.highlight
                  ? 'bg-orange-950/40 text-orange-400 border border-orange-800/40 hover:bg-orange-900/40 hover:text-orange-300'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-zinc-950' : item.highlight ? 'text-orange-400' : 'text-zinc-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-zinc-950 text-orange-400' : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User / Location Footer */}
      <div className="p-3.5 border-t border-zinc-800/80 bg-zinc-900/40 text-[11px]">
        <div className="flex items-center space-x-2 text-zinc-300 font-semibold">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="truncate">Luis Aparicio Villa</span>
        </div>
        <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
          Strength & Conditioning Coach
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-screen sticky top-0 shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="relative w-64 max-w-xs z-10 h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
