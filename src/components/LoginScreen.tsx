import React, { useState } from 'react';
import { HardDrive, Mail, ShieldCheck, UserPlus, Wrench } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BRAND_SUBTITLE } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, createFirebaseAccount, continueOffline } = useStore();
  const [busy, setBusy] = useState<'google' | 'email' | 'offline' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [emailMode, setEmailMode] = useState<'none' | 'signin' | 'create'>('none');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogle = async () => {
    setBusy('google');
    setErr(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Google Sign-In failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setErr('Please enter a valid email and a password of at least 6 characters.');
      return;
    }
    setBusy('email');
    setErr(null);
    try {
      if (emailMode === 'create') {
        await createFirebaseAccount(email, password, displayName);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Authentication failed.';
      if (msg.includes('operation-not-allowed')) {
        setErr(
          'Email/Password sign-in is not enabled in Firebase Console yet. Enable Email/Password under Authentication → Sign-in method, or use Sign in with Google above.'
        );
      } else {
        setErr(msg);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleOffline = async () => {
    setBusy('offline');
    setErr(null);
    try {
      await continueOffline();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50 text-slate-900">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[10px] shadow-sm overflow-hidden">
        <div className="bg-[#1E293B] text-white px-6 py-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-[10px] bg-[#1D4ED8] flex items-center justify-center shadow-sm">
            <Wrench className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Store</h1>
          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{BRAND_SUBTITLE}</p>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-slate-900">Workshop &amp; Spare Parts POS</h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Sign in or create a Firebase account to sync across Android &amp; PC, or work offline anytime.
            </p>
          </div>

          {err && (
            <div className="p-3 text-xs sm:text-sm bg-red-50 border border-red-200 text-red-800 rounded-[10px]" role="alert">
              {err}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy !== null}
            className="w-full min-h-[48px] px-4 py-3 bg-[#1D4ED8] hover:bg-blue-800 text-white font-semibold text-sm rounded-[10px] flex items-center justify-center gap-3 transition-colors disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
              />
            </svg>
            <span>{busy === 'google' ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>

          {/* Email / Password Firebase Account Creation & Sign-In */}
          {emailMode === 'none' ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setErr(null);
                  setEmailMode('create');
                }}
                className="min-h-[44px] px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-[10px] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-blue-700" />
                <span>Create Account</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setErr(null);
                  setEmailMode('signin');
                }}
                className="min-h-[44px] px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-[10px] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Mail className="w-4 h-4 text-slate-600" />
                <span>Email Sign In</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="bg-slate-50 border border-slate-200 rounded-[10px] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  {emailMode === 'create' ? 'Create Firebase Account' : 'Sign in with Email'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode('none');
                    setErr(null);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              {emailMode === 'create' && (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Shop or Owner Name"
                  className="w-full min-h-[42px] px-3 bg-white border border-slate-300 rounded-[8px] text-sm"
                />
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full min-h-[42px] px-3 bg-white border border-slate-300 rounded-[8px] text-sm"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 6 characters)"
                className="w-full min-h-[42px] px-3 bg-white border border-slate-300 rounded-[8px] text-sm"
              />
              <button
                type="submit"
                disabled={busy !== null}
                className="w-full min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-[8px] cursor-pointer disabled:opacity-60"
              >
                {busy === 'email'
                  ? 'Please wait...'
                  : emailMode === 'create'
                  ? 'Create Firebase Account'
                  : 'Sign In'}
              </button>
            </form>
          )}

          <div className="relative py-0.5 flex items-center">
            <div className="flex-grow border-t border-slate-200" />
            <span className="px-3 text-xs font-medium text-slate-400">or</span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          <button
            type="button"
            onClick={handleOffline}
            disabled={busy !== null}
            className="w-full min-h-[48px] px-4 py-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-300 rounded-[10px] flex items-center justify-center gap-2.5 transition-colors disabled:opacity-60 cursor-pointer"
          >
            <HardDrive className="w-4 h-4 text-slate-600" />
            <span>{busy === 'offline' ? 'Opening local storage...' : 'Use Offline (Local Browser Storage)'}</span>
          </button>

          <PWAInstallButton variant="card" />

          <div className="pt-1 flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Online cloud sync &amp; offline local storage ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};
