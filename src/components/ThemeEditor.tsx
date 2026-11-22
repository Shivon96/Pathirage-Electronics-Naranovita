import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, Lock, Palette, Plus, Trash2, Upload } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { SavedTheme } from '../types';
import { makeSafeId } from '../utils/validation';

interface ThemeEditorProps {
  adminUnlocked: boolean;
  onRequireAdmin?: () => void;
}

export const ThemeEditor: React.FC<ThemeEditorProps> = ({ adminUnlocked, onRequireAdmin }) => {
  const { snapshot, applyTheme, saveTheme, deleteTheme } = useStore();
  const { shopProfile, savedThemes } = snapshot;
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [editId, setEditId] = useState<string>(shopProfile.activeThemeId || 'classic-store');
  const [name, setName] = useState('Custom Theme');
  const [primary, setPrimary] = useState(shopProfile.themePrimary || '#1D4ED8');
  const [header, setHeader] = useState(shopProfile.themeHeader || '#1E293B');
  const [background, setBackground] = useState(shopProfile.themeBackground || '#F8FAFC');
  const [surface, setSurface] = useState(shopProfile.themeSurface || '#FFFFFF');
  const [accent, setAccent] = useState(shopProfile.themeAccent || '#0F766E');
  const [text, setText] = useState(shopProfile.themeText || '#0F172A');
  const [cornerRadius, setCornerRadius] = useState(shopProfile.cornerRadius ?? 10);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const active = savedThemes.find((t) => t.id === shopProfile.activeThemeId);
    if (active) {
      setEditId(active.id);
      setName(active.name);
      setPrimary(active.primary);
      setHeader(active.header);
      setBackground(active.background);
      setSurface(active.surface);
      setAccent(active.accent);
      setText(active.text);
      setCornerRadius(active.cornerRadius);
    }
  }, [shopProfile.activeThemeId, savedThemes]);

  const loadThemeIntoEditor = (theme: SavedTheme) => {
    setEditId(theme.id);
    setName(theme.name);
    setPrimary(theme.primary);
    setHeader(theme.header);
    setBackground(theme.background);
    setSurface(theme.surface);
    setAccent(theme.accent);
    setText(theme.text);
    setCornerRadius(theme.cornerRadius);
    void applyTheme(theme);
  };

  const handleSaveUpdate = async () => {
    const targetId = editId || makeSafeId('theme');
    const payload: Omit<SavedTheme, 'ownerUid'> = {
      id: targetId,
      name: name.trim() || 'Custom Theme',
      primary,
      header,
      background,
      surface,
      accent,
      text,
      cornerRadius,
      isPreset: false,
    };
    await saveTheme(payload);
    await applyTheme({ ...payload, ownerUid: shopProfile.ownerUid });
    setNotice(`Saved & applied "${payload.name}"`);
    setTimeout(() => setNotice(null), 2500);
  };

  const handleSaveAsNew = async () => {
    const newId = makeSafeId('theme');
    const payload: Omit<SavedTheme, 'ownerUid'> = {
      id: newId,
      name: `${name.trim() || 'Custom'} Copy`,
      primary,
      header,
      background,
      surface,
      accent,
      text,
      cornerRadius,
      isPreset: false,
    };
    setEditId(newId);
    setName(payload.name);
    await saveTheme(payload);
    await applyTheme({ ...payload, ownerUid: shopProfile.ownerUid });
    setNotice(`Created preset "${payload.name}"`);
    setTimeout(() => setNotice(null), 2500);
  };

  const handleDelete = async (id: string) => {
    if (!adminUnlocked) {
      onRequireAdmin?.();
      return;
    }
    await deleteTheme(id);
    setNotice('Theme deleted');
    setTimeout(() => setNotice(null), 2000);
  };

  const handleExportThemes = () => {
    const blob = new Blob([JSON.stringify(savedThemes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `store-themes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportThemes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<SavedTheme>[];
      if (!Array.isArray(parsed)) throw new Error('Invalid theme file');
      for (const item of parsed) {
        if (item.name && item.primary && item.header) {
          await saveTheme({
            id: item.id || makeSafeId('theme'),
            name: item.name,
            primary: item.primary,
            header: item.header,
            background: item.background || '#F8FAFC',
            surface: item.surface || '#FFFFFF',
            accent: item.accent || '#0F766E',
            text: item.text || '#0F172A',
            cornerRadius: typeof item.cornerRadius === 'number' ? item.cornerRadius : 10,
            isPreset: false,
          });
        }
      }
      setNotice('Themes imported successfully');
    } catch {
      setNotice('Invalid theme JSON file');
    } finally {
      e.target.value = '';
      setTimeout(() => setNotice(null), 2500);
    }
  };

  return (
    <div className="store-card border border-slate-200 p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Palette className="w-5 h-5 text-blue-700" />
          <div>
            <h3 className="text-base font-bold">Themes &amp; Custom Theme Editor</h3>
            <p className="text-xs text-slate-500">Switch presets or customize colors &amp; corner radius</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportThemes}
            className="min-h-[40px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-[8px] hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Themes</span>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="min-h-[40px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-[8px] hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Themes</span>
          </button>
          <input ref={fileRef} type="file" accept="application/json" onChange={handleImportThemes} className="hidden" />
        </div>
      </div>

      {/* Saved Presets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {savedThemes.map((t) => {
          const active = t.id === shopProfile.activeThemeId;
          return (
            <div
              key={t.id}
              className={`border rounded-[10px] p-3 flex flex-col justify-between gap-2 transition-colors ${
                active ? 'border-blue-700 bg-blue-50/50' : 'border-slate-200 bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => loadThemeIntoEditor(t)}
                className="text-left w-full cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-bold text-slate-900 truncate">{t.name}</span>
                  {active && <Check className="w-4 h-4 text-blue-700 shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded border border-slate-200" style={{ backgroundColor: t.primary }} />
                  <span className="w-5 h-5 rounded border border-slate-200" style={{ backgroundColor: t.header }} />
                  <span className="w-5 h-5 rounded border border-slate-200" style={{ backgroundColor: t.background }} />
                  <span className="w-5 h-5 rounded border border-slate-200" style={{ backgroundColor: t.accent }} />
                </div>
              </button>
              {t.id !== 'classic-store' && (
                <div className="flex justify-end pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => void handleDelete(t.id)}
                    className="min-h-[36px] px-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-[6px] flex items-center gap-1 cursor-pointer"
                    title={adminUnlocked ? 'Delete Theme' : 'Unlock Admin to delete'}
                  >
                    {adminUnlocked ? <Trash2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom Editor */}
      <div className="border-t border-slate-200 pt-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Preset Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Corner Radius ({cornerRadius}px)</label>
            <input
              type="range"
              min={0}
              max={20}
              value={cornerRadius}
              onChange={(e) => setCornerRadius(Number(e.target.value))}
              className="w-full mt-2 accent-blue-700"
            />
          </div>
          {[
            { label: 'Primary (Buttons)', val: primary, set: setPrimary },
            { label: 'Header / Nav Rail', val: header, set: setHeader },
            { label: 'Page Background', val: background, set: setBackground },
            { label: 'Card Surface', val: surface, set: setSurface },
            { label: 'Accent Color', val: accent, set: setAccent },
            { label: 'Body Text', val: text, set: setText },
          ].map((c) => (
            <div key={c.label}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{c.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={c.val}
                  onChange={(e) => c.set(e.target.value)}
                  className="w-11 h-11 rounded border border-slate-300 cursor-pointer shrink-0 p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={c.val}
                  onChange={(e) => c.set(e.target.value)}
                  className="w-full min-h-[44px] px-2.5 border border-slate-300 rounded-[8px] text-xs font-mono-num"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSaveUpdate()}
            className="min-h-[48px] px-5 store-primary-btn font-semibold text-sm flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Save &amp; Apply Theme</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSaveAsNew()}
            className="min-h-[48px] px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold text-sm rounded-[10px] flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Save as New Preset</span>
          </button>
          {notice && <span className="text-sm font-medium text-emerald-700">{notice}</span>}
        </div>
      </div>
    </div>
  );
};
