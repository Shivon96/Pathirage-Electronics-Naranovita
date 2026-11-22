import React, { useState } from 'react';
import { Download, MonitorSmartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'card' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  const buttonClass =
    variant === 'sidebar'
      ? 'w-full min-h-[42px] px-3 rounded-[10px] bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer'
      : variant === 'card'
      ? 'w-full min-h-[44px] px-4 border border-blue-600 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-[10px] text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer'
      : 'min-h-[40px] px-3 border border-blue-600 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-[8px] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer';

  return (
    <>
      <button type="button" onClick={() => void handleClick()} className={buttonClass}>
        <Download className="w-4 h-4 shrink-0" />
        <span>{isInstallable ? 'Install App' : 'Install Android / PC'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-[10px] border border-slate-200 shadow-xl overflow-hidden text-slate-900">
            <div className="bg-[#1E293B] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="w-5 h-5" />
                <h3 className="text-base font-bold">Install Store on Android &amp; PC</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-[8px] hover:bg-slate-700 cursor-pointer"
                aria-label="Close install instructions"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm text-slate-700">
              {isIOS ? (
                <div className="space-y-1.5">
                  <p className="font-bold text-slate-900">iPhone / iPad (Safari):</p>
                  <p>1. Tap the <strong>Share</strong> icon in Safari.</p>
                  <p>2. Scroll down and tap <strong>Add to Home Screen</strong>.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">Android (Chrome / Edge):</p>
                    <p>Open the browser menu (⋮) and tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-slate-200">
                    <p className="font-bold text-slate-900">Windows / Mac / Linux PC (Chrome / Edge):</p>
                    <p>Click the <strong>Install Store</strong> icon in the right side of the address bar, or open menu → <strong>Cast, save, and share → Install page as app</strong>.</p>
                  </div>
                  <p className="text-xs text-slate-500 pt-1">
                    Note: If previewing inside an embedded frame, open the hosted app URL directly in a browser tab for one-tap installation.
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full min-h-[44px] mt-2 store-primary-btn font-semibold text-sm cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
