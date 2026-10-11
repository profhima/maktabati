import { Product, InvoiceItem, SalesReturnItem, BundleComponentItem } from '../types';
import { productFullName } from './utils';

/**
 * Calculate maximum available bundles that can be assembled from current inventory.
 */
export function getBundleAvailableQty(bundle: Product, allProducts: Product[]): number {
  if (!bundle.isBundle || !bundle.bundleComponents || bundle.bundleComponents.length === 0) {
    return Number(bundle.qty) || 0;
  }

  let maxAssembleable = Infinity;

  for (const comp of bundle.bundleComponents) {
    const compProduct = allProducts.find(p => p.id === comp.productId);
    const availableQty = compProduct ? Math.max(0, Number(compProduct.qty) || 0) : 0;
    const requiredPerBundle = Math.max(1, Number(comp.qty) || 1);
    
    const possibleBundles = Math.floor(availableQty / requiredPerBundle);
    if (possibleBundles < maxAssembleable) {
      maxAssembleable = possibleBundles;
    }
  }

  return maxAssembleable === Infinity ? 0 : Math.max(0, maxAssembleable);
}

/**
 * Calculate accurate unit cost of a bundle based on current component cost prices.
 */
export function getBundleCalculatedCost(bundle: Product, allProducts: Product[]): number {
  if (!bundle.isBundle || !bundle.bundleComponents || bundle.bundleComponents.length === 0) {
    return Number(bundle.costPrice) || 0;
  }

  return bundle.bundleComponents.reduce((sum, comp) => {
    const compProduct = allProducts.find(p => p.id === comp.productId);
    const unitCost = compProduct ? Number(compProduct.costPrice) || 0 : Number(comp.unitCost) || 0;
    return sum + (unitCost * (Number(comp.qty) || 1));
  }, 0);
}

export interface ExpandedStockDeduction {
  productId: string;
  qty: number;
  delta: number; // negative number for deduction
  name: string;
  isBundleComponent?: boolean;
  bundleName?: string;
}

/**
 * Expands cart invoice items (including bundles) into individual physical inventory items that must be deducted.
 * Groups by productId so components used across multiple bundles/items are merged accurately.
 */
export function expandItemsToPhysicalDeductions(
  items: InvoiceItem[] | Array<{ productId: string | null; qty: number; name: string }>,
  allProducts: Product[]
): ExpandedStockDeduction[] {
  const map = new Map<string, { qty: number; name: string; isBundleComponent: boolean; bundleNames: Set<string> }>();

  for (const it of items) {
    if (!it.productId) continue;
    const prod = allProducts.find(p => p.id === it.productId);
    if (!prod) continue;

    const requestedQty = Math.max(0, Number(it.qty) || 0);
    if (requestedQty <= 0) continue;

    if (prod.isBundle && Array.isArray(prod.bundleComponents) && prod.bundleComponents.length > 0) {
      // It's a bundle -> deduct each component
      for (const comp of prod.bundleComponents) {
        if (!comp.productId) continue;
        const compTotalQty = (Number(comp.qty) || 1) * requestedQty;
        const existing = map.get(comp.productId);
        
        if (existing) {
          existing.qty += compTotalQty;
          existing.bundleNames.add(prod.name);
        } else {
          const compProd = allProducts.find(p => p.id === comp.productId);
          map.set(comp.productId, {
            qty: compTotalQty,
            name: compProd ? productFullName(compProd) : comp.productName || 'مكون باقة',
            isBundleComponent: true,
            bundleNames: new Set([prod.name])
          });
        }
      }
    } else {
      // Regular product
      const existing = map.get(prod.id);
      if (existing) {
        existing.qty += requestedQty;
      } else {
        map.set(prod.id, {
          qty: requestedQty,
          name: productFullName(prod),
          isBundleComponent: false,
          bundleNames: new Set()
        });
      }
    }
  }

  return Array.from(map.entries()).map(([productId, data]) => ({
    productId,
    qty: data.qty,
    delta: -data.qty,
    name: data.name,
    isBundleComponent: data.isBundleComponent,
    bundleName: data.bundleNames.size > 0 ? Array.from(data.bundleNames).join(' + ') : undefined
  }));
}

/**
 * Expands returned items (including bundles) into individual physical items to be returned to stock.
 */
export function expandReturnsToPhysicalItems(
  items: SalesReturnItem[] | Array<{ productId: string; qty: number; name: string }>,
  allProducts: Product[]
): ExpandedStockDeduction[] {
  const map = new Map<string, { qty: number; name: string; isBundleComponent: boolean; bundleNames: Set<string> }>();

  for (const it of items) {
    if (!it.productId) continue;
    const prod = allProducts.find(p => p.id === it.productId);
    const returnQty = Math.max(0, Number(it.qty) || 0);
    if (returnQty <= 0) continue;

    if (prod && prod.isBundle && Array.isArray(prod.bundleComponents) && prod.bundleComponents.length > 0) {
      for (const comp of prod.bundleComponents) {
        if (!comp.productId) continue;
        const compTotalQty = (Number(comp.qty) || 1) * returnQty;
        const existing = map.get(comp.productId);
        if (existing) {
          existing.qty += compTotalQty;
          existing.bundleNames.add(prod.name);
        } else {
          const compProd = allProducts.find(p => p.id === comp.productId);
          map.set(comp.productId, {
            qty: compTotalQty,
            name: compProd ? productFullName(compProd) : comp.productName || 'مكون باقة',
            isBundleComponent: true,
            bundleNames: new Set([prod.name])
          });
        }
      }
    } else {
      const existing = map.get(it.productId);
      if (existing) {
        existing.qty += returnQty;
      } else {
        map.set(it.productId, {
          qty: returnQty,
          name: prod ? productFullName(prod) : it.name,
          isBundleComponent: false,
          bundleNames: new Set()
        });
      }
    }
  }

  return Array.from(map.entries()).map(([productId, data]) => ({
    productId,
    qty: data.qty,
    delta: data.qty, // positive for returns
    name: data.name,
    isBundleComponent: data.isBundleComponent,
    bundleName: data.bundleNames.size > 0 ? Array.from(data.bundleNames).join(' + ') : undefined
  }));
}

/**
 * Validates whether all items (including bundle components) have sufficient inventory.
 */
export function validateCartStock(
  cartItems: InvoiceItem[],
  allProducts: Product[],
  additionalItem?: { productId: string; qty: number }
): { valid: boolean; error?: string; insufficientItem?: { name: string; available: number; required: number } } {
  const itemsToCheck = [...cartItems.map(it => ({ productId: it.productId, qty: it.qty, name: it.name }))];
  if (additionalItem) {
    itemsToCheck.push({ productId: additionalItem.productId, qty: additionalItem.qty, name: '' });
  }

  const deductions = expandItemsToPhysicalDeductions(itemsToCheck, allProducts);

  for (const item of deductions) {
    const prod = allProducts.find(p => p.id === item.productId);
    const available = prod ? Math.max(0, Number(prod.qty) || 0) : 0;
    if (item.qty > available) {
      const reason = item.isBundleComponent && item.bundleName
        ? `المخزون غير كافٍ للمكون "${item.name}" داخل باقة (${item.bundleName}): المطلوب ${item.qty} والمتاح في المخزن ${available} فقط`
        : `المخزون غير كافٍ للصنف "${item.name}": المطلوب ${item.qty} والمتاح بالمخزن ${available} فقط`;
      return {
        valid: false,
        error: reason,
        insufficientItem: {
          name: item.name,
          available,
          required: item.qty
        }
      };
    }
  }

  return { valid: true };
}
