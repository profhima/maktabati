import { AuditLog } from '../types';
import { fsdb, auditActor } from './firebase';
import { uid, todayStr } from './utils';

/**
 * Session tracking for concurrency and offline-safe audit chaining.
 * Prevents false-positive chain breakage when concurrent devices or offline sync write to Firestore.
 */
let memoryLastHash: string = '';

function getAuditSessionId(): string {
  try {
    let sess = sessionStorage.getItem('maktabati_audit_session_id');
    if (!sess) {
      sess = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('maktabati_audit_session_id', sess);
    }
    return sess;
  } catch {
    return 'sess_default';
  }
}

function getNextLocalSequence(): number {
  try {
    const cur = parseInt(sessionStorage.getItem('maktabati_audit_local_seq') || '0', 10);
    const next = cur + 1;
    sessionStorage.setItem('maktabati_audit_local_seq', String(next));
    return next;
  } catch {
    return 1;
  }
}

function getLastSessionHash(): string {
  try {
    return memoryLastHash || sessionStorage.getItem('maktabati_audit_last_hash') || '';
  } catch {
    return memoryLastHash || '';
  }
}

function setLastSessionHash(hash: string) {
  memoryLastHash = hash;
  try {
    sessionStorage.setItem('maktabati_audit_last_hash', hash);
  } catch {}
}

/**
 * Deterministic legacy hash computation for backward-compatible verification of historical logs
 */
export function computeLegacyRecordHash(data: Record<string, any>, prevHash: string = 'GENESIS_BLOCK'): string {
  const serialized = JSON.stringify({
    prev: prevHash,
    actor: data.actorUid,
    act: data.action,
    ent: data.entity,
    det: data.details,
    date: data.date,
    ts: data.createdAt
  });

  let hash1 = 0x811c9dc5;
  let hash2 = 0x5bd1e995;

  for (let i = 0; i < serialized.length; i++) {
    const char = serialized.charCodeAt(i);
    hash1 ^= char;
    hash1 = (hash1 * 0x01000193) >>> 0;
    hash2 = (hash2 ^ (char + (hash1 & 0xff))) >>> 0;
    hash2 = ((hash2 << 5) | (hash2 >>> 27)) >>> 0;
  }

  const p1 = hash1.toString(16).padStart(8, '0');
  const p2 = hash2.toString(16).padStart(8, '0');
  return `hash_${p1}${p2}`;
}

/**
 * Cryptographically secure SHA-256 hash computation for audit records using Web Crypto API
 */
export async function computeRecordHash(
  data: Record<string, any>,
  prevHash: string = 'GENESIS_00000000'
): Promise<string> {
  const serialized = JSON.stringify({
    prev: prevHash,
    actor: data.actorUid,
    act: data.action,
    ent: data.entity,
    det: data.details,
    date: data.date,
    ts: data.createdAt,
    sess: data.sessionId || '',
    seq: data.localSequence || 0
  });

  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(serialized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return `sha256_${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}`;
  } catch (err) {
    console.error('Crypto subtle failure in computeRecordHash, falling back to legacy hash:', err);
    return computeLegacyRecordHash(data, prevHash);
  }
}

/**
 * Record an immutable, tamper-evident audit entry in Firestore using SHA-256
 */
export async function recordSecureAudit(
  action: string,
  entity: string,
  details: Record<string, any> = {},
  severity: 'info' | 'warn' | 'critical' = 'info'
): Promise<AuditLog> {
  const actor = auditActor();
  const id = uid();
  const date = todayStr();
  const createdAt = new Date().toISOString();
  const sessionId = getAuditSessionId();
  const localSequence = getNextLocalSequence();

  // Chain to previous hash of this device/session, or query latest if first in session
  let prevHash = getLastSessionHash();
  if (!prevHash) {
    try {
      const lastSnap = await fsdb
        .collection('auditLogs')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      if (!lastSnap.empty) {
        const lastDoc = lastSnap.docs[0].data() as AuditLog;
        if (lastDoc.hash) {
          prevHash = lastDoc.hash;
        }
      }
    } catch (_e) {
      // Offline fallback
    }
  }

  if (!prevHash) {
    prevHash = 'GENESIS_00000000';
  }

  const logPayload = {
    id,
    action: String(action || 'عملية'),
    entity: String(entity || '-'),
    details: details || {},
    actorUid: actor.uid,
    createdBy: actor.uid,
    actorEmail: actor.email,
    actorName: actor.name,
    date,
    createdAt,
    severity,
    prevHash,
    sessionId,
    localSequence
  };

  const hash = await computeRecordHash(logPayload, prevHash);
  setLastSessionHash(hash);

  const finalLog: AuditLog = {
    ...logPayload,
    hash
  };

  try {
    await fsdb.collection('auditLogs').doc(id).set(finalLog);
  } catch (e) {
    console.warn('Audit record warning:', e);
  }

  return finalLog;
}

/**
 * Verifies the integrity of the audit logs chain.
 * Validates cryptographic SHA-256 payload integrity and session sequence chaining.
 * Prevents false positives between concurrent devices or delayed offline syncs.
 */
export async function verifyAuditChain(logs: AuditLog[]): Promise<{
  valid: boolean;
  totalVerified: number;
  brokenIndex?: number;
  brokenLogId?: string;
  tamperedCount: number;
}> {
  if (!logs || logs.length === 0) {
    return { valid: true, totalVerified: 0, tamperedCount: 0 };
  }

  let tamperedCount = 0;
  let firstBrokenIndex: number | undefined = undefined;
  let firstBrokenId: string | undefined = undefined;

  // 1. Verify individual record payload integrity
  for (let i = 0; i < logs.length; i++) {
    const current = logs[i];
    if (!current.hash) {
      tamperedCount++;
      if (firstBrokenIndex === undefined) {
        firstBrokenIndex = i;
        firstBrokenId = current.id;
      }
      continue;
    }

    let calculated = '';
    if (current.hash.startsWith('sha256_')) {
      calculated = await computeRecordHash(current, current.prevHash || 'GENESIS_00000000');
    } else {
      // Legacy backward-compatible hash check
      calculated = computeLegacyRecordHash(current, current.prevHash || 'GENESIS_BLOCK');
    }

    if (calculated !== current.hash) {
      tamperedCount++;
      if (firstBrokenIndex === undefined) {
        firstBrokenIndex = i;
        firstBrokenId = current.id;
      }
    }
  }

  // 2. Verify sequence chaining per session (concurrency-safe)
  const sessionStreams = new Map<string, AuditLog[]>();
  const legacyLogs: AuditLog[] = [];

  for (const log of logs) {
    if (log.sessionId) {
      const list = sessionStreams.get(log.sessionId) || [];
      list.push(log);
      sessionStreams.set(log.sessionId, list);
    } else {
      legacyLogs.push(log);
    }
  }

  // Verify each session stream's sequence
  for (const [, stream] of sessionStreams.entries()) {
    const sorted = [...stream].sort((a, b) => (a.localSequence || 0) - (b.localSequence || 0));
    for (let j = 1; j < sorted.length; j++) {
      const prev = sorted[j - 1];
      const curr = sorted[j];
      if (curr.prevHash && prev.hash && curr.prevHash !== prev.hash) {
        tamperedCount++;
        if (firstBrokenIndex === undefined) {
          firstBrokenIndex = logs.findIndex(l => l.id === curr.id);
          firstBrokenId = curr.id;
        }
      }
    }
  }

  return {
    valid: tamperedCount === 0,
    totalVerified: logs.length,
    brokenIndex: firstBrokenIndex,
    brokenLogId: firstBrokenId,
    tamperedCount
  };
}

