import React, { useRef, useState } from 'react';
import {
  Cloud,
  Download,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import { AdminLock } from '../components/AdminLock';
import { ThemeEditor } from '../components/ThemeEditor';
import { useStore } from '../context/StoreContext';
import type { StaffRole, StoreBackupPayload } from '../types';
import { makeSafeId } from '../utils/validation';

export const SettingsPage: React.FC = () => {
  const {
    authMode,
    user,
    snapshot,
    isSyncing,
    lastCloudSyncMs,
    signInWithGoogle,
    signOutUser,
    updateShopProfile,
    upsertStaff,
    deleteStaff,
    backupNow,
    restoreFromCloud,
    exportJsonBackup,
    importJsonBackup,
    clearShopData,
  } = useStore();

  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  // Shop Profile state
  const p = snapshot.shopProfile;
  const [shopName, setShopName] = useState(p.shopName);
  const [shopPhone, setShopPhone] = useState(p.shopPhone);
  const [shopAddress, setShopAddress] = useState(p.shopAddress);
  const [currencySymbol, setCurrencySymbol] = useState(p.currencySymbol);
  const [receiptFooter, setReceiptFooter] = useState(p.receiptFooter);

  // Staff Form
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<StaffRole>('Technician');
  const [staffPhone, setStaffPhone] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateShopProfile({
      shopName: shopName.trim() || 'Store',
      shopPhone: shopPhone.trim(),
      shopAddress: shopAddress.trim(),
      currencySymbol: currencySymbol.trim() || 'Rs.',
      receiptFooter: receiptFooter.trim(),
    });
    flash('Shop profile saved');
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim()) return;
    await upsertStaff({
      id: makeSafeId('staff'),
      name: staffName.trim(),
      role: staffRole,
      phone: staffPhone.trim(),
      active: true,
    });
    setStaffName('');
    setStaffPhone('');
    flash('Staff member added');
  };

  const handleExportBackup = () => {
    const payload = exportJsonBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `store-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('JSON backup downloaded');
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as StoreBackupPayload;
      if (!parsed.snapshot || !parsed.snapshot.shopProfile) throw new Error('Invalid backup format');
      await importJsonBackup(parsed);
      flash('Backup restored successfully');
    } catch {
      flash('Invalid backup JSON file');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-[10px] text-sm font-semibold">
          {notice}
        </div>
      )}

      {/* Cloud Sync & Account */}
      <section className="store-card border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-blue-50 text-blue-700 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {authMode === 'google' ? 'Google Cloud Sync Active' : 'Offline Local Storage Mode'}
              </h2>
              <p className="text-xs text-slate-600">
                {authMode === 'google'
                  ? `Signed in as ${user?.email || 'Google User'} · Last sync: ${
                      lastCloudSyncMs ? new Date(lastCloudSyncMs).toLocaleString() : 'Live'
                    }`
                  : 'Data is saved in local browser storage. Sign in with Google to sync across devices.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {authMode === 'google' ? (
              <>
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={async () => {
                    await backupNow();
                    flash('Backed up to Cloud Firestore');
                  }}
                  className="min-h-[42px] px-4 store-primary-btn text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isSyncing ? 'Syncing...' : 'Backup Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="min-h-[42px] px-3.5 border border-slate-300 bg-white hover:bg-slate-50 rounded-[8px] text-xs sm:text-sm font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="min-h-[42px] px-4 store-primary-btn text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  Sign in with Google
                </button>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="min-h-[42px] px-3.5 border border-slate-300 bg-white hover:bg-slate-50 rounded-[8px] text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
                >
                  Exit Offline
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Theme Selector & Custom Theme Editor */}
      <ThemeEditor adminUnlocked={adminUnlocked} onRequireAdmin={() => flash('Unlock Admin below to delete themes')} />

      {/* Admin-Locked Settings */}
      <AdminLock
        unlocked={adminUnlocked}
        onUnlock={() => setAdminUnlocked(true)}
        onLock={() => setAdminUnlocked(false)}
      >
        {/* 1. Shop Profile */}
        <form onSubmit={handleSaveProfile} className="store-card border border-slate-200 p-5 space-y-4">
          <h3 className="text-base font-bold text-slate-900">Shop Profile &amp; Receipt Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Shop Name</label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Shop Phone</label>
              <input
                type="text"
                value={shopPhone}
                onChange={(e) => setShopPhone(e.target.value)}
                className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Shop Address</label>
              <input
                type="text"
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
                className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Currency Symbol</label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">58mm Receipt Footer</label>
            <input
              type="text"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
            />
          </div>
          <button type="submit" className="min-h-[44px] px-5 store-primary-btn text-sm font-semibold cursor-pointer">
            Save Shop Profile
          </button>
        </form>

        {/* 2. Staff Management */}
        <div className="store-card border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-700" />
            <h3 className="text-base font-bold text-slate-900">Staff Management</h3>
          </div>

          <form onSubmit={handleAddStaff} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Staff Name"
              className="min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
            />
            <select
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as StaffRole)}
              className="min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm bg-white"
            >
              <option value="Technician">Technician</option>
              <option value="Cashier">Cashier</option>
              <option value="Admin">Admin</option>
            </select>
            <input
              type="tel"
              value={staffPhone}
              onChange={(e) => setStaffPhone(e.target.value)}
              placeholder="Phone"
              className="min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
            />
            <button
              type="submit"
              className="min-h-[44px] px-4 store-primary-btn text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff</span>
            </button>
          </form>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-[8px]">
            {snapshot.staff.map((st) => (
              <div key={st.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-bold text-slate-900">{st.name}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    {st.role} {st.phone ? `· ${st.phone}` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteStaff(st.id)}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-red-700 hover:bg-red-50 rounded-[6px] cursor-pointer"
                  aria-label={`Remove ${st.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Data Export / Restore & Clear Shop Data */}
        <div className="store-card border border-slate-200 p-5 space-y-4">
          <h3 className="text-base font-bold text-slate-900">Data Backup, Cloud Restore &amp; Reset</h3>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportBackup}
              className="min-h-[44px] px-4 border border-slate-300 bg-white hover:bg-slate-50 rounded-[8px] text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Full JSON Backup</span>
            </button>
            <button
              type="button"
              onClick={() => jsonInputRef.current?.click()}
              className="min-h-[44px] px-4 border border-slate-300 bg-white hover:bg-slate-50 rounded-[8px] text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Import JSON Backup</span>
            </button>
            <input
              ref={jsonInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportBackup}
              className="hidden"
            />
            {authMode === 'google' && (
              <button
                type="button"
                onClick={async () => {
                  await restoreFromCloud();
                  flash('Restored latest data from Cloud Firestore');
                }}
                className="min-h-[44px] px-4 border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-[8px] text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Restore Cloud</span>
              </button>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200">
            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="min-h-[44px] px-4 border border-red-300 bg-red-50 hover:bg-red-100 text-red-800 rounded-[8px] text-sm font-semibold cursor-pointer"
              >
                Clear All Shop Data
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 bg-red-50 border border-red-200 p-3 rounded-[8px]">
                <span className="text-xs font-bold text-red-900">
                  Delete all tickets, sales, inventory, and bookings?
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await clearShopData();
                    setConfirmClear(false);
                    flash('All workshop & inventory data cleared');
                  }}
                  className="min-h-[38px] px-3 bg-red-700 text-white text-xs font-bold rounded-[6px] cursor-pointer"
                >
                  Confirm Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="min-h-[38px] px-3 bg-white border border-slate-300 text-xs font-semibold rounded-[6px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </AdminLock>
    </div>
  );
};
