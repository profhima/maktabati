import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fsdb, purgeAllData, IMMUTABLE_COLLECTIONS_NO_DELETE } from './firebase';

describe('purgeAllData Unit Tests', () => {
  const mockCollections: Record<string, any[]> = {};
  let batchCalls: Array<{ deletes: string[]; committed: boolean }> = [];

  beforeEach(() => {
    Object.keys(mockCollections).forEach(k => delete mockCollections[k]);
    batchCalls = [];

    // Spy on fsdb methods directly on the imported fsdb object
    vi.spyOn(fsdb, 'collection').mockImplementation((colName: string) => {
      return {
        get: async () => {
          const items = mockCollections[colName] || [];
          return {
            empty: items.length === 0,
            docs: items.map(item => ({
              ref: { path: `${colName}/${item.id}`, id: item.id },
              data: () => item
            }))
          } as any;
        }
      } as any;
    });

    vi.spyOn(fsdb, 'batch').mockImplementation(() => {
      const currentBatch: { deletes: string[]; committed: boolean } = {
        deletes: [],
        committed: false
      };
      batchCalls.push(currentBatch);
      return {
        delete: (docRef: any) => {
          currentBatch.deletes.push(docRef.path || docRef.id);
          return {} as any;
        },
        commit: async () => {
          currentBatch.committed = true;
        }
      } as any;
    });
  });

  it('skips all immutable collections defined in IMMUTABLE_COLLECTIONS_NO_DELETE without querying or calling batch delete', async () => {
    // Populate an immutable collection
    mockCollections['customerPayments'] = [{ id: 'p1' }, { id: 'p2' }];
    mockCollections['stockMovements'] = [{ id: 'sm1' }];

    const result = await purgeAllData();

    // Verify skippedCollections contains all immutable collections
    for (const imm of IMMUTABLE_COLLECTIONS_NO_DELETE) {
      expect(result.skippedCollections).toContain(imm);
    }

    // Verify customerPayments and stockMovements were never deleted in batches
    const allDeletedPaths = batchCalls.flatMap(b => b.deletes);
    expect(allDeletedPaths.some(p => p.includes('customerPayments'))).toBe(false);
    expect(allDeletedPaths.some(p => p.includes('stockMovements'))).toBe(false);
  });

  it('chunks deletions into maximum 400 documents per batch for large collections (1050 docs -> 400 + 400 + 250)', async () => {
    // Create 1050 products (requires 3 batches: 400 + 400 + 250)
    const prods = [];
    for (let i = 0; i < 1050; i++) {
      prods.push({ id: `prod_${i}` });
    }
    mockCollections['products'] = prods;

    const result = await purgeAllData();

    expect(result.purgedCount).toBe(1050);
    expect(result.purgedCollections).toContain('products');

    // Filter batches that deleted products
    const productBatches = batchCalls.filter(b => b.deletes.some(p => p.includes('products')));
    expect(productBatches.length).toBe(3);
    expect(productBatches[0].deletes.length).toBe(400);
    expect(productBatches[0].committed).toBe(true);
    expect(productBatches[1].deletes.length).toBe(400);
    expect(productBatches[1].committed).toBe(true);
    expect(productBatches[2].deletes.length).toBe(250);
    expect(productBatches[2].committed).toBe(true);
    expect(productBatches.every(b => b.committed)).toBe(true);
  });

  it('handles empty collections gracefully without errors', async () => {
    mockCollections['products'] = [];
    mockCollections['invoices'] = [];

    const result = await purgeAllData();

    expect(result.purgedCount).toBe(0);
    expect(result.purgedCollections).toContain('products');
    expect(result.purgedCollections).toContain('invoices');
  });
});
