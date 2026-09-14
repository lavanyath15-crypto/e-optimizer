import React from 'react';
import { ASSETS } from '../data/mockData';
import { useOperator } from '../hooks/useOperator';
import { Search, Settings, Menu, RefreshCw, Mic, MicOff } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleMobileMenu: () => void;
  onOpenSettings: () => void;
  onQuickRefresh?: () => void;
  isRefreshing?: boolean;
  wakeWordSupported?: boolean;
  wakeWordEnabled?: boolean;
  /** True only while the background recogniser actually holds the microphone. */
  wakeWordActive?: boolean;
  onToggleWakeWord?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onToggleMobileMenu,
  onOpenSettings,
  onQuickRefresh,
  isRefreshing = false,
  wakeWordSupported = false,
  wakeWordEnabled = false,
  wakeWordActive = false,
  onToggleWakeWord
}) => {
  const operator = useOperator();

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 h-16 flex justify-between items-center px-4 md:px-8 z-40 bg-white/90 backdrop-blur-md border-b border-[#e0e3e6]/70 shadow-xs">
      {/* Mobile Brand & Hamburger */}
      <div className="md:hidden flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-1.5 rounded-lg text-[#191c1e] hover:bg-[#eceef1]"
          aria-label="Open navigation"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-[#061449]/10">
            <img
              src={ASSETS.brandLogo}
              alt="E-Optimizer"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="font-extrabold text-base text-[#061449]">
            E-Optimizer
          </span>
        </div>
      </div>

      {/* Desktop Search Bar */}
      <div className="hidden md:flex items-center ml-auto">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#767680]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search reports, metrics, sensors..."
            className="pl-10 pr-4 py-2 bg-[#eceef1]/80 hover:bg-[#eceef1] focus:bg-white rounded-full border border-transparent focus:border-[#3d93ad]/40 focus:ring-2 focus:ring-[#3d93ad]/20 text-sm text-[#191c1e] w-64 focus:w-84 transition-all outline-none"
          />
        </div>
      </div>

      {/* Trailing Actions */}
      <div className="flex items-center gap-3 md:gap-5 ml-4 md:ml-6">
        {/* Wake word state. Lives here rather than only in the assistant,
            because the assistant is shut whenever the wake word is listening,
            so its own badge is invisible exactly when it matters. */}
        {wakeWordSupported && onToggleWakeWord && (
          <button
            onClick={onToggleWakeWord}
            aria-pressed={wakeWordEnabled}
            title={
              wakeWordEnabled
                ? wakeWordActive
                  ? 'Listening for "Hey Optimizer". Click to turn off.'
                  : 'Wake word on, starting up. Click to turn off.'
                : 'Wake word off. Click to listen for "Hey Optimizer".'
            }
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold transition-colors cursor-pointer ${
              wakeWordEnabled
                ? 'bg-[#2D6A4F]/10 border-[#2D6A4F]/25 text-[#2D6A4F]'
                : 'bg-[#eceef1] border-[#c6c5d1] text-[#767680]'
            }`}
          >
            {wakeWordEnabled ? (
              <span className="relative flex h-2 w-2">
                {wakeWordActive && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2D6A4F] opacity-75"></span>
                )}
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2D6A4F]"></span>
              </span>
            ) : (
              <MicOff className="w-3.5 h-3.5" />
            )}
            {wakeWordEnabled && <Mic className="w-3.5 h-3.5" />}
            <span className="uppercase tracking-wider">
              {wakeWordEnabled ? (wakeWordActive ? 'Listening' : 'Starting') : 'Voice off'}
            </span>
          </button>
        )}

        {/* Quick Refresh Telemetry button */}
        {onQuickRefresh && (
          <button
            onClick={onQuickRefresh}
            title="Sync Live Telemetry"
            className={`p-2 text-[#45464f] hover:text-[#061449] hover:bg-[#eceef1] rounded-lg transition-colors cursor-pointer ${
              isRefreshing ? 'animate-spin text-[#3d93ad]' : ''
            }`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {/* Desktop Settings Icon */}
        <button
          onClick={onOpenSettings}
          className="hidden md:block p-2 text-[#45464f] hover:text-[#061449] hover:bg-[#eceef1] rounded-lg transition-colors cursor-pointer"
          title="Plant Preferences"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Mobile Operator Avatar */}
        <button
          onClick={onOpenSettings}
          className="md:hidden w-8 h-8 rounded-full bg-[#0f6e8c] border border-[#061449]/20 flex items-center justify-center"
          title={operator ? `${operator.name} (${operator.email})` : 'Operator profile'}
        >
          <span className="text-[11px] font-extrabold text-white">
            {operator?.initials ?? ''}
          </span>
        </button>
      </div>
    </header>
  );
};
