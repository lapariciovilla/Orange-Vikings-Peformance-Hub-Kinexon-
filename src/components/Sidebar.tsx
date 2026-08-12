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
  Database,
  Flame,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'import'
  | 'sessions'
  | 'players'
  | 'analytics'
  | 'comparison'
  | 'ai_analyst'
  | 'future_modules'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  sessionCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, sessionCount }) => {
  const navItems = [
    { id: 'dashboard', label: "TODAY'S LOAD", icon: LayoutDashboard },
    { id: 'import', label: 'IMPORT KINEXON CSV', icon: Upload, highlight: true },
    { id: 'sessions', label: 'SESSION HISTORY', icon: Calendar, badge: sessionCount },
    { id: 'players', label: 'PLAYER PROFILES', icon: User },
    { id: 'analytics', label: 'TEAM ANALYTICS', icon: LineChart },
    { id: 'comparison', label: 'PLAYER COMPARISON', icon: GitCompare },
    { id: 'ai_analyst', label: 'AI PERFORMANCE ANALYST', icon: Bot },
    { id: 'future_modules', label: 'RPE & S&C MODULES', icon: Activity },
    { id: 'settings', label: 'SETTINGS & EXPORT', icon: Sliders },
  ];

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 text-zinc-300 flex flex-col h-screen shrink-0 sticky top-0 select-none">
      {/* Branding Header */}
      <div className="p-5 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center text-black font-black text-xl shadow-lg shadow-orange-950/40">
            <Flame className="w-5 h-5 text-zinc-950 fill-zinc-950" />
          </div>
          <div>
            <div className="text-orange-500 font-extrabold tracking-wider text-xs uppercase">
              ORANGE VIKINGS
            </div>
            <div className="text-white font-black text-lg tracking-tight leading-none">
              PERFORMANCE HUB
            </div>
          </div>
        </div>
        <div className="mt-3 text-[11px] font-medium text-zinc-400 bg-zinc-900/80 px-2.5 py-1 rounded border border-zinc-800/80 flex items-center justify-between">
          <span>KINEXON MONITORING</span>
          <span className="text-orange-400 font-bold">2026–27</span>
        </div>
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
              onClick={() => setActiveTab(item.id as ActiveTab)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md text-xs font-bold tracking-wide transition-all duration-150 ${
                isActive
                  ? 'bg-orange-600 text-zinc-950 shadow-md shadow-orange-950/30 font-extrabold'
                  : item.highlight
                  ? 'bg-orange-950/40 text-orange-400 border border-orange-800/40 hover:bg-orange-900/40 hover:text-orange-300'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-zinc-950' : item.highlight ? 'text-orange-400' : 'text-zinc-400'}`} />
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
          Strength & Conditioning | Matsuyama
        </div>
      </div>
    </aside>
  );
};
