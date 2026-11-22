import React, { useState } from 'react';
import { Lock, Unlock } from 'lucide-react';

interface AdminLockProps {
  unlocked: boolean;
  onUnlock: () => void;
  onLock: () => void;
  title?: string;
  children: React.ReactNode;
}

export const AdminLock: React.FC<AdminLockProps> = ({
  unlocked,
  onUnlock,
  onLock,
  title = 'Administrator Settings',
  children,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Stech2026') {
      setError(false);
      setPassword('');
      onUnlock();
    } else {
      setError(true);
    }
  };

  if (!unlocked) {
    return (
      <div className="store-card border border-slate-200 p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-[10px] bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold">{title}</h3>
            <p className="text-sm text-slate-600 mt-0.5">
              Enter admin password to unlock Shop Profile, Staff Management, Data Restore, Clear Data, and Theme Delete.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md">
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(false);
            }}
            placeholder="Enter admin password"
            className="flex-1 min-h-[48px] px-3.5 border border-slate-300 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            className="min-h-[48px] px-5 store-primary-btn font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Unlock className="w-4 h-4" />
            <span>Unlock Admin</span>
          </button>
        </form>
        {error && <p className="text-xs font-medium text-red-700 mt-2">Incorrect password.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-[10px] px-4 py-3">
        <div className="flex items-center gap-2 text-emerald-900 text-sm font-semibold">
          <Unlock className="w-4 h-4 text-emerald-700" />
          <span>Admin Controls Unlocked</span>
        </div>
        <button
          type="button"
          onClick={onLock}
          className="min-h-[40px] px-3 py-1.5 bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold rounded-[8px] hover:bg-emerald-100 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Lock Now
        </button>
      </div>
      {children}
    </div>
  );
};
