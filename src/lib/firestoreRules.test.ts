import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;

const PROJECT_ID = 'demo-rules-test-project';

const isEmulatorRunning = process.env.FIRESTORE_EMULATOR_HOST || Boolean(process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS);

describe.skipIf(!isEmulatorRunning)('Firestore Security Rules Baseline Suite (T01 - T20)', () => {
  beforeAll(async () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8888
      }
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    // Seed authorized maintenance/admin profile for business calendar baseline operations
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/user_store_staff').set({
        uid: 'user_store_staff',
        role: 'admin',
        isActive: true,
        permissions: { maintenance: true }
      });
    });
  });

  // =========================================================================
  // 1. BUSINESS CALENDAR TESTS (T01 - T14)
  // =========================================================================

  it('T01: Unauthenticated read businessCalendar -> DENY', async () => {
    const unauthCtx = testEnv.unauthenticatedContext();
    const db = unauthCtx.firestore();
    const docRef = db.doc('appSettings/businessCalendar');
    await assertFails(docRef.get());
  });

  it('T02: Authenticated read businessCalendar -> ALLOW', async () => {
    // Seed initial doc via admin context
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const docRef = db.doc('appSettings/businessCalendar');
    await assertSucceeds(docRef.get());
  });

  it('T03: Create businessCalendar v1 without versions/1 -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const docRef = db.doc('appSettings/businessCalendar');
    await assertFails(
      docRef.set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      })
    );
  });

  it('T04: Create versions/1 without businessCalendar v1 -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const versionRef = db.doc('appSettings/businessCalendar/versions/1');
    await assertFails(
      versionRef.set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      })
    );
  });

  it('T05: Create both v1 documents atomically -> ALLOW', async () => {
    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 1,
      effectiveFrom: '2026-10-01',
      weeklyHolidays: [5]
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/1'), {
      version: 1,
      effectiveFrom: '2026-10-01',
      weeklyHolidays: [5]
    });

    await assertSucceeds(batch.commit());
  });

  it('T06: Initial version 50 -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 50,
      effectiveFrom: '2026-10-01',
      weeklyHolidays: [5]
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/50'), {
      version: 50,
      effectiveFrom: '2026-10-01',
      weeklyHolidays: [5]
    });

    await assertFails(batch.commit());
  });

  it('T07: v1 -> v3 -> DENY', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 3,
      effectiveFrom: '2026-10-05',
      weeklyHolidays: [5, 6]
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/3'), {
      version: 3,
      effectiveFrom: '2026-10-05',
      weeklyHolidays: [5, 6]
    });

    await assertFails(batch.commit());
  });

  it('T08: v1 -> v2 without versions/2 -> DENY', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const docRef = db.doc('appSettings/businessCalendar');

    await assertFails(
      docRef.set({
        version: 2,
        effectiveFrom: '2026-10-05',
        weeklyHolidays: [5, 6]
      })
    );
  });

  it('T09: Create versions/999 while current is v1 -> DENY', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const versionRef = db.doc('appSettings/businessCalendar/versions/999');

    await assertFails(
      versionRef.set({
        version: 999,
        effectiveFrom: '2026-10-05',
        weeklyHolidays: [5, 6]
      })
    );
  });

  it('T10: Update versions/1 -> DENY', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const versionRef = db.doc('appSettings/businessCalendar/versions/1');

    await assertFails(
      versionRef.update({
        effectiveFrom: '2026-10-02'
      })
    );
  });

  it('T11: Delete versions/1 -> DENY', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const versionRef = db.doc('appSettings/businessCalendar/versions/1');

    await assertFails(versionRef.delete());
  });

  it('T12: Delete current businessCalendar -> DENY', async () => {
    // Seed current doc
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const docRef = db.doc('appSettings/businessCalendar');

    await assertFails(docRef.delete());
  });

  it('T13: Valid v2 transaction -> ALLOW', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 2,
      effectiveFrom: '2026-10-05',
      weeklyHolidays: [5, 6]
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/2'), {
      version: 2,
      effectiveFrom: '2026-10-05',
      weeklyHolidays: [5, 6]
    });

    await assertSucceeds(batch.commit());
  });

  it('T14: Concurrent v2 creation -> exactly one succeeds', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
      await adminDb.doc('userProfiles/client_device_1').set({
        uid: 'client_device_1',
        role: 'admin',
        isActive: true,
        permissions: { maintenance: true }
      });
      await adminDb.doc('userProfiles/client_device_2').set({
        uid: 'client_device_2',
        role: 'admin',
        isActive: true,
        permissions: { maintenance: true }
      });
    });

    const client1 = testEnv.authenticatedContext('client_device_1').firestore();
    const client2 = testEnv.authenticatedContext('client_device_2').firestore();

    const doTx = async (db: any) => {
      return db.runTransaction(async (tx: any) => {
        const curSnap = await tx.get(db.doc('appSettings/businessCalendar'));
        const curVer = curSnap.data().version;
        const nextVer = curVer + 1;
        const vRef = db.doc(`appSettings/businessCalendar/versions/${nextVer}`);
        const vSnap = await tx.get(vRef);
        if (vSnap.exists) {
          throw new Error('VERSION_ALREADY_EXISTS');
        }
        tx.set(db.doc('appSettings/businessCalendar'), {
          version: nextVer,
          effectiveFrom: '2026-10-05',
          weeklyHolidays: [5, 6]
        });
        tx.set(vRef, {
          version: nextVer,
          effectiveFrom: '2026-10-05',
          weeklyHolidays: [5, 6]
        });
      });
    };

    const results = await Promise.allSettled([doTx(client1), doTx(client2)]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // Exactly one transaction must succeed on concurrent attempt
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });

  // =========================================================================
  // 2. CONTENT SNAPSHOT INTEGRITY (T15 - T16, CLOSED GAP IN 2.2.5.14)
  // =========================================================================

  it('T15: Different effectiveFrom between current and version -> DENY (GAP CLOSED)', async () => {
    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    // Mismatched effectiveFrom: current has 2026-10-10, version has 2026-10-11
    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 1,
      effectiveFrom: '2026-10-10',
      weeklyHolidays: [5, 6]
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/1'), {
      version: 1,
      effectiveFrom: '2026-10-11',
      weeklyHolidays: [5, 6]
    });

    // Content snapshot parity enforced: must DENY
    await assertFails(batch.commit());
  });

  it('T16: Different officialHolidays / nonWorkingDates -> DENY (GAP CLOSED)', async () => {
    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    // Current has holidays, version record has empty list
    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 1,
      effectiveFrom: '2026-10-10',
      weeklyHolidays: [5],
      officialHolidays: ['2026-10-06'],
      nonWorkingDates: ['2026-10-07']
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/1'), {
      version: 1,
      effectiveFrom: '2026-10-10',
      weeklyHolidays: [5],
      officialHolidays: [],
      nonWorkingDates: []
    });

    // Content snapshot parity enforced: must DENY
    await assertFails(batch.commit());
  });

  // =========================================================================
  // 3. ADDITIONAL BASELINE TESTS (T17 - T20)
  // =========================================================================

  it('T17: Non-numeric version path versions/abc -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 1,
      effectiveFrom: '2026-10-01',
      weeklyHolidays: [5]
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/abc'), {
      version: 1,
      effectiveFrom: '2026-10-01',
      weeklyHolidays: [5]
    });

    // int('abc') causes evaluation error or failure in rules
    await assertFails(batch.commit());
  });

  it('T18: Direct creation of future arbitrary version where current does not match -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 1,
      effectiveFrom: '2026-10-01',
      weeklyHolidays: [5]
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/2'), {
      version: 2,
      effectiveFrom: '2026-10-01',
      weeklyHolidays: [5]
    });

    // version 2 does not match current version 1
    await assertFails(batch.commit());
  });

  it('T19: Attempt to overwrite existing historical version -> DENY', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const versionRef = db.doc('appSettings/businessCalendar/versions/1');

    // Overwriting existing historical version is blocked by !exists() and update: false
    await assertFails(
      versionRef.set({
        version: 1,
        effectiveFrom: '2026-10-02',
        weeklyHolidays: [5, 6]
      })
    );
  });

  it('T20: Attempt to delete current businessCalendar when existing -> DENY', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const docRef = db.doc('appSettings/businessCalendar');

    await assertFails(docRef.delete());
  });

  // =========================================================================
  // 4. PARITY ENFORCEMENT & INTEGRITY SUITE (T21 - T28)
  // =========================================================================

  it('T21: effectiveFrom mismatch on v2 -> DENY', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    // current.effectiveFrom != version.effectiveFrom
    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 2,
      effectiveFrom: '2026-10-01',
      weeklyHolidays: [5, 6]
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/2'), {
      version: 2,
      effectiveFrom: '2026-10-02',
      weeklyHolidays: [5, 6]
    });

    await assertFails(batch.commit());
  });

  it('T22: weeklyHolidays mismatch on v2 -> DENY', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    // current.weeklyHolidays != version.weeklyHolidays
    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 2,
      effectiveFrom: '2026-10-05',
      weeklyHolidays: [5]
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/2'), {
      version: 2,
      effectiveFrom: '2026-10-05',
      weeklyHolidays: [5, 6]
    });

    await assertFails(batch.commit());
  });

  it('T23: officialHolidays mismatch on v2 -> DENY', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5],
        officialHolidays: [],
        nonWorkingDates: []
      });
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5],
        officialHolidays: [],
        nonWorkingDates: []
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    // officialHolidays mismatch
    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 2,
      effectiveFrom: '2026-10-05',
      weeklyHolidays: [5, 6],
      officialHolidays: ['2026-10-06'],
      nonWorkingDates: []
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/2'), {
      version: 2,
      effectiveFrom: '2026-10-05',
      weeklyHolidays: [5, 6],
      officialHolidays: ['2026-10-07'],
      nonWorkingDates: []
    });

    await assertFails(batch.commit());
  });

  it('T24: nonWorkingDates mismatch on v2 -> DENY', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5],
        officialHolidays: [],
        nonWorkingDates: []
      });
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5],
        officialHolidays: [],
        nonWorkingDates: []
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    // nonWorkingDates mismatch
    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 2,
      effectiveFrom: '2026-10-05',
      weeklyHolidays: [5, 6],
      officialHolidays: ['2026-10-06'],
      nonWorkingDates: ['2026-10-08']
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/2'), {
      version: 2,
      effectiveFrom: '2026-10-05',
      weeklyHolidays: [5, 6],
      officialHolidays: ['2026-10-06'],
      nonWorkingDates: ['2026-10-09']
    });

    await assertFails(batch.commit());
  });

  it('T25: All snapshot fields identical on valid v2 -> ALLOW', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5],
        officialHolidays: ['2026-10-06'],
        nonWorkingDates: ['2026-10-08']
      });
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5],
        officialHolidays: ['2026-10-06'],
        nonWorkingDates: ['2026-10-08']
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    // All snapshot fields match perfectly
    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 2,
      effectiveFrom: '2026-10-15',
      weeklyHolidays: [5, 6],
      officialHolidays: ['2026-10-06', '2026-10-20'],
      nonWorkingDates: ['2026-10-08', '2026-10-21'],
      updatedAt: '2026-10-02T12:00:00.000Z',
      updatedByUid: 'user_store_staff',
      updatedByName: 'Store Manager',
      changeReason: 'Holiday update'
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/2'), {
      version: 2,
      effectiveFrom: '2026-10-15',
      weeklyHolidays: [5, 6],
      officialHolidays: ['2026-10-06', '2026-10-20'],
      nonWorkingDates: ['2026-10-08', '2026-10-21'],
      createdAt: '2026-10-02T12:00:00.000Z',
      createdByUid: 'user_store_staff',
      createdByName: 'Store Manager',
      changeReason: 'Holiday update'
    });

    await assertSucceeds(batch.commit());
  });

  it('T26: Multiple fields mismatch -> DENY', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5],
        officialHolidays: [],
        nonWorkingDates: []
      });
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5],
        officialHolidays: [],
        nonWorkingDates: []
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    // effectiveFrom AND weeklyHolidays mismatch
    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 2,
      effectiveFrom: '2026-10-05',
      weeklyHolidays: [5]
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/2'), {
      version: 2,
      effectiveFrom: '2026-10-06',
      weeklyHolidays: [5, 6]
    });

    await assertFails(batch.commit());
  });

  it('T27: Version identical (version=2) but content mismatch -> DENY', async () => {
    // Seed v1
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const batch = db.batch();

    // version is 2 on both, but effectiveFrom differs
    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 2,
      effectiveFrom: '2026-10-10',
      weeklyHolidays: [5, 6]
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/2'), {
      version: 2,
      effectiveFrom: '2026-10-11',
      weeklyHolidays: [5, 6]
    });

    await assertFails(batch.commit());
  });

  it('T28: Historical versions/1 remains immutable after v2 creation -> DENY', async () => {
    // Seed v1 and v2
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('appSettings/businessCalendar').set({
        version: 2,
        effectiveFrom: '2026-10-05',
        weeklyHolidays: [5, 6]
      });
      await adminDb.doc('appSettings/businessCalendar/versions/1').set({
        version: 1,
        effectiveFrom: '2026-10-01',
        weeklyHolidays: [5]
      });
      await adminDb.doc('appSettings/businessCalendar/versions/2').set({
        version: 2,
        effectiveFrom: '2026-10-05',
        weeklyHolidays: [5, 6]
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const version1Ref = db.doc('appSettings/businessCalendar/versions/1');

    // Attempting update on historical versions/1 must fail
    await assertFails(
      version1Ref.update({
        effectiveFrom: '2026-10-02'
      })
    );

    // Attempting delete on historical versions/1 must fail
    await assertFails(version1Ref.delete());
  });

  // =========================================================================
  // 2. PURCHASE RETURNS SECURITY RULES & SCHEMA VALIDATION TESTS (T29 - T34)
  // =========================================================================

  it('T29: Unauthenticated create purchaseReturn -> DENY', async () => {
    const unauthCtx = testEnv.unauthenticatedContext();
    const db = unauthCtx.firestore();
    const returnRef = db.doc('purchaseReturns/pr_test_01');
    await assertFails(
      returnRef.set({
        id: 'pr_test_01',
        purchaseId: 'pur_01',
        totalRefund: 500,
        refundMethod: 'cash',
        items: [{ productId: 'p1', qty: 2 }],
        originalEventDate: '2026-10-03',
        postingDate: '2026-10-03',
        operationId: 'op_pr_01',
        createdAt: '2026-10-03T12:00:00Z'
      })
    );
  });

  it('T30: Authenticated user without purchasesManage perm -> DENY', async () => {
    // Seed staff profile without purchasesManage
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/user_no_perm').set({
        role: 'staff',
        isActive: true,
        permissions: { purchasesManage: false }
      });
    });

    const authCtx = testEnv.authenticatedContext('user_no_perm');
    const db = authCtx.firestore();
    const returnRef = db.doc('purchaseReturns/pr_test_02');
    await assertFails(
      returnRef.set({
        id: 'pr_test_02',
        purchaseId: 'pur_01',
        totalRefund: 500,
        refundMethod: 'cash',
        items: [{ productId: 'p1', qty: 2 }],
        originalEventDate: '2026-10-03',
        postingDate: '2026-10-03',
        operationId: 'op_pr_02',
        createdAt: '2026-10-03T12:00:00Z'
      })
    );
  });

  it('T31: Authenticated user with purchasesManage and valid schema -> ALLOW', async () => {
    // Seed staff profile with purchasesManage
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/purchaser_user').set({
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
    });

    const authCtx = testEnv.authenticatedContext('purchaser_user');
    const db = authCtx.firestore();
    const returnRef = db.doc('purchaseReturns/pr_test_03');
    await assertSucceeds(
      returnRef.set({
        id: 'pr_test_03',
        purchaseId: 'pur_01',
        totalRefund: 500,
        refundMethod: 'cash',
        items: [{ productId: 'p1', qty: 2 }],
        originalEventDate: '2026-10-03',
        postingDate: '2026-10-03',
        statementDate: '2026-10-03',
        operationId: 'op_pr_03',
        createdAt: '2026-10-03T12:00:00Z'
      })
    );
  });

  it('T32: Invalid schema (negative totalRefund, invalid refundMethod, empty items) -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/purchaser_user').set({
        role: 'admin',
        isActive: true,
        permissions: { purchasesManage: true }
      });
    });

    const authCtx = testEnv.authenticatedContext('purchaser_user');
    const db = authCtx.firestore();

    // 1. Negative totalRefund
    await assertFails(
      db.doc('purchaseReturns/pr_test_neg').set({
        id: 'pr_test_neg',
        purchaseId: 'pur_01',
        totalRefund: -100,
        refundMethod: 'cash',
        items: [{ productId: 'p1', qty: 2 }],
        originalEventDate: '2026-10-03',
        postingDate: '2026-10-03',
        statementDate: '2026-10-03',
        operationId: 'op_pr_neg',
        createdAt: '2026-10-03T12:00:00Z'
      })
    );

    // 2. Invalid refundMethod
    await assertFails(
      db.doc('purchaseReturns/pr_test_bad_method').set({
        id: 'pr_test_bad_method',
        purchaseId: 'pur_01',
        totalRefund: 100,
        refundMethod: 'unknown_method',
        items: [{ productId: 'p1', qty: 2 }],
        originalEventDate: '2026-10-03',
        postingDate: '2026-10-03',
        statementDate: '2026-10-03',
        operationId: 'op_pr_bad',
        createdAt: '2026-10-03T12:00:00Z'
      })
    );

    // 3. Empty items list
    await assertFails(
      db.doc('purchaseReturns/pr_test_empty_items').set({
        id: 'pr_test_empty_items',
        purchaseId: 'pur_01',
        totalRefund: 100,
        refundMethod: 'credit',
        items: [],
        originalEventDate: '2026-10-03',
        postingDate: '2026-10-03',
        statementDate: '2026-10-03',
        operationId: 'op_pr_empty',
        createdAt: '2026-10-03T12:00:00Z'
      })
    );
  });

  it('T33: Immutability: Attempting update or delete on purchaseReturns -> DENY', async () => {
    // Seed existing return doc
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/admin_user').set({
        role: 'admin',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc('purchaseReturns/pr_existing_01').set({
        id: 'pr_existing_01',
        purchaseId: 'pur_01',
        totalRefund: 500,
        refundMethod: 'credit',
        items: [{ productId: 'p1', qty: 2 }],
        originalEventDate: '2026-10-03',
        postingDate: '2026-10-03',
        statementDate: '2026-10-03',
        operationId: 'op_pr_exist',
        createdAt: '2026-10-03T12:00:00Z'
      });
    });

    const authCtx = testEnv.authenticatedContext('admin_user');
    const db = authCtx.firestore();
    const returnRef = db.doc('purchaseReturns/pr_existing_01');

    // Update must fail
    await assertFails(
      returnRef.update({
        totalRefund: 600
      })
    );

    // Delete must fail
    await assertFails(returnRef.delete());
  });

  it('T34: Purchase Return missing statementDate -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/purchaser_user').set({
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
    });

    const authCtx = testEnv.authenticatedContext('purchaser_user');
    const db = authCtx.firestore();
    const returnRef = db.doc('purchaseReturns/pr_test_04');
    await assertFails(
      returnRef.set({
        id: 'pr_test_04',
        purchaseId: 'pur_01',
        totalRefund: 500,
        refundMethod: 'cash',
        items: [{ productId: 'p1', qty: 2 }],
        originalEventDate: '2026-10-03',
        postingDate: '2026-10-03',
        // statementDate omitted
        operationId: 'op_pr_04',
        createdAt: '2026-10-03T12:00:00Z'
      })
    );
  });

  // =========================================================================
  // 3. CUSTOMER PAYMENTS SECURITY RULES & SCHEMA VALIDATION (T35 - T42)
  // =========================================================================

  it('T35: Customer Payment valid create -> ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_user').set({
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const authCtx = testEnv.authenticatedContext('cashier_user');
    const db = authCtx.firestore();
    const payRef = db.doc('customerPayments/cp_valid_01');
    await assertSucceeds(
      payRef.set({
        id: 'cp_valid_01',
        customerId: 'c_01',
        amount: 250,
        operationId: 'op_cust_pay_cp_valid_01',
        originalEventDate: '2026-10-05',
        statementDate: '2026-10-05',
        postingDate: '2026-10-05',
        effectiveCashDate: '2026-10-05',
        actorUid: 'cashier_user',
        createdBy: 'cashier_user',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  it('T36: Customer Payment missing operationId -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_user');
    const db = authCtx.firestore();
    const payRef = db.doc('customerPayments/cp_missing_op');
    await assertFails(
      payRef.set({
        id: 'cp_missing_op',
        customerId: 'c_01',
        amount: 250,
        // missing operationId
        originalEventDate: '2026-10-05',
        statementDate: '2026-10-05',
        postingDate: '2026-10-05',
        effectiveCashDate: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  it('T37: Customer Payment invalid amount (non-number or negative) -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_user');
    const db = authCtx.firestore();

    // 1. Non-number amount
    await assertFails(
      db.doc('customerPayments/cp_bad_amt_1').set({
        id: 'cp_bad_amt_1',
        customerId: 'c_01',
        amount: 'two hundred',
        operationId: 'op_1',
        originalEventDate: '2026-10-05',
        statementDate: '2026-10-05',
        postingDate: '2026-10-05',
        effectiveCashDate: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );

    // 2. Amount <= 0
    await assertFails(
      db.doc('customerPayments/cp_bad_amt_2').set({
        id: 'cp_bad_amt_2',
        customerId: 'c_01',
        amount: 0,
        operationId: 'op_2',
        originalEventDate: '2026-10-05',
        statementDate: '2026-10-05',
        postingDate: '2026-10-05',
        effectiveCashDate: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  it('T38: Customer Payment missing customerId or required date fields -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_user');
    const db = authCtx.firestore();

    // Missing customerId
    await assertFails(
      db.doc('customerPayments/cp_no_cust').set({
        id: 'cp_no_cust',
        amount: 100,
        operationId: 'op_3',
        originalEventDate: '2026-10-05',
        statementDate: '2026-10-05',
        postingDate: '2026-10-05',
        effectiveCashDate: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );

    // Missing effectiveCashDate
    await assertFails(
      db.doc('customerPayments/cp_no_eff_date').set({
        id: 'cp_no_eff_date',
        customerId: 'c_01',
        amount: 100,
        operationId: 'op_4',
        originalEventDate: '2026-10-05',
        statementDate: '2026-10-05',
        postingDate: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  it('T39: Customer Payment immutability (update / delete) -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('customerPayments/cp_exist_01').set({
        id: 'cp_exist_01',
        customerId: 'c_01',
        amount: 500,
        operationId: 'op_exist_01',
        originalEventDate: '2026-10-05',
        statementDate: '2026-10-05',
        postingDate: '2026-10-05',
        effectiveCashDate: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      });
    });

    const authCtx = testEnv.authenticatedContext('cashier_user');
    const db = authCtx.firestore();
    const docRef = db.doc('customerPayments/cp_exist_01');

    await assertFails(docRef.update({ amount: 600 }));
    await assertFails(docRef.delete());
  });

  // =========================================================================
  // 4. SUPPLIER PAYMENTS SECURITY RULES & SCHEMA VALIDATION (T40 - T44)
  // =========================================================================

  it('T40: Supplier Payment valid create -> ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/purchaser_user').set({
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
    });

    const authCtx = testEnv.authenticatedContext('purchaser_user');
    const db = authCtx.firestore();
    const payRef = db.doc('supplierPayments/sp_valid_01');
    await assertSucceeds(
      payRef.set({
        id: 'sp_valid_01',
        supplierId: 's_01',
        amount: 1200,
        operationId: 'op_supp_pay_sp_valid_01',
        originalEventDate: '2026-10-05',
        statementDate: '2026-10-05',
        postingDate: '2026-10-05',
        effectiveCashDate: '2026-10-05',
        actorUid: 'purchaser_user',
        createdBy: 'purchaser_user',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  it('T41: Supplier Payment missing operationId -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('purchaser_user');
    const db = authCtx.firestore();
    const payRef = db.doc('supplierPayments/sp_missing_op');
    await assertFails(
      payRef.set({
        id: 'sp_missing_op',
        supplierId: 's_01',
        amount: 1200,
        originalEventDate: '2026-10-05',
        statementDate: '2026-10-05',
        postingDate: '2026-10-05',
        effectiveCashDate: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  it('T42: Supplier Payment invalid amount (non-number or negative) -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('purchaser_user');
    const db = authCtx.firestore();

    // 1. Non-number amount
    await assertFails(
      db.doc('supplierPayments/sp_bad_amt_1').set({
        id: 'sp_bad_amt_1',
        supplierId: 's_01',
        amount: 'five hundred',
        operationId: 'op_sp_1',
        originalEventDate: '2026-10-05',
        statementDate: '2026-10-05',
        postingDate: '2026-10-05',
        effectiveCashDate: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );

    // 2. Amount <= 0
    await assertFails(
      db.doc('supplierPayments/sp_bad_amt_2').set({
        id: 'sp_bad_amt_2',
        supplierId: 's_01',
        amount: -50,
        operationId: 'op_sp_2',
        originalEventDate: '2026-10-05',
        statementDate: '2026-10-05',
        postingDate: '2026-10-05',
        effectiveCashDate: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  it('T43: Supplier Payment missing supplierId or required date fields -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('purchaser_user');
    const db = authCtx.firestore();

    // Missing supplierId
    await assertFails(
      db.doc('supplierPayments/sp_no_supp').set({
        id: 'sp_no_supp',
        amount: 800,
        operationId: 'op_sp_3',
        originalEventDate: '2026-10-05',
        statementDate: '2026-10-05',
        postingDate: '2026-10-05',
        effectiveCashDate: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );

    // Missing postingDate
    await assertFails(
      db.doc('supplierPayments/sp_no_posting_date').set({
        id: 'sp_no_posting_date',
        supplierId: 's_01',
        amount: 800,
        operationId: 'op_sp_4',
        originalEventDate: '2026-10-05',
        statementDate: '2026-10-05',
        effectiveCashDate: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  it('T44: Supplier Payment immutability (update / delete) -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('supplierPayments/sp_exist_01').set({
        id: 'sp_exist_01',
        supplierId: 's_01',
        amount: 900,
        operationId: 'op_sp_exist_01',
        originalEventDate: '2026-10-05',
        statementDate: '2026-10-05',
        postingDate: '2026-10-05',
        effectiveCashDate: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      });
    });

    const authCtx = testEnv.authenticatedContext('purchaser_user');
    const db = authCtx.firestore();
    const docRef = db.doc('supplierPayments/sp_exist_01');

    await assertFails(docRef.update({ amount: 1500 }));
    await assertFails(docRef.delete());
  });

  // =========================================================================
  // 5. PHASE 2.4.3 SECURITY HARDENING SUITE (T45 - T70)
  // =========================================================================

  // A. USER PROFILES
  it('T45: Unprivileged user self-creation of userProfiles -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('new_random_user');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('userProfiles/new_random_user').set({
        id: 'new_random_user',
        uid: 'new_random_user',
        role: 'admin',
        isActive: true,
        permissions: { admin: true }
      })
    );
  });

  it('T46: Admin creates employee profile -> ALLOW', async () => {
    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    await assertSucceeds(
      db.doc('userProfiles/new_employee_01').set({
        id: 'new_employee_01',
        uid: 'new_employee_01',
        name: 'New Cashier',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      })
    );
  });

  it('T47: Cashier tries to modify other profile -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_01').set({
        uid: 'cashier_01',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc('userProfiles/target_profile').set({
        uid: 'target_profile',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('userProfiles/target_profile').update({
        role: 'admin'
      })
    );
  });

  it('T48: Cashier tries to modify own role/permissions -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_01').set({
        uid: 'cashier_01',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('userProfiles/cashier_01').update({
        role: 'admin'
      })
    );
    // But updating own lastLoginAt timestamp is allowed
    await assertSucceeds(
      db.doc('userProfiles/cashier_01').update({
        lastLoginAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  // B. AUDIT LOGS
  it('T49: AuditLog legitimate write matching auth.uid -> ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_01').set({
        uid: 'cashier_01',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const authCtx = testEnv.authenticatedContext('cashier_01', { email: 'cashier_01@example.com' });
    const db = authCtx.firestore();
    await assertSucceeds(
      db.doc('auditLogs/log_01').set({
        id: 'log_01',
        action: 'sale_created',
        entity: 'invoices',
        details: { invoiceId: 'inv_1' },
        actorUid: 'cashier_01',
        createdBy: 'cashier_01',
        actorEmail: 'cashier_01@example.com',
        actorName: 'Cashier One',
        date: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  it('T50: AuditLog forged actorUid -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('auditLogs/log_forged').set({
        id: 'log_forged',
        action: 'admin_override',
        entity: 'invoices',
        details: {},
        actorUid: 'admin_user', // Forged actor!
        createdBy: 'cashier_01',
        actorName: 'Admin',
        date: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  it('T51: AuditLog extra arbitrary fields -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('auditLogs/log_extra_fields').set({
        id: 'log_extra_fields',
        action: 'sale',
        entity: 'invoices',
        details: {},
        actorUid: 'cashier_01',
        createdBy: 'cashier_01',
        actorName: 'Cashier One',
        date: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z',
        unauthorizedField: 'malicious_payload'
      })
    );
  });

  it('T52: AuditLog update or delete -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('auditLogs/log_locked').set({
        id: 'log_locked',
        action: 'sale',
        entity: 'invoices',
        details: {},
        actorUid: 'user_store_staff',
        createdBy: 'user_store_staff',
        actorName: 'Staff',
        date: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const docRef = db.doc('auditLogs/log_locked');
    await assertFails(docRef.update({ action: 'tampered' }));
    await assertFails(docRef.delete());
  });

  // C. STOCK MOVEMENTS
  it('T53: StockMovement legitimate POS deduction with posSales -> ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_01').set({
        uid: 'cashier_01',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    await assertSucceeds(
      db.doc('stockMovements/sm_pos_01').set({
        id: 'sm_pos_01',
        productId: 'prod_01',
        delta: -2,
        type: 'sale',
        actorUid: 'cashier_01',
        createdBy: 'cashier_01',
        date: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  it('T54: StockMovement forged actorUid -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('stockMovements/sm_forged').set({
        id: 'sm_forged',
        productId: 'prod_01',
        delta: -2,
        type: 'sale',
        actorUid: 'other_user',
        createdBy: 'cashier_01',
        date: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  it('T55: StockMovement unauthorized cashier (no posSales or inventoryManage) -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/unauth_worker').set({
        uid: 'unauth_worker',
        role: 'cashier',
        isActive: true,
        permissions: {}
      });
    });

    const authCtx = testEnv.authenticatedContext('unauth_worker');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('stockMovements/sm_unauth').set({
        id: 'sm_unauth',
        productId: 'prod_01',
        delta: -1,
        type: 'sale',
        actorUid: 'unauth_worker',
        createdBy: 'unauth_worker',
        date: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  it('T56: StockMovement update or delete -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('stockMovements/sm_exist').set({
        id: 'sm_exist',
        productId: 'prod_01',
        delta: -1,
        type: 'sale',
        actorUid: 'user_store_staff',
        createdBy: 'user_store_staff',
        date: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      });
    });

    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    const docRef = db.doc('stockMovements/sm_exist');
    await assertFails(docRef.update({ delta: -5 }));
    await assertFails(docRef.delete());
  });

  // D. CASH MOVEMENTS
  it('T57: CashMovement non-admin creation -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('cashMovements/cm_bad').set({
        amount: 500,
        direction: 'in'
      })
    );
  });

  it('T58: CashMovement admin creation -> ALLOW', async () => {
    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    await assertSucceeds(
      db.doc('cashMovements/cm_admin').set({
        amount: 500,
        direction: 'in'
      })
    );
  });

  // E. PRODUCTS INVENTORY FIELD HARDENING
  it('T59: Product quantity update by posSales -> ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_01').set({
        uid: 'cashier_01',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc('products/prod_pos_test').set({
        name: 'Notebook A4',
        barcode: '123456',
        costPrice: 10,
        sellPrice: 15,
        qty: 100
      });
    });

    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    const prodRef = db.doc('products/prod_pos_test');

    await assertSucceeds(
      prodRef.update({
        qty: 98,
        lastOperationId: 'op_pos_sale_1',
        lastOperationType: 'sale',
        lastOperationActorUid: 'cashier_01'
      })
    );
  });

  it('T60: Product costPrice/sellPrice update by posSales -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    const prodRef = db.doc('products/prod_pos_test');

    await assertFails(
      prodRef.update({
        costPrice: 5
      })
    );
    await assertFails(
      prodRef.update({
        sellPrice: 25
      })
    );
  });

  it('T61: Product name/barcode update by posSales -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    const prodRef = db.doc('products/prod_pos_test');

    await assertFails(
      prodRef.update({
        name: 'Hacked Product Name'
      })
    );
    await assertFails(
      prodRef.update({
        barcode: '999999'
      })
    );
  });

  it('T62: Product purchase update (qty, costPrice, sellPrice) with purchasesManage -> ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/purchaser_user').set({
        uid: 'purchaser_user',
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc('products/prod_pos_test').set({
        name: 'Notebook A4',
        barcode: '123456',
        costPrice: 10,
        sellPrice: 15,
        qty: 100
      });
    });

    const authCtx = testEnv.authenticatedContext('purchaser_user');
    const db = authCtx.firestore();
    const prodRef = db.doc('products/prod_pos_test');

    await assertSucceeds(
      prodRef.update({
        qty: 150,
        costPrice: 12,
        sellPrice: 18,
        lastOperationId: 'op_pur_1',
        lastOperationType: 'purchase',
        lastOperationActorUid: 'purchaser_user',
        lastOperationTime: '2026-10-05T12:00:00Z'
      })
    );
  });

  it('T63: Product name/barcode update by purchasesManage -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('purchaser_user');
    const db = authCtx.firestore();
    const prodRef = db.doc('products/prod_pos_test');

    await assertFails(
      prodRef.update({
        name: 'Purchaser Modified Name'
      })
    );
  });

  // F. META / COUNTERS
  it('T64: Meta counters invoice increment with posSales -> ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_01').set({
        uid: 'cashier_01',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc('meta/counters').set({
        invoice: 10
      });
    });

    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    await assertSucceeds(
      db.doc('meta/counters').set({
        invoice: 11
      }, { merge: true })
    );
  });

  it('T65: Meta counters rollback (lower number) by cashier -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('meta/counters').set({
        invoice: 5 // current is 11! Rollback attempt
      }, { merge: true })
    );
  });

  it('T66: Meta counters arbitrary field injection -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('meta/counters').set({
        invoice: 12,
        maliciousAdminFlag: true
      }, { merge: true })
    );
  });

  it('T67: Meta non-counters document write by cashier -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('meta/system_config').set({
        maintenanceMode: true
      })
    );
  });

  // G. APP SETTINGS & SHOP
  it('T68: Shop settings write by cashier -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('appSettings/shop').set({
        shopName: 'Tampered Shop'
      })
    );
  });

  it('T69: Shop settings write by admin -> ALLOW', async () => {
    const authCtx = testEnv.authenticatedContext('user_store_staff');
    const db = authCtx.firestore();
    await assertSucceeds(
      db.doc('appSettings/shop').set({
        shopName: 'Maktabati Official'
      })
    );
  });

  it('T70: Business Calendar write by unprivileged cashier -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    const batch = db.batch();
    batch.set(db.doc('appSettings/businessCalendar'), {
      version: 2,
      effectiveFrom: '2026-10-06',
      weeklyHolidays: [5]
    });
    batch.set(db.doc('appSettings/businessCalendar/versions/2'), {
      version: 2,
      effectiveFrom: '2026-10-06',
      weeklyHolidays: [5]
    });
    await assertFails(batch.commit());
  });

  // =========================================================================
  // 6. PHASE 2.4.4 SECURITY RECONCILIATION SUITE (T71 - T89)
  // =========================================================================

  // H. AUTHENTICATED != STAFF (READ RULES HARDENING)
  it('T71: Unprovisioned authenticated UID reads invoices -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('invoices/inv_secret').set({ id: 'inv_secret', total: 500 });
    });
    const authCtx = testEnv.authenticatedContext('unprovisioned_user_1');
    const db = authCtx.firestore();
    await assertFails(db.doc('invoices/inv_secret').get());
  });

  it('T72: Unprovisioned authenticated UID reads customers -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('customers/cust_secret').set({ id: 'cust_secret', name: 'VIP Customer' });
    });
    const authCtx = testEnv.authenticatedContext('unprovisioned_user_2');
    const db = authCtx.firestore();
    await assertFails(db.doc('customers/cust_secret').get());
  });

  it('T73: Unprovisioned authenticated UID reads suppliers -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('suppliers/supp_secret').set({ id: 'supp_secret', name: 'Supplier X' });
    });
    const authCtx = testEnv.authenticatedContext('unprovisioned_user_3');
    const db = authCtx.firestore();
    await assertFails(db.doc('suppliers/supp_secret').get());
  });

  it('T74: Unprovisioned authenticated UID reads stockMovements -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('stockMovements/sm_secret').set({ id: 'sm_secret', delta: -5 });
    });
    const authCtx = testEnv.authenticatedContext('unprovisioned_user_4');
    const db = authCtx.firestore();
    await assertFails(db.doc('stockMovements/sm_secret').get());
  });

  it('T75: Unprovisioned authenticated UID reads cashMovements -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('cashMovements/cm_secret').set({ id: 'cm_secret', amount: 1000 });
    });
    const authCtx = testEnv.authenticatedContext('unprovisioned_user_5');
    const db = authCtx.firestore();
    await assertFails(db.doc('cashMovements/cm_secret').get());
  });

  it('T76: Unprovisioned authenticated UID reads auditLogs -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('auditLogs/log_secret').set({ id: 'log_secret', action: 'sale' });
    });
    const authCtx = testEnv.authenticatedContext('unprovisioned_user_6');
    const db = authCtx.firestore();
    await assertFails(db.doc('auditLogs/log_secret').get());
  });

  it('T77: Unprovisioned authenticated UID reads employee profiles -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/staff_alice').set({
        uid: 'staff_alice',
        role: 'cashier',
        isActive: true,
        pinHash: 'secret_hash_123'
      });
    });
    const authCtx = testEnv.authenticatedContext('unprovisioned_user_7');
    const db = authCtx.firestore();
    await assertFails(db.doc('userProfiles/staff_alice').get());
  });

  it('T78: User reads own userProfile during bootstrap -> ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/bootstrap_user').set({
        uid: 'bootstrap_user',
        name: 'Bootstrap User',
        role: 'cashier',
        isActive: true
      });
    });
    const authCtx = testEnv.authenticatedContext('bootstrap_user');
    const db = authCtx.firestore();
    await assertSucceeds(db.doc('userProfiles/bootstrap_user').get());
  });

  it('T79: Inactive employee reads sensitive collection -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/inactive_worker').set({
        uid: 'inactive_worker',
        role: 'cashier',
        isActive: false,
        permissions: { posSales: true }
      });
      await adminDb.doc('invoices/inv_active_store').set({ id: 'inv_active_store', total: 100 });
      await adminDb.doc('products/prod_active_store').set({ id: 'prod_active_store', name: 'Pen' });
    });
    const authCtx = testEnv.authenticatedContext('inactive_worker');
    const db = authCtx.firestore();
    await assertFails(db.doc('invoices/inv_active_store').get());
    await assertFails(db.doc('products/prod_active_store').get());
    await assertFails(db.doc('customers/cust_secret').get());
  });

  // I. OPERATION KEYS AUTHORIZATION & IDEMPOTENCY
  it('T80: Unprovisioned authenticated UID creates operationKey -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('unprovisioned_user_8');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('operationKeys/op_unprov_1').set({
        id: 'op_unprov_1',
        actorUid: 'unprovisioned_user_8',
        type: 'sale'
      })
    );
  });

  it('T81: Inactive employee creates operationKey -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('inactive_worker');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('operationKeys/op_inactive_1').set({
        id: 'op_inactive_1',
        actorUid: 'inactive_worker',
        type: 'sale'
      })
    );
  });

  it('T82: Authorized cashier creates legitimate operationKey -> ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_01').set({
        uid: 'cashier_01',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    await assertSucceeds(
      db.doc('operationKeys/op_cashier_legit').set({
        id: 'op_cashier_legit',
        actorUid: 'cashier_01',
        type: 'sale'
      })
    );
    // Duplicate retry with same key cannot overwrite (idempotency preserved)
    await assertFails(
      db.doc('operationKeys/op_cashier_legit').set({
        id: 'op_cashier_legit',
        actorUid: 'cashier_01',
        type: 'sale_tampered'
      })
    );
  });

  it('T83: Authorized purchase workflow creates operationKey -> ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/purchaser_user').set({
        uid: 'purchaser_user',
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
    });

    const authCtx = testEnv.authenticatedContext('purchaser_user');
    const db = authCtx.firestore();
    await assertSucceeds(
      db.doc('operationKeys/op_purchase_legit').set({
        id: 'op_purchase_legit',
        actorUid: 'purchaser_user',
        type: 'purchase'
      })
    );
  });

  it('T83b: Legitimate operationKey paths across roles with actual runtime types -> ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/staff_all_ops').set({
        uid: 'staff_all_ops',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const authCtx = testEnv.authenticatedContext('staff_all_ops');
    const db = authCtx.firestore();

    const actualTypes = [
      'sale',
      'salesReturn',
      'return',
      'purchase',
      'purchaseReturn',
      'customer_payment',
      'supplier_payment',
      'dayClose',
      'adjustment'
    ];

    for (const opType of actualTypes) {
      const opKey = `op_verify_${opType}`;
      await assertSucceeds(
        db.doc(`operationKeys/${opKey}`).set({
          id: opKey,
          actorUid: 'staff_all_ops',
          type: opType,
          createdAt: '2026-10-06T10:00:00Z'
        })
      );
    }
  });

  // J. META COUNTERS SAFE FIRST INCREMENT & ROBUSTNESS
  it('T84: First counter increment when field does not yet exist -> ALLOW', async () => {
    // Document exists with only { invoice: 20 }, 'purchase' does not exist yet!
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/purchaser_user').set({
        uid: 'purchaser_user',
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc('meta/counters').set({
        invoice: 20
      });
    });

    const authCtx = testEnv.authenticatedContext('purchaser_user');
    const db = authCtx.firestore();
    // First purchase increment safely handles resource.data.purchase being undefined
    await assertSucceeds(
      db.doc('meta/counters').set({
        purchase: 1
      }, { merge: true })
    );
  });

  it('T85: Counter rollback -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('purchaser_user');
    const db = authCtx.firestore();
    // purchase is currently 1, rolling back to 0 is denied
    await assertFails(
      db.doc('meta/counters').set({
        purchase: 0
      }, { merge: true })
    );
  });

  it('T86: Unauthorized counter field -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('purchaser_user');
    const db = authCtx.firestore();
    await assertFails(
      db.doc('meta/counters').set({
        purchase: 2,
        unauthorizedSystemConfig: 'compromised'
      }, { merge: true })
    );
  });

  // K. STOCK MOVEMENTS CODE-VERIFIED TYPES & CONSTRAINTS
  it('T87: Every actual stockMovement type generated by application -> ALLOW through legitimate workflow', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_01').set({
        uid: 'cashier_01',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true, purchasesManage: true, inventoryManage: true, salesReturns: true }
      });
    });

    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();

    const allowedTypes = [
      'sale',
      'return',
      'exchange_in',
      'exchange_out',
      'purchase',
      'purchase_return',
      'adjustment'
    ];

    for (const mType of allowedTypes) {
      const mid = `sm_type_test_${mType}`;
      await assertSucceeds(
        db.doc(`stockMovements/${mid}`).set({
          id: mid,
          productId: 'prod_01',
          delta: mType.includes('return') || mType.includes('in') || mType === 'purchase' ? 2 : -2,
          type: mType,
          actorUid: 'cashier_01',
          createdBy: 'cashier_01',
          date: '2026-10-05',
          createdAt: '2026-10-05T12:00:00Z'
        })
      );
    }
  });

  it('T88: Unauthorized arbitrary stockMovement -> DENY', async () => {
    const authCtx = testEnv.authenticatedContext('cashier_01');
    const db = authCtx.firestore();
    // 1. Invalid movement type
    await assertFails(
      db.doc('stockMovements/sm_fake_type').set({
        id: 'sm_fake_type',
        productId: 'prod_01',
        delta: 10,
        type: 'unauthorized_free_gift',
        actorUid: 'cashier_01',
        createdBy: 'cashier_01',
        date: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
    // 2. Unprovisioned user creating stockMovement
    const unprovCtx = testEnv.authenticatedContext('unprov_user_sm');
    await assertFails(
      unprovCtx.firestore().doc('stockMovements/sm_unprov').set({
        id: 'sm_unprov',
        productId: 'prod_01',
        delta: -1,
        type: 'sale',
        actorUid: 'unprov_user_sm',
        createdBy: 'unprov_user_sm',
        date: '2026-10-05',
        createdAt: '2026-10-05T12:00:00Z'
      })
    );
  });

  // L. QUICKADDMODAL ROLE BEHAVIOR VERIFICATION
  it('T89: QuickAddModal behavior verified for each intended role', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      // Setup manager profile with inventoryManage
      await adminDb.doc('userProfiles/store_manager_01').set({
        uid: 'store_manager_01',
        role: 'manager',
        isActive: true,
        permissions: { inventoryManage: true, posSales: true }
      });
    });

    const newProdPayload = (uidStr: string) => ({
      id: `prod_quick_${uidStr}`,
      name: `Quick Item ${uidStr}`,
      category: 'عام',
      barcode: '',
      unit: 'قطعة',
      costPrice: 5,
      sellPrice: 10,
      qty: 0,
      minQty: 5,
      createdBy: uidStr,
      actorUid: uidStr,
      createdAt: '2026-10-05T12:00:00Z'
    });

    // 1. Cashier (no inventoryManage) -> DENY (cannot introduce arbitrary catalog items)
    const cashierCtx = testEnv.authenticatedContext('cashier_01');
    await assertFails(
      cashierCtx.firestore().doc('products/prod_quick_cashier_01').set(newProdPayload('cashier_01'))
    );

    // 2. Manager (has inventoryManage) -> ALLOW
    const managerCtx = testEnv.authenticatedContext('store_manager_01');
    await assertSucceeds(
      managerCtx.firestore().doc('products/prod_quick_store_manager_01').set(newProdPayload('store_manager_01'))
    );

    // 3. Admin (has inventoryManage / admin) -> ALLOW
    const adminCtx = testEnv.authenticatedContext('user_store_staff');
    await assertSucceeds(
      adminCtx.firestore().doc('products/prod_quick_user_store_staff').set(newProdPayload('user_store_staff'))
    );
  });

  // M. STOCK MOVEMENT INTEGRITY & ABUSE TESTING (T90 - T94)
  it('T90: Authorized cashier creates legitimate sale movement -> ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_t90').set({
        uid: 'cashier_t90',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc('products/prod_notebook').set({
        id: 'prod_notebook',
        name: 'دفتر مسطر',
        qty: 50,
        sellPrice: 15
      });
    });

    const cashierCtx = testEnv.authenticatedContext('cashier_t90');
    const db = cashierCtx.firestore();
    const smId = 'sm_t90_legit_sale';

    await assertSucceeds(
      db.doc(`stockMovements/${smId}`).set({
        id: smId,
        productId: 'prod_notebook',
        productName: 'دفتر مسطر',
        delta: -3,
        qtyBefore: 50,
        qtyAfter: 47,
        type: 'sale',
        referenceId: 'inv_legit_101',
        referenceNumber: 'INV-101',
        actorUid: 'cashier_t90',
        createdBy: 'cashier_t90',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z',
        note: 'بيع — نقطة البيع POS'
      })
    );
  });

  it('T91: Authorized cashier creates arbitrary movement -> role boundaries enforced, documented Security Debt verified', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_t90').set({
        uid: 'cashier_t90',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc('products/prod_notebook').set({
        id: 'prod_notebook',
        name: 'دفتر مسطر',
        qty: 50,
        sellPrice: 15
      });
    });

    const cashierCtx = testEnv.authenticatedContext('cashier_t90');
    const db = cashierCtx.firestore();

    // 1. Role-type boundary: Cashier cannot create purchase movement -> DENY
    await assertFails(
      db.doc('stockMovements/sm_arbitrary_purchase').set({
        id: 'sm_arbitrary_purchase',
        productId: 'prod_notebook',
        delta: 100,
        type: 'purchase',
        actorUid: 'cashier_t90',
        createdBy: 'cashier_t90',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );

    // 2. Role-type boundary: Cashier cannot create adjustment movement -> DENY
    await assertFails(
      db.doc('stockMovements/sm_arbitrary_adj').set({
        id: 'sm_arbitrary_adj',
        productId: 'prod_notebook',
        delta: 20,
        type: 'adjustment',
        actorUid: 'cashier_t90',
        createdBy: 'cashier_t90',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );

    // 3. Documented Security Debt: Cashier creates standalone type 'sale' with arbitrary delta
    // Under client-side architecture without relational get() (which would exceed 10-call budget),
    // rules permit type 'sale' because user holds posSales permission.
    await assertSucceeds(
      db.doc('stockMovements/sm_arbitrary_sale').set({
        id: 'sm_arbitrary_sale',
        productId: 'prod_notebook',
        delta: -5,
        type: 'sale',
        actorUid: 'cashier_t90',
        createdBy: 'cashier_t90',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T92: Unprovisioned or inactive user creating stockMovement -> DENY', async () => {
    // 1. Unprovisioned authenticated user
    const unprovCtx = testEnv.authenticatedContext('unprov_stock_intruder');
    await assertFails(
      unprovCtx.firestore().doc('stockMovements/sm_unprov_intruder').set({
        id: 'sm_unprov_intruder',
        productId: 'prod_notebook',
        delta: -1,
        type: 'sale',
        actorUid: 'unprov_stock_intruder',
        createdBy: 'unprov_stock_intruder',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );

    // 2. Inactive staff member
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/inactive_stock_user').set({
        uid: 'inactive_stock_user',
        role: 'cashier',
        isActive: false,
        permissions: { posSales: true }
      });
    });

    const inactiveCtx = testEnv.authenticatedContext('inactive_stock_user');
    await assertFails(
      inactiveCtx.firestore().doc('stockMovements/sm_inactive_intruder').set({
        id: 'sm_inactive_intruder',
        productId: 'prod_notebook',
        delta: -1,
        type: 'sale',
        actorUid: 'inactive_stock_user',
        createdBy: 'inactive_stock_user',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T93: Tampering with actorUid / createdBy / delta / productId on creation -> DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_t90').set({
        uid: 'cashier_t90',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc('products/prod_notebook').set({
        id: 'prod_notebook',
        name: 'دفتر مسطر',
        qty: 50,
        sellPrice: 15
      });
    });

    const cashierCtx = testEnv.authenticatedContext('cashier_t90');
    const db = cashierCtx.firestore();

    // 1. actorUid spoofing
    await assertFails(
      db.doc('stockMovements/sm_spoof_actor').set({
        id: 'sm_spoof_actor',
        productId: 'prod_notebook',
        delta: -1,
        type: 'sale',
        actorUid: 'other_admin_uid',
        createdBy: 'cashier_t90',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );

    // 2. createdBy spoofing
    await assertFails(
      db.doc('stockMovements/sm_spoof_creator').set({
        id: 'sm_spoof_creator',
        productId: 'prod_notebook',
        delta: -1,
        type: 'sale',
        actorUid: 'cashier_t90',
        createdBy: 'other_admin_uid',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );

    // 3. invalid delta type (string instead of number)
    await assertFails(
      db.doc('stockMovements/sm_invalid_delta').set({
        id: 'sm_invalid_delta',
        productId: 'prod_notebook',
        delta: '-5' as any,
        type: 'sale',
        actorUid: 'cashier_t90',
        createdBy: 'cashier_t90',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );

    // 4. invalid productId (non-string)
    await assertFails(
      db.doc('stockMovements/sm_invalid_prod').set({
        id: 'sm_invalid_prod',
        productId: 12345 as any,
        delta: -1,
        type: 'sale',
        actorUid: 'cashier_t90',
        createdBy: 'cashier_t90',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T94: Modifying or deleting existing stock movement -> DENY (strictly immutable)', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('stockMovements/sm_existing_record').set({
        id: 'sm_existing_record',
        productId: 'prod_notebook',
        delta: -2,
        type: 'sale',
        actorUid: 'cashier_t90',
        createdBy: 'cashier_t90',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      });
    });

    // 1. Cashier attempts update -> DENY
    const cashierCtx = testEnv.authenticatedContext('cashier_t90');
    await assertFails(
      cashierCtx.firestore().doc('stockMovements/sm_existing_record').update({
        delta: -10
      })
    );

    // 2. Admin attempts update -> DENY
    const adminCtx = testEnv.authenticatedContext('user_store_staff');
    await assertFails(
      adminCtx.firestore().doc('stockMovements/sm_existing_record').update({
        delta: -10
      })
    );

    // 3. Cashier attempts delete -> DENY
    await assertFails(
      cashierCtx.firestore().doc('stockMovements/sm_existing_record').delete()
    );

    // 4. Admin attempts delete -> DENY
    await assertFails(
      adminCtx.firestore().doc('stockMovements/sm_existing_record').delete()
    );
  });

  // =========================================================================
  // N. PHASE 2.4.5 STOCK MOVEMENT INTEGRITY & EXTENDED AUDIT (T95 - T108)
  // =========================================================================

  it('T95: Legitimate sale movement from Cashier -> ALLOW (Prompt T90 mapping)', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_t95').set({
        uid: 'cashier_t95',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc('products/prod_t95').set({
        id: 'prod_t95',
        name: 'قلم جاف أزرق',
        qty: 100,
        sellPrice: 5
      });
    });

    const cashierCtx = testEnv.authenticatedContext('cashier_t95');
    const db = cashierCtx.firestore();
    const smId = 'sm_t95_legit_sale';

    await assertSucceeds(
      db.doc(`stockMovements/${smId}`).set({
        id: smId,
        productId: 'prod_t95',
        productName: 'قلم جاف أزرق',
        delta: -2,
        qtyBefore: 100,
        qtyAfter: 98,
        type: 'sale',
        referenceId: 'inv_legit_t95',
        referenceNumber: 'INV-95',
        actorUid: 'cashier_t95',
        createdBy: 'cashier_t95',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z',
        note: 'بيع — نقطة البيع POS'
      })
    );
  });

  it('T96: Cashier attempts to create purchase movement -> DENY (Prompt T91 mapping)', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_t96').set({
        uid: 'cashier_t96',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext('cashier_t96');
    const db = cashierCtx.firestore();

    await assertFails(
      db.doc('stockMovements/sm_t96_purchase').set({
        id: 'sm_t96_purchase',
        productId: 'prod_t95',
        delta: 50,
        type: 'purchase',
        actorUid: 'cashier_t96',
        createdBy: 'cashier_t96',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T97: Cashier attempts to create adjustment movement -> DENY (Prompt T92 mapping)', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_t97').set({
        uid: 'cashier_t97',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext('cashier_t97');
    const db = cashierCtx.firestore();

    await assertFails(
      db.doc('stockMovements/sm_t97_adj').set({
        id: 'sm_t97_adj',
        productId: 'prod_t95',
        delta: 10,
        type: 'adjustment',
        actorUid: 'cashier_t97',
        createdBy: 'cashier_t97',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T98: Unprovisioned user creates stockMovement -> DENY (Prompt T93 mapping)', async () => {
    const unprovCtx = testEnv.authenticatedContext('unprov_user_t98');
    const db = unprovCtx.firestore();

    await assertFails(
      db.doc('stockMovements/sm_t98_unprov').set({
        id: 'sm_t98_unprov',
        productId: 'prod_t95',
        delta: -1,
        type: 'sale',
        actorUid: 'unprov_user_t98',
        createdBy: 'unprov_user_t98',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T99: Inactive staff creates stockMovement -> DENY (Prompt T94 mapping)', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/inactive_t99').set({
        uid: 'inactive_t99',
        role: 'cashier',
        isActive: false,
        permissions: { posSales: true }
      });
    });

    const inactiveCtx = testEnv.authenticatedContext('inactive_t99');
    const db = inactiveCtx.firestore();

    await assertFails(
      db.doc('stockMovements/sm_t99_inactive').set({
        id: 'sm_t99_inactive',
        productId: 'prod_t95',
        delta: -1,
        type: 'sale',
        actorUid: 'inactive_t99',
        createdBy: 'inactive_t99',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T100: Tampering with actorUid -> DENY (Prompt T95 mapping)', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_t100').set({
        uid: 'cashier_t100',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext('cashier_t100');
    const db = cashierCtx.firestore();

    await assertFails(
      db.doc('stockMovements/sm_t100_tamper_actor').set({
        id: 'sm_t100_tamper_actor',
        productId: 'prod_t95',
        delta: -1,
        type: 'sale',
        actorUid: 'admin_compromised_uid',
        createdBy: 'cashier_t100',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T101: Tampering with createdBy -> DENY (Prompt T96 mapping)', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_t101').set({
        uid: 'cashier_t101',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext('cashier_t101');
    const db = cashierCtx.firestore();

    await assertFails(
      db.doc('stockMovements/sm_t101_tamper_creator').set({
        id: 'sm_t101_tamper_creator',
        productId: 'prod_t95',
        delta: -1,
        type: 'sale',
        actorUid: 'cashier_t101',
        createdBy: 'admin_compromised_uid',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T102: Tampering with restricted payload fields (productId, delta, type, referenceId) -> DENY (Prompt T97 mapping)', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_t102').set({
        uid: 'cashier_t102',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext('cashier_t102');
    const db = cashierCtx.firestore();

    // 1. invalid productId (number instead of string)
    await assertFails(
      db.doc('stockMovements/sm_t102_prod').set({
        id: 'sm_t102_prod',
        productId: 9999 as any,
        delta: -1,
        type: 'sale',
        actorUid: 'cashier_t102',
        createdBy: 'cashier_t102',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );

    // 2. invalid delta (string instead of number)
    await assertFails(
      db.doc('stockMovements/sm_t102_delta').set({
        id: 'sm_t102_delta',
        productId: 'prod_t95',
        delta: '-5' as any,
        type: 'sale',
        actorUid: 'cashier_t102',
        createdBy: 'cashier_t102',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );

    // 3. invalid type
    await assertFails(
      db.doc('stockMovements/sm_t102_type').set({
        id: 'sm_t102_type',
        productId: 'prod_t95',
        delta: -1,
        type: 'unauthorized_type',
        actorUid: 'cashier_t102',
        createdBy: 'cashier_t102',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );

    // 4. invalid referenceId (non-string)
    await assertFails(
      db.doc('stockMovements/sm_t102_ref').set({
        id: 'sm_t102_ref',
        productId: 'prod_t95',
        delta: -1,
        type: 'sale',
        referenceId: 12345 as any,
        actorUid: 'cashier_t102',
        createdBy: 'cashier_t102',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T103: Existing movement update -> DENY (Prompt T98 mapping)', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_t103').set({
        uid: 'cashier_t103',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc('stockMovements/sm_t103_exist').set({
        id: 'sm_t103_exist',
        productId: 'prod_t95',
        delta: -2,
        type: 'sale',
        actorUid: 'cashier_t103',
        createdBy: 'cashier_t103',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      });
    });

    const cashierCtx = testEnv.authenticatedContext('cashier_t103');
    await assertFails(
      cashierCtx.firestore().doc('stockMovements/sm_t103_exist').update({
        delta: -20
      })
    );
  });

  it('T104: Existing movement delete -> DENY (Prompt T99 mapping)', async () => {
    const cashierCtx = testEnv.authenticatedContext('cashier_t103');
    await assertFails(
      cashierCtx.firestore().doc('stockMovements/sm_t103_exist').delete()
    );
  });

  it('T105: Duplicate movement ID overwrite -> DENY (Prompt T100 mapping)', async () => {
    const cashierCtx = testEnv.authenticatedContext('cashier_t103');
    await assertFails(
      cashierCtx.firestore().doc('stockMovements/sm_t103_exist').set({
        id: 'sm_t103_exist',
        productId: 'prod_t95',
        delta: -5,
        type: 'sale',
        actorUid: 'cashier_t103',
        createdBy: 'cashier_t103',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T106: Cashier creates standalone sale movement directly without parent invoice -> ALLOW as documented Security Debt (Prompt T101 mapping)', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc('userProfiles/cashier_t106').set({
        uid: 'cashier_t106',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext('cashier_t106');
    const db = cashierCtx.firestore();

    // In client-only Firestore rules, checking relational invoice existence via get() is prohibited
    // by the strict 10-call transaction limit on multi-item sales. Therefore, rules permit authorized posSales
    // to write valid sale movements, which is a known and documented Security Debt.
    await assertSucceeds(
      db.doc('stockMovements/sm_t106_direct_api').set({
        id: 'sm_t106_direct_api',
        productId: 'prod_t95',
        delta: -3,
        type: 'sale',
        actorUid: 'cashier_t106',
        createdBy: 'cashier_t106',
        date: '2026-10-06',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T107: OperationKeys legitimate paths for all roles -> ALLOW (Priority 0 requirement)', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      // Setup roles
      await adminDb.doc('userProfiles/user_cashier').set({
        uid: 'user_cashier',
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc('userProfiles/user_accountant').set({
        uid: 'user_accountant',
        role: 'accountant',
        isActive: true,
        permissions: { customersManage: true, treasuryManage: true }
      });
      await adminDb.doc('userProfiles/user_purchaser').set({
        uid: 'user_purchaser',
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc('userProfiles/user_inv_mgr').set({
        uid: 'user_inv_mgr',
        role: 'manager',
        isActive: true,
        permissions: { inventoryManage: true }
      });
      await adminDb.doc('userProfiles/user_day_close').set({
        uid: 'user_day_close',
        role: 'manager',
        isActive: true,
        permissions: { dayClose: true }
      });
    });

    // 1. Cashier -> sale, salesReturn, return
    const cashierDb = testEnv.authenticatedContext('user_cashier').firestore();
    await assertSucceeds(cashierDb.doc('operationKeys/op_t107_sale').set({ id: 'op_t107_sale', actorUid: 'user_cashier', type: 'sale' }));
    await assertSucceeds(cashierDb.doc('operationKeys/op_t107_ret').set({ id: 'op_t107_ret', actorUid: 'user_cashier', type: 'return' }));

    // 2. Accountant -> customer_payment, supplier_payment
    const accDb = testEnv.authenticatedContext('user_accountant').firestore();
    await assertSucceeds(accDb.doc('operationKeys/op_t107_cpay').set({ id: 'op_t107_cpay', actorUid: 'user_accountant', type: 'customer_payment' }));
    await assertSucceeds(accDb.doc('operationKeys/op_t107_spay').set({ id: 'op_t107_spay', actorUid: 'user_accountant', type: 'supplier_payment' }));

    // 3. Purchaser -> purchase, purchaseReturn
    const purDb = testEnv.authenticatedContext('user_purchaser').firestore();
    await assertSucceeds(purDb.doc('operationKeys/op_t107_pur').set({ id: 'op_t107_pur', actorUid: 'user_purchaser', type: 'purchase' }));
    await assertSucceeds(purDb.doc('operationKeys/op_t107_pret').set({ id: 'op_t107_pret', actorUid: 'user_purchaser', type: 'purchaseReturn' }));

    // 4. Inventory Manager -> adjustment
    const invDb = testEnv.authenticatedContext('user_inv_mgr').firestore();
    await assertSucceeds(invDb.doc('operationKeys/op_t107_adj').set({ id: 'op_t107_adj', actorUid: 'user_inv_mgr', type: 'adjustment' }));

    // 5. DayClose User -> dayClose
    const closeDb = testEnv.authenticatedContext('user_day_close').firestore();
    await assertSucceeds(closeDb.doc('operationKeys/op_t107_close').set({ id: 'op_t107_close', actorUid: 'user_day_close', type: 'dayClose' }));
  });

  it('T108: 15-item POS Sale atomic transaction access-calls test (invoice + 15 products + 15 stockMovements + counter + opKey)', async () => {
    const cashierUid = 'cashier_15_items';
    const numItems = 15;
    const invId = 'inv_15_items_test';
    const opKey = 'op_' + invId;

    // Seed 15 products in Firestore
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc('meta/counters').set({ invoice: 50 });

      for (let i = 0; i < numItems; i++) {
        await adminDb.doc(`products/prod_15_${i}`).set({
          id: `prod_15_${i}`,
          name: `Item ${i}`,
          qty: 100,
          sellPrice: 10
        });
      }
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Execute atomic transaction as done in SaleInvoicePage.tsx
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        // Reads:
        const counterRef = db.doc('meta/counters');
        const opRef = db.doc(`operationKeys/${opKey}`);
        const invRef = db.doc(`invoices/${invId}`);

        const counterSnap = await tx.get(counterRef);
        const opSnap = await tx.get(opRef);
        const invSnap = await tx.get(invRef);

        const prodSnaps = [];
        for (let i = 0; i < numItems; i++) {
          prodSnaps.push(await tx.get(db.doc(`products/prod_15_${i}`)));
        }

        // Writes:
        // 1. Invoice
        tx.set(invRef, {
          id: invId,
          number: 51,
          date: '2026-10-06',
          total: 150,
          paidAmount: 150,
          dueAmount: 0,
          items: prodSnaps.map((s, idx) => ({ productId: `prod_15_${idx}`, qty: 1, price: 10 })),
          operationId: opKey,
          actorUid: cashierUid,
          createdBy: cashierUid,
          createdAt: '2026-10-06T10:00:00Z'
        });

        // 2. 15 Product qty updates
        for (let i = 0; i < numItems; i++) {
          const currentQty = prodSnaps[i].data()?.qty || 100;
          tx.update(db.doc(`products/prod_15_${i}`), {
            qty: currentQty - 1
          });
        }

        // 3. 15 StockMovements
        for (let i = 0; i < numItems; i++) {
          const smId = `sm_15_test_${i}`;
          tx.set(db.doc(`stockMovements/${smId}`), {
            id: smId,
            productId: `prod_15_${i}`,
            delta: -1,
            type: 'sale',
            referenceId: invId,
            referenceNumber: 51,
            actorUid: cashierUid,
            createdBy: cashierUid,
            date: '2026-10-06',
            createdAt: '2026-10-06T10:00:00Z'
          });
        }

        // 4. Counter update
        tx.set(counterRef, { invoice: 51 }, { merge: true });

        // 5. OperationKey
        tx.set(opRef, {
          id: opKey,
          actorUid: cashierUid,
          type: 'sale',
          targetId: invId,
          number: 51,
          createdAt: '2026-10-06T10:00:00Z'
        });
      })
    );
  });

  // =========================================================================
  // 9. PHASE 2.4.5 FIELD-LEVEL AUTHORIZATION SUITE (T110 - T134)
  // =========================================================================

  // A. CUSTOMERS FIELD-LEVEL AUTHORIZATION
  it('T110: Cashier with posSales creates customer at POS checkout without discountRate -> ALLOW', async () => {
    const cashierUid = 'cashier_fl_cust_1';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    await assertSucceeds(
      db.doc('customers/cust_checkout_1').set({
        id: 'cust_checkout_1',
        name: 'عميل نقطة البيع الجديد',
        phone: '01012345678',
        address: 'شارع التحرير',
        createdAt: '2026-10-06T10:00:00Z',
        balance: { invoiced: 100, paid: 100, updatedAt: '2026-10-06T10:00:00Z' },
        loyaltyPoints: 10,
        lastTransactionDate: '2026-10-06'
      })
    );
  });

  it('T111: Cashier with posSales attempts to create customer with arbitrary discountRate -> DENY', async () => {
    const cashierUid = 'cashier_fl_cust_2';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    await assertFails(
      db.doc('customers/cust_checkout_exploit').set({
        id: 'cust_checkout_exploit',
        name: 'عميل خصم استغلالي',
        phone: '01099999999',
        discountRate: 25, // Unsanctioned cashier-granted discount rate
        createdAt: '2026-10-06T10:00:00Z',
        balance: { invoiced: 0, paid: 0, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('T112: Cashier with posSales updates existing customer sales fields (balance, points, contact) -> ALLOW', async () => {
    const cashierUid = 'cashier_fl_cust_3';
    const custId = 'cust_existing_sales_1';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل قديم',
        phone: '01000000000',
        address: 'القديم',
        discountRate: 0,
        balance: { invoiced: 100, paid: 100, updatedAt: '2026-10-01T00:00:00Z' },
        loyaltyPoints: 5,
        lastTransactionDate: '2026-10-01'
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: 250, paid: 250, updatedAt: '2026-10-06T10:00:00Z' },
        loyaltyPoints: 15,
        lastTransactionDate: '2026-10-06',
        name: 'عميل قديم معدل',
        phone: '01011111111',
        address: 'العنوان الجديد'
      })
    );
  });

  it('T113: Cashier with posSales attempts to modify customer discountRate -> DENY', async () => {
    const cashierUid = 'cashier_fl_cust_4';
    const custId = 'cust_existing_sales_2';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل عادي',
        discountRate: 0,
        balance: { invoiced: 50, paid: 50, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    await assertFails(
      db.doc(`customers/${custId}`).update({
        discountRate: 20
      })
    );
  });

  it('T114: Staff with customersManage updates customer discountRate -> ALLOW', async () => {
    const managerUid = 'cust_manager_1';
    const custId = 'cust_existing_sales_3';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${managerUid}`).set({
        uid: managerUid,
        role: 'manager',
        isActive: true,
        permissions: { customersManage: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل مؤسسي',
        discountRate: 5,
        balance: { invoiced: 50, paid: 50, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const mgrCtx = testEnv.authenticatedContext(managerUid);
    const db = mgrCtx.firestore();

    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        discountRate: 15
      })
    );
  });

  it('T115: Staff with salesReturns updates customer balance only -> ALLOW', async () => {
    const returnUid = 'return_agent_1';
    const custId = 'cust_for_return_1';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${returnUid}`).set({
        uid: returnUid,
        role: 'cashier',
        isActive: true,
        permissions: { salesReturns: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل مرتجع',
        balance: { invoiced: 100, paid: 100, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const retCtx = testEnv.authenticatedContext(returnUid);
    const db = retCtx.firestore();

    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: 70, paid: 100, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('T116: Staff with salesReturns attempts to update customer name or phone -> DENY', async () => {
    const returnUid = 'return_agent_2';
    const custId = 'cust_for_return_2';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${returnUid}`).set({
        uid: returnUid,
        role: 'cashier',
        isActive: true,
        permissions: { salesReturns: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل مرتجع محمي',
        phone: '01012345678',
        balance: { invoiced: 100, paid: 100, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const retCtx = testEnv.authenticatedContext(returnUid);
    const db = retCtx.firestore();

    await assertFails(
      db.doc(`customers/${custId}`).update({
        phone: '01099998888'
      })
    );
  });

  // B. SUPPLIERS FIELD-LEVEL AUTHORIZATION
  it('T117: Staff with suppliersManage creates new supplier -> ALLOW', async () => {
    const suppMgrUid = 'supp_manager_1';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${suppMgrUid}`).set({
        uid: suppMgrUid,
        role: 'manager',
        isActive: true,
        permissions: { suppliersManage: true }
      });
    });

    const mgrCtx = testEnv.authenticatedContext(suppMgrUid);
    const db = mgrCtx.firestore();

    await assertSucceeds(
      db.doc('suppliers/supp_new_1').set({
        id: 'supp_new_1',
        name: 'دار الشروق للنشر',
        phone: '0223456789',
        company: 'دار الشروق',
        balance: { invoiced: 0, paid: 0, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('T118: Staff with purchasesManage attempts to create new supplier document -> DENY', async () => {
    const purchaserUid = 'purchaser_fl_1';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purchaserUid}`).set({
        uid: purchaserUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
    });

    const purCtx = testEnv.authenticatedContext(purchaserUid);
    const db = purCtx.firestore();

    await assertFails(
      db.doc('suppliers/supp_unauthorized_create').set({
        id: 'supp_unauthorized_create',
        name: 'مورد وهمي من مسؤول المشتريات',
        balance: { invoiced: 0, paid: 0 }
      })
    );
  });

  it('T119: Staff with purchasesManage updates supplier balance ledger -> ALLOW', async () => {
    const purchaserUid = 'purchaser_fl_2';
    const suppId = 'supp_legit_1';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purchaserUid}`).set({
        uid: purchaserUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مكتبة العبيكان',
        phone: '01011122233',
        company: 'العبيكان',
        balance: { invoiced: 1000, paid: 500, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const purCtx = testEnv.authenticatedContext(purchaserUid);
    const db = purCtx.firestore();

    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 1800, paid: 500, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('T120: Staff with purchasesManage attempts to alter supplier name or phone -> DENY', async () => {
    const purchaserUid = 'purchaser_fl_3';
    const suppId = 'supp_legit_2';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purchaserUid}`).set({
        uid: purchaserUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'نهضة مصر',
        phone: '01000000000',
        balance: { invoiced: 2000, paid: 2000, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const purCtx = testEnv.authenticatedContext(purchaserUid);
    const db = purCtx.firestore();

    await assertFails(
      db.doc(`suppliers/${suppId}`).update({
        name: 'نهضة مصر فرع آخر',
        phone: '01099999999'
      })
    );
  });

  it('T121: Staff with treasuryManage updates supplier balance ledger -> ALLOW', async () => {
    const treasuryUid = 'treasury_agent_1';
    const suppId = 'supp_legit_3';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${treasuryUid}`).set({
        uid: treasuryUid,
        role: 'treasurer',
        isActive: true,
        permissions: { treasuryManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد تجاري',
        balance: { invoiced: 500, paid: 200, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const trCtx = testEnv.authenticatedContext(treasuryUid);
    const db = trCtx.firestore();

    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 500, paid: 500, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('T122: Staff with treasuryManage attempts to alter supplier company or phone -> DENY', async () => {
    const treasuryUid = 'treasury_agent_2';
    const suppId = 'supp_legit_4';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${treasuryUid}`).set({
        uid: treasuryUid,
        role: 'treasurer',
        isActive: true,
        permissions: { treasuryManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد محمي',
        company: 'شركة أصلية',
        balance: { invoiced: 500, paid: 200, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const trCtx = testEnv.authenticatedContext(treasuryUid);
    const db = trCtx.firestore();

    await assertFails(
      db.doc(`suppliers/${suppId}`).update({
        company: 'شركة مزيفة'
      })
    );
  });

  // C. INVOICES AUTHORIZATION & IMMUTABILITY
  it('T123: Cashier with posSales creates legitimate invoice -> ALLOW', async () => {
    const cashierUid = 'cashier_fl_inv_1';
    const invId = 'inv_fl_valid_1';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    await assertSucceeds(
      db.doc(`invoices/${invId}`).set({
        id: invId,
        number: 101,
        date: '2026-10-06',
        items: [{ productId: 'prod_1', name: 'قلم جاف', qty: 2, price: 10 }],
        total: 20,
        paidAmount: 20,
        operationId: 'op_fl_inv_1',
        actorUid: cashierUid,
        createdBy: cashierUid,
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T124: Cashier attempts to forge actorUid or createdBy on invoice -> DENY', async () => {
    const cashierUid = 'cashier_fl_inv_2';
    const invId = 'inv_fl_forged_1';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    await assertFails(
      db.doc(`invoices/${invId}`).set({
        id: invId,
        number: 102,
        date: '2026-10-06',
        items: [{ productId: 'prod_1', name: 'قلم جاف', qty: 1, price: 10 }],
        total: 10,
        paidAmount: 10,
        operationId: 'op_fl_inv_2',
        actorUid: 'another_user', // Forged actor
        createdBy: cashierUid,
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T125: Cashier with posSales attempts to modify historical invoice -> DENY', async () => {
    const cashierUid = 'cashier_fl_inv_3';
    const invId = 'inv_fl_hist_1';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`invoices/${invId}`).set({
        id: invId,
        number: 50,
        date: '2026-10-01',
        total: 100,
        paidAmount: 100,
        items: [{ productId: 'p1', qty: 1, price: 100 }],
        operationId: 'op_old_50',
        actorUid: cashierUid,
        createdBy: cashierUid,
        createdAt: '2026-10-01T10:00:00Z'
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    await assertFails(
      db.doc(`invoices/${invId}`).update({
        total: 80 // Attempting unauthorized historical modification
      })
    );
  });

  it('T126: Admin updates historical invoice preserving immutable identifiers -> ALLOW', async () => {
    const adminUid = 'admin_inv_edit';
    const invId = 'inv_fl_hist_2';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${adminUid}`).set({
        uid: adminUid,
        role: 'admin',
        isActive: true,
        permissions: {}
      });
      await adminDb.doc(`invoices/${invId}`).set({
        id: invId,
        number: 55,
        date: '2026-10-01',
        total: 150,
        paidAmount: 150,
        items: [{ productId: 'p1', qty: 1, price: 150 }],
        operationId: 'op_old_55',
        actorUid: 'cashier_orig',
        createdBy: 'cashier_orig',
        createdAt: '2026-10-01T10:00:00Z'
      });
    });

    const adminCtx = testEnv.authenticatedContext(adminUid);
    const db = adminCtx.firestore();

    await assertSucceeds(
      db.doc(`invoices/${invId}`).update({
        notes: 'تمت المراجعة والتدقيق الإداري'
      })
    );
  });

  it('T127: Admin attempts to alter operationId or createdBy on historical invoice -> DENY', async () => {
    const adminUid = 'admin_inv_tamper';
    const invId = 'inv_fl_hist_3';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${adminUid}`).set({
        uid: adminUid,
        role: 'admin',
        isActive: true,
        permissions: {}
      });
      await adminDb.doc(`invoices/${invId}`).set({
        id: invId,
        number: 60,
        date: '2026-10-01',
        total: 200,
        paidAmount: 200,
        items: [{ productId: 'p1', qty: 2, price: 100 }],
        operationId: 'op_orig_60',
        actorUid: 'orig_actor',
        createdBy: 'orig_actor',
        createdAt: '2026-10-01T10:00:00Z'
      });
    });

    const adminCtx = testEnv.authenticatedContext(adminUid);
    const db = adminCtx.firestore();

    await assertFails(
      db.doc(`invoices/${invId}`).update({
        operationId: 'op_tampered_new_id'
      })
    );
  });

  // D. PURCHASES AUTHORIZATION & IMMUTABILITY
  it('T128: Staff with purchasesManage creates legitimate purchase -> ALLOW', async () => {
    const purchaserUid = 'pur_agent_1';
    const purId = 'pur_legit_create_1';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purchaserUid}`).set({
        uid: purchaserUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
    });

    const purCtx = testEnv.authenticatedContext(purchaserUid);
    const db = purCtx.firestore();

    await assertSucceeds(
      db.doc(`purchases/${purId}`).set({
        id: purId,
        number: 1,
        date: '2026-10-06',
        supplierId: 'supp_legit_1',
        items: [{ productId: 'prod_1', name: 'كشكول سلك', qty: 50, cost: 15 }],
        total: 750,
        paidAmount: 750,
        dueAmount: 0,
        operationId: 'op_pur_create_1',
        actorUid: purchaserUid,
        createdBy: purchaserUid,
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T129: Staff with purchasesManage attempts to forge actorUid on purchase -> DENY', async () => {
    const purchaserUid = 'pur_agent_2';
    const purId = 'pur_forged_actor_1';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purchaserUid}`).set({
        uid: purchaserUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
    });

    const purCtx = testEnv.authenticatedContext(purchaserUid);
    const db = purCtx.firestore();

    await assertFails(
      db.doc(`purchases/${purId}`).set({
        id: purId,
        number: 2,
        date: '2026-10-06',
        items: [{ productId: 'prod_1', name: 'أقلام', qty: 10, cost: 5 }],
        total: 50,
        paidAmount: 50,
        operationId: 'op_pur_forged_1',
        actorUid: 'another_purchaser',
        createdBy: purchaserUid,
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T130: Staff with purchasesManage attempts to update existing purchase -> DENY', async () => {
    const purchaserUid = 'pur_agent_3';
    const purId = 'pur_immutable_test_1';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purchaserUid}`).set({
        uid: purchaserUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`purchases/${purId}`).set({
        id: purId,
        number: 3,
        date: '2026-10-01',
        items: [{ productId: 'p1', qty: 10, cost: 20 }],
        total: 200,
        paidAmount: 200,
        operationId: 'op_pur_hist_3',
        actorUid: purchaserUid,
        createdBy: purchaserUid,
        createdAt: '2026-10-01T10:00:00Z'
      });
    });

    const purCtx = testEnv.authenticatedContext(purchaserUid);
    const db = purCtx.firestore();

    await assertFails(
      db.doc(`purchases/${purId}`).update({
        total: 150
      })
    );
  });

  it('T131: Admin updates historical purchase preserving immutable identifiers -> ALLOW', async () => {
    const adminUid = 'admin_pur_update';
    const purId = 'pur_admin_edit_1';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${adminUid}`).set({
        uid: adminUid,
        role: 'admin',
        isActive: true,
        permissions: {}
      });
      await adminDb.doc(`purchases/${purId}`).set({
        id: purId,
        number: 4,
        date: '2026-10-01',
        items: [{ productId: 'p1', qty: 10, cost: 20 }],
        total: 200,
        paidAmount: 200,
        operationId: 'op_pur_hist_4',
        actorUid: 'pur_agent_orig',
        createdBy: 'pur_agent_orig',
        createdAt: '2026-10-01T10:00:00Z'
      });
    });

    const adminCtx = testEnv.authenticatedContext(adminUid);
    const db = adminCtx.firestore();

    await assertSucceeds(
      db.doc(`purchases/${purId}`).update({
        notes: 'ملاحظة إدارية معتمدة'
      })
    );
  });

  it('T132: Admin attempts to alter operationId on historical purchase -> DENY', async () => {
    const adminUid = 'admin_pur_tamper';
    const purId = 'pur_admin_edit_2';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${adminUid}`).set({
        uid: adminUid,
        role: 'admin',
        isActive: true,
        permissions: {}
      });
      await adminDb.doc(`purchases/${purId}`).set({
        id: purId,
        number: 5,
        date: '2026-10-01',
        items: [{ productId: 'p1', qty: 10, cost: 20 }],
        total: 200,
        paidAmount: 200,
        operationId: 'op_pur_orig_5',
        actorUid: 'pur_agent_orig',
        createdBy: 'pur_agent_orig',
        createdAt: '2026-10-01T10:00:00Z'
      });
    });

    const adminCtx = testEnv.authenticatedContext(adminUid);
    const db = adminCtx.firestore();

    await assertFails(
      db.doc(`purchases/${purId}`).update({
        operationId: 'op_forged_pur_key'
      })
    );
  });

  // E. DELETION RESTRICTIONS
  it('T133: Cashier attempts to delete customer, supplier, invoice, or purchase -> DENY', async () => {
    const cashierUid = 'cashier_del_test';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc('customers/cust_del_target').set({ id: 'cust_del_target', name: 'عميل' });
      await adminDb.doc('suppliers/supp_del_target').set({ id: 'supp_del_target', name: 'مورد' });
      await adminDb.doc('invoices/inv_del_target').set({ id: 'inv_del_target', total: 50 });
      await adminDb.doc('purchases/pur_del_target').set({ id: 'pur_del_target', total: 50 });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    await assertFails(db.doc('customers/cust_del_target').delete());
    await assertFails(db.doc('suppliers/supp_del_target').delete());
    await assertFails(db.doc('invoices/inv_del_target').delete());
    await assertFails(db.doc('purchases/pur_del_target').delete());
  });

  it('T134: Admin deletes invoice, purchase, customer, or supplier -> ALLOW', async () => {
    const adminUid = 'admin_del_test';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${adminUid}`).set({
        uid: adminUid,
        role: 'admin',
        isActive: true,
        permissions: { deleteInvoices: true }
      });
      await adminDb.doc('customers/cust_del_adm').set({ id: 'cust_del_adm', name: 'عميل للحذف' });
      await adminDb.doc('suppliers/supp_del_adm').set({ id: 'supp_del_adm', name: 'مورد للحذف' });
      await adminDb.doc('invoices/inv_del_adm').set({ id: 'inv_del_adm', total: 50 });
      await adminDb.doc('purchases/pur_del_adm').set({ id: 'pur_del_adm', total: 50 });
    });

    const adminCtx = testEnv.authenticatedContext(adminUid);
    const db = adminCtx.firestore();

    await assertSucceeds(db.doc('customers/cust_del_adm').delete());
    await assertSucceeds(db.doc('suppliers/supp_del_adm').delete());
    await assertSucceeds(db.doc('invoices/inv_del_adm').delete());
    await assertSucceeds(db.doc('purchases/pur_del_adm').delete());
  });

  // =========================================================================
  // 10. PHASE 2.4.5 FINANCIAL FIELD INTEGRITY & ATTACK MATRIX (T135 - T155)
  // =========================================================================

  // A. CUSTOMER BALANCE & FINANCIAL VALUE INTEGRITY
  it('T135: Cashier arbitrary customer balance.invoiced (KNOWN DEBT - ALLOW at rules layer, mitigated by audit reconciliation)', async () => {
    const cashierUid = 'cashier_atk_135';
    const custId = 'cust_atk_135';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل تدقيق 135',
        balance: { invoiced: 100, paid: 100, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Field-level allows 'balance' update with valid shape, but rules cannot independently verify invoice existence.
    // This is KNOWN FINANCIAL VALUE INTEGRITY DEBT mitigated by runIntegrityAudit / reconcileBalances.
    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: 999999, paid: 100, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('T136: Cashier arbitrary customer balance.paid (KNOWN DEBT - ALLOW at rules layer, mitigated by audit reconciliation)', async () => {
    const cashierUid = 'cashier_atk_136';
    const custId = 'cust_atk_136';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل تدقيق 136',
        balance: { invoiced: 500, paid: 100, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Field-level allows 'balance' update with valid shape. KNOWN DEBT without customerPayment proof in rules.
    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: 500, paid: 999999, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('T137: Cashier arbitrary customer loyaltyPoints (KNOWN DEBT - ALLOW at rules layer)', async () => {
    const cashierUid = 'cashier_atk_137';
    const custId = 'cust_atk_137';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل تدقيق 137',
        loyaltyPoints: 10
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Cashier is permitted to update loyaltyPoints in POS checkout. KNOWN DEBT for arbitrary points assignment.
    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        loyaltyPoints: 999999
      })
    );
  });

  it('T138: Cashier arbitrary customer discountRate -> DENY (Field-Level Protected)', async () => {
    const cashierUid = 'cashier_atk_138';
    const custId = 'cust_atk_138';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل تدقيق 138',
        discountRate: 0
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    await assertFails(
      db.doc(`customers/${custId}`).update({
        discountRate: 35
      })
    );
  });

  it('T139: Cashier arbitrary customer createdBy -> DENY (Field-Level Protected)', async () => {
    const cashierUid = 'cashier_atk_139';
    const custId = 'cust_atk_139';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل تدقيق 139',
        createdBy: 'admin_original'
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    await assertFails(
      db.doc(`customers/${custId}`).update({
        createdBy: 'forged_creator'
      })
    );
  });

  it('T140: Cashier arbitrary customer actorUid -> DENY (Field-Level Protected)', async () => {
    const cashierUid = 'cashier_atk_140';
    const custId = 'cust_atk_140';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل تدقيق 140',
        actorUid: 'admin_original'
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    await assertFails(
      db.doc(`customers/${custId}`).update({
        actorUid: 'forged_actor'
      })
    );
  });

  it('T141: Cashier arbitrary customer createdAt -> DENY (Field-Level Protected)', async () => {
    const cashierUid = 'cashier_atk_141';
    const custId = 'cust_atk_141';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل تدقيق 141',
        createdAt: '2026-01-01T00:00:00Z'
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    await assertFails(
      db.doc(`customers/${custId}`).update({
        createdAt: '2025-01-01T00:00:00Z'
      })
    );
  });

  // B. SUPPLIER BALANCE & PROFILE INTEGRITY
  it('T142: Purchases manager arbitrary supplier balance.invoiced (KNOWN DEBT - ALLOW at rules layer)', async () => {
    const purchaserUid = 'pur_atk_142';
    const suppId = 'supp_atk_142';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purchaserUid}`).set({
        uid: purchaserUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد تدقيق 142',
        balance: { invoiced: 500, paid: 500, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const purCtx = testEnv.authenticatedContext(purchaserUid);
    const db = purCtx.firestore();

    // Allowed because affectedKeys is ['balance'] with valid shape. KNOWN FINANCIAL VALUE INTEGRITY DEBT.
    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 999999, paid: 500, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('T143: Purchases manager arbitrary supplier balance.paid (KNOWN DEBT - ALLOW at rules layer)', async () => {
    const purchaserUid = 'pur_atk_143';
    const suppId = 'supp_atk_143';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purchaserUid}`).set({
        uid: purchaserUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد تدقيق 143',
        balance: { invoiced: 500, paid: 100, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const purCtx = testEnv.authenticatedContext(purchaserUid);
    const db = purCtx.firestore();

    // Allowed because affectedKeys is ['balance'] with valid shape. KNOWN DEBT.
    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 500, paid: 999999, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('T144: Treasury manager arbitrary supplier balance (KNOWN DEBT - ALLOW at rules layer)', async () => {
    const treasuryUid = 'tr_atk_144';
    const suppId = 'supp_atk_144';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${treasuryUid}`).set({
        uid: treasuryUid,
        role: 'treasurer',
        isActive: true,
        permissions: { treasuryManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد تدقيق 144',
        balance: { invoiced: 1000, paid: 200, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const trCtx = testEnv.authenticatedContext(treasuryUid);
    const db = trCtx.firestore();

    // Allowed because treasuryManage is permitted to update balance. KNOWN DEBT.
    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 8000, paid: 8000, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('T145: Purchases manager supplier name tampering -> DENY (Field-Level Protected)', async () => {
    const purchaserUid = 'pur_atk_145';
    const suppId = 'supp_atk_145';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purchaserUid}`).set({
        uid: purchaserUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد أصلي 145',
        phone: '01011111111'
      });
    });

    const purCtx = testEnv.authenticatedContext(purchaserUid);
    const db = purCtx.firestore();

    await assertFails(
      db.doc(`suppliers/${suppId}`).update({
        name: 'اسم مورد مزيف'
      })
    );
  });

  it('T146: Purchases manager supplier phone tampering -> DENY (Field-Level Protected)', async () => {
    const purchaserUid = 'pur_atk_146';
    const suppId = 'supp_atk_146';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purchaserUid}`).set({
        uid: purchaserUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد أصلي 146',
        phone: '01011111111'
      });
    });

    const purCtx = testEnv.authenticatedContext(purchaserUid);
    const db = purCtx.firestore();

    await assertFails(
      db.doc(`suppliers/${suppId}`).update({
        phone: '01099999999'
      })
    );
  });

  it('T146b: Treasury manager supplier company tampering -> DENY (Field-Level Protected)', async () => {
    const treasuryUid = 'tr_atk_146b';
    const suppId = 'supp_atk_146b';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${treasuryUid}`).set({
        uid: treasuryUid,
        role: 'treasurer',
        isActive: true,
        permissions: { treasuryManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد أصلي 146b',
        company: 'شركة أصلية'
      });
    });

    const trCtx = testEnv.authenticatedContext(treasuryUid);
    const db = trCtx.firestore();

    await assertFails(
      db.doc(`suppliers/${suppId}`).update({
        company: 'شركة وهمية'
      })
    );
  });

  it('T146c: Purchases manager supplier createdBy tampering -> DENY (Field-Level Protected)', async () => {
    const purchaserUid = 'pur_atk_146c';
    const suppId = 'supp_atk_146c';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purchaserUid}`).set({
        uid: purchaserUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد أصلي 146c',
        createdBy: 'admin_initial'
      });
    });

    const purCtx = testEnv.authenticatedContext(purchaserUid);
    const db = purCtx.firestore();

    await assertFails(
      db.doc(`suppliers/${suppId}`).update({
        createdBy: 'forged_user'
      })
    );
  });

  // C. CUSTOMER CREATION PAYLOAD INTEGRITY
  it('T147: Cashier creates customer with invalid balance shape -> DENY', async () => {
    const cashierUid = 'cashier_atk_147';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Invalid balance keys: extra unauthorized field
    await assertFails(
      db.doc('customers/cust_invalid_bal').set({
        id: 'cust_invalid_bal',
        name: 'عميل تشويه رصيد',
        balance: { invoiced: 100, paid: 100, bogusField: 'exploit' }
      })
    );
  });

  it('T148: Cashier fake customer with discountRate > 0 -> DENY', async () => {
    const cashierUid = 'cashier_atk_148';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // posSales cannot include discountRate in allowed create keys
    await assertFails(
      db.doc('customers/cust_exploit_148').set({
        id: 'cust_exploit_148',
        name: 'عميل خصم استغلالي',
        discountRate: 50,
        balance: { invoiced: 0, paid: 0, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  // D. INVOICE FINANCIAL INTEGRITY
  it('T149: Cashier fake invoice with paidAmount > total -> DENY', async () => {
    const cashierUid = 'cashier_atk_149';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    await assertFails(
      db.doc('invoices/inv_overpaid').set({
        id: 'inv_overpaid',
        number: 201,
        date: '2026-10-06',
        total: 100,
        paidAmount: 500, // Invalid: paidAmount > total
        items: [{ productId: 'p1', qty: 1, price: 100 }],
        operationId: 'op_inv_overpaid',
        actorUid: cashierUid,
        createdBy: cashierUid,
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T150: Cashier fake invoice with negative total or negative paidAmount -> DENY', async () => {
    const cashierUid = 'cashier_atk_150';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    await assertFails(
      db.doc('invoices/inv_neg_total').set({
        id: 'inv_neg_total',
        number: 202,
        date: '2026-10-06',
        total: -50,
        paidAmount: 0,
        items: [{ productId: 'p1', qty: 1, price: 50 }],
        operationId: 'op_inv_neg',
        actorUid: cashierUid,
        createdBy: cashierUid,
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T151: Historical invoice edit attempts to modify immutable identity fields (operationId) -> DENY', async () => {
    const adminUid = 'admin_atk_151';
    const invId = 'inv_hist_151';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${adminUid}`).set({
        uid: adminUid,
        role: 'admin',
        isActive: true,
        permissions: {}
      });
      await adminDb.doc(`invoices/${invId}`).set({
        id: invId,
        number: 80,
        date: '2026-10-01',
        total: 100,
        paidAmount: 100,
        items: [{ productId: 'p1', qty: 1, price: 100 }],
        operationId: 'op_original_80',
        actorUid: 'cashier_orig',
        createdBy: 'cashier_orig',
        createdAt: '2026-10-01T10:00:00Z'
      });
    });

    const adminCtx = testEnv.authenticatedContext(adminUid);
    const db = adminCtx.firestore();

    await assertFails(
      db.doc(`invoices/${invId}`).update({
        operationId: 'op_forged_edit_80'
      })
    );
  });

  // E. PURCHASE INTEGRITY
  it('T152: Purchases manager negative total purchase -> DENY', async () => {
    const purchaserUid = 'pur_atk_152';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purchaserUid}`).set({
        uid: purchaserUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
    });

    const purCtx = testEnv.authenticatedContext(purchaserUid);
    const db = purCtx.firestore();

    await assertFails(
      db.doc('purchases/pur_neg_total').set({
        id: 'pur_neg_total',
        number: 301,
        date: '2026-10-06',
        total: -500,
        paidAmount: 0,
        items: [{ productId: 'p1', qty: 10, cost: 50 }],
        operationId: 'op_pur_neg',
        actorUid: purchaserUid,
        createdBy: purchaserUid,
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  it('T153: Purchases manager attempts to update existing purchase -> DENY (Purchases are immutable)', async () => {
    const purchaserUid = 'pur_atk_153';
    const purId = 'pur_hist_153';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purchaserUid}`).set({
        uid: purchaserUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`purchases/${purId}`).set({
        id: purId,
        number: 302,
        date: '2026-10-01',
        total: 1000,
        paidAmount: 1000,
        items: [{ productId: 'p1', qty: 20, cost: 50 }],
        operationId: 'op_pur_hist_153',
        actorUid: purchaserUid,
        createdBy: purchaserUid,
        createdAt: '2026-10-01T10:00:00Z'
      });
    });

    const purCtx = testEnv.authenticatedContext(purchaserUid);
    const db = purCtx.firestore();

    await assertFails(
      db.doc(`purchases/${purId}`).update({
        total: 800
      })
    );
  });

  // F. MAINTENANCE ROLE BALANCE REPAIR
  it('T154: Maintenance user repairs customer and supplier balance -> ALLOW', async () => {
    const maintUid = 'maint_user_154';
    const custId = 'cust_maint_154';
    const suppId = 'supp_maint_154';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${maintUid}`).set({
        uid: maintUid,
        role: 'staff',
        isActive: true,
        permissions: { maintenance: true } // Key verified in permissions.ts
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل صيانة',
        balance: { invoiced: 200, paid: 100, updatedAt: '2026-10-01T00:00:00Z' }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد صيانة',
        balance: { invoiced: 400, paid: 200, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const maintCtx = testEnv.authenticatedContext(maintUid);
    const db = maintCtx.firestore();

    // Repair customer balance
    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: 300, paid: 100, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );

    // Repair supplier balance
    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 500, paid: 200, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  // G. LEGITIMATE WORKFLOWS VERIFICATION (T155 Series)
  it('T155a: Legitimate POS checkout with new customer creation -> ALLOW', async () => {
    const cashierUid = 'cashier_wf_155a';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Actual payload from SaleInvoicePage.tsx L752
    await assertSucceeds(
      db.doc('customers/cust_checkout_real').set({
        id: 'cust_checkout_real',
        name: 'عميل نقدي جديد',
        phone: '01012345678',
        address: 'شارع الهرم',
        createdAt: '2026-10-06T10:00:00Z',
        balance: { invoiced: 150, paid: 150, updatedAt: '2026-10-06T10:00:00Z' },
        loyaltyPoints: 15,
        lastTransactionDate: '2026-10-06'
      })
    );
  });

  it('T155b: Legitimate POS credit sale to existing customer (merge update) -> ALLOW', async () => {
    const cashierUid = 'cashier_wf_155b';
    const custId = 'cust_wf_155b';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل آجل',
        phone: '01000000000',
        address: 'عنوان',
        balance: { invoiced: 200, paid: 200, updatedAt: '2026-10-01T00:00:00Z' },
        loyaltyPoints: 5,
        lastTransactionDate: '2026-10-01'
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Actual merge update payload from SaleInvoicePage.tsx L734
    await assertSucceeds(
      db.doc(`customers/${custId}`).set(
        {
          balance: { invoiced: 500, paid: 300, updatedAt: '2026-10-06T10:00:00Z' },
          loyaltyPoints: 20,
          lastTransactionDate: '2026-10-06',
          name: 'عميل آجل',
          phone: '01000000000',
          address: 'عنوان'
        },
        { merge: true }
      )
    );
  });

  it('T155c: Legitimate Sales Return updating customer balance -> ALLOW', async () => {
    const returnUid = 'return_wf_155c';
    const custId = 'cust_wf_155c';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${returnUid}`).set({
        uid: returnUid,
        role: 'cashier',
        isActive: true,
        permissions: { salesReturns: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل مرتجع',
        balance: { invoiced: 500, paid: 300, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const retCtx = testEnv.authenticatedContext(returnUid);
    const db = retCtx.firestore();

    // Actual payload from SalesReturnPage.tsx L287
    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: 400, paid: 300, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('T155d: Legitimate Customer Payment creating payment record and updating balance -> ALLOW', async () => {
    const trUid = 'tr_wf_155d';
    const custId = 'cust_wf_155d';
    const payId = 'pay_wf_155d';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${trUid}`).set({
        uid: trUid,
        role: 'treasurer',
        isActive: true,
        permissions: { treasuryManage: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل سداد',
        balance: { invoiced: 1000, paid: 400, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const trCtx = testEnv.authenticatedContext(trUid);
    const db = trCtx.firestore();

    // Actual payload from CustomersPage.tsx L178 & L186
    await assertSucceeds(
      db.doc(`customerPayments/${payId}`).set({
        id: payId,
        customerId: custId,
        amount: 200,
        operationId: 'op_pay_155d',
        originalEventDate: '2026-10-06',
        statementDate: '2026-10-06',
        postingDate: '2026-10-06',
        effectiveCashDate: '2026-10-06',
        actorUid: trUid,
        createdBy: trUid,
        createdAt: '2026-10-06T10:00:00Z'
      })
    );

    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: 1000, paid: 600, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('T155e: Legitimate Purchase creating purchase document and updating supplier balance -> ALLOW', async () => {
    const purUid = 'pur_wf_155e';
    const suppId = 'supp_wf_155e';
    const purId = 'pur_wf_155e';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purUid}`).set({
        uid: purUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد توريد',
        balance: { invoiced: 2000, paid: 1500, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const purCtx = testEnv.authenticatedContext(purUid);
    const db = purCtx.firestore();

    // Actual payload from PurchaseInvoicePage.tsx L260 & L305
    await assertSucceeds(
      db.doc(`purchases/${purId}`).set({
        id: purId,
        number: 401,
        date: '2026-10-06',
        supplierId: suppId,
        items: [{ productId: 'p1', name: 'دفتر', qty: 50, cost: 20 }],
        total: 1000,
        paidAmount: 500,
        dueAmount: 500,
        operationId: 'op_pur_155e',
        actorUid: purUid,
        createdBy: purUid,
        createdAt: '2026-10-06T10:00:00Z'
      })
    );

    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 3000, paid: 2000, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('T155f: Legitimate Purchase Return creating return and updating supplier balance -> ALLOW', async () => {
    const purUid = 'pur_wf_155f';
    const suppId = 'supp_wf_155f';
    const retId = 'pret_wf_155f';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purUid}`).set({
        uid: purUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد مرتجع',
        balance: { invoiced: 3000, paid: 2000, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const purCtx = testEnv.authenticatedContext(purUid);
    const db = purCtx.firestore();

    // Actual payload from PurchaseInvoicePage.tsx L826 & L839
    await assertSucceeds(
      db.doc(`purchaseReturns/${retId}`).set({
        id: retId,
        purchaseId: 'pur_wf_155e',
        totalRefund: 200,
        refundMethod: 'credit',
        items: [{ productId: 'p1', productName: 'دفتر', qty: 10, originalUnitCost: 20, totalCost: 200 }],
        originalEventDate: '2026-10-06',
        postingDate: '2026-10-06',
        statementDate: '2026-10-06',
        operationId: 'op_pret_155f',
        createdAt: '2026-10-06T10:00:00Z'
      })
    );

    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 2800, paid: 2000, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('T155g: Legitimate Supplier Payment creating payment record and updating supplier balance -> ALLOW', async () => {
    const trUid = 'tr_wf_155g';
    const suppId = 'supp_wf_155g';
    const payId = 'spay_wf_155g';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${trUid}`).set({
        uid: trUid,
        role: 'treasurer',
        isActive: true,
        permissions: { treasuryManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد سداد خزينة',
        balance: { invoiced: 2800, paid: 2000, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const trCtx = testEnv.authenticatedContext(trUid);
    const db = trCtx.firestore();

    // Actual payload from SuppliersPage.tsx L166 & L174
    await assertSucceeds(
      db.doc(`supplierPayments/${payId}`).set({
        id: payId,
        supplierId: suppId,
        amount: 500,
        operationId: 'op_spay_155g',
        originalEventDate: '2026-10-06',
        statementDate: '2026-10-06',
        postingDate: '2026-10-06',
        effectiveCashDate: '2026-10-06',
        actorUid: trUid,
        createdBy: trUid,
        createdAt: '2026-10-06T10:00:00Z'
      })
    );

    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 2800, paid: 2500, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  // =========================================================================
  // 11. PHASE 2.4.5 SESSION 4 ADVERSARIAL MATRIX (C1-C10 & S1-S8 & P5)
  // =========================================================================

  it('C1: Cashier raises balance.invoiced without Invoice -> ALLOW (KNOWN DEBT at rules layer)', async () => {
    const cashierUid = 'c1_cashier';
    const custId = 'c1_cust';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل C1',
        balance: { invoiced: 100, paid: 100, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Allowed because field-level permits balance update; relational verification of invoice is KNOWN DEBT
    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: 5000, paid: 100, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('C2: Cashier lowers balance.invoiced without Sales Return -> ALLOW (KNOWN DEBT at rules layer)', async () => {
    const cashierUid = 'c2_cashier';
    const custId = 'c2_cust';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل C2',
        balance: { invoiced: 500, paid: 100, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Allowed at rules layer; relational proof of return is KNOWN DEBT
    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: 200, paid: 100, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('C3: Cashier raises balance.paid without Customer Payment -> ALLOW (KNOWN DEBT at rules layer)', async () => {
    const cashierUid = 'c3_cashier';
    const custId = 'c3_cust';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل C3',
        balance: { invoiced: 500, paid: 100, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Allowed at rules layer; KNOWN DEBT
    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: 500, paid: 400, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('C4: Cashier lowers balance.paid without financial workflow -> ALLOW (KNOWN DEBT at rules layer)', async () => {
    const cashierUid = 'c4_cashier';
    const custId = 'c4_cust';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل C4',
        balance: { invoiced: 500, paid: 300, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Allowed at rules layer; KNOWN DEBT
    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: 500, paid: 100, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('C5: Cashier sets both balance.invoiced and balance.paid to arbitrary values -> ALLOW (KNOWN DEBT)', async () => {
    const cashierUid = 'c5_cashier';
    const custId = 'c5_cust';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل C5',
        balance: { invoiced: 200, paid: 100, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Allowed at rules layer; KNOWN DEBT
    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: 7777, paid: 3333, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('C6: Cashier sets balance.invoiced = -1 -> ALLOW (Negative invoiced permitted for returns, KNOWN DEBT)', async () => {
    const cashierUid = 'c6_cashier';
    const custId = 'c6_cust';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل C6',
        balance: { invoiced: 50, paid: 50, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Allowed because invoiced can legitimately become negative after net returns/reversals
    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: -1, paid: 50, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('C7: Cashier sets balance.paid = -1 -> DENY (Rules enforced with bal.paid >= 0)', async () => {
    const cashierUid = 'c7_cashier';
    const custId = 'c7_cust';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل C7',
        balance: { invoiced: 50, paid: 50, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Denied by isValidBalance: bal.paid >= 0
    await assertFails(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: 50, paid: -1, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('C8: Cashier sets huge balance (999999999) -> ALLOW (KNOWN DEBT at rules layer)', async () => {
    const cashierUid = 'c8_cashier';
    const custId = 'c8_cust';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل C8',
        balance: { invoiced: 100, paid: 100, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Allowed at rules layer; KNOWN DEBT
    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        balance: { invoiced: 999999999, paid: 999999999, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('C9: Cashier sets arbitrary loyaltyPoints (999999) -> ALLOW (KNOWN DEBT at rules layer)', async () => {
    const cashierUid = 'c9_cashier';
    const custId = 'c9_cust';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل C9',
        loyaltyPoints: 10
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Allowed at rules layer; KNOWN DEBT
    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        loyaltyPoints: 999999
      })
    );
  });

  it('C10: Cashier date validation -> Malformed date DENIED, Future date ALLOWED (KNOWN DEBT)', async () => {
    const cashierUid = 'c10_cashier';
    const custId = 'c10_cust';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${cashierUid}`).set({
        uid: cashierUid,
        role: 'cashier',
        isActive: true,
        permissions: { posSales: true }
      });
      await adminDb.doc(`customers/${custId}`).set({
        id: custId,
        name: 'عميل C10',
        lastTransactionDate: '2026-10-01'
      });
    });

    const cashierCtx = testEnv.authenticatedContext(cashierUid);
    const db = cashierCtx.firestore();

    // Malformed string format is DENIED by regex validation in rules
    await assertFails(
      db.doc(`customers/${custId}`).update({
        lastTransactionDate: 'invalid-date-format'
      })
    );

    // Valid format in the future is ALLOWED (rules cannot verify system clock without backend, KNOWN DEBT)
    await assertSucceeds(
      db.doc(`customers/${custId}`).update({
        lastTransactionDate: '2099-12-31'
      })
    );
  });

  // SUPPLIERS ADVERSARIAL MATRIX (S1 - S8)
  it('S1: Purchases manager arbitrary supplier balance.invoiced without Purchase -> ALLOW (KNOWN DEBT)', async () => {
    const purUid = 's1_pur';
    const suppId = 's1_supp';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purUid}`).set({
        uid: purUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد S1',
        balance: { invoiced: 500, paid: 500, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const purCtx = testEnv.authenticatedContext(purUid);
    const db = purCtx.firestore();

    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 10000, paid: 500, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('S2: Purchases manager arbitrary supplier balance.paid without Supplier Payment -> ALLOW (KNOWN DEBT)', async () => {
    const purUid = 's2_pur';
    const suppId = 's2_supp';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purUid}`).set({
        uid: purUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد S2',
        balance: { invoiced: 1000, paid: 500, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const purCtx = testEnv.authenticatedContext(purUid);
    const db = purCtx.firestore();

    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 1000, paid: 1000, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('S3: Purchases manager sets supplier balance.invoiced = -1 -> ALLOW (Negative invoiced permitted for returns, KNOWN DEBT)', async () => {
    const purUid = 's3_pur';
    const suppId = 's3_supp';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purUid}`).set({
        uid: purUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد S3',
        balance: { invoiced: 100, paid: 100, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const purCtx = testEnv.authenticatedContext(purUid);
    const db = purCtx.firestore();

    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: -1, paid: 100, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('S4: Purchases manager sets supplier balance.paid = -1 -> DENY (Rules enforced with bal.paid >= 0)', async () => {
    const purUid = 's4_pur';
    const suppId = 's4_supp';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purUid}`).set({
        uid: purUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد S4',
        balance: { invoiced: 100, paid: 100, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const purCtx = testEnv.authenticatedContext(purUid);
    const db = purCtx.firestore();

    await assertFails(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 100, paid: -1, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('S5: Purchases manager sets huge supplier balance (999999999) -> ALLOW (KNOWN DEBT)', async () => {
    const purUid = 's5_pur';
    const suppId = 's5_supp';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purUid}`).set({
        uid: purUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد S5',
        balance: { invoiced: 500, paid: 500, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const purCtx = testEnv.authenticatedContext(purUid);
    const db = purCtx.firestore();

    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 999999999, paid: 999999999, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('S6: Supplier invoiced modified without Purchase document -> ALLOW (KNOWN DEBT at rules layer)', async () => {
    const purUid = 's6_pur';
    const suppId = 's6_supp';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purUid}`).set({
        uid: purUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد S6',
        balance: { invoiced: 500, paid: 200, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const purCtx = testEnv.authenticatedContext(purUid);
    const db = purCtx.firestore();

    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 1200, paid: 200, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('S7: Supplier invoiced modified without Purchase Return document -> ALLOW (KNOWN DEBT at rules layer)', async () => {
    const purUid = 's7_pur';
    const suppId = 's7_supp';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purUid}`).set({
        uid: purUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد S7',
        balance: { invoiced: 1000, paid: 200, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const purCtx = testEnv.authenticatedContext(purUid);
    const db = purCtx.firestore();

    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 700, paid: 200, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  it('S8: Supplier paid modified without Supplier Payment document -> ALLOW (KNOWN DEBT at rules layer)', async () => {
    const purUid = 's8_pur';
    const suppId = 's8_supp';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purUid}`).set({
        uid: purUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
      await adminDb.doc(`suppliers/${suppId}`).set({
        id: suppId,
        name: 'مورد S8',
        balance: { invoiced: 1000, paid: 200, updatedAt: '2026-10-01T00:00:00Z' }
      });
    });

    const purCtx = testEnv.authenticatedContext(purUid);
    const db = purCtx.firestore();

    await assertSucceeds(
      db.doc(`suppliers/${suppId}`).update({
        balance: { invoiced: 1000, paid: 600, updatedAt: '2026-10-06T10:00:00Z' }
      })
    );
  });

  // P5: Purchases paidAmount > total validation (Phase 2.6: ALLOW supplier advances / overpayments)
  it('P5: Purchases manager creates purchase with paidAmount > total -> ALLOW (Supplier advance recorded in drawer)', async () => {
    const purUid = 'pur_p5';
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`userProfiles/${purUid}`).set({
        uid: purUid,
        role: 'purchaser',
        isActive: true,
        permissions: { purchasesManage: true }
      });
    });

    const purCtx = testEnv.authenticatedContext(purUid);
    const db = purCtx.firestore();

    // In purchasing, paidAmount > total represents supplier advances/prepayments handled by DayClosePage drawer out
    await assertSucceeds(
      db.doc('purchases/pur_p5_overpaid').set({
        id: 'pur_p5_overpaid',
        number: 501,
        date: '2026-10-06',
        items: [{ productId: 'p1', name: 'دفاتر', qty: 10, cost: 20 }],
        total: 200,
        paidAmount: 500, // Allowed: paidAmount > total (supplier prepayment/advance)
        operationId: 'op_pur_p5',
        actorUid: purUid,
        createdBy: purUid,
        createdAt: '2026-10-06T10:00:00Z'
      })
    );
  });

  // =========================================================================
  // 17. PHASE 2.6 STAGE A VERIFICATION SUITE (B01-B06, Large Tx, Payments, Roles, Backup)
  // =========================================================================

  describe('PHASE 2.6 - Security Gate Verification Tests (Emulator Live Execution)', () => {
    // -----------------------------------------------------------------------
    // SECTION 1: isValidBalance B01 to B06
    // -----------------------------------------------------------------------
    it('B01: Cashier setting customer balance invoiced=-500, paid=-500 -> DENY', async () => {
      const cashierUid = 'cashier_b01';
      const custId = 'cust_b01';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${cashierUid}`).set({
          uid: cashierUid,
          role: 'cashier',
          isActive: true,
          permissions: { posSales: true }
        });
        await adminDb.doc(`customers/${custId}`).set({
          id: custId,
          name: 'عميل B01',
          balance: { invoiced: 0, paid: 0 }
        });
      });

      const cashierDb = testEnv.authenticatedContext(cashierUid).firestore();
      await assertFails(
        cashierDb.doc(`customers/${custId}`).update({
          balance: { invoiced: -500, paid: -500, updatedAt: '2026-10-06T10:00:00Z' }
        })
      );
    });

    it('B02: SalesReturns non-admin setting customer balance invoiced=-500, paid=-500 -> DENY', async () => {
      const retUid = 'user_ret_b02';
      const custId = 'cust_b02';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${retUid}`).set({
          uid: retUid,
          role: 'cashier',
          isActive: true,
          permissions: { salesReturns: true }
        });
        await adminDb.doc(`customers/${custId}`).set({
          id: custId,
          name: 'عميل B02',
          balance: { invoiced: 0, paid: 0 }
        });
      });

      const retDb = testEnv.authenticatedContext(retUid).firestore();
      await assertFails(
        retDb.doc(`customers/${custId}`).update({
          balance: { invoiced: -500, paid: -500, updatedAt: '2026-10-06T10:00:00Z' }
        })
      );
    });

    it('B03: Treasury non-admin setting customer balance invoiced=-500, paid=-500 -> DENY', async () => {
      const treasUid = 'user_treas_b03';
      const custId = 'cust_b03';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${treasUid}`).set({
          uid: treasUid,
          role: 'accountant',
          isActive: true,
          permissions: { treasuryManage: true }
        });
        await adminDb.doc(`customers/${custId}`).set({
          id: custId,
          name: 'عميل B03',
          balance: { invoiced: 0, paid: 0 }
        });
      });

      const treasDb = testEnv.authenticatedContext(treasUid).firestore();
      await assertFails(
        treasDb.doc(`customers/${custId}`).update({
          balance: { invoiced: -500, paid: -500, updatedAt: '2026-10-06T10:00:00Z' }
        })
      );
    });

    it('B04: Admin setting customer balance invoiced=-500, paid=-500 (Debt Reset) -> ALLOW', async () => {
      const adminUid = 'admin_b04';
      const custId = 'cust_b04';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${adminUid}`).set({
          uid: adminUid,
          role: 'admin',
          isActive: true
        });
        await adminDb.doc(`customers/${custId}`).set({
          id: custId,
          name: 'عميل B04',
          balance: { invoiced: 0, paid: 0 }
        });
      });

      const adminDb = testEnv.authenticatedContext(adminUid).firestore();
      await assertSucceeds(
        adminDb.doc(`customers/${custId}`).update({
          balance: { invoiced: -500, paid: -500, updatedAt: '2026-10-06T10:00:00Z' }
        })
      );
    });

    it('B05: Admin setting customer balance invoiced=-500, paid=-300 (Mismatched negative) -> DENY', async () => {
      const adminUid = 'admin_b05';
      const custId = 'cust_b05';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${adminUid}`).set({
          uid: adminUid,
          role: 'admin',
          isActive: true
        });
        await adminDb.doc(`customers/${custId}`).set({
          id: custId,
          name: 'عميل B05',
          balance: { invoiced: 0, paid: 0 }
        });
      });

      const adminDb = testEnv.authenticatedContext(adminUid).firestore();
      await assertFails(
        adminDb.doc(`customers/${custId}`).update({
          balance: { invoiced: -500, paid: -300, updatedAt: '2026-10-06T10:00:00Z' }
        })
      );
    });

    it('B06: Normal positive balance invoiced=1000, paid=500 -> ALLOW', async () => {
      const cashierUid = 'cashier_b06';
      const custId = 'cust_b06';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${cashierUid}`).set({
          uid: cashierUid,
          role: 'cashier',
          isActive: true,
          permissions: { posSales: true }
        });
        await adminDb.doc(`customers/${custId}`).set({
          id: custId,
          name: 'عميل B06',
          balance: { invoiced: 0, paid: 0 }
        });
      });

      const cashierDb = testEnv.authenticatedContext(cashierUid).firestore();
      await assertSucceeds(
        cashierDb.doc(`customers/${custId}`).update({
          balance: { invoiced: 1000, paid: 500, updatedAt: '2026-10-06T10:00:00Z' }
        })
      );
    });

    // -----------------------------------------------------------------------
    // SECTION 2: Large Transactions (20, 30, 40 items)
    // -----------------------------------------------------------------------
    const testLargeSale = async (itemCount: number) => {
      const cashierUid = `cashier_lg_${itemCount}`;
      const invId = `inv_lg_${itemCount}`;
      const opKey = `op_lg_${itemCount}`;

      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${cashierUid}`).set({
          uid: cashierUid,
          role: 'cashier',
          isActive: true,
          permissions: { posSales: true }
        });
        await adminDb.doc('meta/counters').set({ invoice: 1000 });

        for (let i = 0; i < itemCount; i++) {
          await adminDb.doc(`products/prod_lg_${itemCount}_${i}`).set({
            id: `prod_lg_${itemCount}_${i}`,
            name: `Item ${i}`,
            qty: 500,
            sellPrice: 10
          });
        }
      });

      const cashierDb = testEnv.authenticatedContext(cashierUid).firestore();

      return cashierDb.runTransaction(async (tx) => {
        const counterRef = cashierDb.doc('meta/counters');
        const opRef = cashierDb.doc(`operationKeys/${opKey}`);
        const invRef = cashierDb.doc(`invoices/${invId}`);

        await tx.get(counterRef);
        await tx.get(opRef);
        await tx.get(invRef);

        const prodSnaps = [];
        for (let i = 0; i < itemCount; i++) {
          prodSnaps.push(await tx.get(cashierDb.doc(`products/prod_lg_${itemCount}_${i}`)));
        }

        // Writes:
        tx.set(invRef, {
          id: invId,
          number: 1001,
          date: '2026-10-06',
          total: itemCount * 10,
          paidAmount: itemCount * 10,
          dueAmount: 0,
          items: prodSnaps.map((_, idx) => ({ productId: `prod_lg_${itemCount}_${idx}`, qty: 1, price: 10 })),
          operationId: opKey,
          actorUid: cashierUid,
          createdBy: cashierUid,
          createdAt: '2026-10-06T10:00:00Z'
        });

        for (let i = 0; i < itemCount; i++) {
          const cur = prodSnaps[i].data()?.qty || 500;
          tx.update(cashierDb.doc(`products/prod_lg_${itemCount}_${i}`), {
            qty: cur - 1
          });
        }

        for (let i = 0; i < itemCount; i++) {
          const smId = `sm_lg_${itemCount}_${i}`;
          tx.set(cashierDb.doc(`stockMovements/${smId}`), {
            id: smId,
            productId: `prod_lg_${itemCount}_${i}`,
            delta: -1,
            type: 'sale',
            referenceId: invId,
            referenceNumber: 1001,
            actorUid: cashierUid,
            createdBy: cashierUid,
            date: '2026-10-06',
            createdAt: '2026-10-06T10:00:00Z'
          });
        }

        tx.set(counterRef, { invoice: 1001 }, { merge: true });
        tx.set(opRef, { id: opKey, actorUid: cashierUid, type: 'sale' });
      });
    };

    it('Large Tx: 20-item POS Sale atomic transaction (43 writes) -> ALLOW', async () => {
      await assertSucceeds(testLargeSale(20));
    });

    it('Large Tx: 30-item POS Sale atomic transaction (63 writes) -> ALLOW', async () => {
      await assertSucceeds(testLargeSale(30));
    });

    it('Large Tx: 40-item POS Sale atomic transaction (83 writes) -> ALLOW', async () => {
      await assertSucceeds(testLargeSale(40));
    });

    // -----------------------------------------------------------------------
    // SECTION 2.1: Large Purchase Transactions (PURCHASE-20, PURCHASE-30, PURCHASE-40)
    // -----------------------------------------------------------------------
    const testLargePurchase = async (itemCount: number) => {
      const purUid = `purchaser_lg_${itemCount}`;
      const purId = `pur_lg_${itemCount}`;
      const opKey = `op_pur_lg_${itemCount}`;

      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${purUid}`).set({
          uid: purUid,
          role: 'purchaser',
          isActive: true,
          permissions: { purchasesManage: true }
        });
        await adminDb.doc('meta/counters').set({ purchase: 2000 });

        for (let i = 0; i < itemCount; i++) {
          await adminDb.doc(`products/prod_pur_lg_${itemCount}_${i}`).set({
            id: `prod_pur_lg_${itemCount}_${i}`,
            name: `Purchase Item ${i}`,
            qty: 50,
            costPrice: 15,
            sellPrice: 20
          });
        }
      });

      const purDb = testEnv.authenticatedContext(purUid).firestore();

      return purDb.runTransaction(async (tx) => {
        const counterRef = purDb.doc('meta/counters');
        const opRef = purDb.doc(`operationKeys/${opKey}`);
        const purRef = purDb.doc(`purchases/${purId}`);

        await tx.get(counterRef);
        await tx.get(opRef);
        await tx.get(purRef);

        const prodSnaps = [];
        for (let i = 0; i < itemCount; i++) {
          prodSnaps.push(await tx.get(purDb.doc(`products/prod_pur_lg_${itemCount}_${i}`)));
        }

        // Writes:
        // 1. Purchase invoice
        tx.set(purRef, {
          id: purId,
          number: 2001,
          date: '2026-10-06',
          total: itemCount * 15,
          paidAmount: itemCount * 15,
          items: prodSnaps.map((_, idx) => ({ productId: `prod_pur_lg_${itemCount}_${idx}`, name: `Item ${idx}`, qty: 10, cost: 15 })),
          operationId: opKey,
          actorUid: purUid,
          createdBy: purUid,
          createdAt: '2026-10-06T10:00:00Z'
        });

        // 2. Product qty updates
        for (let i = 0; i < itemCount; i++) {
          const cur = prodSnaps[i].data()?.qty || 50;
          tx.update(purDb.doc(`products/prod_pur_lg_${itemCount}_${i}`), {
            qty: cur + 10,
            lastOperationId: opKey,
            lastOperationType: 'purchase',
            lastOperationActorUid: purUid
          });
        }

        // 3. StockMovements
        for (let i = 0; i < itemCount; i++) {
          const smId = `sm_pur_lg_${itemCount}_${i}`;
          tx.set(purDb.doc(`stockMovements/${smId}`), {
            id: smId,
            productId: `prod_pur_lg_${itemCount}_${i}`,
            delta: 10,
            type: 'purchase',
            referenceId: purId,
            referenceNumber: 2001,
            actorUid: purUid,
            createdBy: purUid,
            date: '2026-10-06',
            createdAt: '2026-10-06T10:00:00Z'
          });
        }

        // 4. Counter and OperationKey
        tx.set(counterRef, { purchase: 2001 }, { merge: true });
        tx.set(opRef, { id: opKey, actorUid: purUid, type: 'purchase' });
      });
    };

    it('Large Tx: PURCHASE-20 atomic transaction (43 writes) -> ALLOW', async () => {
      await assertSucceeds(testLargePurchase(20));
    });

    it('Large Tx: PURCHASE-30 atomic transaction (63 writes) -> ALLOW', async () => {
      await assertSucceeds(testLargePurchase(30));
    });

    it('Large Tx: PURCHASE-40 atomic transaction (83 writes) -> ALLOW', async () => {
      await assertSucceeds(testLargePurchase(40));
    });

    // -----------------------------------------------------------------------
    // SECTION 3: Payment Actor Identity & Anti-Spoofing (customerPayments & supplierPayments)
    // -----------------------------------------------------------------------
    it('customerPayments: Legitimate creation with genuine actorUid & createdBy -> ALLOW', async () => {
      const cashierUid = 'cashier_cpay_legit';
      const custId = 'cust_cpay_legit';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${cashierUid}`).set({
          uid: cashierUid,
          role: 'cashier',
          isActive: true,
          permissions: { posSales: true }
        });
        await adminDb.doc(`customers/${custId}`).set({
          id: custId,
          name: 'عميل مدفوعات',
          balance: { invoiced: 1000, paid: 0 }
        });
      });

      const db = testEnv.authenticatedContext(cashierUid).firestore();
      await assertSucceeds(
        db.doc('customerPayments/pay_legit_1').set({
          id: 'pay_legit_1',
          customerId: custId,
          amount: 200,
          operationId: 'op_cpay_legit',
          originalEventDate: '2026-10-06',
          statementDate: '2026-10-06',
          postingDate: '2026-10-06',
          effectiveCashDate: '2026-10-06',
          actorUid: cashierUid,
          createdBy: cashierUid,
          createdAt: '2026-10-06T10:00:00Z'
        })
      );
    });

    it('customerPayments: Spoofed actorUid -> DENY', async () => {
      const cashierUid = 'cashier_cpay_legit';
      const custId = 'cust_cpay_legit';
      const db = testEnv.authenticatedContext(cashierUid).firestore();
      await assertFails(
        db.doc('customerPayments/pay_spoof_actor').set({
          id: 'pay_spoof_actor',
          customerId: custId,
          amount: 200,
          operationId: 'op_cpay_spoof_actor',
          originalEventDate: '2026-10-06',
          statementDate: '2026-10-06',
          postingDate: '2026-10-06',
          effectiveCashDate: '2026-10-06',
          actorUid: 'victim_admin_uid', // Spoofed!
          createdBy: cashierUid,
          createdAt: '2026-10-06T10:00:00Z'
        })
      );
    });

    it('customerPayments: Missing actorUid -> DENY', async () => {
      const cashierUid = 'cashier_cpay_legit';
      const custId = 'cust_cpay_legit';
      const db = testEnv.authenticatedContext(cashierUid).firestore();
      await assertFails(
        db.doc('customerPayments/pay_missing_actor').set({
          id: 'pay_missing_actor',
          customerId: custId,
          amount: 200,
          operationId: 'op_cpay_missing_actor',
          originalEventDate: '2026-10-06',
          statementDate: '2026-10-06',
          postingDate: '2026-10-06',
          effectiveCashDate: '2026-10-06',
          // actorUid is missing!
          createdBy: cashierUid,
          createdAt: '2026-10-06T10:00:00Z'
        })
      );
    });

    it('customerPayments: Spoofed createdBy -> DENY', async () => {
      const cashierUid = 'cashier_cpay_legit';
      const custId = 'cust_cpay_legit';
      const db = testEnv.authenticatedContext(cashierUid).firestore();
      await assertFails(
        db.doc('customerPayments/pay_spoof_creator').set({
          id: 'pay_spoof_creator',
          customerId: custId,
          amount: 200,
          operationId: 'op_cpay_spoof_creator',
          originalEventDate: '2026-10-06',
          statementDate: '2026-10-06',
          postingDate: '2026-10-06',
          effectiveCashDate: '2026-10-06',
          actorUid: cashierUid,
          createdBy: 'admin_compromised_uid', // Spoofed!
          createdAt: '2026-10-06T10:00:00Z'
        })
      );
    });

    it('customerPayments: Duplicate payment ID overwrite -> DENY (Immutability)', async () => {
      const cashierUid = 'cashier_cpay_legit';
      const custId = 'cust_cpay_legit';
      const db = testEnv.authenticatedContext(cashierUid).firestore();
      // Attempting to overwrite existing 'pay_legit_1'
      await assertFails(
        db.doc('customerPayments/pay_legit_1').set({
          id: 'pay_legit_1',
          customerId: custId,
          amount: 500,
          operationId: 'op_cpay_dup',
          originalEventDate: '2026-10-06',
          statementDate: '2026-10-06',
          postingDate: '2026-10-06',
          effectiveCashDate: '2026-10-06',
          actorUid: cashierUid,
          createdBy: cashierUid,
          createdAt: '2026-10-06T10:00:00Z'
        })
      );
    });

    it('supplierPayments: Legitimate creation with genuine actorUid & createdBy -> ALLOW', async () => {
      const purUid = 'pur_spay_legit';
      const suppId = 'supp_spay_legit';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${purUid}`).set({
          uid: purUid,
          role: 'purchaser',
          isActive: true,
          permissions: { purchasesManage: true }
        });
        await adminDb.doc(`suppliers/${suppId}`).set({
          id: suppId,
          name: 'مورد مدفوعات',
          balance: { invoiced: 2000, paid: 0 }
        });
      });

      const db = testEnv.authenticatedContext(purUid).firestore();
      await assertSucceeds(
        db.doc('supplierPayments/spay_legit_1').set({
          id: 'spay_legit_1',
          supplierId: suppId,
          amount: 350,
          operationId: 'op_spay_legit',
          originalEventDate: '2026-10-06',
          statementDate: '2026-10-06',
          postingDate: '2026-10-06',
          effectiveCashDate: '2026-10-06',
          actorUid: purUid,
          createdBy: purUid,
          createdAt: '2026-10-06T10:00:00Z'
        })
      );
    });

    it('supplierPayments: Spoofed actorUid -> DENY', async () => {
      const purUid = 'pur_spay_legit';
      const suppId = 'supp_spay_legit';
      const db = testEnv.authenticatedContext(purUid).firestore();
      await assertFails(
        db.doc('supplierPayments/spay_spoof_actor').set({
          id: 'spay_spoof_actor',
          supplierId: suppId,
          amount: 350,
          operationId: 'op_spay_spoof_actor',
          originalEventDate: '2026-10-06',
          statementDate: '2026-10-06',
          postingDate: '2026-10-06',
          effectiveCashDate: '2026-10-06',
          actorUid: 'victim_admin_uid', // Spoofed!
          createdBy: purUid,
          createdAt: '2026-10-06T10:00:00Z'
        })
      );
    });

    it('supplierPayments: Missing actorUid -> DENY', async () => {
      const purUid = 'pur_spay_legit';
      const suppId = 'supp_spay_legit';
      const db = testEnv.authenticatedContext(purUid).firestore();
      await assertFails(
        db.doc('supplierPayments/spay_missing_actor').set({
          id: 'spay_missing_actor',
          supplierId: suppId,
          amount: 350,
          operationId: 'op_spay_missing_actor',
          originalEventDate: '2026-10-06',
          statementDate: '2026-10-06',
          postingDate: '2026-10-06',
          effectiveCashDate: '2026-10-06',
          // actorUid is missing!
          createdBy: purUid,
          createdAt: '2026-10-06T10:00:00Z'
        })
      );
    });

    it('supplierPayments: Spoofed createdBy -> DENY', async () => {
      const purUid = 'pur_spay_legit';
      const suppId = 'supp_spay_legit';
      const db = testEnv.authenticatedContext(purUid).firestore();
      await assertFails(
        db.doc('supplierPayments/spay_spoof_creator').set({
          id: 'spay_spoof_creator',
          supplierId: suppId,
          amount: 350,
          operationId: 'op_spay_spoof_creator',
          originalEventDate: '2026-10-06',
          statementDate: '2026-10-06',
          postingDate: '2026-10-06',
          effectiveCashDate: '2026-10-06',
          actorUid: purUid,
          createdBy: 'admin_compromised_uid', // Spoofed!
          createdAt: '2026-10-06T10:00:00Z'
        })
      );
    });

    it('supplierPayments: Duplicate payment ID overwrite -> DENY (Immutability)', async () => {
      const purUid = 'pur_spay_legit';
      const suppId = 'supp_spay_legit';
      const db = testEnv.authenticatedContext(purUid).firestore();
      // Attempting to overwrite existing 'spay_legit_1'
      await assertFails(
        db.doc('supplierPayments/spay_legit_1').set({
          id: 'spay_legit_1',
          supplierId: suppId,
          amount: 800,
          operationId: 'op_spay_dup',
          originalEventDate: '2026-10-06',
          statementDate: '2026-10-06',
          postingDate: '2026-10-06',
          effectiveCashDate: '2026-10-06',
          actorUid: purUid,
          createdBy: purUid,
          createdAt: '2026-10-06T10:00:00Z'
        })
      );
    });

    it('Payments: Spoofed actorUid on invoice creation -> DENY', async () => {
      const cashierUid = 'cashier_inv_spoof';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${cashierUid}`).set({
          uid: cashierUid,
          role: 'cashier',
          isActive: true,
          permissions: { posSales: true }
        });
      });

      const db = testEnv.authenticatedContext(cashierUid).firestore();
      await assertFails(
        db.doc('invoices/inv_spoofed_actor').set({
          id: 'inv_spoofed_actor',
          number: 999,
          date: '2026-10-06',
          total: 100,
          paidAmount: 100,
          items: [{ productId: 'p1', qty: 1, price: 100 }],
          operationId: 'op_spoof',
          actorUid: 'victim_admin_uid', // Spoofed!
          createdBy: cashierUid,
          createdAt: '2026-10-06T10:00:00Z'
        })
      );
    });

    it('Payments: Spoofed createdBy on purchases creation -> DENY', async () => {
      const purUid = 'pur_spoof_creator';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${purUid}`).set({
          uid: purUid,
          role: 'purchaser',
          isActive: true,
          permissions: { purchasesManage: true }
        });
      });

      const db = testEnv.authenticatedContext(purUid).firestore();
      await assertFails(
        db.doc('purchases/pur_spoofed_creator').set({
          id: 'pur_spoofed_creator',
          number: 777,
          date: '2026-10-06',
          items: [{ productId: 'p1', name: 'دفاتر', qty: 10, cost: 20 }],
          total: 200,
          paidAmount: 200,
          operationId: 'op_pur_spoof',
          actorUid: purUid,
          createdBy: 'admin_compromised_uid', // Spoofed!
          createdAt: '2026-10-06T10:00:00Z'
        })
      );
    });

    // -----------------------------------------------------------------------
    // SECTION 4: userProfiles Read & Administration Policy
    // -----------------------------------------------------------------------
    it('userProfiles: User reads their own profile -> ALLOW', async () => {
      const userUid = 'user_own_profile';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${userUid}`).set({
          uid: userUid,
          name: 'الموظف الخاص',
          role: 'cashier',
          isActive: true
        });
      });

      const db = testEnv.authenticatedContext(userUid).firestore();
      await assertSucceeds(db.doc(`userProfiles/${userUid}`).get());
    });

    it('userProfiles: Admin reads any employee profile -> ALLOW', async () => {
      const adminUid = 'admin_reader';
      const empUid = 'emp_target';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${adminUid}`).set({
          uid: adminUid,
          role: 'admin',
          isActive: true
        });
        await adminDb.doc(`userProfiles/${empUid}`).set({
          uid: empUid,
          name: 'موظف 1',
          role: 'cashier',
          isActive: true
        });
      });

      const db = testEnv.authenticatedContext(adminUid).firestore();
      await assertSucceeds(db.doc(`userProfiles/${empUid}`).get());
    });

    it('userProfiles: Active staff reads other employee profile for roster/operator switching -> ALLOW', async () => {
      const staffUid = 'staff_roster_reader';
      const otherStaffUid = 'other_staff_target';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${staffUid}`).set({
          uid: staffUid,
          role: 'cashier',
          isActive: true
        });
        await adminDb.doc(`userProfiles/${otherStaffUid}`).set({
          uid: otherStaffUid,
          role: 'manager',
          isActive: true
        });
      });

      const db = testEnv.authenticatedContext(staffUid).firestore();
      await assertSucceeds(db.doc(`userProfiles/${otherStaffUid}`).get());
    });

    it('userProfiles: Auth user with NO profile doc attempts to read another user profile -> DENY', async () => {
      const strangerUid = 'stranger_no_profile';
      const targetUid = 'target_profile_doc';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${targetUid}`).set({
          uid: targetUid,
          role: 'cashier',
          isActive: true
        });
      });

      const db = testEnv.authenticatedContext(strangerUid).firestore();
      await assertFails(db.doc(`userProfiles/${targetUid}`).get());
    });

    it('userProfiles: Disabled staff cannot perform operations requiring isStaff() -> DENY', async () => {
      const disabledUid = 'disabled_staff_user';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${disabledUid}`).set({
          uid: disabledUid,
          role: 'cashier',
          isActive: false // Disabled!
        });
      });

      const db = testEnv.authenticatedContext(disabledUid).firestore();
      // Trying to read products (requires isStaff())
      await assertFails(db.doc('products/prod_any').get());
    });

    // -----------------------------------------------------------------------
    // SECTION 5: Addendum Item C Admin Policy
    // -----------------------------------------------------------------------
    it('Admin Policy: Admin creates cashier profile -> ALLOW', async () => {
      const adminUid = 'admin_creator_c';
      const newCashierUid = 'new_cashier_uid_100';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${adminUid}`).set({
          uid: adminUid,
          role: 'admin',
          isActive: true
        });
      });

      const adminDb = testEnv.authenticatedContext(adminUid).firestore();
      await assertSucceeds(
        adminDb.doc(`userProfiles/${newCashierUid}`).set({
          id: newCashierUid,
          uid: newCashierUid,
          name: 'كاشير جديد',
          role: 'cashier',
          isActive: true
        })
      );
    });

    it('Admin Policy: Admin attempts to create profile with role=admin -> DENY', async () => {
      const adminUid = 'admin_creator_deny';
      const newAdminUid = 'unauthorized_new_admin_uid';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${adminUid}`).set({
          uid: adminUid,
          role: 'admin',
          isActive: true
        });
      });

      const adminDb = testEnv.authenticatedContext(adminUid).firestore();
      await assertFails(
        adminDb.doc(`userProfiles/${newAdminUid}`).set({
          id: newAdminUid,
          uid: newAdminUid,
          name: 'محاولة إنشاء مدير',
          role: 'admin',
          isActive: true
        })
      );
    });

    it('Admin Policy: Admin attempts to promote existing cashier to role=admin -> DENY', async () => {
      const adminUid = 'admin_promoter';
      const existingCashierUid = 'existing_cashier_to_promote';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${adminUid}`).set({
          uid: adminUid,
          role: 'admin',
          isActive: true
        });
        await adminDb.doc(`userProfiles/${existingCashierUid}`).set({
          id: existingCashierUid,
          uid: existingCashierUid,
          name: 'كاشير حالي',
          role: 'cashier',
          isActive: true
        });
      });

      const adminDb = testEnv.authenticatedContext(adminUid).firestore();
      await assertFails(
        adminDb.doc(`userProfiles/${existingCashierUid}`).update({
          role: 'admin'
        })
      );
    });

    // -----------------------------------------------------------------------
    // SECTION 6: Backup & Restore Verification (Addendum Item F)
    // -----------------------------------------------------------------------
    it('Backup & Restore: Admin restoring historical invoice with other user actorUid/createdBy is REJECTED by strict identity rules', async () => {
      const adminUid = 'admin_restorer';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${adminUid}`).set({
          uid: adminUid,
          role: 'admin',
          isActive: true
        });
      });

      const adminDb = testEnv.authenticatedContext(adminUid).firestore();
      // Historical backup invoice has original cashier UID (e.g. 'historical_cashier_007')
      // Rule line 118 requires request.resource.data.actorUid == request.auth.uid
      await assertFails(
        adminDb.doc('invoices/inv_backup_restored').set({
          id: 'inv_backup_restored',
          number: 101,
          date: '2026-09-01',
          total: 50,
          paidAmount: 50,
          items: [{ productId: 'p1', qty: 1, price: 50 }],
          operationId: 'op_hist_101',
          actorUid: 'historical_cashier_007',
          createdBy: 'historical_cashier_007',
          createdAt: '2026-09-01T10:00:00Z'
        })
      );
    });

    it('Backup & Restore: Admin restoring products and customers without actor constraints succeeds', async () => {
      const adminUid = 'admin_restorer_cat';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${adminUid}`).set({
          uid: adminUid,
          role: 'admin',
          isActive: true
        });
      });

      const adminDb = testEnv.authenticatedContext(adminUid).firestore();
      await assertSucceeds(
        adminDb.doc('products/prod_restored_1').set({
          id: 'prod_restored_1',
          name: 'كتاب تاريخ مسترجع',
          qty: 25,
          sellPrice: 40,
          buyPrice: 30
        })
      );
      await assertSucceeds(
        adminDb.doc('customers/cust_restored_1').set({
          id: 'cust_restored_1',
          name: 'عميل مسترجع',
          phone: '01012345678',
          balance: { invoiced: 500, paid: 500 }
        })
      );
    });

    it('Backup & Restore: 500-batch limit compliance in batchUpsert chunking (400 items chunks)', async () => {
      const adminUid = 'admin_batch_tester';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${adminUid}`).set({
          uid: adminUid,
          role: 'admin',
          isActive: true
        });
      });

      const adminDb = testEnv.authenticatedContext(adminUid).firestore();

      // Verify batchUpsert chunking design: batching up to 400 operations commits cleanly
      const batch400 = adminDb.batch();
      for (let i = 0; i < 400; i++) {
        batch400.set(adminDb.doc(`products/prod_batch_${i}`), {
          id: `prod_batch_${i}`,
          name: `Batch Item ${i}`,
          qty: 10,
          sellPrice: 5
        });
      }
      await assertSucceeds(batch400.commit());
    }, 15000);

    // -----------------------------------------------------------------------
    // SECTION 7: Daily Closing Access & Option A Closed-Day Late Posting
    // -----------------------------------------------------------------------
    it('DailyClosings Option A: Cashier isStaff can READ dailyClosings and dayCloses', async () => {
      const cashierUid = 'cashier_read_close';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${cashierUid}`).set({
          uid: cashierUid,
          role: 'cashier',
          isActive: true,
          permissions: { posSales: true } // NO dayClose, NO reportsView
        });
        await adminDb.doc('dailyClosings/2026-10-05').set({
          date: '2026-10-05',
          totalSales: 1500,
          closedAt: '2026-10-05T22:00:00Z',
          closedBy: 'manager_1'
        });
        await adminDb.doc('dayCloses/close_2026-10-05').set({
          date: '2026-10-05',
          closedAt: '2026-10-05T22:00:00Z'
        });
      });

      const cashierDb = testEnv.authenticatedContext(cashierUid).firestore();
      await assertSucceeds(cashierDb.doc('dailyClosings/2026-10-05').get());
      await assertSucceeds(cashierDb.doc('dayCloses/close_2026-10-05').get());
    });

    it('DailyClosings Option A: Cashier without dayClose permission CANNOT write dailyClosings', async () => {
      const cashierUid = 'cashier_write_close_deny';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${cashierUid}`).set({
          uid: cashierUid,
          role: 'cashier',
          isActive: true,
          permissions: { posSales: true }
        });
      });

      const cashierDb = testEnv.authenticatedContext(cashierUid).firestore();
      await assertFails(
        cashierDb.doc('dailyClosings/2026-10-06').set({
          date: '2026-10-06',
          totalSales: 500,
          closedAt: '2026-10-06T22:00:00Z'
        })
      );
      await assertFails(
        cashierDb.doc('dayCloses/close_2026-10-06').set({
          date: '2026-10-06',
          closedAt: '2026-10-06T22:00:00Z'
        })
      );
    });

    it('Rules Data Acceptance: Firestore accepts manually crafted invoice & payment on closed day with postingDate set to first open business day (Rules Acceptance Test, not client app runtime test)', async () => {
      const cashierUid = 'cashier_closed_poster';
      const custId = 'cust_closed_01';
      const prodId = 'prod_closed_01';
      const closedDate = '2026-10-05'; // Monday closed
      const nextOpenDay = '2026-10-06'; // Tuesday open

      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${cashierUid}`).set({
          uid: cashierUid,
          role: 'cashier',
          isActive: true,
          permissions: { posSales: true, customersManage: true }
        });
        await adminDb.doc(`dailyClosings/${closedDate}`).set({
          date: closedDate,
          closedAt: '2026-10-05T20:00:00Z',
          closedBy: 'admin'
        });
        await adminDb.doc(`products/${prodId}`).set({
          id: prodId,
          name: 'قلم حبر',
          qty: 50,
          sellPrice: 20
        });
        await adminDb.doc(`customers/${custId}`).set({
          id: custId,
          name: 'عميل مقفل',
          balance: { invoiced: 0, paid: 0 }
        });
        await adminDb.doc('meta/counters').set({ invoice: 1, payment: 1 });
      });

      const cashierDb = testEnv.authenticatedContext(cashierUid).firestore();

      // Cashier reads dailyClosings to inspect closed dates
      const closeSnap = await cashierDb.doc(`dailyClosings/${closedDate}`).get();
      expect(closeSnap.exists).toBe(true);

      // Cashier creates POS sale on closed day with postingDate = nextOpenDay
      const invId = 'inv_closed_day_test';
      const opKeyInv = 'op_key_inv_closed';
      const movId = 'mov_closed_day_test';

      const saleTx = cashierDb.runTransaction(async (tx) => {
        tx.set(cashierDb.doc(`operationKeys/${opKeyInv}`), {
          id: opKeyInv,
          usedAt: '2026-10-05T12:00:00Z',
          actorUid: cashierUid
        });
        tx.set(cashierDb.doc(`invoices/${invId}`), {
          id: invId,
          number: 2,
          date: closedDate,
          originalEventDate: closedDate,
          statementDate: closedDate,
          postingDate: nextOpenDay, // Shifted to next open business day
          total: 20,
          paidAmount: 20,
          items: [{ productId: prodId, qty: 1, price: 20, name: 'قلم حبر' }],
          operationId: opKeyInv,
          actorUid: cashierUid,
          createdBy: cashierUid,
          createdAt: '2026-10-05T12:00:00Z'
        });
        tx.set(cashierDb.doc(`stockMovements/${movId}`), {
          id: movId,
          productId: prodId,
          delta: -1,
          type: 'sale',
          referenceId: invId,
          date: closedDate,
          createdAt: '2026-10-05T12:00:00Z',
          actorUid: cashierUid,
          createdBy: cashierUid
        });
        tx.update(cashierDb.doc(`products/${prodId}`), {
          qty: 49,
          lastOperationId: opKeyInv,
          lastOperationType: 'sale',
          lastOperationActorUid: cashierUid
        });
        tx.set(cashierDb.doc('meta/counters'), {
          invoice: 2,
          updatedAt: '2026-10-05T12:00:00Z'
        }, { merge: true });
      });

      await assertSucceeds(saleTx);

      // Cashier creates Customer Payment on closed day with postingDate = nextOpenDay
      const payId = 'pay_closed_day_test';
      const opKeyPay = 'op_key_pay_closed';

      const payTx = cashierDb.runTransaction(async (tx) => {
        tx.set(cashierDb.doc(`operationKeys/${opKeyPay}`), {
          id: opKeyPay,
          usedAt: '2026-10-05T12:05:00Z',
          actorUid: cashierUid
        });
        tx.set(cashierDb.doc(`customerPayments/${payId}`), {
          id: payId,
          customerId: custId,
          amount: 50,
          originalEventDate: closedDate,
          statementDate: closedDate,
          postingDate: nextOpenDay, // Shifted to next open business day
          effectiveCashDate: nextOpenDay,
          operationId: opKeyPay,
          actorUid: cashierUid,
          createdBy: cashierUid,
          createdAt: '2026-10-05T12:05:00Z'
        });
        tx.update(cashierDb.doc(`customers/${custId}`), {
          balance: { invoiced: 0, paid: 50 },
          lastTransactionDate: closedDate
        });
        tx.set(cashierDb.doc('meta/counters'), {
          payment: 2,
          updatedAt: '2026-10-05T12:05:00Z'
        }, { merge: true });
      });

      await assertSucceeds(payTx);
    });

    // -----------------------------------------------------------------------
    // SECTION 8: Full Backup Export & Restore per Collection Evaluation
    // -----------------------------------------------------------------------
    it('Backup & Restore: per-collection export and restore evaluation on Emulator with admin account', async () => {
      const adminUid = 'admin_full_backup_eval';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${adminUid}`).set({
          uid: adminUid,
          role: 'admin',
          isActive: true
        });
        await adminDb.doc('appSettings/shop').set({
          name: 'المتجر النموذجي',
          vatEnabled: false
        });
      });

      const adminDb = testEnv.authenticatedContext(adminUid).firestore();

      // Collections where admin can restore own data without immutable actorUid conflict:
      // 1. products
      await assertSucceeds(adminDb.doc('products/prod_eval_1').set({ id: 'prod_eval_1', name: 'دفتر', qty: 10, sellPrice: 15 }));
      // 2. customers
      await assertSucceeds(adminDb.doc('customers/cust_eval_1').set({ id: 'cust_eval_1', name: 'عميل 1', balance: { invoiced: 100, paid: 50 } }));
      // 3. suppliers
      await assertSucceeds(adminDb.doc('suppliers/supp_eval_1').set({ id: 'supp_eval_1', name: 'مورد 1', balance: { invoiced: 200, paid: 100 } }));
      // 4. expenses
      await assertSucceeds(adminDb.doc('expenses/exp_eval_1').set({ id: 'exp_eval_1', amount: 30, title: 'ضيافة', date: '2026-10-06' }));
      // 5. printingTariffs
      await assertSucceeds(adminDb.doc('printingTariffs/pt_eval_1').set({ id: 'pt_eval_1', name: 'A4 ألوان', price: 2 }));
      // 6. dailyClosings
      await assertSucceeds(adminDb.doc('dailyClosings/2026-10-01').set({ date: '2026-10-01', totalSales: 400 }));
      // 7. dayCloses
      await assertSucceeds(adminDb.doc('dayCloses/close_eval_1').set({ date: '2026-10-01' }));
      // 8. treasuryAdjustments
      await assertSucceeds(adminDb.doc('treasuryAdjustments/ta_eval_1').set({ id: 'ta_eval_1', amount: 500, type: 'deposit' }));
      // 9. cashMovements
      await assertSucceeds(adminDb.doc('cashMovements/cm_eval_1').set({ id: 'cm_eval_1', amount: 100 }));
      // 10. appSettings/shop
      await assertSucceeds(adminDb.doc('appSettings/shop').set({ name: 'المتجر المحدث' }, { merge: true }));

      // Collections where foreign actorUid or immutable non-delete rules enforce rejection on foreign restore:
      // Invoices with foreign actorUid -> REJECTED
      await assertFails(adminDb.doc('invoices/inv_foreign_1').set({
        id: 'inv_foreign_1',
        total: 100,
        paidAmount: 100,
        date: '2026-09-01',
        items: [{ productId: 'prod_eval_1', qty: 1, price: 100 }],
        operationId: 'op_foreign_inv',
        actorUid: 'foreign_cashier_uid',
        createdBy: 'foreign_cashier_uid',
        createdAt: '2026-09-01T10:00:00Z'
      }));

      // Customer payments with foreign actorUid -> REJECTED
      await assertFails(adminDb.doc('customerPayments/pay_foreign_1').set({
        id: 'pay_foreign_1',
        customerId: 'cust_eval_1',
        amount: 50,
        actorUid: 'foreign_cashier_uid',
        createdBy: 'foreign_cashier_uid',
        originalEventDate: '2026-09-01',
        statementDate: '2026-09-01',
        postingDate: '2026-09-01',
        effectiveCashDate: '2026-09-01',
        operationId: 'op_foreign_pay',
        createdAt: '2026-09-01T10:00:00Z'
      }));

      // Supplier payments with foreign actorUid -> REJECTED
      await assertFails(adminDb.doc('supplierPayments/sp_foreign_1').set({
        id: 'sp_foreign_1',
        supplierId: 'supp_eval_1',
        amount: 80,
        actorUid: 'foreign_purchaser_uid',
        createdBy: 'foreign_purchaser_uid',
        originalEventDate: '2026-09-01',
        statementDate: '2026-09-01',
        postingDate: '2026-09-01',
        effectiveCashDate: '2026-09-01',
        operationId: 'op_foreign_sp',
        createdAt: '2026-09-01T10:00:00Z'
      }));

      // StockMovements with foreign actorUid -> REJECTED
      await assertFails(adminDb.doc('stockMovements/sm_foreign_1').set({
        id: 'sm_foreign_1',
        productId: 'prod_eval_1',
        delta: -1,
        type: 'sale',
        actorUid: 'foreign_cashier_uid',
        createdBy: 'foreign_cashier_uid',
        date: '2026-09-01',
        createdAt: '2026-09-01T10:00:00Z'
      }));
    });

    it('PurgeAllData: skips immutable collections (stockMovements, customerPayments, supplierPayments, purchaseReturns) and deletes products', async () => {
      const adminUid = 'admin_purge_test';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.firestore();
        await adminDb.doc(`userProfiles/${adminUid}`).set({
          uid: adminUid,
          role: 'admin',
          isActive: true
        });
        await adminDb.doc('products/prod_purge_1').set({
          id: 'prod_purge_1',
          name: 'منتج للحذف'
        });
        await adminDb.doc('customerPayments/pay_immutable_1').set({
          id: 'pay_immutable_1',
          amount: 50
        });
      });

      const adminDb = testEnv.authenticatedContext(adminUid).firestore();

      // Deleting product by admin -> ALLOW
      await assertSucceeds(adminDb.doc('products/prod_purge_1').delete());

      // Attempting to delete immutable customerPayment by admin -> DENY
      await assertFails(adminDb.doc('customerPayments/pay_immutable_1').delete());
    });
  });
});
