import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import {
  BRAND_FOOTER,
  createDefaultShopProfile,
  PRESET_THEMES,
  type BookingStatus,
  type InventoryItem,
  type PaymentMethod,
  type PosSale,
  type PosSaleItem,
  type RepairTicket,
  type SavedTheme,
  type ShopProfile,
  type StaffMember,
  type StoreBackupPayload,
  type StoreSnapshot,
  type TicketPart,
  type TicketStatus,
  type TicketTimelineEntry,
  type WorkshopBooking,
} from '../types';
import { createEmptySnapshot, loadLocalSnapshot, saveLocalSnapshot } from '../utils/storage';
import {
  clampNum,
  clampStr,
  makeSafeId,
  sanitizeInventoryItem,
  sanitizePosSale,
  sanitizePosSaleItem,
  sanitizeRepairTicket,
  sanitizeSavedTheme,
  sanitizeShopProfile,
  sanitizeStaffMember,
  sanitizeTicketPart,
  sanitizeTicketTimeline,
  sanitizeWorkshopBooking,
} from '../utils/validation';

export type AuthMode = 'loading' | 'signed_out' | 'google' | 'offline';

export interface CreateTicketInput {
  deviceBarcode?: string;
  customerName: string;
  customerPhone: string;
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  serialNo: string;
  faultDescription: string;
  diagnosisNotes?: string;
  assignedStaff?: string;
  laborCharge?: number;
  advanceDeposit?: number;
  depositMethod?: PaymentMethod | 'None';
}

export interface CompleteSaleInput {
  customerName: string;
  customerPhone: string;
  items: { inventoryItemId: string; itemName: string; qty: number; unitPrice: number }[];
  discount: number;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  staffName: string;
}

interface StoreContextValue {
  authMode: AuthMode;
  user: User | null;
  snapshot: StoreSnapshot;
  isSyncing: boolean;
  syncError: string | null;
  lastCloudSyncMs: number;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createFirebaseAccount: (email: string, password: string, displayName: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationAndSync: () => Promise<boolean>;
  hasOfflinePendingData: boolean;
  syncOfflineLocalDataToAccount: () => Promise<void>;
  continueOffline: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateShopProfile: (patch: Partial<ShopProfile>) => Promise<void>;
  applyTheme: (theme: SavedTheme) => Promise<void>;
  saveTheme: (theme: Omit<SavedTheme, 'ownerUid'>) => Promise<void>;
  deleteTheme: (themeId: string) => Promise<void>;
  upsertStaff: (staff: Omit<StaffMember, 'ownerUid'>) => Promise<void>;
  deleteStaff: (staffId: string) => Promise<void>;
  createTicket: (input: CreateTicketInput) => Promise<RepairTicket>;
  updateTicket: (
    ticketId: string,
    patch: Partial<RepairTicket>,
    timelineSummary?: string,
    eventType?: string
  ) => Promise<void>;
  settleTicketBalance: (ticketId: string, amount: number, method: PaymentMethod) => Promise<void>;
  attachPartToTicket: (
    ticketId: string,
    inventoryItemId: string,
    itemName: string,
    shelfLocation: string,
    qty: number,
    unitPrice: number
  ) => Promise<void>;
  removePartFromTicket: (partId: string) => Promise<void>;
  upsertInventoryItem: (
    item: Omit<InventoryItem, 'id' | 'ownerUid' | 'updatedAtMs'> & { id?: string },
    stockDelta?: number
  ) => Promise<InventoryItem>;
  deleteInventoryItem: (itemId: string) => Promise<void>;
  bulkAssignRack: (itemIds: string[], shelfLocation: string) => Promise<void>;
  completePosSale: (input: CompleteSaleInput) => Promise<{ sale: PosSale; items: PosSaleItem[] }>;
  createBooking: (input: {
    customerName: string;
    customerPhone: string;
    deviceType: string;
    deviceModel: string;
    deviceBarcode: string;
    issueSummary: string;
    scheduledDate: string;
  }) => Promise<WorkshopBooking>;
  updateBookingStatus: (bookingId: string, status: BookingStatus, convertedTicketId?: string) => Promise<void>;
  convertBookingToTicket: (bookingId: string) => Promise<RepairTicket | null>;
  backupNow: () => Promise<void>;
  restoreFromCloud: () => Promise<void>;
  exportJsonBackup: () => StoreBackupPayload;
  importJsonBackup: (payload: StoreBackupPayload) => Promise<void>;
  clearShopData: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const OFFLINE_FLAG_KEY = 'store_offline_mode';
const OFFLINE_UID = 'offline_local_user';

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [snapshot, setSnapshot] = useState<StoreSnapshot>(() => createEmptySnapshot(OFFLINE_UID));
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastCloudSyncMs, setLastCloudSyncMs] = useState(0);
  const [hasOfflinePendingData, setHasOfflinePendingData] = useState(false);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const activeUid = user?.uid || OFFLINE_UID;
  const canCloudSync = authMode === 'google' && Boolean(user?.emailVerified);

  // Apply active theme CSS variables immediately
  useEffect(() => {
    const p = snapshot.shopProfile;
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', p.themePrimary || '#1D4ED8');
    root.style.setProperty('--theme-header', p.themeHeader || '#1E293B');
    root.style.setProperty('--theme-bg', p.themeBackground || '#F8FAFC');
    root.style.setProperty('--theme-surface', p.themeSurface || '#FFFFFF');
    root.style.setProperty('--theme-accent', p.themeAccent || '#0F766E');
    root.style.setProperty('--theme-text', p.themeText || '#0F172A');
    root.style.setProperty('--theme-radius', `${p.cornerRadius ?? 10}px`);
  }, [snapshot.shopProfile]);

  // Persist local cache whenever snapshot changes
  useEffect(() => {
    if (authMode === 'google' && user) {
      void saveLocalSnapshot(user.uid, snapshot);
    } else if (authMode === 'offline') {
      void saveLocalSnapshot(OFFLINE_UID, snapshot);
    }
  }, [snapshot, authMode, user]);

  // Seed initial cloud state if user document / shopProfile doesn't exist
  const ensureCloudInitialized = useCallback(async (u: User) => {
    const uid = u.uid;
    const userRef = doc(db, 'users', uid);
    const profileRef = doc(db, 'users', uid, 'shopProfile', 'default');

    try {
      const [userSnap, profileSnap] = await Promise.all([getDoc(userRef), getDoc(profileRef)]);
      if (!userSnap.exists() || !profileSnap.exists()) {
        const batch = writeBatch(db);
        const nowMs = Date.now();
        batch.set(
          userRef,
          {
            uid,
            email: clampStr(u.email, 200, ''),
            displayName: clampStr(u.displayName, 120, 'Shop Owner'),
            lastSyncMs: nowMs,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        if (!profileSnap.exists()) {
          const def = createDefaultShopProfile(uid);
          batch.set(profileRef, { ...sanitizeShopProfile(def, uid), updatedAt: serverTimestamp() });

          for (const preset of PRESET_THEMES) {
            const tRef = doc(db, 'users', uid, 'savedThemes', preset.id);
            batch.set(tRef, {
              ...sanitizeSavedTheme({ ...preset, ownerUid: uid }, uid),
              updatedAt: serverTimestamp(),
            });
          }

          const defaultStaffRef = doc(db, 'users', uid, 'staff', 'staff_admin_default');
          batch.set(defaultStaffRef, {
            ...sanitizeStaffMember(
              {
                id: 'staff_admin_default',
                ownerUid: uid,
                name: u.displayName || 'Owner / Lead Tech',
                role: 'Admin',
                phone: '0702809995',
                active: true,
              },
              uid
            ),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
    }
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        localStorage.removeItem(OFFLINE_FLAG_KEY);
        setUser(firebaseUser);
        const cached = await loadLocalSnapshot(firebaseUser.uid);
        if (cached) {
          setSnapshot(cached);
        } else {
          setSnapshot(createEmptySnapshot(firebaseUser.uid));
        }
        setAuthMode('google');
        setSyncError(null);
        const offlineSnap = await loadLocalSnapshot(OFFLINE_UID);
        const offlineHasRecords = Boolean(
          offlineSnap &&
            (offlineSnap.tickets.length > 0 ||
              offlineSnap.inventory.length > 0 ||
              offlineSnap.posSales.length > 0 ||
              offlineSnap.bookings.length > 0)
        );
        setHasOfflinePendingData(offlineHasRecords);
        if (firebaseUser.emailVerified) {
          void ensureCloudInitialized(firebaseUser);
        }
      } else {
        setUser(null);
        setHasOfflinePendingData(false);
        const isOffline = localStorage.getItem(OFFLINE_FLAG_KEY) === 'true';
        if (isOffline) {
          const cached = await loadLocalSnapshot(OFFLINE_UID);
          setSnapshot(cached || createEmptySnapshot(OFFLINE_UID));
          setAuthMode('offline');
        } else {
          setAuthMode('signed_out');
        }
      }
    });
    return () => unsub();
  }, [ensureCloudInitialized]);

  // Real-time Firestore listeners when signed in and email verified
  useEffect(() => {
    if (!canCloudSync || !user) return;
    const uid = user.uid;
    const unsubs: (() => void)[] = [];

    // 1. Root lastSyncMs listener
    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (typeof data.lastSyncMs === 'number') {
              setLastCloudSyncMs(data.lastSyncMs);
              setSnapshot((prev) => ({ ...prev, lastSyncMs: data.lastSyncMs }));
            }
          }
        },
        (err) => {
          setSyncError(err.message);
          handleFirestoreError(err, OperationType.GET, `users/${uid}`);
        }
      )
    );

    const subQuery = (subName: string) =>
      query(collection(db, 'users', uid, subName), where('ownerUid', '==', uid));

    // 2. shopProfile
    unsubs.push(
      onSnapshot(
        subQuery('shopProfile'),
        (snap) => {
          const defDoc = snap.docs.find((d) => d.id === 'default') || snap.docs[0];
          if (defDoc) {
            const d = defDoc.data() as ShopProfile;
            setSnapshot((prev) => ({ ...prev, shopProfile: { ...createDefaultShopProfile(uid), ...d } }));
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/shopProfile`)
      )
    );

    // 3. savedThemes
    unsubs.push(
      onSnapshot(
        subQuery('savedThemes'),
        (snap) => {
          const items = snap.docs.map((d) => d.data() as SavedTheme);
          if (items.length > 0) {
            setSnapshot((prev) => ({ ...prev, savedThemes: items }));
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/savedThemes`)
      )
    );

    // 4. staff
    unsubs.push(
      onSnapshot(
        subQuery('staff'),
        (snap) => {
          setSnapshot((prev) => ({ ...prev, staff: snap.docs.map((d) => d.data() as StaffMember) }));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/staff`)
      )
    );

    // 5. tickets
    unsubs.push(
      onSnapshot(
        subQuery('tickets'),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as RepairTicket)
            .sort((a, b) => b.createdAtMs - a.createdAtMs);
          setSnapshot((prev) => ({ ...prev, tickets: list }));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/tickets`)
      )
    );

    // 6. ticketParts
    unsubs.push(
      onSnapshot(
        subQuery('ticketParts'),
        (snap) => {
          setSnapshot((prev) => ({ ...prev, ticketParts: snap.docs.map((d) => d.data() as TicketPart) }));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/ticketParts`)
      )
    );

    // 7. ticketTimeline
    unsubs.push(
      onSnapshot(
        subQuery('ticketTimeline'),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as TicketTimelineEntry)
            .sort((a, b) => b.createdAtMs - a.createdAtMs);
          setSnapshot((prev) => ({ ...prev, ticketTimeline: list }));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/ticketTimeline`)
      )
    );

    // 8. inventory
    unsubs.push(
      onSnapshot(
        subQuery('inventory'),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as InventoryItem)
            .sort((a, b) => a.name.localeCompare(b.name));
          setSnapshot((prev) => ({ ...prev, inventory: list }));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/inventory`)
      )
    );

    // 9. posSales
    unsubs.push(
      onSnapshot(
        subQuery('posSales'),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as PosSale)
            .sort((a, b) => b.createdAtMs - a.createdAtMs);
          setSnapshot((prev) => ({ ...prev, posSales: list }));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/posSales`)
      )
    );

    // 10. posSaleItems
    unsubs.push(
      onSnapshot(
        subQuery('posSaleItems'),
        (snap) => {
          setSnapshot((prev) => ({ ...prev, posSaleItems: snap.docs.map((d) => d.data() as PosSaleItem) }));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/posSaleItems`)
      )
    );

    // 11. bookings
    unsubs.push(
      onSnapshot(
        subQuery('bookings'),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as WorkshopBooking)
            .sort((a, b) => b.createdAtMs - a.createdAtMs);
          setSnapshot((prev) => ({ ...prev, bookings: list }));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/bookings`)
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [canCloudSync, user]);

  // Helper to commit batch or single writes + touch users/{uid}.lastSyncMs
  const touchUserSync = useCallback(async (uid: string, nowMs: number) => {
    try {
      await setDoc(
        doc(db, 'users', uid),
        {
          uid,
          email: clampStr(auth.currentUser?.email, 200, ''),
          displayName: clampStr(auth.currentUser?.displayName, 120, 'Shop Owner'),
          lastSyncMs: nowMs,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setSyncError(null);
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setSyncError(null);
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const createFirebaseAccount = useCallback(async (email: string, password: string, displayName: string) => {
    setSyncError(null);
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Non-fatal if verification email throttled
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser);
    }
  }, []);

  const continueOffline = useCallback(async () => {
    localStorage.setItem(OFFLINE_FLAG_KEY, 'true');
    const cached = await loadLocalSnapshot(OFFLINE_UID);
    setSnapshot(cached || createEmptySnapshot(OFFLINE_UID));
    setAuthMode('offline');
  }, []);

  const signOutUser = useCallback(async () => {
    localStorage.removeItem(OFFLINE_FLAG_KEY);
    if (auth.currentUser) {
      await signOut(auth);
    }
    setUser(null);
    setAuthMode('signed_out');
  }, []);

  const updateShopProfile = useCallback(
    async (patch: Partial<ShopProfile>) => {
      const uid = activeUid;
      const merged = sanitizeShopProfile({ ...snapshotRef.current.shopProfile, ...patch }, uid);
      setSnapshot((prev) => ({ ...prev, shopProfile: merged, lastSyncMs: Date.now() }));
      if (canCloudSync && user) {
        const nowMs = Date.now();
        try {
          await setDoc(doc(db, 'users', uid, 'shopProfile', 'default'), {
            ...merged,
            updatedAt: serverTimestamp(),
          });
          await touchUserSync(uid, nowMs);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${uid}/shopProfile/default`);
        }
      }
    },
    [activeUid, authMode, touchUserSync, user]
  );

  const applyTheme = useCallback(
    async (theme: SavedTheme) => {
      await updateShopProfile({
        activeThemeId: theme.id,
        themePrimary: theme.primary,
        themeHeader: theme.header,
        themeBackground: theme.background,
        themeSurface: theme.surface,
        themeAccent: theme.accent,
        themeText: theme.text,
        cornerRadius: theme.cornerRadius,
      });
    },
    [updateShopProfile]
  );

  const saveTheme = useCallback(
    async (themeInput: Omit<SavedTheme, 'ownerUid'>) => {
      const uid = activeUid;
      const clean = sanitizeSavedTheme({ ...themeInput, ownerUid: uid }, uid);
      setSnapshot((prev) => {
        const exists = prev.savedThemes.some((t) => t.id === clean.id);
        const savedThemes = exists
          ? prev.savedThemes.map((t) => (t.id === clean.id ? clean : t))
          : [...prev.savedThemes, clean];
        return { ...prev, savedThemes, lastSyncMs: Date.now() };
      });
      if (canCloudSync && user) {
        try {
          await setDoc(doc(db, 'users', uid, 'savedThemes', clean.id), {
            ...clean,
            updatedAt: serverTimestamp(),
          });
          await touchUserSync(uid, Date.now());
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${uid}/savedThemes/${clean.id}`);
        }
      }
    },
    [activeUid, authMode, touchUserSync, user]
  );

  const deleteTheme = useCallback(
    async (themeId: string) => {
      const uid = activeUid;
      setSnapshot((prev) => ({
        ...prev,
        savedThemes: prev.savedThemes.filter((t) => t.id !== themeId),
      }));
      if (canCloudSync && user) {
        try {
          await deleteDoc(doc(db, 'users', uid, 'savedThemes', themeId));
          await touchUserSync(uid, Date.now());
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${uid}/savedThemes/${themeId}`);
        }
      }
    },
    [activeUid, authMode, touchUserSync, user]
  );

  const upsertStaff = useCallback(
    async (staffInput: Omit<StaffMember, 'ownerUid'>) => {
      const uid = activeUid;
      const clean = sanitizeStaffMember({ ...staffInput, ownerUid: uid }, uid);
      setSnapshot((prev) => {
        const exists = prev.staff.some((s) => s.id === clean.id);
        const staff = exists ? prev.staff.map((s) => (s.id === clean.id ? clean : s)) : [...prev.staff, clean];
        return { ...prev, staff };
      });
      if (canCloudSync && user) {
        try {
          await setDoc(doc(db, 'users', uid, 'staff', clean.id), {
            ...clean,
            updatedAt: serverTimestamp(),
          });
          await touchUserSync(uid, Date.now());
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${uid}/staff/${clean.id}`);
        }
      }
    },
    [activeUid, authMode, touchUserSync, user]
  );

  const deleteStaff = useCallback(
    async (staffId: string) => {
      const uid = activeUid;
      setSnapshot((prev) => ({
        ...prev,
        staff: prev.staff.filter((s) => s.id !== staffId),
      }));
      if (canCloudSync && user) {
        try {
          await deleteDoc(doc(db, 'users', uid, 'staff', staffId));
          await touchUserSync(uid, Date.now());
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${uid}/staff/${staffId}`);
        }
      }
    },
    [activeUid, authMode, touchUserSync, user]
  );

  const createTicket = useCallback(
    async (input: CreateTicketInput): Promise<RepairTicket> => {
      const uid = activeUid;
      const nowMs = Date.now();
      const profile = snapshotRef.current.shopProfile;
      const seq = profile.nextTicketSeq || 1001;
      const ticketId = makeSafeId('tkt');
      const ticketNo = `T-${seq}`;
      const deviceBarcode = clampStr(input.deviceBarcode, 80) || `DEV-${seq}`;
      const labor = clampNum(input.laborCharge ?? 0, 0);
      const deposit = clampNum(input.advanceDeposit ?? 0, 0);
      const totalAmount = labor;
      const balanceDue = Math.max(0, totalAmount - deposit);

      const ticket = sanitizeRepairTicket(
        {
          id: ticketId,
          ownerUid: uid,
          ticketNo,
          deviceBarcode,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deviceType: input.deviceType,
          deviceBrand: input.deviceBrand,
          deviceModel: input.deviceModel,
          serialNo: input.serialNo,
          faultDescription: input.faultDescription,
          diagnosisNotes: input.diagnosisNotes || '',
          status: 'Received',
          assignedStaff: input.assignedStaff || '',
          laborCharge: labor,
          partsTotal: 0,
          discount: 0,
          totalAmount,
          advanceDeposit: deposit,
          depositMethod: deposit > 0 ? input.depositMethod || 'Cash' : 'None',
          depositPaidAtMs: deposit > 0 ? nowMs : 0,
          settledAmount: 0,
          settlementMethod: 'None',
          settledAtMs: 0,
          balanceDue,
          createdAtMs: nowMs,
          updatedAtMs: nowMs,
        },
        uid
      );

      const timeline = sanitizeTicketTimeline(
        {
          id: makeSafeId('tl'),
          ownerUid: uid,
          ticketId: ticket.id,
          eventType: 'CREATED',
          summary: `Intake created (${ticket.ticketNo}) for ${ticket.deviceType}${
            deposit > 0 ? ` • Deposit ${profile.currencySymbol} ${deposit.toFixed(2)} (${ticket.depositMethod})` : ''
          }`,
          actor: input.assignedStaff || 'Counter',
          createdAtMs: nowMs,
        },
        uid
      );

      const nextProfile = sanitizeShopProfile({ ...profile, nextTicketSeq: seq + 1 }, uid);

      setSnapshot((prev) => ({
        ...prev,
        shopProfile: nextProfile,
        tickets: [ticket, ...prev.tickets],
        ticketTimeline: [timeline, ...prev.ticketTimeline],
        lastSyncMs: nowMs,
      }));

      if (canCloudSync && user) {
        try {
          const batch = writeBatch(db);
          batch.set(doc(db, 'users', uid, 'tickets', ticket.id), { ...ticket, updatedAt: serverTimestamp() });
          batch.set(doc(db, 'users', uid, 'ticketTimeline', timeline.id), {
            ...timeline,
            updatedAt: serverTimestamp(),
          });
          batch.set(doc(db, 'users', uid, 'shopProfile', 'default'), {
            ...nextProfile,
            updatedAt: serverTimestamp(),
          });
          batch.set(
            doc(db, 'users', uid),
            { uid, lastSyncMs: nowMs, updatedAt: serverTimestamp() },
            { merge: true }
          );
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${uid}/tickets/${ticket.id}`);
        }
      }

      return ticket;
    },
    [activeUid, authMode, user]
  );

  const updateTicket = useCallback(
    async (
      ticketId: string,
      patch: Partial<RepairTicket>,
      timelineSummary?: string,
      eventType = 'UPDATED'
    ) => {
      const uid = activeUid;
      const existing = snapshotRef.current.tickets.find((t) => t.id === ticketId);
      if (!existing) return;

      const nowMs = Date.now();
      const labor = patch.laborCharge !== undefined ? clampNum(patch.laborCharge, 0) : existing.laborCharge;
      const parts = patch.partsTotal !== undefined ? clampNum(patch.partsTotal, 0) : existing.partsTotal;
      const discount = patch.discount !== undefined ? clampNum(patch.discount, 0) : existing.discount;
      const deposit = patch.advanceDeposit !== undefined ? clampNum(patch.advanceDeposit, 0) : existing.advanceDeposit;
      const settled = patch.settledAmount !== undefined ? clampNum(patch.settledAmount, 0) : existing.settledAmount;
      const totalAmount = Math.max(0, labor + parts - discount);
      const balanceDue = Math.max(0, totalAmount - deposit - settled);

      const updated = sanitizeRepairTicket(
        {
          ...existing,
          ...patch,
          laborCharge: labor,
          partsTotal: parts,
          discount,
          totalAmount,
          advanceDeposit: deposit,
          depositPaidAtMs:
            deposit > 0 && existing.depositPaidAtMs === 0 ? nowMs : patch.depositPaidAtMs ?? existing.depositPaidAtMs,
          settledAmount: settled,
          balanceDue,
          updatedAtMs: nowMs,
        },
        uid
      );

      let tlEntry: TicketTimelineEntry | null = null;
      if (timelineSummary) {
        tlEntry = sanitizeTicketTimeline(
          {
            id: makeSafeId('tl'),
            ownerUid: uid,
            ticketId,
            eventType,
            summary: timelineSummary,
            actor: updated.assignedStaff || 'Staff',
            createdAtMs: nowMs,
          },
          uid
        );
      }

      setSnapshot((prev) => ({
        ...prev,
        tickets: prev.tickets.map((t) => (t.id === ticketId ? updated : t)),
        ticketTimeline: tlEntry ? [tlEntry, ...prev.ticketTimeline] : prev.ticketTimeline,
        lastSyncMs: nowMs,
      }));

      if (canCloudSync && user) {
        try {
          const batch = writeBatch(db);
          batch.set(doc(db, 'users', uid, 'tickets', ticketId), { ...updated, updatedAt: serverTimestamp() });
          if (tlEntry) {
            batch.set(doc(db, 'users', uid, 'ticketTimeline', tlEntry.id), {
              ...tlEntry,
              updatedAt: serverTimestamp(),
            });
          }
          batch.set(
            doc(db, 'users', uid),
            { uid, lastSyncMs: nowMs, updatedAt: serverTimestamp() },
            { merge: true }
          );
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/tickets/${ticketId}`);
        }
      }
    },
    [activeUid, authMode, user]
  );

  const settleTicketBalance = useCallback(
    async (ticketId: string, amount: number, method: PaymentMethod) => {
      const existing = snapshotRef.current.tickets.find((t) => t.id === ticketId);
      if (!existing) return;
      const nowMs = Date.now();
      const payAmt = clampNum(amount, 0);
      const newSettled = clampNum(existing.settledAmount + payAmt, 0);
      const curSym = snapshotRef.current.shopProfile.currencySymbol;
      await updateTicket(
        ticketId,
        {
          settledAmount: newSettled,
          settlementMethod: method,
          settledAtMs: nowMs,
          status: existing.balanceDue - payAmt <= 0 ? 'Delivered' : existing.status,
        },
        `Settled ${curSym} ${payAmt.toFixed(2)} via ${method}`,
        'PAYMENT'
      );
    },
    [updateTicket]
  );

  const attachPartToTicket = useCallback(
    async (
      ticketId: string,
      inventoryItemId: string,
      itemName: string,
      shelfLocation: string,
      qty: number,
      unitPrice: number
    ) => {
      const uid = activeUid;
      const ticket = snapshotRef.current.tickets.find((t) => t.id === ticketId);
      if (!ticket) return;
      const nowMs = Date.now();
      const cleanQty = clampNum(qty, 0.01, 999999);
      const cleanPrice = clampNum(unitPrice, 0);
      const lineTotal = clampNum(cleanQty * cleanPrice, 0);

      const part = sanitizeTicketPart(
        {
          id: makeSafeId('tpart'),
          ownerUid: uid,
          ticketId,
          inventoryItemId,
          itemName,
          shelfLocation,
          qty: cleanQty,
          unitPrice: cleanPrice,
          lineTotal,
          addedAtMs: nowMs,
        },
        uid
      );

      const invItem = inventoryItemId
        ? snapshotRef.current.inventory.find((i) => i.id === inventoryItemId)
        : undefined;
      const updatedInv = invItem
        ? sanitizeInventoryItem(
            {
              ...invItem,
              qty: Math.max(0, invItem.qty - cleanQty),
              stockOutTotal: (invItem.stockOutTotal || 0) + cleanQty,
              updatedAtMs: nowMs,
            },
            uid
          )
        : null;

      const newPartsTotal = clampNum(ticket.partsTotal + lineTotal, 0);
      const totalAmount = Math.max(0, ticket.laborCharge + newPartsTotal - ticket.discount);
      const balanceDue = Math.max(0, totalAmount - ticket.advanceDeposit - ticket.settledAmount);
      const updatedTicket = sanitizeRepairTicket(
        {
          ...ticket,
          partsTotal: newPartsTotal,
          totalAmount,
          balanceDue,
          updatedAtMs: nowMs,
        },
        uid
      );

      const tlEntry = sanitizeTicketTimeline(
        {
          id: makeSafeId('tl'),
          ownerUid: uid,
          ticketId,
          eventType: 'PART_ADDED',
          summary: `Attached ${cleanQty} × ${itemName}${shelfLocation ? ` (Rack ${shelfLocation})` : ''}`,
          actor: ticket.assignedStaff || 'Tech',
          createdAtMs: nowMs,
        },
        uid
      );

      setSnapshot((prev) => ({
        ...prev,
        ticketParts: [...prev.ticketParts, part],
        tickets: prev.tickets.map((t) => (t.id === ticketId ? updatedTicket : t)),
        inventory: updatedInv
          ? prev.inventory.map((i) => (i.id === updatedInv.id ? updatedInv : i))
          : prev.inventory,
        ticketTimeline: [tlEntry, ...prev.ticketTimeline],
        lastSyncMs: nowMs,
      }));

      if (canCloudSync && user) {
        try {
          const batch = writeBatch(db);
          batch.set(doc(db, 'users', uid, 'ticketParts', part.id), { ...part, updatedAt: serverTimestamp() });
          batch.set(doc(db, 'users', uid, 'tickets', ticketId), { ...updatedTicket, updatedAt: serverTimestamp() });
          batch.set(doc(db, 'users', uid, 'ticketTimeline', tlEntry.id), {
            ...tlEntry,
            updatedAt: serverTimestamp(),
          });
          if (updatedInv) {
            batch.set(doc(db, 'users', uid, 'inventory', updatedInv.id), {
              ...updatedInv,
              updatedAt: serverTimestamp(),
            });
          }
          batch.set(
            doc(db, 'users', uid),
            { uid, lastSyncMs: nowMs, updatedAt: serverTimestamp() },
            { merge: true }
          );
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${uid}/ticketParts/${part.id}`);
        }
      }
    },
    [activeUid, authMode, user]
  );

  const removePartFromTicket = useCallback(
    async (partId: string) => {
      const uid = activeUid;
      const part = snapshotRef.current.ticketParts.find((p) => p.id === partId);
      if (!part) return;
      const ticket = snapshotRef.current.tickets.find((t) => t.id === part.ticketId);
      if (!ticket) return;

      const nowMs = Date.now();
      const invItem = part.inventoryItemId
        ? snapshotRef.current.inventory.find((i) => i.id === part.inventoryItemId)
        : undefined;
      const updatedInv = invItem
        ? sanitizeInventoryItem(
            {
              ...invItem,
              qty: invItem.qty + part.qty,
              stockOutTotal: Math.max(0, (invItem.stockOutTotal || 0) - part.qty),
              updatedAtMs: nowMs,
            },
            uid
          )
        : null;

      const newPartsTotal = Math.max(0, clampNum(ticket.partsTotal - part.lineTotal, 0));
      const totalAmount = Math.max(0, ticket.laborCharge + newPartsTotal - ticket.discount);
      const balanceDue = Math.max(0, totalAmount - ticket.advanceDeposit - ticket.settledAmount);
      const updatedTicket = sanitizeRepairTicket(
        {
          ...ticket,
          partsTotal: newPartsTotal,
          totalAmount,
          balanceDue,
          updatedAtMs: nowMs,
        },
        uid
      );

      const tlEntry = sanitizeTicketTimeline(
        {
          id: makeSafeId('tl'),
          ownerUid: uid,
          ticketId: ticket.id,
          eventType: 'PART_REMOVED',
          summary: `Removed ${part.qty} × ${part.itemName} (stock restored)`,
          actor: 'Tech',
          createdAtMs: nowMs,
        },
        uid
      );

      setSnapshot((prev) => ({
        ...prev,
        ticketParts: prev.ticketParts.filter((p) => p.id !== partId),
        tickets: prev.tickets.map((t) => (t.id === ticket.id ? updatedTicket : t)),
        inventory: updatedInv
          ? prev.inventory.map((i) => (i.id === updatedInv.id ? updatedInv : i))
          : prev.inventory,
        ticketTimeline: [tlEntry, ...prev.ticketTimeline],
        lastSyncMs: nowMs,
      }));

      if (canCloudSync && user) {
        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, 'users', uid, 'ticketParts', partId));
          batch.set(doc(db, 'users', uid, 'tickets', ticket.id), { ...updatedTicket, updatedAt: serverTimestamp() });
          batch.set(doc(db, 'users', uid, 'ticketTimeline', tlEntry.id), {
            ...tlEntry,
            updatedAt: serverTimestamp(),
          });
          if (updatedInv) {
            batch.set(doc(db, 'users', uid, 'inventory', updatedInv.id), {
              ...updatedInv,
              updatedAt: serverTimestamp(),
            });
          }
          batch.set(
            doc(db, 'users', uid),
            { uid, lastSyncMs: nowMs, updatedAt: serverTimestamp() },
            { merge: true }
          );
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${uid}/ticketParts/${partId}`);
        }
      }
    },
    [activeUid, authMode, user]
  );

  const upsertInventoryItem = useCallback(
    async (
      itemInput: Omit<InventoryItem, 'id' | 'ownerUid' | 'updatedAtMs'> & { id?: string },
      stockDelta = 0
    ): Promise<InventoryItem> => {
      const uid = activeUid;
      const nowMs = Date.now();
      const id = itemInput.id || makeSafeId('inv');
      const existing = snapshotRef.current.inventory.find((i) => i.id === id);

      const stockInTotal =
        (existing?.stockInTotal ?? itemInput.stockInTotal ?? itemInput.qty) + (stockDelta > 0 ? stockDelta : 0);
      const stockOutTotal =
        (existing?.stockOutTotal ?? itemInput.stockOutTotal ?? 0) + (stockDelta < 0 ? Math.abs(stockDelta) : 0);

      const clean = sanitizeInventoryItem(
        {
          ...itemInput,
          id,
          ownerUid: uid,
          stockInTotal,
          stockOutTotal,
          updatedAtMs: nowMs,
        },
        uid
      );

      setSnapshot((prev) => {
        const exists = prev.inventory.some((i) => i.id === clean.id);
        const inventory = exists
          ? prev.inventory.map((i) => (i.id === clean.id ? clean : i))
          : [...prev.inventory, clean].sort((a, b) => a.name.localeCompare(b.name));
        return { ...prev, inventory, lastSyncMs: nowMs };
      });

      if (canCloudSync && user) {
        try {
          await setDoc(doc(db, 'users', uid, 'inventory', clean.id), {
            ...clean,
            updatedAt: serverTimestamp(),
          });
          await touchUserSync(uid, nowMs);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${uid}/inventory/${clean.id}`);
        }
      }

      return clean;
    },
    [activeUid, authMode, touchUserSync, user]
  );

  const deleteInventoryItem = useCallback(
    async (itemId: string) => {
      const uid = activeUid;
      setSnapshot((prev) => ({
        ...prev,
        inventory: prev.inventory.filter((i) => i.id !== itemId),
      }));
      if (canCloudSync && user) {
        try {
          await deleteDoc(doc(db, 'users', uid, 'inventory', itemId));
          await touchUserSync(uid, Date.now());
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${uid}/inventory/${itemId}`);
        }
      }
    },
    [activeUid, authMode, touchUserSync, user]
  );

  const bulkAssignRack = useCallback(
    async (itemIds: string[], shelfLocation: string) => {
      const uid = activeUid;
      const cleanRack = clampStr(shelfLocation, 60, '');
      const nowMs = Date.now();
      const idSet = new Set(itemIds);
      const updatedItems: InventoryItem[] = [];

      setSnapshot((prev) => ({
        ...prev,
        inventory: prev.inventory.map((item) => {
          if (!idSet.has(item.id)) return item;
          const next = sanitizeInventoryItem({ ...item, shelfLocation: cleanRack, updatedAtMs: nowMs }, uid);
          updatedItems.push(next);
          return next;
        }),
        lastSyncMs: nowMs,
      }));

      if (canCloudSync && user && updatedItems.length > 0) {
        try {
          const batch = writeBatch(db);
          for (const item of updatedItems) {
            batch.set(doc(db, 'users', uid, 'inventory', item.id), { ...item, updatedAt: serverTimestamp() });
          }
          batch.set(
            doc(db, 'users', uid),
            { uid, lastSyncMs: nowMs, updatedAt: serverTimestamp() },
            { merge: true }
          );
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/inventory`);
        }
      }
    },
    [activeUid, authMode, user]
  );

  const completePosSale = useCallback(
    async (input: CompleteSaleInput): Promise<{ sale: PosSale; items: PosSaleItem[] }> => {
      const uid = activeUid;
      const nowMs = Date.now();
      const profile = snapshotRef.current.shopProfile;
      const seq = profile.nextSaleSeq || 5001;
      const saleId = makeSafeId('sale');
      const saleNo = `POS-${seq}`;

      const subtotal = clampNum(
        input.items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0),
        0
      );
      const discount = clampNum(input.discount, 0);
      const totalAmount = Math.max(0, clampNum(subtotal - discount, 0));
      const amountTendered =
        input.paymentMethod === 'Cash' ? clampNum(Math.max(totalAmount, input.amountTendered), 0) : totalAmount;
      const changeDue = input.paymentMethod === 'Cash' ? Math.max(0, clampNum(amountTendered - totalAmount, 0)) : 0;

      const sale = sanitizePosSale(
        {
          id: saleId,
          ownerUid: uid,
          saleNo,
          customerName: input.customerName || 'Walk-in',
          customerPhone: input.customerPhone || '',
          subtotal,
          discount,
          totalAmount,
          paymentMethod: input.paymentMethod,
          amountTendered,
          changeDue,
          staffName: input.staffName || '',
          createdAtMs: nowMs,
        },
        uid
      );

      const saleItems = input.items.map((it) =>
        sanitizePosSaleItem(
          {
            id: makeSafeId('sitem'),
            ownerUid: uid,
            saleId,
            inventoryItemId: it.inventoryItemId,
            itemName: it.itemName,
            qty: it.qty,
            unitPrice: it.unitPrice,
            lineTotal: clampNum(it.qty * it.unitPrice, 0),
          },
          uid
        )
      );

      // Deduct stock for matching inventory items
      const qtyDeductions = new Map<string, number>();
      for (const it of input.items) {
        if (it.inventoryItemId) {
          qtyDeductions.set(it.inventoryItemId, (qtyDeductions.get(it.inventoryItemId) || 0) + it.qty);
        }
      }

      const updatedInvList: InventoryItem[] = [];
      const nextInventory = snapshotRef.current.inventory.map((inv) => {
        const deduct = qtyDeductions.get(inv.id);
        if (!deduct) return inv;
        const next = sanitizeInventoryItem(
          {
            ...inv,
            qty: Math.max(0, inv.qty - deduct),
            stockOutTotal: (inv.stockOutTotal || 0) + deduct,
            updatedAtMs: nowMs,
          },
          uid
        );
        updatedInvList.push(next);
        return next;
      });

      const nextProfile = sanitizeShopProfile({ ...profile, nextSaleSeq: seq + 1 }, uid);

      setSnapshot((prev) => ({
        ...prev,
        shopProfile: nextProfile,
        posSales: [sale, ...prev.posSales],
        posSaleItems: [...prev.posSaleItems, ...saleItems],
        inventory: nextInventory,
        lastSyncMs: nowMs,
      }));

      if (canCloudSync && user) {
        try {
          const batch = writeBatch(db);
          batch.set(doc(db, 'users', uid, 'posSales', sale.id), { ...sale, updatedAt: serverTimestamp() });
          for (const si of saleItems) {
            batch.set(doc(db, 'users', uid, 'posSaleItems', si.id), { ...si, updatedAt: serverTimestamp() });
          }
          for (const inv of updatedInvList) {
            batch.set(doc(db, 'users', uid, 'inventory', inv.id), { ...inv, updatedAt: serverTimestamp() });
          }
          batch.set(doc(db, 'users', uid, 'shopProfile', 'default'), {
            ...nextProfile,
            updatedAt: serverTimestamp(),
          });
          batch.set(
            doc(db, 'users', uid),
            { uid, lastSyncMs: nowMs, updatedAt: serverTimestamp() },
            { merge: true }
          );
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${uid}/posSales/${sale.id}`);
        }
      }

      return { sale, items: saleItems };
    },
    [activeUid, authMode, user]
  );

  const createBooking = useCallback(
    async (input: {
      customerName: string;
      customerPhone: string;
      deviceType: string;
      deviceModel: string;
      deviceBarcode: string;
      issueSummary: string;
      scheduledDate: string;
    }): Promise<WorkshopBooking> => {
      const uid = activeUid;
      const nowMs = Date.now();
      const profile = snapshotRef.current.shopProfile;
      const seq = profile.nextBookingSeq || 201;
      const booking = sanitizeWorkshopBooking(
        {
          id: makeSafeId('bkg'),
          ownerUid: uid,
          bookingNo: `BK-${seq}`,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deviceType: input.deviceType,
          deviceModel: input.deviceModel,
          deviceBarcode: input.deviceBarcode,
          issueSummary: input.issueSummary,
          scheduledDate: input.scheduledDate,
          status: 'Scheduled',
          convertedTicketId: '',
          createdAtMs: nowMs,
          updatedAtMs: nowMs,
        },
        uid
      );
      const nextProfile = sanitizeShopProfile({ ...profile, nextBookingSeq: seq + 1 }, uid);

      setSnapshot((prev) => ({
        ...prev,
        shopProfile: nextProfile,
        bookings: [booking, ...prev.bookings],
        lastSyncMs: nowMs,
      }));

      if (canCloudSync && user) {
        try {
          const batch = writeBatch(db);
          batch.set(doc(db, 'users', uid, 'bookings', booking.id), { ...booking, updatedAt: serverTimestamp() });
          batch.set(doc(db, 'users', uid, 'shopProfile', 'default'), {
            ...nextProfile,
            updatedAt: serverTimestamp(),
          });
          batch.set(
            doc(db, 'users', uid),
            { uid, lastSyncMs: nowMs, updatedAt: serverTimestamp() },
            { merge: true }
          );
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${uid}/bookings/${booking.id}`);
        }
      }

      return booking;
    },
    [activeUid, authMode, user]
  );

  const updateBookingStatus = useCallback(
    async (bookingId: string, status: BookingStatus, convertedTicketId?: string) => {
      const uid = activeUid;
      const existing = snapshotRef.current.bookings.find((b) => b.id === bookingId);
      if (!existing) return;
      const nowMs = Date.now();
      const updated = sanitizeWorkshopBooking(
        {
          ...existing,
          status,
          convertedTicketId: convertedTicketId ?? existing.convertedTicketId,
          updatedAtMs: nowMs,
        },
        uid
      );

      setSnapshot((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) => (b.id === bookingId ? updated : b)),
        lastSyncMs: nowMs,
      }));

      if (canCloudSync && user) {
        try {
          await setDoc(doc(db, 'users', uid, 'bookings', bookingId), {
            ...updated,
            updatedAt: serverTimestamp(),
          });
          await touchUserSync(uid, nowMs);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/bookings/${bookingId}`);
        }
      }
    },
    [activeUid, authMode, touchUserSync, user]
  );

  const convertBookingToTicket = useCallback(
    async (bookingId: string): Promise<RepairTicket | null> => {
      const booking = snapshotRef.current.bookings.find((b) => b.id === bookingId);
      if (!booking) return null;
      const ticket = await createTicket({
        deviceBarcode: booking.deviceBarcode || undefined,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        deviceType: booking.deviceType,
        deviceBrand: '',
        deviceModel: booking.deviceModel,
        serialNo: '',
        faultDescription: booking.issueSummary,
      });
      await updateBookingStatus(bookingId, 'Checked In', ticket.id);
      return ticket;
    },
    [createTicket, updateBookingStatus]
  );

  const pushFullSnapshotToCloud = useCallback(async (uid: string, snap: StoreSnapshot) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const nowMs = Date.now();
      const ops: { ref: ReturnType<typeof doc>; data: Record<string, unknown> }[] = [];

      ops.push({
        ref: doc(db, 'users', uid),
        data: {
          uid,
          email: clampStr(auth.currentUser?.email, 200, ''),
          displayName: clampStr(auth.currentUser?.displayName, 120, 'Shop Owner'),
          lastSyncMs: nowMs,
          updatedAt: serverTimestamp(),
        },
      });
      ops.push({
        ref: doc(db, 'users', uid, 'shopProfile', 'default'),
        data: { ...sanitizeShopProfile(snap.shopProfile, uid), updatedAt: serverTimestamp() },
      });
      for (const t of snap.savedThemes) {
        ops.push({
          ref: doc(db, 'users', uid, 'savedThemes', t.id),
          data: { ...sanitizeSavedTheme(t, uid), updatedAt: serverTimestamp() },
        });
      }
      for (const s of snap.staff) {
        ops.push({
          ref: doc(db, 'users', uid, 'staff', s.id),
          data: { ...sanitizeStaffMember(s, uid), updatedAt: serverTimestamp() },
        });
      }
      for (const tk of snap.tickets) {
        ops.push({
          ref: doc(db, 'users', uid, 'tickets', tk.id),
          data: { ...sanitizeRepairTicket(tk, uid), updatedAt: serverTimestamp() },
        });
      }
      for (const tp of snap.ticketParts) {
        ops.push({
          ref: doc(db, 'users', uid, 'ticketParts', tp.id),
          data: { ...sanitizeTicketPart(tp, uid), updatedAt: serverTimestamp() },
        });
      }
      for (const tl of snap.ticketTimeline) {
        ops.push({
          ref: doc(db, 'users', uid, 'ticketTimeline', tl.id),
          data: { ...sanitizeTicketTimeline(tl, uid), updatedAt: serverTimestamp() },
        });
      }
      for (const inv of snap.inventory) {
        ops.push({
          ref: doc(db, 'users', uid, 'inventory', inv.id),
          data: { ...sanitizeInventoryItem(inv, uid), updatedAt: serverTimestamp() },
        });
      }
      for (const sale of snap.posSales) {
        ops.push({
          ref: doc(db, 'users', uid, 'posSales', sale.id),
          data: { ...sanitizePosSale(sale, uid), updatedAt: serverTimestamp() },
        });
      }
      for (const si of snap.posSaleItems) {
        ops.push({
          ref: doc(db, 'users', uid, 'posSaleItems', si.id),
          data: { ...sanitizePosSaleItem(si, uid), updatedAt: serverTimestamp() },
        });
      }
      for (const b of snap.bookings) {
        ops.push({
          ref: doc(db, 'users', uid, 'bookings', b.id),
          data: { ...sanitizeWorkshopBooking(b, uid), updatedAt: serverTimestamp() },
        });
      }

      for (let i = 0; i < ops.length; i += 400) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + 400)) {
          batch.set(op.ref, op.data);
        }
        await batch.commit();
      }
      setLastCloudSyncMs(nowMs);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const backupNow = useCallback(async () => {
    if (!canCloudSync || !user) return;
    await pushFullSnapshotToCloud(user.uid, snapshotRef.current);
  }, [canCloudSync, pushFullSnapshotToCloud, user]);

  const refreshVerificationAndSync = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    setUser(refreshed);
    if (refreshed.emailVerified) {
      await ensureCloudInitialized(refreshed);
      await pushFullSnapshotToCloud(refreshed.uid, snapshotRef.current);
      return true;
    }
    return false;
  }, [ensureCloudInitialized, pushFullSnapshotToCloud]);

  const syncOfflineLocalDataToAccount = useCallback(async () => {
    if (!user) return;
    const offlineSnap = await loadLocalSnapshot(OFFLINE_UID);
    if (!offlineSnap) return;
    const uid = user.uid;
    const merged: StoreSnapshot = {
      ...offlineSnap,
      shopProfile: sanitizeShopProfile(offlineSnap.shopProfile, uid),
      savedThemes: offlineSnap.savedThemes.map((t) => sanitizeSavedTheme(t, uid)),
      staff: offlineSnap.staff.map((s) => sanitizeStaffMember(s, uid)),
      tickets: offlineSnap.tickets.map((t) => sanitizeRepairTicket(t, uid)),
      ticketParts: offlineSnap.ticketParts.map((tp) => sanitizeTicketPart(tp, uid)),
      ticketTimeline: offlineSnap.ticketTimeline.map((tl) => sanitizeTicketTimeline(tl, uid)),
      inventory: offlineSnap.inventory.map((i) => sanitizeInventoryItem(i, uid)),
      posSales: offlineSnap.posSales.map((s) => sanitizePosSale(s, uid)),
      posSaleItems: offlineSnap.posSaleItems.map((si) => sanitizePosSaleItem(si, uid)),
      bookings: offlineSnap.bookings.map((b) => sanitizeWorkshopBooking(b, uid)),
      lastSyncMs: Date.now(),
    };
    setSnapshot(merged);
    await saveLocalSnapshot(uid, merged);
    setHasOfflinePendingData(false);
    if (user.emailVerified) {
      await pushFullSnapshotToCloud(uid, merged);
    }
  }, [pushFullSnapshotToCloud, user]);

  const restoreFromCloud = useCallback(async () => {
    if (!canCloudSync || !user) return;
    const uid = user.uid;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const fetchSub = async <T,>(subName: string): Promise<T[]> => {
        const q = query(collection(db, 'users', uid, subName), where('ownerUid', '==', uid));
        const res = await getDocs(q);
        return res.docs.map((d) => d.data() as T);
      };
      const [
        profiles,
        savedThemes,
        staff,
        tickets,
        ticketParts,
        ticketTimeline,
        inventory,
        posSales,
        posSaleItems,
        bookings,
      ] = await Promise.all([
        fetchSub<ShopProfile>('shopProfile'),
        fetchSub<SavedTheme>('savedThemes'),
        fetchSub<StaffMember>('staff'),
        fetchSub<RepairTicket>('tickets'),
        fetchSub<TicketPart>('ticketParts'),
        fetchSub<TicketTimelineEntry>('ticketTimeline'),
        fetchSub<InventoryItem>('inventory'),
        fetchSub<PosSale>('posSales'),
        fetchSub<PosSaleItem>('posSaleItems'),
        fetchSub<WorkshopBooking>('bookings'),
      ]);

      const next: StoreSnapshot = {
        shopProfile: profiles.find((p) => p.id === 'default') || profiles[0] || createDefaultShopProfile(uid),
        savedThemes: savedThemes.length ? savedThemes : PRESET_THEMES.map((t) => ({ ...t, ownerUid: uid })),
        staff,
        tickets: tickets.sort((a, b) => b.createdAtMs - a.createdAtMs),
        ticketParts,
        ticketTimeline: ticketTimeline.sort((a, b) => b.createdAtMs - a.createdAtMs),
        inventory: inventory.sort((a, b) => a.name.localeCompare(b.name)),
        posSales: posSales.sort((a, b) => b.createdAtMs - a.createdAtMs),
        posSaleItems,
        bookings: bookings.sort((a, b) => b.createdAtMs - a.createdAtMs),
        lastSyncMs: Date.now(),
      };
      setSnapshot(next);
      setLastCloudSyncMs(next.lastSyncMs);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Restore failed');
      handleFirestoreError(err, OperationType.LIST, `users/${uid}`);
    } finally {
      setIsSyncing(false);
    }
  }, [canCloudSync, user]);

  const exportJsonBackup = useCallback((): StoreBackupPayload => {
    return {
      version: 1,
      exportedAtMs: Date.now(),
      appName: 'Store',
      snapshot: snapshotRef.current,
    };
  }, []);

  const importJsonBackup = useCallback(
    async (payload: StoreBackupPayload) => {
      const uid = activeUid;
      const s = payload.snapshot;
      const sanitized: StoreSnapshot = {
        shopProfile: sanitizeShopProfile({ ...s.shopProfile, receiptFooter: s.shopProfile.receiptFooter || BRAND_FOOTER }, uid),
        savedThemes: (s.savedThemes || []).map((t) => sanitizeSavedTheme(t, uid)),
        staff: (s.staff || []).map((st) => sanitizeStaffMember(st, uid)),
        tickets: (s.tickets || []).map((tk) => sanitizeRepairTicket(tk, uid)),
        ticketParts: (s.ticketParts || []).map((tp) => sanitizeTicketPart(tp, uid)),
        ticketTimeline: (s.ticketTimeline || []).map((tl) => sanitizeTicketTimeline(tl, uid)),
        inventory: (s.inventory || []).map((inv) => sanitizeInventoryItem(inv, uid)),
        posSales: (s.posSales || []).map((ps) => sanitizePosSale(ps, uid)),
        posSaleItems: (s.posSaleItems || []).map((psi) => sanitizePosSaleItem(psi, uid)),
        bookings: (s.bookings || []).map((bk) => sanitizeWorkshopBooking(bk, uid)),
        lastSyncMs: Date.now(),
      };
      setSnapshot(sanitized);
      if (canCloudSync && user) {
        await pushFullSnapshotToCloud(user.uid, sanitized);
      }
    },
    [activeUid, canCloudSync, pushFullSnapshotToCloud, user]
  );

  const clearShopData = useCallback(async () => {
    const uid = activeUid;
    const empty = createEmptySnapshot(uid);
    empty.shopProfile = {
      ...snapshotRef.current.shopProfile,
      nextTicketSeq: 1001,
      nextSaleSeq: 5001,
      nextBookingSeq: 201,
    };
    empty.savedThemes = snapshotRef.current.savedThemes;
    empty.staff = snapshotRef.current.staff;

    const prev = snapshotRef.current;
    setSnapshot(empty);

    if (canCloudSync && user) {
      setIsSyncing(true);
      try {
        const deletes: ReturnType<typeof doc>[] = [
          ...prev.tickets.map((x) => doc(db, 'users', uid, 'tickets', x.id)),
          ...prev.ticketParts.map((x) => doc(db, 'users', uid, 'ticketParts', x.id)),
          ...prev.ticketTimeline.map((x) => doc(db, 'users', uid, 'ticketTimeline', x.id)),
          ...prev.inventory.map((x) => doc(db, 'users', uid, 'inventory', x.id)),
          ...prev.posSales.map((x) => doc(db, 'users', uid, 'posSales', x.id)),
          ...prev.posSaleItems.map((x) => doc(db, 'users', uid, 'posSaleItems', x.id)),
          ...prev.bookings.map((x) => doc(db, 'users', uid, 'bookings', x.id)),
        ];
        for (let i = 0; i < deletes.length; i += 400) {
          const batch = writeBatch(db);
          for (const dRef of deletes.slice(i, i + 400)) {
            batch.delete(dRef);
          }
          await batch.commit();
        }
        await pushFullSnapshotToCloud(uid, empty);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [activeUid, canCloudSync, pushFullSnapshotToCloud, user]);

  const value = useMemo<StoreContextValue>(
    () => ({
      authMode,
      user,
      snapshot,
      isSyncing,
      syncError,
      lastCloudSyncMs,
      signInWithGoogle,
      signInWithEmail,
      createFirebaseAccount,
      resendVerificationEmail,
      refreshVerificationAndSync,
      hasOfflinePendingData,
      syncOfflineLocalDataToAccount,
      continueOffline,
      signOutUser,
      updateShopProfile,
      applyTheme,
      saveTheme,
      deleteTheme,
      upsertStaff,
      deleteStaff,
      createTicket,
      updateTicket,
      settleTicketBalance,
      attachPartToTicket,
      removePartFromTicket,
      upsertInventoryItem,
      deleteInventoryItem,
      bulkAssignRack,
      completePosSale,
      createBooking,
      updateBookingStatus,
      convertBookingToTicket,
      backupNow,
      restoreFromCloud,
      exportJsonBackup,
      importJsonBackup,
      clearShopData,
    }),
    [
      authMode,
      user,
      snapshot,
      isSyncing,
      syncError,
      lastCloudSyncMs,
      signInWithGoogle,
      signInWithEmail,
      createFirebaseAccount,
      resendVerificationEmail,
      refreshVerificationAndSync,
      hasOfflinePendingData,
      syncOfflineLocalDataToAccount,
      continueOffline,
      signOutUser,
      updateShopProfile,
      applyTheme,
      saveTheme,
      deleteTheme,
      upsertStaff,
      deleteStaff,
      createTicket,
      updateTicket,
      settleTicketBalance,
      attachPartToTicket,
      removePartFromTicket,
      upsertInventoryItem,
      deleteInventoryItem,
      bulkAssignRack,
      completePosSale,
      createBooking,
      updateBookingStatus,
      convertBookingToTicket,
      backupNow,
      restoreFromCloud,
      exportJsonBackup,
      importJsonBackup,
      clearShopData,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
