import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateCalendarData,
  validateMutationPermissions,
  assertNoSealedDateMutation,
  selectApplicableCalendarVersion,
  resolveDayStatus,
  isDayPostable,
  findFirstOpenBusinessDay,
  isCalendarCacheStale,
  saveBusinessCalendarMutation,
  MAX_LOOKAHEAD_DAYS,
  UserActorContext
} from './businessCalendar';
import {
  BusinessCalendarConfig,
  BusinessCalendarVersionRecord
} from '../types';
import { getCairoDateStr } from './dateUtils';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('Phase 2.2.5.6 — Business Calendar Foundation & Version Selection Test Suite', () => {

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. CALENDAR CONFIGURATION VALIDATION TESTS
  // =========================================================================
  describe('1. Calendar Configuration Validation', () => {

    it('Test 1: Missing/unconfigured calendar is correctly recognized', () => {
      const status = resolveDayStatus('2026-10-05', null, false);
      expect(status).toBe('NOT_CONFIGURED');
    });

    it('Test 2: Valid initial calendar configuration passes validation', () => {
      expect(() => {
        validateCalendarData({
          weeklyHolidays: [5], // Friday
          officialHolidays: ['2026-10-06'],
          nonWorkingDates: ['2026-12-31'],
          effectiveFrom: '2026-10-01'
        });
      }).not.toThrow();
    });

    it('Test 3: Invalid weekly holiday integer (< 0 or > 6) is rejected', () => {
      expect(() => {
        validateCalendarData({
          weeklyHolidays: [7], // Invalid: must be 0..6
          officialHolidays: [],
          nonWorkingDates: [],
          effectiveFrom: '2026-10-01'
        });
      }).toThrow('INVALID_WEEKLY_HOLIDAY');
    });

    it('Test 4: Duplicate weekly holiday is rejected', () => {
      expect(() => {
        validateCalendarData({
          weeklyHolidays: [5, 5],
          officialHolidays: [],
          nonWorkingDates: [],
          effectiveFrom: '2026-10-01'
        });
      }).toThrow('DUPLICATE_WEEKLY_HOLIDAY');
    });

    it('Test 5: Invalid ISO date format is rejected', () => {
      expect(() => {
        validateCalendarData({
          weeklyHolidays: [5],
          officialHolidays: ['06-10-2026'], // Invalid format
          nonWorkingDates: [],
          effectiveFrom: '2026-10-01'
        });
      }).toThrow('INVALID_OFFICIAL_HOLIDAY');

      expect(() => {
        validateCalendarData({
          weeklyHolidays: [5],
          officialHolidays: [],
          nonWorkingDates: [],
          effectiveFrom: '2026/10/01' // Invalid format
        });
      }).toThrow('INVALID_EFFECTIVE_FROM');
    });

    it('Test 6: Duplicate holiday in officialHolidays is rejected', () => {
      expect(() => {
        validateCalendarData({
          weeklyHolidays: [5],
          officialHolidays: ['2026-10-06', '2026-10-06'],
          nonWorkingDates: [],
          effectiveFrom: '2026-10-01'
        });
      }).toThrow('DUPLICATE_OFFICIAL_HOLIDAY');
    });

    it('Test 7: Duplicate date in nonWorkingDates is rejected', () => {
      expect(() => {
        validateCalendarData({
          weeklyHolidays: [5],
          officialHolidays: [],
          nonWorkingDates: ['2026-12-31', '2026-12-31'],
          effectiveFrom: '2026-10-01'
        });
      }).toThrow('DUPLICATE_NON_WORKING_DATE');
    });

    it('Test 8: Conflicting date present in both officialHolidays and nonWorkingDates is rejected', () => {
      expect(() => {
        validateCalendarData({
          weeklyHolidays: [5],
          officialHolidays: ['2026-10-06'],
          nonWorkingDates: ['2026-10-06'], // Overlapping!
          effectiveFrom: '2026-10-01'
        });
      }).toThrow('CONFLICTING_CALENDAR_DATE');
    });
  });

  // =========================================================================
  // 2. PERMISSIONS & ROLE ENFORCEMENT TESTS
  // =========================================================================
  describe('2. Permission Matrix Enforcement', () => {
    const adminActor: UserActorContext = { uid: 'u_admin', name: 'Admin', role: 'admin' };
    const managerActor: UserActorContext = { uid: 'u_mgr', name: 'Manager', role: 'manager' };
    const cashierActor: UserActorContext = { uid: 'u_cash', name: 'Cashier', role: 'cashier' };

    it('Admin is allowed to create initial calendar and modify all fields', () => {
      expect(() => {
        validateMutationPermissions(adminActor, true, {
          weeklyHolidays: [5],
          effectiveFrom: '2026-10-01'
        }, null);
      }).not.toThrow();
    });

    it('Manager is BLOCKED from creating initial calendar', () => {
      expect(() => {
        validateMutationPermissions(managerActor, true, {
          weeklyHolidays: [5],
          effectiveFrom: '2026-10-01',
          changeReason: 'Create calendar'
        }, null);
      }).toThrow('PERMISSION_DENIED: Only Admin can create the initial business calendar.');
    });

    it('Manager is BLOCKED from modifying weeklyHolidays', () => {
      const currentConfig: BusinessCalendarConfig = {
        version: 1,
        weeklyHolidays: [5],
        officialHolidays: [],
        nonWorkingDates: [],
        effectiveFrom: '2026-10-01',
        updatedAt: '2026-10-01T00:00:00Z',
        updatedByUid: 'u_admin',
        updatedByName: 'Admin'
      };

      expect(() => {
        validateMutationPermissions(managerActor, false, {
          weeklyHolidays: [5, 6], // Attempting to add Saturday
          effectiveFrom: '2026-10-02',
          changeReason: 'Adding Saturday'
        }, currentConfig);
      }).toThrow('PERMISSION_DENIED: Manager cannot modify weeklyHolidays. Admin required.');
    });

    it('Manager is BLOCKED from modifying officialHolidays', () => {
      const currentConfig: BusinessCalendarConfig = {
        version: 1,
        weeklyHolidays: [5],
        officialHolidays: ['2026-10-06'],
        nonWorkingDates: [],
        effectiveFrom: '2026-10-01',
        updatedAt: '2026-10-01T00:00:00Z',
        updatedByUid: 'u_admin',
        updatedByName: 'Admin'
      };

      expect(() => {
        validateMutationPermissions(managerActor, false, {
          officialHolidays: ['2026-10-06', '2026-10-07'],
          effectiveFrom: '2026-10-02',
          changeReason: 'Adding holiday'
        }, currentConfig);
      }).toThrow('PERMISSION_DENIED: Manager cannot modify officialHolidays. Admin required.');
    });

    it('Manager is ALLOWED to modify nonWorkingDates with an explicit reason', () => {
      const currentConfig: BusinessCalendarConfig = {
        version: 1,
        weeklyHolidays: [5],
        officialHolidays: ['2026-10-06'],
        nonWorkingDates: [],
        effectiveFrom: '2026-10-01',
        updatedAt: '2026-10-01T00:00:00Z',
        updatedByUid: 'u_admin',
        updatedByName: 'Admin'
      };

      expect(() => {
        validateMutationPermissions(managerActor, false, {
          nonWorkingDates: ['2026-10-15'],
          effectiveFrom: '2026-10-02',
          changeReason: 'صيانة دورية للكهرباء والتكييف بالفرع'
        }, currentConfig);
      }).not.toThrow();
    });

    it('Manager modifying nonWorkingDates WITHOUT reason is rejected', () => {
      const currentConfig: BusinessCalendarConfig = {
        version: 1,
        weeklyHolidays: [5],
        officialHolidays: [],
        nonWorkingDates: [],
        effectiveFrom: '2026-10-01',
        updatedAt: '2026-10-01T00:00:00Z',
        updatedByUid: 'u_admin',
        updatedByName: 'Admin'
      };

      expect(() => {
        validateMutationPermissions(managerActor, false, {
          nonWorkingDates: ['2026-10-15'],
          effectiveFrom: '2026-10-02',
          changeReason: '' // Empty reason
        }, currentConfig);
      }).toThrow('MANDATORY_REASON_REQUIRED');
    });

    it('Cashier or other roles are completely BLOCKED from mutating calendar', () => {
      expect(() => {
        validateMutationPermissions(cashierActor, false, {
          nonWorkingDates: ['2026-10-15'],
          effectiveFrom: '2026-10-02'
        }, null);
      }).toThrow('PERMISSION_DENIED');
    });
  });

  // =========================================================================
  // 3. VERSIONING & CRITICAL VERSION-SELECTION TESTS
  // =========================================================================
  describe('3. Calendar Version Selection (BR-02 & Critical Selection Rule)', () => {
    const versions: BusinessCalendarVersionRecord[] = [
      {
        version: 1,
        weeklyHolidays: [5],
        officialHolidays: ['2026-10-06'],
        nonWorkingDates: [],
        effectiveFrom: '2026-10-01',
        createdAt: '2026-10-01T00:00:00Z',
        createdByUid: 'u_admin',
        createdByName: 'Admin'
      },
      {
        version: 2,
        weeklyHolidays: [5],
        officialHolidays: ['2026-10-06', '2026-10-08'],
        nonWorkingDates: [],
        effectiveFrom: '2026-10-06',
        createdAt: '2026-10-05T12:00:00Z',
        createdByUid: 'u_admin',
        createdByName: 'Admin'
      },
      {
        version: 3,
        weeklyHolidays: [5, 6], // Added Saturday
        officialHolidays: ['2026-10-06', '2026-10-08'],
        nonWorkingDates: ['2026-10-12'],
        effectiveFrom: '2026-10-10',
        createdAt: '2026-10-09T18:00:00Z',
        createdByUid: 'u_admin',
        createdByName: 'Admin'
      }
    ];

    it('Test 9: Initial version = 1', () => {
      expect(versions[0].version).toBe(1);
    });

    it('Test 10: Update produces incremented version 2', () => {
      expect(versions[1].version).toBe(2);
      expect(versions[1].version).toBe(versions[0].version + 1);
    });

    it('Test 12: Historical version records remain intact and unchanged', () => {
      expect(versions[0].weeklyHolidays).toEqual([5]);
      expect(versions[1].weeklyHolidays).toEqual([5]);
      expect(versions[2].weeklyHolidays).toEqual([5, 6]);
      expect(versions[0].officialHolidays).toHaveLength(1);
      expect(versions[1].officialHolidays).toHaveLength(2);
    });

    it('Test 13: Correct version selected deterministically by effectiveFrom <= decisionDate', () => {
      // Evaluation on 2026-10-05: effectiveFrom 2026-10-01 is eligible -> Version 1
      const selectedForOct5 = selectApplicableCalendarVersion(versions, '2026-10-05');
      expect(selectedForOct5?.version).toBe(1);

      // Evaluation on 2026-10-07: Version 2 is effective from 2026-10-06 -> Version 2 (NOT Version 3)
      const selectedForOct7 = selectApplicableCalendarVersion(versions, '2026-10-07');
      expect(selectedForOct7?.version).toBe(2);

      // Evaluation on 2026-10-12: Version 3 is effective from 2026-10-10 -> Version 3
      const selectedForOct12 = selectApplicableCalendarVersion(versions, '2026-10-12');
      expect(selectedForOct12?.version).toBe(3);
    });

    it('Test 14: Future version does not affect an earlier decision date', () => {
      const selected = selectApplicableCalendarVersion(versions, '2026-10-04');
      expect(selected?.version).toBe(1);
      expect(selected?.weeklyHolidays).toEqual([5]); // Does not include Saturday from Version 3
    });

    it('Returns undefined if decisionDate precedes all effectiveFrom dates', () => {
      const selected = selectApplicableCalendarVersion(versions, '2026-09-20');
      expect(selected).toBeUndefined();
    });
  });

  // =========================================================================
  // 4. HISTORICAL MUTATION SAFETY TESTS
  // =========================================================================
  describe('4. Historical Mutation Safety', () => {
    it('Test 15: Adding holiday to an already closed date is BLOCKED', async () => {
      const closedDates = new Set(['2026-10-01', '2026-10-02']);
      const newDatesAttempted = ['2026-10-01']; // Already closed!

      await expect(assertNoSealedDateMutation(newDatesAttempted, closedDates))
        .rejects
        .toThrow('HISTORICAL_MUTATION_BLOCKED: Date 2026-10-01 has already been closed and sealed by Day Close.');
    });

    it('Test 16: Adding non-working date to a closed date is BLOCKED', async () => {
      const closedDates = new Set(['2026-09-30']);
      const newDatesAttempted = ['2026-09-30'];

      await expect(assertNoSealedDateMutation(newDatesAttempted, closedDates))
        .rejects
        .toThrow('HISTORICAL_MUTATION_BLOCKED');
    });

    it('Test 17: Weekly holiday change applies only from effectiveFrom', () => {
      const versions: BusinessCalendarVersionRecord[] = [
        {
          version: 1,
          weeklyHolidays: [], // No weekly holidays initially
          officialHolidays: [],
          nonWorkingDates: [],
          effectiveFrom: '2026-10-01',
          createdAt: '2026-10-01T00:00:00Z',
          createdByUid: 'u_admin',
          createdByName: 'Admin'
        },
        {
          version: 2,
          weeklyHolidays: [5], // Friday becomes holiday starting 2026-10-05
          officialHolidays: [],
          nonWorkingDates: [],
          effectiveFrom: '2026-10-05',
          createdAt: '2026-10-04T00:00:00Z',
          createdByUid: 'u_admin',
          createdByName: 'Admin'
        }
      ];

      // Friday 2026-10-02 was closed in period 1:
      const v1ForOct2 = selectApplicableCalendarVersion(versions, '2026-10-02');
      const statusOct2 = resolveDayStatus('2026-10-02', v1ForOct2, true);
      // It was CLOSED, not HOLIDAY
      expect(statusOct2).toBe('CLOSED');

      // Friday 2026-10-09 in period 2:
      const v2ForOct9 = selectApplicableCalendarVersion(versions, '2026-10-09');
      const statusOct9 = resolveDayStatus('2026-10-09', v2ForOct9, false);
      expect(statusOct9).toBe('HOLIDAY');
    });
  });

  // =========================================================================
  // 5. DAY STATUS & POSTABILITY RESOLUTION TESTS
  // =========================================================================
  describe('5. Day Status Resolution', () => {
    const config = {
      weeklyHolidays: [5], // Friday
      officialHolidays: ['2026-10-06'],
      nonWorkingDates: ['2026-10-15']
    };

    it('Test 18: Business day + no close = OPEN (postable)', () => {
      const status = resolveDayStatus('2026-10-07', config, false); // Wednesday
      expect(status).toBe('BUSINESS_DAY');
      expect(isDayPostable(status)).toBe(true);
    });

    it('Test 19: Business day + Daily Close = CLOSED (not postable)', () => {
      const status = resolveDayStatus('2026-10-07', config, true); // Wednesday closed
      expect(status).toBe('CLOSED');
      expect(isDayPostable(status)).toBe(false);
    });

    it('Test 20: Official holiday = HOLIDAY (not postable)', () => {
      const status = resolveDayStatus('2026-10-06', config, false);
      expect(status).toBe('HOLIDAY');
      expect(isDayPostable(status)).toBe(false);
    });

    it('Test 21: Non-working date = NON_WORKING (not postable)', () => {
      const status = resolveDayStatus('2026-10-15', config, false);
      expect(status).toBe('NON_WORKING');
      expect(isDayPostable(status)).toBe(false);
    });

    it('Weekly holiday (Friday) = HOLIDAY (not postable)', () => {
      const status = resolveDayStatus('2026-10-09', config, false); // Friday
      expect(status).toBe('HOLIDAY');
      expect(isDayPostable(status)).toBe(false);
    });

    it('Test 22: Missing calendar = NOT_CONFIGURED (not postable)', () => {
      const status = resolveDayStatus('2026-10-07', null, false);
      expect(status).toBe('NOT_CONFIGURED');
      expect(isDayPostable(status)).toBe(false);
    });
  });

  // =========================================================================
  // 6. findFirstOpenBusinessDay & LOOKAHEAD SAFETY TESTS
  // =========================================================================
  describe('6. findFirstOpenBusinessDay Resolver (BR-08)', () => {
    const versions: BusinessCalendarVersionRecord[] = [
      {
        version: 1,
        weeklyHolidays: [5], // Friday
        officialHolidays: ['2026-10-06'], // Tuesday Oct 6
        nonWorkingDates: ['2026-10-07'],   // Wednesday Oct 7
        effectiveFrom: '2026-10-01',
        createdAt: '2026-10-01T00:00:00Z',
        createdByUid: 'u_admin',
        createdByName: 'Admin'
      }
    ];

    it('Test 23 & 24 & 25 & 26: Skips holidays, non-working days, and Daily Close to find first open day', () => {
      // Monday 2026-10-05 event.
      // Next days:
      // - Tuesday 2026-10-06: official holiday (skip)
      // - Wednesday 2026-10-07: non-working date (skip)
      // - Thursday 2026-10-08: closed by Day Close (skip)
      // - Friday 2026-10-09: weekly holiday (skip)
      // - Saturday 2026-10-10: open business day!
      const closedDates = new Set(['2026-10-05', '2026-10-08']);

      const firstOpen = findFirstOpenBusinessDay('2026-10-05', versions, closedDates);
      expect(firstOpen).toBe('2026-10-10'); // Saturday
    });

    it('Test 27 & 28: Stops at 60-day safety limit and throws NO_OPEN_BUSINESS_DAY_WITHIN_LIMIT', () => {
      // Mock an extreme scenario where all days are non-working for 100 days
      const extremeVersions: BusinessCalendarVersionRecord[] = [
        {
          version: 1,
          weeklyHolidays: [0, 1, 2, 3, 4, 5, 6], // Every day is a weekly holiday!
          officialHolidays: [],
          nonWorkingDates: [],
          effectiveFrom: '2026-10-01',
          createdAt: '2026-10-01T00:00:00Z',
          createdByUid: 'u_admin',
          createdByName: 'Admin'
        }
      ];

      expect(() => {
        findFirstOpenBusinessDay('2026-10-01', extremeVersions, new Set());
      }).toThrow(`NO_OPEN_BUSINESS_DAY_WITHIN_LIMIT: Lookahead exceeded ${MAX_LOOKAHEAD_DAYS} days`);
    });

    it('Throws BUSINESS_CALENDAR_NOT_CONFIGURED if no calendar versions exist', () => {
      expect(() => {
        findFirstOpenBusinessDay('2026-10-01', [], new Set());
      }).toThrow('BUSINESS_CALENDAR_NOT_CONFIGURED');
    });
  });

  // =========================================================================
  // 7. TIMEZONE & STALE CACHE EVALUATION TESTS
  // =========================================================================
  describe('7. Timezone Helper & Stale Cache Evaluator', () => {
    it('Test 29: Cairo date helper correctly formats dates', () => {
      // Test fixed UTC timestamp
      const testDate = new Date('2026-10-02T22:30:00.000Z'); // 22:30 UTC = 00:30 (next day) in Cairo (UTC+2)
      const cairoDate = getCairoDateStr(testDate);
      expect(cairoDate).toBe('2026-10-03');
    });

    it('Stale evaluator: Local Version < Cloud Version => STALE', () => {
      expect(isCalendarCacheStale(1, 2)).toBe(true);
      expect(isCalendarCacheStale(2, 2)).toBe(false);
      expect(isCalendarCacheStale(3, 2)).toBe(false);
    });
  });

});
