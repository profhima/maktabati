import {
  BusinessCalendarConfig,
  BusinessCalendarVersionRecord,
  DayStatus
} from '../types';
export type { BusinessCalendarVersionRecord };
import { fsdb } from './firebase';
import { recordSecureAudit } from './auditEngine';
import {
  isValidDateStr,
  addDaysToDateStr,
  getDayOfWeekFromDateStr,
  getCairoDateStr
} from './dateUtils';

export const BUSINESS_CALENDAR_DOC_PATH = 'appSettings/businessCalendar';
export const BUSINESS_CALENDAR_VERSIONS_COLL = 'appSettings/businessCalendar/versions';
export const BUSINESS_CALENDAR_STORAGE_KEY = 'maktabati_business_calendar_v1';
export const MAX_LOOKAHEAD_DAYS = 60; // Technical safety limit to prevent infinite loops

export interface CalendarMutationInput {
  weeklyHolidays?: number[];
  officialHolidays?: string[];
  nonWorkingDates?: string[];
  effectiveFrom: string; // YYYY-MM-DD
  changeReason?: string;
}

export interface UserActorContext {
  uid: string;
  name: string;
  role: string;
}

/**
 * Validates the calendar data contract deterministically.
 * 
 * Rules:
 * - weeklyHolidays: integers 0..6, no duplicates
 * - officialHolidays: valid YYYY-MM-DD, no duplicates
 * - nonWorkingDates: valid YYYY-MM-DD, no duplicates
 * - effectiveFrom: valid YYYY-MM-DD
 * - Overlap rejection: A date cannot exist in both officialHolidays and nonWorkingDates
 */
export function validateCalendarData(data: {
  weeklyHolidays: number[];
  officialHolidays: string[];
  nonWorkingDates: string[];
  effectiveFrom: string;
}): void {
  // 1. effectiveFrom
  if (!isValidDateStr(data.effectiveFrom)) {
    throw new Error(`INVALID_EFFECTIVE_FROM: ${data.effectiveFrom} must be a valid YYYY-MM-DD date.`);
  }

  // 2. weeklyHolidays
  const seenDays = new Set<number>();
  for (const d of data.weeklyHolidays) {
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      throw new Error(`INVALID_WEEKLY_HOLIDAY: ${d} must be an integer between 0 and 6.`);
    }
    if (seenDays.has(d)) {
      throw new Error(`DUPLICATE_WEEKLY_HOLIDAY: Day ${d} is duplicated.`);
    }
    seenDays.add(d);
  }

  // 3. officialHolidays
  const seenHolidays = new Set<string>();
  for (const h of data.officialHolidays) {
    if (!isValidDateStr(h)) {
      throw new Error(`INVALID_OFFICIAL_HOLIDAY: ${h} is not a valid YYYY-MM-DD date.`);
    }
    if (seenHolidays.has(h)) {
      throw new Error(`DUPLICATE_OFFICIAL_HOLIDAY: Date ${h} is duplicated in officialHolidays.`);
    }
    seenHolidays.add(h);
  }

  // 4. nonWorkingDates
  const seenNonWorking = new Set<string>();
  for (const nw of data.nonWorkingDates) {
    if (!isValidDateStr(nw)) {
      throw new Error(`INVALID_NON_WORKING_DATE: ${nw} is not a valid YYYY-MM-DD date.`);
    }
    if (seenNonWorking.has(nw)) {
      throw new Error(`DUPLICATE_NON_WORKING_DATE: Date ${nw} is duplicated in nonWorkingDates.`);
    }
    seenNonWorking.add(nw);
  }

  // 5. Overlap rejection between officialHolidays and nonWorkingDates
  for (const date of data.officialHolidays) {
    if (seenNonWorking.has(date)) {
      throw new Error(`CONFLICTING_CALENDAR_DATE: Date ${date} exists in both officialHolidays and nonWorkingDates.`);
    }
  }
}

/**
 * Validates permission according to the locked permission matrix.
 * 
 * Matrix:
 * - Admin: Allowed all calendar mutations.
 * - Manager: Allowed ONLY adding/removing nonWorkingDates with an explicit reason.
 *            CANNOT create initial calendar.
 *            CANNOT modify weeklyHolidays.
 *            CANNOT modify officialHolidays.
 * - Cashier/Other: CANNOT perform any calendar mutations.
 */
export function validateMutationPermissions(
  actor: UserActorContext,
  isInitialCreation: boolean,
  input: CalendarMutationInput,
  currentConfig?: BusinessCalendarConfig | null
): void {
  const role = actor.role?.toLowerCase() || '';

  if (role === 'admin') {
    return; // Full access
  }

  if (role === 'manager') {
    if (isInitialCreation) {
      throw new Error('PERMISSION_DENIED: Only Admin can create the initial business calendar.');
    }
    if (input.weeklyHolidays !== undefined && currentConfig) {
      const currentSet = new Set(currentConfig.weeklyHolidays);
      const newSet = new Set(input.weeklyHolidays);
      const changed = currentSet.size !== newSet.size || input.weeklyHolidays.some(d => !currentSet.has(d));
      if (changed) {
        throw new Error('PERMISSION_DENIED: Manager cannot modify weeklyHolidays. Admin required.');
      }
    }
    if (input.officialHolidays !== undefined && currentConfig) {
      const currentSet = new Set(currentConfig.officialHolidays);
      const newSet = new Set(input.officialHolidays);
      const changed = currentSet.size !== newSet.size || input.officialHolidays.some(h => !currentSet.has(h));
      if (changed) {
        throw new Error('PERMISSION_DENIED: Manager cannot modify officialHolidays. Admin required.');
      }
    }
    if (!input.changeReason || !input.changeReason.trim()) {
      throw new Error('MANDATORY_REASON_REQUIRED: Manager must provide an explicit changeReason for operational calendar exceptions.');
    }
    return;
  }

  throw new Error(`PERMISSION_DENIED: Role "${role}" cannot mutate the business calendar.`);
}

/**
 * Prevents retroactive mutation of sealed accounting dates.
 * Cannot add holiday or non-working classification to a date that is already closed.
 */
export async function assertNoSealedDateMutation(
  targetDatesToCheck: string[],
  closedDates: Set<string>
): Promise<void> {
  for (const date of targetDatesToCheck) {
    if (closedDates.has(date)) {
      throw new Error(`HISTORICAL_MUTATION_BLOCKED: Date ${date} has already been closed and sealed by Day Close.`);
    }
  }
}

/**
 * Pure deterministic selector for applicable calendar version.
 * 
 * Rule:
 * For a given decisionDate (YYYY-MM-DD), find the latest version where:
 *   version.effectiveFrom <= decisionDate
 * 
 * If no version satisfies the condition, returns undefined.
 */
export function selectApplicableCalendarVersion(
  versions: BusinessCalendarVersionRecord[],
  decisionDate: string
): BusinessCalendarVersionRecord | undefined {
  if (!versions || versions.length === 0) return undefined;

  // Filter versions with effectiveFrom <= decisionDate
  const eligible = versions.filter(v => v.effectiveFrom <= decisionDate);
  if (eligible.length === 0) return undefined;

  // Sort descending by effectiveFrom, then by version number
  eligible.sort((a, b) => {
    const cmp = b.effectiveFrom.localeCompare(a.effectiveFrom);
    if (cmp !== 0) return cmp;
    return b.version - a.version;
  });

  return eligible[0];
}

/**
 * Pure deterministic day status evaluator.
 * Evaluates whether a date is BUSINESS_DAY, HOLIDAY, NON_WORKING, CLOSED, or NOT_CONFIGURED.
 */
export function resolveDayStatus(
  dateStr: string,
  calendarConfig: {
    weeklyHolidays: number[];
    officialHolidays: string[];
    nonWorkingDates: string[];
  } | undefined | null,
  isDateClosed: boolean
): DayStatus {
  if (!calendarConfig) {
    return 'NOT_CONFIGURED';
  }

  if (calendarConfig.officialHolidays.includes(dateStr)) {
    return 'HOLIDAY';
  }

  if (calendarConfig.nonWorkingDates.includes(dateStr)) {
    return 'NON_WORKING';
  }

  const dayOfWeek = getDayOfWeekFromDateStr(dateStr);
  if (calendarConfig.weeklyHolidays.includes(dayOfWeek)) {
    return 'HOLIDAY';
  }

  if (isDateClosed) {
    return 'CLOSED';
  }

  return 'BUSINESS_DAY';
}

/**
 * Evaluates if a day status allows financial cash posting.
 */
export function isDayPostable(status: DayStatus): boolean {
  return status === 'BUSINESS_DAY';
}

/**
 * Pure deterministic resolver for findFirstOpenBusinessDay.
 * 
 * Requirements:
 * 1. Start from day AFTER supplied dateStr.
 * 2. Look up applicable calendar version for that day.
 * 3. Skip: weekly holidays, official holidays, nonWorkingDates, and closed days.
 * 4. Technical safety limit: MAX_LOOKAHEAD_DAYS (60 days).
 * 5. Returns first valid open business day or throws NO_OPEN_BUSINESS_DAY_WITHIN_LIMIT.
 */
export function findFirstOpenBusinessDay(
  startDateStr: string,
  calendarVersions: BusinessCalendarVersionRecord[],
  closedDates: Set<string> | string[]
): string {
  if (!calendarVersions || calendarVersions.length === 0) {
    throw new Error('BUSINESS_CALENDAR_NOT_CONFIGURED: No calendar versions available to resolve open days.');
  }

  const closedSet = Array.isArray(closedDates) ? new Set(closedDates) : closedDates;
  let currentDate = startDateStr;

  for (let step = 1; step <= MAX_LOOKAHEAD_DAYS; step++) {
    currentDate = addDaysToDateStr(currentDate, 1);

    const applicableVersion = selectApplicableCalendarVersion(calendarVersions, currentDate);
    if (!applicableVersion) {
      throw new Error(`BUSINESS_CALENDAR_NOT_CONFIGURED: No applicable calendar version found for date ${currentDate}.`);
    }

    const isClosed = closedSet.has(currentDate);
    const status = resolveDayStatus(currentDate, applicableVersion, isClosed);

    if (isDayPostable(status)) {
      return currentDate;
    }
  }

  throw new Error(`NO_OPEN_BUSINESS_DAY_WITHIN_LIMIT: Lookahead exceeded ${MAX_LOOKAHEAD_DAYS} days without finding an open business day.`);
}

/**
 * Stale Cache Evaluator.
 * 
 * Deterministic Rule:
 * Local Version < Cloud Version => STALE
 */
export function isCalendarCacheStale(localVersion: number, cloudVersion: number): boolean {
  return localVersion < cloudVersion;
}

/**
 * Resolved Date Model for Payments & Transactions (BR-02, BR-03, BR-08, BR-09)
 */
export interface ResolvedPaymentDates {
  originalEventDate: string;
  actualCashDate: string;
  statementDate: string;
  postingDate: string;
  effectiveCashDate: string;
  isLatePosting: boolean;
  closedDate: string | null;
}

/**
 * Pure deterministic resolver for Closed-Day Late Posting Date Model.
 * If eventDate is in closedDates:
 *   - originalEventDate / actualCashDate / statementDate = eventDate
 *   - postingDate / effectiveCashDate = first open business day
 *   - isLatePosting = true
 *   - closedDate = eventDate
 * If eventDate is open:
 *   - all dates = eventDate
 *   - isLatePosting = false
 *   - closedDate = null
 */
export function resolveClosedDayDates(
  eventDate: string,
  closedDates: Set<string> | string[],
  calendarVersions?: BusinessCalendarVersionRecord[]
): ResolvedPaymentDates {
  const closedSet = Array.isArray(closedDates) ? new Set(closedDates) : closedDates;
  const isClosed = closedSet.has(eventDate);

  if (!isClosed) {
    return {
      originalEventDate: eventDate,
      actualCashDate: eventDate,
      statementDate: eventDate,
      postingDate: eventDate,
      effectiveCashDate: eventDate,
      isLatePosting: false,
      closedDate: null
    };
  }

  let postingDate = eventDate;
  if (calendarVersions && calendarVersions.length > 0) {
    try {
      postingDate = findFirstOpenBusinessDay(eventDate, calendarVersions, closedSet);
    } catch {
      postingDate = eventDate;
    }
  }

  return {
    originalEventDate: eventDate,
    actualCashDate: eventDate,
    statementDate: eventDate,
    postingDate,
    effectiveCashDate: postingDate,
    isLatePosting: true,
    closedDate: eventDate
  };
}

// ============================================================================
// FIRESTORE ATOMIC TRANSACTIONS & PERSISTENCE
// ============================================================================

let memoryCalendarCache: BusinessCalendarConfig | null = null;

export function getLocalCachedCalendar(): BusinessCalendarConfig | null {
  if (memoryCalendarCache) return memoryCalendarCache;
  try {
    const raw = localStorage.getItem(BUSINESS_CALENDAR_STORAGE_KEY);
    if (raw) {
      memoryCalendarCache = JSON.parse(raw);
      return memoryCalendarCache;
    }
  } catch {}
  return null;
}

export function setLocalCachedCalendar(config: BusinessCalendarConfig): void {
  memoryCalendarCache = config;
  try {
    localStorage.setItem(BUSINESS_CALENDAR_STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

/**
 * Reads the current calendar configuration from Firestore.
 */
export async function fetchCurrentBusinessCalendar(): Promise<BusinessCalendarConfig | null> {
  try {
    const snap = await fsdb.doc(BUSINESS_CALENDAR_DOC_PATH).get();
    if (snap.exists) {
      const data = snap.data() as BusinessCalendarConfig;
      setLocalCachedCalendar(data);
      return data;
    }
  } catch (err) {
    console.warn('Could not fetch business calendar from cloud:', err);
  }
  return getLocalCachedCalendar();
}

/**
 * Reads all historical versions of the business calendar.
 */
export async function fetchCalendarVersionHistory(): Promise<BusinessCalendarVersionRecord[]> {
  try {
    const snap = await fsdb.collection(BUSINESS_CALENDAR_VERSIONS_COLL).orderBy('version', 'desc').get();
    const versions: BusinessCalendarVersionRecord[] = [];
    snap.forEach(doc => {
      versions.push(doc.data() as BusinessCalendarVersionRecord);
    });
    return versions;
  } catch (err) {
    console.warn('Could not fetch calendar versions history:', err);
    return [];
  }
}

/**
 * Mutates the Business Calendar atomically inside a single Firestore Transaction.
 * 
 * Atomicity Steps:
 * 1. Reads current calendar document inside transaction.
 * 2. Validates requested mutation & permissions.
 * 3. Prevents retroactive mutation of closed dates.
 * 4. Determines nextVersion = currentVersion + 1.
 * 5. Writes new current document: appSettings/businessCalendar
 * 6. Writes immutable historical record: appSettings/businessCalendar/versions/{nextVersion}
 * 7. Synchronizes local cache.
 * 8. Triggers audit record decoupled after transaction commit.
 */
export async function saveBusinessCalendarMutation(
  actor: UserActorContext,
  input: CalendarMutationInput,
  existingClosedDates: Set<string> = new Set()
): Promise<BusinessCalendarConfig> {
  const currentDocRef = fsdb.doc(BUSINESS_CALENDAR_DOC_PATH);
  let finalConfig: BusinessCalendarConfig | null = null;
  let previousVersionNum = 0;

  await fsdb.runTransaction(async (tx) => {
    const currentSnap = await tx.get(currentDocRef);
    const isInitial = !currentSnap.exists;
    const currentConfig = isInitial ? null : (currentSnap.data() as BusinessCalendarConfig);
    previousVersionNum = currentConfig ? currentConfig.version : 0;

    // Permission check
    validateMutationPermissions(actor, isInitial, input, currentConfig);

    const mergedData = {
      weeklyHolidays: input.weeklyHolidays !== undefined ? input.weeklyHolidays : (currentConfig?.weeklyHolidays || []),
      officialHolidays: input.officialHolidays !== undefined ? input.officialHolidays : (currentConfig?.officialHolidays || []),
      nonWorkingDates: input.nonWorkingDates !== undefined ? input.nonWorkingDates : (currentConfig?.nonWorkingDates || []),
      effectiveFrom: input.effectiveFrom
    };

    // Validation
    validateCalendarData(mergedData);

    // Assert no retroactive mutation of sealed dates
    const newDatesAdded = [
      ...mergedData.officialHolidays.filter(d => !currentConfig?.officialHolidays.includes(d)),
      ...mergedData.nonWorkingDates.filter(d => !currentConfig?.nonWorkingDates.includes(d))
    ];
    await assertNoSealedDateMutation(newDatesAdded, existingClosedDates);

    const nextVersion = previousVersionNum + 1;
    const versionDocRef = fsdb.collection(BUSINESS_CALENDAR_VERSIONS_COLL).doc(String(nextVersion));

    // Ensure concurrency idempotency: version doc must not exist
    const versionSnap = await tx.get(versionDocRef);
    if (versionSnap.exists) {
      throw new Error(`CONCURRENT_MUTATION_CONFLICT: Version ${nextVersion} already exists.`);
    }

    const nowIso = new Date().toISOString();

    const newConfig: BusinessCalendarConfig = {
      version: nextVersion,
      weeklyHolidays: mergedData.weeklyHolidays,
      officialHolidays: mergedData.officialHolidays,
      nonWorkingDates: mergedData.nonWorkingDates,
      effectiveFrom: mergedData.effectiveFrom,
      updatedAt: nowIso,
      updatedByUid: actor.uid,
      updatedByName: actor.name,
      changeReason: input.changeReason?.trim() || ''
    };

    const versionRecord: BusinessCalendarVersionRecord = {
      version: nextVersion,
      weeklyHolidays: mergedData.weeklyHolidays,
      officialHolidays: mergedData.officialHolidays,
      nonWorkingDates: mergedData.nonWorkingDates,
      effectiveFrom: mergedData.effectiveFrom,
      createdAt: nowIso,
      createdByUid: actor.uid,
      createdByName: actor.name,
      changeReason: input.changeReason?.trim() || ''
    };

    // Atomic Writes inside transaction
    tx.set(currentDocRef, newConfig);
    tx.set(versionDocRef, versionRecord);

    finalConfig = newConfig;
  });

  if (!finalConfig) {
    throw new Error('TRANSACTION_FAILED: Calendar mutation did not complete.');
  }

  // Update local memory and localStorage cache
  setLocalCachedCalendar(finalConfig);

  // Decoupled Audit Record (post-commit)
  try {
    await recordSecureAudit(
      `تحديث روزنامة العمل التشغيلية (إصدار ${finalConfig.version})`,
      'appSettings/businessCalendar',
      {
        previousVersion: previousVersionNum,
        newVersion: finalConfig.version,
        effectiveFrom: finalConfig.effectiveFrom,
        weeklyHolidays: finalConfig.weeklyHolidays,
        officialHolidaysCount: finalConfig.officialHolidays.length,
        nonWorkingDatesCount: finalConfig.nonWorkingDates.length,
        changeReason: finalConfig.changeReason
      },
      'warn'
    );
  } catch (auditErr) {
    console.warn('Calendar mutation audit warning (non-fatal):', auditErr);
  }

  return finalConfig;
}
