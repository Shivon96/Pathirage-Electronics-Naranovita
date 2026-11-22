import { createDefaultShopProfile, PRESET_THEMES, type StoreSnapshot } from '../types';

const DB_NAME = 'store_workshop_idb';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalSnapshot(key: string, snapshot: StoreSnapshot): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(snapshot, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      localStorage.setItem(`store_snap_${key}`, JSON.stringify(snapshot));
    } catch {
      // Ignore storage quota fallback errors
    }
  }
}

export async function loadLocalSnapshot(key: string): Promise<StoreSnapshot | null> {
  try {
    const db = await openIdb();
    const res = await new Promise<StoreSnapshot | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as StoreSnapshot) || null);
      req.onerror = () => reject(req.error);
    });
    if (res) return res;
  } catch {
    // Fallback to localStorage
  }
  try {
    const raw = localStorage.getItem(`store_snap_${key}`);
    return raw ? (JSON.parse(raw) as StoreSnapshot) : null;
  } catch {
    return null;
  }
}

export function createEmptySnapshot(ownerUid: string): StoreSnapshot {
  return {
    shopProfile: createDefaultShopProfile(ownerUid),
    savedThemes: PRESET_THEMES.map((t) => ({ ...t, ownerUid })),
    staff: [
      {
        id: 'staff_admin_default',
        ownerUid,
        name: 'Owner / Lead Tech',
        role: 'Admin',
        phone: '0702809995',
        active: true,
      },
    ],
    tickets: [],
    ticketParts: [],
    ticketTimeline: [],
    inventory: [],
    posSales: [],
    posSaleItems: [],
    bookings: [],
    lastSyncMs: Date.now(),
  };
}
