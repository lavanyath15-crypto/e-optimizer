import React, { useState } from 'react';
import { Settings, HelpCircle, Shield, Sliders, Database, Server, CheckCircle2, LogOut } from 'lucide-react';
import { signOut } from '@backend/auth.js';
import { IllustrativeDataBanner } from './IllustrativeDataBanner';

const SLIDING_PAGE_URL = '/';

interface SettingsSupportViewProps {
  initialTab?: 'settings' | 'support';
}

export const SettingsSupportView: React.FC<SettingsSupportViewProps> = ({
  initialTab = 'settings'
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'support'>(initialTab);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-4 border-b border-[#e0e3e6]/60 pb-3">
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-[#061449] text-white shadow-sm'
              : 'text-[#45464f] hover:bg-[#eceef1]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Plant Settings</span>
        </button>
        <button
          onClick={() => setActiveTab('support')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'support'
              ? 'bg-[#061449] text-white shadow-sm'
              : 'text-[#45464f] hover:bg-[#eceef1]'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Support & Field Service</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-[#FFB703]/10 border border-[#FFB703]/40 rounded-xl text-xs font-bold text-[#8a6100] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>
            Not saved. This form has no backend yet, so nothing was written and these
            values reset on reload.
          </span>
        </div>
      )}

      {activeTab === 'settings' ? (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-4">
            <h3 className="text-base font-bold text-[#061449] flex items-center gap-2">
              <Server className="w-4 h-4 text-[#0f6e8c]" />
              <span>Plant & DCS Gateway Configuration</span>
            </h3>

            <IllustrativeDataBanner>
              These fields are not wired to anything. There is no DCS gateway, no
              historian sync and no carbon accounting integration behind them, and
              saving does not persist. Signing out below is real.
            </IllustrativeDataBanner>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#45464f] mb-1">
                  Plant Facility Name
                </label>
                <input
                  type="text"
                  defaultValue="E-Optimizer Ethanol Plant #42 (Midwest Bioenergy)"
                  className="w-full px-3.5 py-2.5 bg-[#f7f9fc] border border-[#c6c5d1] rounded-lg text-xs text-[#061449] font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#45464f] mb-1">
                  Plant Unique Identifier
                </label>
                <input
                  type="text"
                  defaultValue="ETH-042"
                  disabled
                  className="w-full px-3.5 py-2.5 bg-[#eceef1] border border-[#c6c5d1] rounded-lg text-xs font-mono font-bold text-[#45464f]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#45464f] mb-1">
                  Historian Telemetry Sync Rate
                </label>
                <select className="w-full px-3.5 py-2.5 bg-[#f7f9fc] border border-[#c6c5d1] rounded-lg text-xs text-[#061449] font-medium">
                  <option>High Frequency (1,000 ms continuous)</option>
                  <option>Standard (5,000 ms)</option>
                  <option>Economic (30,000 ms)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#45464f] mb-1">
                  Carbon Accounting Protocol
                </label>
                <select className="w-full px-3.5 py-2.5 bg-[#f7f9fc] border border-[#c6c5d1] rounded-lg text-xs text-[#061449] font-medium">
                  <option>CA LCFS / GREET 2026</option>
                  <option>EPA RFS2 Renewable Fuel Standard</option>
                  <option>EU RED II Compliance</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#061449] hover:bg-[#1e2a5e] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Save Configuration
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-4">
            <h3 className="text-base font-bold text-[#061449] flex items-center gap-2">
              <LogOut className="w-4 h-4 text-[#0f6e8c]" />
              <span>Session</span>
            </h3>
            <p className="text-xs text-[#45464f]">
              Signs you out and takes you back to the login page.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={isSigningOut}
                onClick={async () => {
                  setIsSigningOut(true);
                  await signOut();
                  window.location.href = SLIDING_PAGE_URL;
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-[#fdecea] disabled:opacity-60 border border-[#c0392b] text-[#c0392b] rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{isSigningOut ? 'Signing out...' : 'Log Out'}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="bg-white rounded-xl p-6 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-4">
          <IllustrativeDataBanner>
            The contacts below are placeholders. The name, extension, phone number and
            address are not real and there is no escalation desk behind them.
          </IllustrativeDataBanner>

          <h3 className="text-base font-bold text-[#061449]">
            Industrial Engineering Technical Support
          </h3>
          <p className="text-xs text-[#45464f]">
            24/7 Field Engineering Escalation Desk for Plant ETH-042.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-[#f7f9fc] rounded-xl border border-[#e0e3e6] space-y-1">
              <span className="text-xs font-bold text-[#0f6e8c] block">
                Primary Process Engineer Contact
              </span>
              <div className="text-sm font-bold text-[#061449]">Marcus Vance, PE</div>
              <div className="text-xs text-[#767680]">Ext: 4082 • Direct: +1 (515) 555-0194</div>
            </div>

            <div className="p-4 bg-[#f7f9fc] rounded-xl border border-[#e0e3e6] space-y-1">
              <span className="text-xs font-bold text-[#2D6A4F] block">
                DCS & Instrumentation Rapid Response
              </span>
              <div className="text-sm font-bold text-[#061449]">DeltaV Automation Desk</div>
              <div className="text-xs text-[#767680]">desk@e-optimizer-industrial.internal</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
