import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import {
  DBState,
  PageId,
  InvoiceItem,
  PurchaseItem,
  SalesReturnItem,
  Invoice,
  UserProfile,
  UserPermissionSet,
  Product,
  Customer
} from '../types';
import {
  fsdb,
  fsauth,
  COLLECTIONS,
  defaultDB,
  SYNC_WINDOW_DAYS,
  recordAudit,
  FieldValue
} from '../lib/firebase';
import { OfflineSyncManager, QueuedOfflineOperation } from '../lib/offlineSync';
import {
  hasPermission,
  canAccessPage,
  resolveEffectiveSession,
  DEFAULT_ADMIN_PERMISSIONS
} from '../lib/permissions';
import type firebase from 'firebase/compat/app';
import { uid, todayStr, productFullName, beepSound } from '../lib/utils';
import { validateCartStock, getBundleCalculatedCost, getBundleAvailableQty } from '../lib/bundles';

export interface PrintModalData {
  title?: string;
  bodyHtml: string;
  phone?: string;
  filename?: string;
  waMessage?: string;
}

export interface AppContextType {
  db: DBState;
  setDb: React.Dispatch<React.SetStateAction<DBState>>;
  currentPage: PageId;
  goTo: (page: PageId) => void;
  currentUser: firebase.User | null;
  currentProfile: UserProfile | null;
  effectiveProfile: UserProfile | null;
  isAccountActive: boolean;
  profileVerificationStatus: 'loading' | 'verified' | 'not_found' | 'error';
  profileVerificationError: string | null;
  retryProfileVerification: () => void;
  otherUserPendingCount: number;
  isAdmin: boolean;
  hasPerm: (key: keyof UserPermissionSet | string) => boolean;
  canAccess: (page: PageId) => boolean;
  toastMessage: string | null;
  toast: (msg: string) => void;
  connStatus: {
    online: boolean;
    fromCache: boolean;
    pendingWrites: boolean;
    draftsCount: number;
    offlinePendingCount: number;
  };
  // Modals & Popups
  offlineModalOpen: boolean;
  openOfflineModal: () => void;
  closeOfflineModal: () => void;
  pwaInstallPrompt: any;
  triggerPwaInstall: () => void;
  isPwaInstalled: boolean;
  globalSearchOpen: boolean;
  openGlobalSearch: () => void;
  closeGlobalSearch: () => void;
  scanModalOpen: boolean;
  scanCallback: ((code: string) => void) | null;
  openScanModal: (callback?: (code: string) => void) => void;
  closeScanModal: () => void;
  quickAddOpen: boolean;
  quickAddContext: { prefix: 'inv' | 'pur'; typedName: string; qty: number } | null;
  openQuickAdd: (prefix: 'inv' | 'pur', typedName?: string, qty?: number) => void;
  closeQuickAdd: () => void;
  printModalData: PrintModalData | null;
  showPrintModal: (data: PrintModalData) => void;
  closePrintModal: () => void;
  egyptianCatalogModalOpen: boolean;
  openEgyptianCatalogModal: () => void;
  closeEgyptianCatalogModal: () => void;
  shadowTestOpen: boolean;
  openShadowTest: () => void;
  closeShadowTest: () => void;
  selectedInvoiceForModal: Invoice | null;
  openInvoiceModal: (invoice: Invoice) => void;
  closeInvoiceModal: () => void;
  reorderInvoiceToCart: (invoice: Invoice) => void;

  // Sale POS Cart State
  saleCartItems: InvoiceItem[];
  setSaleCartItems: React.Dispatch<React.SetStateAction<InvoiceItem[]>>;
  saleCategoryDiscounts: Record<string, { type: 'percent' | 'amount'; value: number }>;
  setSaleCategoryDiscounts: React.Dispatch<React.SetStateAction<Record<string, { type: 'percent' | 'amount'; value: number }>>>;
  addSaleItemByProduct: (productId: string, qty?: number) => boolean;
  processInvoiceBarcode: (code: string, source?: 'scanner' | 'camera') => boolean;
  clearSaleCart: () => void;

  // Purchase Cart State
  purchaseCartItems: PurchaseItem[];
  setPurchaseCartItems: React.Dispatch<React.SetStateAction<PurchaseItem[]>>;

  // Sales Return State
  returnInvoice: Invoice | null;
  setReturnInvoice: React.Dispatch<React.SetStateAction<Invoice | null>>;
  returnSelections: Record<string, number>;
  setReturnSelections: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  exchangeItems: SalesReturnItem[];
  setExchangeItems: React.Dispatch<React.SetStateAction<SalesReturnItem[]>>;
  returnMode: 'cash' | 'exchange';
  setReturnMode: (mode: 'cash' | 'exchange') => void;
  clearReturnState: () => void;

  // Helper sync flags
  firstSyncDone: boolean;
  reconcileBalances: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const OFFLINE_DRAFT_KEY = 'maktabati_stage11_drafts_v1';
export function readOfflineDrafts(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_DRAFT_KEY) || '{}') || {};
  } catch (_e) {
    return {};
  }
}
export function writeOfflineDrafts(x: any) {
  try {
    localStorage.setItem(OFFLINE_DRAFT_KEY, JSON.stringify(x));
  } catch (_e) {}
}

export interface ProfileSnapshotHandlerOptions {
  onVerified: (profile: UserProfile) => void;
  onNotFound: () => void;
  onError: (errorMessage: string) => void;
  onLoading?: () => void;
  timeoutMs?: number;
}

/**
 * Handles Firestore userProfile snapshot with cache-vs-server awareness:
 * 1. If snap.exists === false && snap.metadata.fromCache === true:
 *    Do NOT set not_found. Stay in loading waiting for server.
 * 2. If no confirmed server response arrives within 8s (timeoutMs), switch to error.
 * 3. Only set not_found when snap.exists === false && snap.metadata.fromCache === false.
 * 4. Cleans up timers when server responds or on unsubscribe, preventing updates after cleanup.
 */
export function handleProfileDocumentSnapshot(
  snap: {
    exists: boolean | (() => boolean);
    id?: string;
    data?: () => any;
    metadata?: { fromCache?: boolean; hasPendingWrites?: boolean };
  },
  currentTimer: any,
  setTimer: (timer: any) => void,
  callbacks: ProfileSnapshotHandlerOptions,
  isCleanedUp: () => boolean
): void {
  if (isCleanedUp()) return;

  const exists = typeof snap.exists === 'function' ? snap.exists() : Boolean(snap.exists);
  const fromCache = Boolean(snap.metadata?.fromCache);
  const timeoutMs = callbacks.timeoutMs ?? 8000;

  if (exists) {
    if (currentTimer) {
      clearTimeout(currentTimer);
      setTimer(null);
    }
    const rawData = typeof snap.data === 'function' ? snap.data() : (snap as any).data || {};
    const profile: UserProfile = { id: snap.id || '', ...rawData };
    callbacks.onVerified(profile);
  } else if (fromCache) {
    // 1. Missing in cache, awaiting server authoritative response: stay in loading
    if (callbacks.onLoading) {
      callbacks.onLoading();
    }
    // 2. Start 8-second timer waiting for server confirmation
    if (!currentTimer) {
      const timer = setTimeout(() => {
        if (isCleanedUp()) return;
        setTimer(null);
        callbacks.onError(
          'تعذر التحقق من الصلاحيات من الخادم السحابي بعد الانتظار (8 ثوانٍ). يُرجى التحقق من اتصال الإنترنت وإعادة المحاولة.'
        );
      }, timeoutMs);
      setTimer(timer);
    }
  } else {
    // 3. Confirmed server response: document explicitly does not exist
    if (currentTimer) {
      clearTimeout(currentTimer);
      setTimer(null);
    }
    callbacks.onNotFound();
  }
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<DBState>(() => {
    const base = defaultDB();
    base.userProfiles = [];
    try {
      const savedClosings = localStorage.getItem('maktabati_local_daily_closings');
      if (savedClosings) {
        const parsed = JSON.parse(savedClosings);
        if (Array.isArray(parsed) && parsed.length > 0) {
          base.dailyClosings = parsed;
          (base as any).dayCloses = parsed;
        }
      }
    } catch {}
    return base;
  });
  const [currentPage, setCurrentPage] = useState<PageId>('saleInvoice');
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [firstSyncDone, setFirstSyncDone] = useState(false);
  const [profileVerificationStatus, setProfileVerificationStatus] = useState<
    'loading' | 'verified' | 'not_found' | 'error'
  >('loading');
  const [profileVerificationError, setProfileVerificationError] = useState<string | null>(null);
  const [profileRetryCount, setProfileRetryCount] = useState(0);

  const retryProfileVerification = () => {
    setProfileVerificationStatus('loading');
    setProfileVerificationError(null);
    setProfileRetryCount(c => c + 1);
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);

  const openOfflineModal = () => setOfflineModalOpen(true);
  const closeOfflineModal = () => setOfflineModalOpen(false);

  const [connStatus, setConnStatus] = useState({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    fromCache: false,
    pendingWrites: false,
    draftsCount: Object.keys(readOfflineDrafts()).length,
    offlinePendingCount: OfflineSyncManager.getQueue().filter(q => q.status !== 'synced').length
  });

  // Listen to PWA install prompt
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPwaInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setPwaInstallPrompt(null);
      toast('🎉 تم تثبيت نظام مكتبتي على جهازك بنجاح!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsPwaInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerPwaInstall = async () => {
    if (!pwaInstallPrompt) {
      toast('التطبيق مثبت بالفعل أو أن متصفحك لا يدعم التثبيت المباشر');
      return;
    }
    pwaInstallPrompt.prompt();
    const { outcome } = await pwaInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      setPwaInstallPrompt(null);
    }
  };

  // Subscribe to offline queue changes
  useEffect(() => {
    const unsub = OfflineSyncManager.subscribe(queue => {
      const pendingCount = queue.filter(q => q.status !== 'synced').length;
      setConnStatus(prev => ({
        ...prev,
        offlinePendingCount: pendingCount
      }));
    });
    return () => unsub();
  }, []);

  // Modal states
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanCallback, setScanCallback] = useState<((code: string) => void) | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddContext, setQuickAddContext] = useState<{ prefix: 'inv' | 'pur'; typedName: string; qty: number } | null>(null);
  const [printModalData, setPrintModalData] = useState<PrintModalData | null>(null);
  const [shadowTestOpen, setShadowTestOpen] = useState(false);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Invoice | null>(null);

  const [egyptianCatalogModalOpen, setEgyptianCatalogModalOpen] = useState(false);
  const openEgyptianCatalogModal = () => setEgyptianCatalogModalOpen(true);
  const closeEgyptianCatalogModal = () => setEgyptianCatalogModalOpen(false);

  // Clean up legacy operator session and cached profile keys safely from localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('maktabati_active_operator_id');
      localStorage.removeItem('maktabati_local_user_profiles_v2');
    } catch {}
  }, []);

  // Track pending offline operations belonging to other users (or unowned)
  const [otherUserPendingCount, setOtherUserPendingCount] = useState<number>(() => {
    return OfflineSyncManager.getPendingOtherUserOperations(fsauth.currentUser?.uid).length;
  });

  useEffect(() => {
    const unsub = OfflineSyncManager.subscribe(() => {
      setOtherUserPendingCount(
        OfflineSyncManager.getPendingOtherUserOperations(currentUser?.uid).length
      );
    });
    setOtherUserPendingCount(
      OfflineSyncManager.getPendingOtherUserOperations(currentUser?.uid).length
    );
    return () => unsub();
  }, [currentUser]);

  const openInvoiceModal = (invoice: Invoice) => {
    setSelectedInvoiceForModal(invoice);
  };

  const closeInvoiceModal = () => {
    setSelectedInvoiceForModal(null);
  };

  const reorderInvoiceToCart = (invoice: Invoice) => {
    if (!invoice.items || invoice.items.length === 0) {
      toast('لا توجد أصناف في هذه الفاتورة');
      return;
    }
    setSaleCartItems(invoice.items.map(it => ({ ...it })));
    closeInvoiceModal();
    goTo('saleInvoice');
    toast(`🛒 تم تحميل أصناف الفاتورة #${invoice.number} في سلة البيع بنجاح`);
  };

  // POS State
  const [saleCartItems, setSaleCartItems] = useState<InvoiceItem[]>([]);
  const [saleCategoryDiscounts, setSaleCategoryDiscounts] = useState<Record<string, { type: 'percent' | 'amount'; value: number }>>({});
  const [purchaseCartItems, setPurchaseCartItems] = useState<PurchaseItem[]>([]);

  // Return State
  const [returnInvoice, setReturnInvoice] = useState<Invoice | null>(null);
  const [returnSelections, setReturnSelections] = useState<Record<string, number>>({});
  const [exchangeItems, setExchangeItems] = useState<SalesReturnItem[]>([]);
  const [returnMode, setReturnMode] = useState<'cash' | 'exchange'>('cash');

  // Barcode and POS Quick Action Ref
  const lastBarcodeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const toast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = fsauth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = async () => {
      setConnStatus(prev => ({
        ...prev,
        online: true,
        draftsCount: Object.keys(readOfflineDrafts()).length
      }));
      toast('🟢 عاد الاتصال بالإنترنت — جاري فحص ومزامنة العمليات المعلقة...');

      // Background auto-sync of queued offline invoices
      try {
        const res = await OfflineSyncManager.syncAllPending();
        if (res.synced > 0) {
          toast(`🚀 تمت مزامنة ${res.synced} فاتورة/عملية تلقائياً مع السحابة!`);
        }
      } catch (err) {
        console.warn('Auto-sync background attempt note:', err);
      }
    };
    const handleOffline = () => {
      setConnStatus(prev => ({
        ...prev,
        online: false,
        draftsCount: Object.keys(readOfflineDrafts()).length
      }));
      toast('⚪ انقطع الإنترنت — وضع الأوفلاين نشط (يمكنك مواصلة البيع وحفظ الفواتير محلياً)');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync with Firestore
  useEffect(() => {
    if (!currentUser) {
      setProfileVerificationStatus('loading');
      setProfileVerificationError(null);
      return;
    }

    setProfileVerificationStatus('loading');
    setProfileVerificationError(null);

    let syncReadyCount = 0;
    const syncCutoff = new Date(Date.now() - SYNC_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
    const unsubs: Array<() => void> = [];
    let isCleanedUp = false;
    let serverTimeoutTimer: any = null;

    const clearServerTimer = () => {
      if (serverTimeoutTimer) {
        clearTimeout(serverTimeoutTimer);
        serverTimeoutTimer = null;
      }
    };

    const initSubscriptions = async () => {
      // 1. Authoritative subscription to current user's individual profile document
      try {
        const ownDocRef = fsdb.collection('userProfiles').doc(currentUser.uid);
        const ownDocUnsub = ownDocRef.onSnapshot(
          { includeMetadataChanges: true },
          (snap: firebase.firestore.DocumentSnapshot) => {
            handleProfileDocumentSnapshot(
              snap,
              serverTimeoutTimer,
              (t) => {
                serverTimeoutTimer = t;
              },
              {
                onVerified: (p) => {
                  if (isCleanedUp) return;
                  setDb(prev => {
                    const others = (prev.userProfiles || []).filter(x => x.uid !== p.uid && x.id !== p.id);
                    return { ...prev, userProfiles: [p, ...others] };
                  });
                  setProfileVerificationStatus('verified');
                  setProfileVerificationError(null);
                },
                onLoading: () => {
                  if (isCleanedUp) return;
                  setProfileVerificationStatus('loading');
                  setProfileVerificationError(null);
                },
                onNotFound: () => {
                  if (isCleanedUp) return;
                  setProfileVerificationStatus('not_found');
                  setProfileVerificationError(null);
                },
                onError: (errMsg) => {
                  if (isCleanedUp) return;
                  setProfileVerificationStatus('error');
                  setProfileVerificationError(errMsg);
                },
                timeoutMs: 8000
              },
              () => isCleanedUp
            );
          },
          (err: any) => {
            if (isCleanedUp) return;
            clearServerTimer();
            console.warn('Profile doc sync error:', err.message);
            setProfileVerificationStatus('error');
            setProfileVerificationError(err.message || 'تعذر قراءة بيانات المستخدم من الخادم');
          }
        );
        unsubs.push(ownDocUnsub);
      } catch (err: any) {
        if (!isCleanedUp) {
          clearServerTimer();
          setProfileVerificationStatus('error');
          setProfileVerificationError(err.message || 'فشل إعداد مستمع ملف المستخدم');
        }
      }

      // 2. Collection listener for userProfiles roster (if authorized / accessible)
      try {
        const userProfilesUnsub = fsdb.collection('userProfiles').onSnapshot(
          { includeMetadataChanges: true },
          (snap: firebase.firestore.QuerySnapshot) => {
            if (isCleanedUp) return;
            const cloudProfiles: UserProfile[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
            if (cloudProfiles.length > 0) {
              setDb(prev => ({
                ...prev,
                userProfiles: cloudProfiles
              }));
              const myProfile = cloudProfiles.find(x => x.uid === currentUser.uid);
              if (myProfile) {
                clearServerTimer();
                setProfileVerificationStatus('verified');
                setProfileVerificationError(null);
              }
            }
          },
          (err: any) => {
            console.warn('User profiles collection sync note:', err.message);
          }
        );
        unsubs.push(userProfilesUnsub);
      } catch (err) {
        console.warn('User profiles collection listener error:', err);
      }

      // 3. Subscribe to standard business collections (excluding append-only / write-only logging)
      const subs = COLLECTIONS.filter(name => name !== 'operationKeys' && name !== 'auditLogs').map(name => {
        if (name === 'stockMovements') {
          return { name, ref: fsdb.collection(name).where('date', '>=', syncCutoff) };
        }
        return { name, ref: fsdb.collection(name) };
      });

      subs.forEach(({ name, ref }) => {
        const unsub = (ref as any).onSnapshot(
          { includeMetadataChanges: true },
          (snap: firebase.firestore.QuerySnapshot) => {
            if (isCleanedUp) return;
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            setDb(prev => ({
              ...prev,
              [name]: items
            }));

            setConnStatus(prev => ({
              ...prev,
              fromCache: !!snap.metadata.fromCache,
              pendingWrites: !!snap.metadata.hasPendingWrites,
              draftsCount: Object.keys(readOfflineDrafts()).length
            }));

            if (!firstSyncDone) {
              syncReadyCount++;
              if (syncReadyCount >= subs.length) {
                setFirstSyncDone(true);
              }
            }
          },
          (err: any) => {
            console.warn(`Sync note for collection ${name}:`, err.message);
          }
        );
        unsubs.push(unsub);
      });
    };

    initSubscriptions();

    // Fallback timer so UI is never blocked indefinitely if offline/slow:
    // CRITICAL: Does NOT assume not_found! If still loading, switches safely to 'error'.
    const fallbackTimer = setTimeout(() => {
      if (isCleanedUp) return;
      setProfileVerificationStatus(prev => {
        if (prev === 'loading') {
          setProfileVerificationError('انتهت مهلة انتظار الاتصال بقاعدة البيانات (8 ثوانٍ). يُرجى التحقق من اتصال الإنترنت وإعادة المحاولة.');
          return 'error';
        }
        return prev;
      });
      setFirstSyncDone(true);
    }, 8000);

    return () => {
      isCleanedUp = true;
      clearServerTimer();
      clearTimeout(fallbackTimer);
      unsubs.forEach(unsub => unsub());
    };
  }, [currentUser, profileRetryCount]);

  const { currentProfile, isAccountActive, effectiveProfile, isAdmin } = resolveEffectiveSession(
    profileVerificationStatus === 'verified' ? db.userProfiles : [],
    currentUser?.uid
  );

  const hasPerm = (key: keyof UserPermissionSet | string): boolean => {
    return hasPermission(effectiveProfile, key as keyof UserPermissionSet);
  };

  const canAccess = (page: PageId): boolean => {
    return canAccessPage(page, effectiveProfile);
  };

  const goTo = (page: PageId) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addSaleItemByProduct = (productId: string, qtyToAdd = 1): boolean => {
    const p = db.products.find(x => x.id === productId);
    if (!p) {
      toast('الصنف غير موجود بالمخزون');
      return false;
    }
    const qty = Math.max(1, qtyToAdd);

    // Validate entire cart stock against physical inventory (including bundle components)
    const validation = validateCartStock(saleCartItems, db.products, { productId, qty });
    if (!validation.valid) {
      toast(validation.error || 'المخزون غير كافٍ');
      return false;
    }

    const itemCost = p.isBundle ? getBundleCalculatedCost(p, db.products) : (p.costPrice || 0);

    setSaleCartItems(prev => {
      const idx = prev.findIndex(it => it.productId === productId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty, cost: itemCost };
        return next;
      } else {
        return [
          ...prev,
          {
            productId: p.id,
            name: productFullName(p),
            qty,
            price: p.sellPrice,
            originalPrice: p.sellPrice,
            cost: itemCost,
            term: p.term || ''
          }
        ];
      }
    });
    toast(`✅ ${p.name} × ${qty}`);
    return true;
  };

  const processInvoiceBarcode = (code: string, source: 'scanner' | 'camera' = 'scanner'): boolean => {
    const bc = String(code || '').trim();
    if (!bc) return false;

    const now = Date.now();
    if (bc === lastBarcodeRef.current.code && now - lastBarcodeRef.current.time < 250) {
      return false;
    }
    lastBarcodeRef.current = { code: bc, time: now };

    const p = db.products.find(x => String(x.barcode || '').trim() === bc);
    if (p) {
      beepSound();
      return addSaleItemByProduct(p.id, 1);
    }
    toast(`لم يتم العثور على صنف بالباركود: ${bc}`);
    return false;
  };

  const clearSaleCart = () => {
    setSaleCartItems([]);
    setSaleCategoryDiscounts({});
  };

  const clearReturnState = () => {
    setReturnInvoice(null);
    setReturnSelections({});
    setExchangeItems([]);
    setReturnMode('cash');
  };

  const openScanModal = (callback?: (code: string) => void) => {
    setScanCallback(() => callback || null);
    setScanModalOpen(true);
  };

  const closeScanModal = () => {
    setScanModalOpen(false);
    setScanCallback(null);
  };

  const openQuickAdd = (prefix: 'inv' | 'pur', typedName = '', qty = 1) => {
    setQuickAddContext({ prefix, typedName, qty });
    setQuickAddOpen(true);
  };

  const closeQuickAdd = () => {
    setQuickAddOpen(false);
    setQuickAddContext(null);
  };

  const showPrintModal = (data: PrintModalData) => {
    setPrintModalData(data);
  };

  const closePrintModal = () => {
    setPrintModalData(null);
  };

  const openGlobalSearch = () => setGlobalSearchOpen(true);
  const closeGlobalSearch = () => setGlobalSearchOpen(false);
  const openShadowTest = () => setShadowTestOpen(true);
  const closeShadowTest = () => setShadowTestOpen(false);

  const reconcileBalances = async () => {
    if (!isAdmin) {
      toast('إعادة حساب الأرصدة متاحة لمدير النظام فقط');
      return;
    }
    try {
      let updatedCustomers = 0;
      let updatedSuppliers = 0;

      const customerBatches: firebase.firestore.WriteBatch[] = [];
      let curBatch = fsdb.batch();
      let curCount = 0;

      for (const c of (db.customers || [])) {
        const active = (db.invoices || []).filter(i => i.customerId === c.id && i.status !== 'refunded');
        const invoiced = active.reduce((s, i) => s + (Number(i.total) || 0), 0);
        const paidAtSale = active.reduce((s, i) => s + (Number(i.paidAmount ?? i.total) || 0), 0);
        const returns = (db.salesReturns || []).filter(r => r.customerId === c.id);
        const returnCredit = returns.reduce((s, r) => s + (Number(r.creditReduction) || 0), 0);
        const extraPayments = (db.customerPayments || []).filter(x => x.customerId === c.id).reduce((s, x) => s + (Number(x.amount) || 0), 0);

        const b = { invoiced: invoiced - returnCredit, paid: paidAtSale + extraPayments };
        curBatch.update(fsdb.collection('customers').doc(c.id), {
          balance: { invoiced: b.invoiced, paid: b.paid, updatedAt: new Date().toISOString() }
        });
        curCount++;
        updatedCustomers++;
        if (curCount >= 400) {
          customerBatches.push(curBatch);
          curBatch = fsdb.batch();
          curCount = 0;
        }
      }
      if (curCount > 0) customerBatches.push(curBatch);
      for (const b of customerBatches) await b.commit();

      const supplierBatches: firebase.firestore.WriteBatch[] = [];
      curBatch = fsdb.batch();
      curCount = 0;

      for (const s of (db.suppliers || [])) {
        const purchased = (db.purchases || []).filter(p => p.supplierId === s.id).reduce((sum, p) => sum + (Number(p.total) || 0), 0);
        const paidAtPurchase = (db.purchases || []).filter(p => p.supplierId === s.id).reduce((sum, p) => sum + (Number(p.paidAmount ?? p.total) || 0), 0);
        const extraPayments = (db.supplierPayments || []).filter(x => x.supplierId === s.id).reduce((sum, x) => sum + (Number(x.amount) || 0), 0);

        const b = { purchased, paid: paidAtPurchase + extraPayments };
        curBatch.update(fsdb.collection('suppliers').doc(s.id), {
          balance: { invoiced: b.purchased, paid: b.paid, updatedAt: new Date().toISOString() }
        });
        curCount++;
        updatedSuppliers++;
        if (curCount >= 400) {
          supplierBatches.push(curBatch);
          curBatch = fsdb.batch();
          curCount = 0;
        }
      }
      if (curCount > 0) supplierBatches.push(curBatch);
      for (const b of supplierBatches) await b.commit();

      toast(`✅ تمت تسوية ${updatedCustomers} عميل و ${updatedSuppliers} مورد بنجاح.`);
    } catch (e: any) {
      toast(`خطأ أثناء تسوية الأرصدة: ${e.message}`);
    }
  };

  return (
    <AppContext.Provider
      value={{
        db,
        setDb,
        currentPage,
        goTo,
        currentUser,
        currentProfile,
        effectiveProfile,
        isAccountActive,
        profileVerificationStatus,
        profileVerificationError,
        retryProfileVerification,
        otherUserPendingCount,
        isAdmin,
        hasPerm,
        canAccess,
        toastMessage,
        toast,
        connStatus,
        offlineModalOpen,
        openOfflineModal,
        closeOfflineModal,
        pwaInstallPrompt,
        triggerPwaInstall,
        isPwaInstalled,
        globalSearchOpen,
        openGlobalSearch,
        closeGlobalSearch,
        scanModalOpen,
        scanCallback,
        openScanModal,
        closeScanModal,
        quickAddOpen,
        quickAddContext,
        openQuickAdd,
        closeQuickAdd,
        printModalData,
        showPrintModal,
        closePrintModal,
        egyptianCatalogModalOpen,
        openEgyptianCatalogModal,
        closeEgyptianCatalogModal,
        shadowTestOpen,
        openShadowTest,
        closeShadowTest,
        selectedInvoiceForModal,
        openInvoiceModal,
        closeInvoiceModal,
        reorderInvoiceToCart,
        saleCartItems,
        setSaleCartItems,
        saleCategoryDiscounts,
        setSaleCategoryDiscounts,
        addSaleItemByProduct,
        processInvoiceBarcode,
        clearSaleCart,
        purchaseCartItems,
        setPurchaseCartItems,
        returnInvoice,
        setReturnInvoice,
        returnSelections,
        setReturnSelections,
        exchangeItems,
        setExchangeItems,
        returnMode,
        setReturnMode,
        clearReturnState,
        firstSyncDone,
        reconcileBalances
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
