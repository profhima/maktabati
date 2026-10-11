import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { DBState } from '../types';
import { uid, todayStr } from './utils';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCGUbgrnl1TnzEykPQ6XqiB_vW-g0a7zNA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "fekra-d1a66.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "fekra-d1a66",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "fekra-d1a66.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1002184581818",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1002184581818:web:93c38ffd34525818bf5883"
};

export const app = !firebase.apps.length
  ? firebase.initializeApp(firebaseConfig)
  : firebase.app();

export const fsdb = typeof firebase.firestore === 'function'
  ? firebase.firestore()
  : (app as any).firestore();

export const fsauth = typeof firebase.auth === 'function'
  ? firebase.auth()
  : (app as any).auth();

try {
  if (typeof window !== 'undefined' && fsauth && typeof fsauth.setPersistence === 'function') {
    fsauth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((err: any) => {
      if (err?.message?.includes('closing') || err?.message?.includes('hidden')) {
        fsauth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});
      }
    });
  }
} catch (_e) {}

export const FieldValue = (firebase.firestore?.FieldValue || (app as any).firestore?.FieldValue);

export { firebase };

try {
  fsdb.settings({ ignoreUndefinedProperties: true });
} catch (_e) {}

try {
  fsdb.enablePersistence({ synchronizeTabs: true });
} catch (_e) {}

export const COLLECTIONS = [
  'products',
  'customers',
  'suppliers',
  'invoices',
  'salesReturns',
  'purchases',
  'purchaseReturns',
  'expenses',
  'dailyClosings',
  'dayCloses',
  'treasuryAdjustments',
  'supplierPayments',
  'customerPayments',
  'printingTariffs',
  'operationKeys',
  'stockMovements',
  'cashMovements',
  'auditLogs'
] as const;

export const APPEND_ONLY_COLLECTIONS = new Set(['auditLogs', 'operationKeys']);
export const RESTORE_COLLECTIONS = COLLECTIONS.filter(
  name => !APPEND_ONLY_COLLECTIONS.has(name)
);

export const SYNC_WINDOW_DAYS = 180;

export function defaultDB(): DBState {
  return {
    products: [],
    customers: [],
    suppliers: [],
    invoices: [],
    salesReturns: [],
    purchases: [],
    purchaseReturns: [],
    expenses: [],
    dailyClosings: [],
    dayCloses: [],
    treasuryAdjustments: [],
    supplierPayments: [],
    customerPayments: [],
    printingTariffs: [],
    operationKeys: [],
    stockMovements: [],
    cashMovements: [],
    auditLogs: [],
    userProfiles: []
  };
}

export function auditActor() {
  try {
    const u = fsauth.currentUser;
    return {
      uid: u?.uid || 'local-user',
      email: u?.email || 'غير مسجل',
      name: u?.displayName || 'المستخدم الحالي'
    };
  } catch (_e) {
    return { uid: 'local-user', email: 'غير مسجل', name: 'المستخدم الحالي' };
  }
}

export async function recordAudit(action: string, entity: string, details: Record<string, any> = {}) {
  const actor = auditActor();
  const row = {
    id: uid(),
    action: String(action || 'عملية'),
    entity: String(entity || '-'),
    details: details || {},
    actorUid: actor.uid,
    createdBy: actor.uid,
    actorEmail: actor.email,
    actorName: actor.name,
    date: todayStr(),
    createdAt: new Date().toISOString()
  };
  try {
    await fsdb.collection('auditLogs').doc(row.id).set(row);
  } catch (e) {
    console.warn('Audit log failed', e);
  }
  return row;
}

export async function batchUpsert(collectionName: string, records: any[]) {
  const CHUNK = 400;
  for (let i = 0; i < records.length; i += CHUNK) {
    const batch = fsdb.batch();
    records.slice(i, i + CHUNK).forEach(rec => {
      batch.set(fsdb.collection(collectionName).doc(rec.id), rec);
    });
    await batch.commit();
  }
}

export async function getNextNumber(field: string): Promise<number> {
  const ref = fsdb.collection('meta').doc('counters');
  return fsdb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data()?.[field] || 0) : 0;
    const next = current + 1;
    tx.set(ref, { [field]: next }, { merge: true });
    return next;
  });
}

const BACKUP_COLLECTIONS = [
  'products',
  'invoices',
  'salesReturns',
  'purchases',
  'purchaseReturns',
  'expenses',
  'customers',
  'suppliers',
  'supplierPayments',
  'customerPayments',
  'dailyClosings',
  'dayCloses',
  'printingTariffs',
  'stockMovements',
  'treasuryAdjustments',
  'cashMovements',
  'users'
];

export async function exportFullBackup(dbState?: DBState): Promise<Record<string, any>> {
  const data: Record<string, any[]> = {};
  if (dbState) {
    for (const col of BACKUP_COLLECTIONS) {
      data[col] = Array.isArray((dbState as any)[col]) ? (dbState as any)[col] : [];
    }
  } else {
    for (const col of BACKUP_COLLECTIONS) {
      try {
        const snap = await fsdb.collection(col).get();
        data[col] = snap.docs.map(d => d.data());
      } catch (err) {
        console.warn(`Export error for collection ${col}:`, err);
        data[col] = [];
      }
    }
  }
  return {
    version: '2.0-erp',
    exportedAt: new Date().toISOString(),
    data
  };
}

export async function restoreFullBackup(backupJson: any): Promise<void> {
  const data = backupJson.data || backupJson;
  for (const col of BACKUP_COLLECTIONS) {
    const records = data[col];
    if (Array.isArray(records) && records.length > 0) {
      await batchUpsert(col, records);
    }
  }
}

// Immutable collections where delete is prohibited by security rules (allow delete: if false / omitted)
export const IMMUTABLE_COLLECTIONS_NO_DELETE = [
  'stockMovements',
  'customerPayments',
  'supplierPayments',
  'purchaseReturns'
];

export interface PurgeResult {
  purgedCount: number;
  skippedCollections: string[];
  purgedCollections: string[];
}

export async function purgeAllData(): Promise<PurgeResult> {
  const CHUNK = 400;
  let purgedCount = 0;
  const skippedCollections: string[] = [];
  const purgedCollections: string[] = [];

  for (const col of BACKUP_COLLECTIONS) {
    if (IMMUTABLE_COLLECTIONS_NO_DELETE.includes(col)) {
      console.info(`[purgeAllData] تخطي المجموعة الثابتة غير القابلة للحذف بقواعد الأمان: ${col}`);
      skippedCollections.push(col);
      continue;
    }

    try {
      const snap = await fsdb.collection(col).get();
      if (snap.empty) {
        purgedCollections.push(col);
        continue;
      }

      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += CHUNK) {
        const batch = fsdb.batch();
        docs.slice(i, i + CHUNK).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        purgedCount += docs.slice(i, i + CHUNK).length;
      }
      purgedCollections.push(col);
    } catch (err) {
      console.warn(`[purgeAllData] تعذر حذف المجموعة ${col}:`, err);
      skippedCollections.push(col);
    }
  }

  return { purgedCount, skippedCollections, purgedCollections };
}

