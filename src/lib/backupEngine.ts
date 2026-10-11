import { DBState, BackupSnapshotMeta } from '../types';
import { fsdb, exportFullBackup, restoreFullBackup, auditActor } from './firebase';
import { recordSecureAudit } from './auditEngine';
import { uid, todayStr } from './utils';

const SNAPSHOTS_INDEX_KEY = 'maktabati_snapshots_index_v2';
const SNAPSHOT_PREFIX = 'maktabati_snap_v2_';
const MAX_SNAPSHOTS_RETAINED = 30;

/**
 * Calculates a quick string checksum for validation
 */
export function calculateChecksum(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `chk_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Get all local snapshots metadata
 */
export function getLocalSnapshotsIndex(): BackupSnapshotMeta[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

/**
 * Save a complete local snapshot of current DBState into LocalStorage
 */
export async function createLocalSnapshot(
  db: DBState,
  trigger: 'dayClose' | 'manual' | 'scheduled' | 'pre_update' = 'manual'
): Promise<BackupSnapshotMeta> {
  const actor = auditActor();
  const id = uid();
  const date = todayStr();
  const timestamp = new Date().toISOString();

  // Export full raw state from in-memory DBState directly (instant, offline-safe)
  const rawData = await exportFullBackup(db);
  const serialized = JSON.stringify(rawData);
  const checksum = calculateChecksum(serialized);
  const sizeBytes = new Blob([serialized]).size;

  const meta: BackupSnapshotMeta = {
    id,
    date,
    timestamp,
    trigger,
    recordsCount:
      (db.products?.length || 0) +
      (db.invoices?.length || 0) +
      (db.purchases?.length || 0) +
      (db.customers?.length || 0) +
      (db.suppliers?.length || 0),
    checksum,
    actorUid: actor.uid,
    actorName: actor.name,
    sizeBytes,
    summary: {
      products: db.products?.length || 0,
      invoices: db.invoices?.length || 0,
      purchases: db.purchases?.length || 0,
      customers: db.customers?.length || 0,
      suppliers: db.suppliers?.length || 0
    }
  };

  try {
    // Save snapshot content to LocalStorage
    localStorage.setItem(`${SNAPSHOT_PREFIX}${id}`, serialized);

    // Update index (keep max snapshots)
    const existing = getLocalSnapshotsIndex();
    const updated = [meta, ...existing.filter(item => item.id !== id)];

    // Prune older than MAX_SNAPSHOTS_RETAINED
    if (updated.length > MAX_SNAPSHOTS_RETAINED) {
      const removed = updated.splice(MAX_SNAPSHOTS_RETAINED);
      removed.forEach(r => {
        try {
          localStorage.removeItem(`${SNAPSHOT_PREFIX}${r.id}`);
        } catch (_e) {}
      });
    }

    localStorage.setItem(SNAPSHOTS_INDEX_KEY, JSON.stringify(updated));

    // Also persist snapshot metadata to Firestore in background (non-blocking)
    fsdb.collection('backupSnapshots').doc(id).set({
      ...meta,
      createdAt: timestamp
    }).catch(_cloudErr => {
      // Local copy is safely stored
    });

    // Log the backup event securely in background
    recordSecureAudit(
      'إنشاء نسخة احتياطية آلية (Snapshot)',
      'system_backup',
      { snapshotId: id, trigger, sizeBytes, recordsCount: meta.recordsCount },
      'info'
    ).catch(_e => {});
  } catch (err: any) {
    console.warn('Local snapshot storage error:', err);
  }

  return meta;
}

/**
 * Restore database state from a local snapshot
 */
export async function restoreFromLocalSnapshot(snapshotId: string): Promise<boolean> {
  const raw = localStorage.getItem(`${SNAPSHOT_PREFIX}${snapshotId}`);
  if (!raw) {
    throw new Error('النسخة الاحتياطية المطلوبة غير موجودة في التخزين المحلي');
  }

  const parsed = JSON.parse(raw);
  await restoreFullBackup(parsed);

  await recordSecureAudit(
    'استرجاع قاعدة البيانات من نسخة احتياطية محلية',
    'system_backup',
    { snapshotId, restoredAt: new Date().toISOString() },
    'critical'
  );

  return true;
}

/**
 * Validate a backup file JSON structure before restoring
 */
export function validateBackupSchema(json: any): { valid: boolean; message: string; recordCounts?: Record<string, number> } {
  if (!json || typeof json !== 'object') {
    return { valid: false, message: 'ملف النسخة الاحتياطية غير صالح أو فارغ' };
  }

  const data = json.data || json;
  if (typeof data !== 'object') {
    return { valid: false, message: 'هيكل بيانات النسخة الاحتياطية غير متوافق' };
  }

  // Count records
  const recordCounts: Record<string, number> = {};
  let totalFound = 0;

  [
    'products',
    'invoices',
    'salesReturns',
    'purchases',
    'purchaseReturns',
    'customers',
    'suppliers',
    'supplierPayments',
    'customerPayments',
    'expenses',
    'dailyClosings',
    'dayCloses',
    'stockMovements',
    'treasuryAdjustments'
  ].forEach(key => {
    const list = data[key];
    const count = Array.isArray(list) ? list.length : 0;
    recordCounts[key] = count;
    totalFound += count;
  });

  if (totalFound === 0 && !Array.isArray(data.products) && !Array.isArray(data.invoices)) {
    return { valid: false, message: 'الملف لا يحتوي على جداول فواتير أو أصناف صالحة للاسترجاع' };
  }

  return { valid: true, message: 'ملف النسخة الاحتياطية صالح ومفحوص بنجاح', recordCounts };
}

/**
 * Delete a local snapshot from index
 */
export function deleteLocalSnapshot(snapshotId: string): void {
  try {
    localStorage.removeItem(`${SNAPSHOT_PREFIX}${snapshotId}`);
    const index = getLocalSnapshotsIndex();
    const updated = index.filter(i => i.id !== snapshotId);
    localStorage.setItem(SNAPSHOTS_INDEX_KEY, JSON.stringify(updated));
  } catch (_e) {}
}

/**
 * Get backup health status (e.g. for dashboard indicators)
 */
export function getBackupHealthStatus(): {
  isUpToDate: boolean;
  lastBackupDate: string | null;
  snapshotsCount: number;
  message: string;
} {
  const index = getLocalSnapshotsIndex();
  if (index.length === 0) {
    return {
      isUpToDate: false,
      lastBackupDate: null,
      snapshotsCount: 0,
      message: 'لم يتم أخذ أي نسخة احتياطية محلية حتى الآن'
    };
  }

  const latest = index[0];
  const today = todayStr();
  const isToday = latest.date === today;

  return {
    isUpToDate: isToday,
    lastBackupDate: latest.date,
    snapshotsCount: index.length,
    message: isToday
      ? `النظام محمي ومحدث (آخر نسخة اليوم: ${new Date(latest.timestamp).toLocaleTimeString('ar-EG')})`
      : `يُوصى بأخذ نسخة احتياطية اليوم (آخر نسخة: ${latest.date})`
  };
}
