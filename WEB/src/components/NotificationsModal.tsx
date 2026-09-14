import React from 'react';
import { Bell, X } from 'lucide-react';
import { usePlantInput } from '../hooks/usePlantInput';
import { deriveAlarms } from '../lib/plantAlarms';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Where to send the operator to fix a reading. */
  onNavigateToReadings: () => void;
}

/**
 * The bell popover, raised from the operator's own readings.
 *
 * It listed the same three invented alarms Overview did, so the dashboard had
 * two places telling an operator about a centrifuge bearing that no part of this
 * project measures.
 */
export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onNavigateToReadings
}) => {
  const { readings } = usePlantInput();
  const alarms = deriveAlarms(readings);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[105] flex justify-end p-4 md:p-6 pointer-events-none">
      {/* Click-away backdrop */}
      <div
        className="fixed inset-0 bg-transparent pointer-events-auto"
        onClick={onClose}
      />

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-[#e0e3e6] p-4 flex flex-col pointer-events-auto animate-in slide-in-from-top-4 duration-200 mt-12 mr-2">
        <div className="flex items-center justify-between pb-3 border-b border-[#e0e3e6]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#061449]" />
            <h4 className="font-bold text-sm text-[#061449]">Plant Notifications</h4>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#767680] hover:text-[#ba1a1a] rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-2 space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
          {alarms.length === 0 && (
            <p className="text-xs text-[#2D6A4F] p-3">
              Nothing outstanding. Every reading you have entered is inside its band.
            </p>
          )}

          {alarms.map((alarm) => (
            <button
              key={alarm.id}
              type="button"
              onClick={() => {
                onNavigateToReadings();
                onClose();
              }}
              className="w-full text-left p-3 bg-[#f7f9fc] hover:bg-[#eceef1] rounded-xl text-xs space-y-1 border border-[#e0e3e6] cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between font-bold gap-2">
                <span
                  className={
                    alarm.severity === 'critical' ? 'text-[#ba1a1a]' : 'text-[#8a6100]'
                  }
                >
                  {alarm.title}
                </span>
                <span className="text-[10px] font-mono text-[#767680] shrink-0">
                  {alarm.currentValue}
                </span>
              </div>
              <p className="text-[11px] text-[#45464f]">
                {alarm.location} &middot; band {alarm.threshold}
              </p>
            </button>
          ))}
        </div>

        <div className="pt-2 border-t border-[#e0e3e6] flex justify-between items-center text-xs">
          <span className="text-[#767680] font-mono">Plant: ETH-042</span>
          <span className="text-[#767680]">{alarms.length} outside band</span>
        </div>
      </div>
    </div>
  );
};
