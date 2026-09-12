import React from 'react';
import { TabType } from '../types';
import { useOperator } from '../hooks/useOperator';
import {
  LayoutDashboard,
  Cpu,
  Leaf,
  BrainCircuit,
  Sparkles,
  BarChart3,
  FileText,
  Bot,
  Settings,
  HelpCircle,
  X
} from 'lucide-react';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenAiAssistant: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAiAssistant,
  isOpenMobile,
  onCloseMobile
}) => {
  const operator = useOperator();

  const navItems: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    // Order follows the data: readings go in at Process Monitor, then Carbon and
    // Analytics show what they mean, then AI Optimization and Recommendations
    // say what to do about it.
    { id: 'process-monitor', label: 'Process Monitor', icon: <Cpu className="w-5 h-5" /> },
    { id: 'carbon', label: 'Carbon & CO2e', icon: <Leaf className="w-5 h-5" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'ai-optimization', label: 'AI Optimization', icon: <BrainCircuit className="w-5 h-5" /> },
    { id: 'recommendations', label: 'Recommendations', icon: <Sparkles className="w-5 h-5" /> },
    // Overview reads as a summary of the screens above it, so it sits after
    // them rather than first, with Reports last.
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-5 h-5" /> }
  ];

  const handleNavClick = (tab: TabType) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-[#061449]/60 backdrop-blur-xs z-50 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-[#061449] border-r border-[#384378]/20 shadow-2xl flex flex-col py-6 z-50 transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header with signed-in operator */}
        <div className="px-6 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#0f6e8c] shrink-0 border border-white/20 shadow-sm ring-2 ring-[#0f6e8c]/30 flex items-center justify-center">
              <span className="text-sm font-extrabold tracking-tight text-white">EO</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-lg leading-tight text-white tracking-tight">
                E-Optimizer
              </h1>
              <p
                className="text-[11px] font-bold tracking-wider text-[#b9c3ff] mt-0.5 truncate"
                title={operator?.name}
              >
                {operator?.name ?? ''}
              </p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="md:hidden text-[#8793cd] hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* The model behind the figures. A pulsing "Grid Synced · 4.85 kGal/h"
            used to sit here, connected to nothing. */}
        <div className="mx-4 mb-4 px-3.5 py-2 rounded-lg bg-[#1e2a5e]/70 border border-[#384378]/40 flex items-center justify-between text-xs">
          <span className="font-semibold text-white/90 text-[11px]">Consumption model</span>
          <span className="text-[11px] font-mono text-[#dde1ff]">in-browser</span>
        </div>

        {/* Main Navigation items */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 text-left ${
                  isActive
                    ? 'bg-[#3d93ad] text-white shadow-md shadow-[#3d93ad]/20 font-bold'
                    : 'text-[#8793cd] hover:text-white hover:bg-[#1e2a5e]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-white' : 'text-[#8793cd]'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${
                      isActive
                        ? 'bg-white text-[#0f6e8c]'
                        : 'bg-[#ba1a1a] text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="px-4 mt-auto pt-3 border-t border-[#384378]/30 space-y-1.5">
          {/* AI Assistant Button */}
          <button
            onClick={() => {
              onOpenAiAssistant();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-[#0f6e8c] to-[#3d93ad] hover:from-[#0b5670] hover:to-[#0f6e8c] text-white rounded-lg font-bold text-sm shadow-md transition-all duration-150 mb-3 active:scale-[0.98] cursor-pointer group"
          >
            <Bot className="w-4 h-4 transition-transform group-hover:rotate-12" />
            <span>AI Assistant</span>
          </button>

          <button
            onClick={() => handleNavClick('settings')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              currentTab === 'settings'
                ? 'bg-[#1e2a5e] text-white'
                : 'text-[#8793cd] hover:text-white hover:bg-[#1e2a5e]/40'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>

          <button
            onClick={() => handleNavClick('support')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              currentTab === 'support'
                ? 'bg-[#1e2a5e] text-white'
                : 'text-[#8793cd] hover:text-white hover:bg-[#1e2a5e]/40'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Support</span>
          </button>
        </div>
      </aside>
    </>
  );
};
