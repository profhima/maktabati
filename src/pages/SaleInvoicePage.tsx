import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { fsdb, auditActor } from '../lib/firebase';
import {
  todayStr,
  uid,
  productFullName,
  productLabel,
  stockMovementId
} from '../lib/utils';
import { calculateSale } from '../lib/financialEngine';
import { CATEGORIES } from '../lib/constants';
import { OfflineSyncManager, isNetworkOrTransientError } from '../lib/offlineSync';
import {
  generateA4SaleInvoiceHtml,
  generateThermalReceiptHtml,
  generateWhatsAppReceiptMessage
} from '../lib/invoiceTemplates';
import { validateCartStock, expandItemsToPhysicalDeductions } from '../lib/bundles';
import { CUSTOMER_DISPLAY_CHANNEL, CustomerDisplayPayload } from '../types';
import {
  FolderOpen,
  Tv
} from 'lucide-react';
import { exportElementToPdf } from '../lib/pdfExporter';

import { PosCustomerBar } from './pos/PosCustomerBar';
import { PosProductInputBar } from './pos/PosProductInputBar';
import { PosQuickCategoryBar } from './pos/PosQuickCategoryBar';
import { PosCartTable } from './pos/PosCartTable';
import { PosCheckoutPanel } from './pos/PosCheckoutPanel';
import { PosAdminPinModal } from './pos/PosAdminPinModal';
import { PosInvoiceArchiveModal } from './pos/PosInvoiceArchiveModal';

export const SaleInvoicePage: React.FC = () => {
  const {
    db,
    setDb,
    currentProfile,
    saleCartItems,
    setSaleCartItems,
    saleCategoryDiscounts,
    setSaleCategoryDiscounts,
    addSaleItemByProduct,
    processInvoiceBarcode,
    clearSaleCart,
    openScanModal,
    openQuickAdd,
    showPrintModal,
    openInvoiceModal,
    reorderInvoiceToCart,
    setReturnInvoice,
    goTo,
    toast
  } = useApp();

  // Customer State
  const [custSearch, setCustSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [custResultsOpen, setCustResultsOpen] = useState(false);

  // Search & Inputs
  const [prodSearch, setProdSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState<number | ''>('');
  const [prodResultsOpen, setProdResultsOpen] = useState(false);

  // Category Quick Filter Chips
  const [posCategory, setPosCategory] = useState('');
  const [posInstitution, setPosInstitution] = useState('');
  const [posGrade, setPosGrade] = useState('');

  // Category Discount Drawer / Config
  const [catDiscountOpen, setCatDiscountOpen] = useState(false);
  const [selectedCatForDiscount, setSelectedCatForDiscount] = useState<string>('كتب خارجية');
  const [catDiscountVal, setCatDiscountVal] = useState<number>(10);
  const [catDiscountType, setCatDiscountType] = useState<'percent' | 'amount'>('percent');

  // General Discount & Payment
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'vodafone_cash' | 'credit'>('cash');
  const [paidAmountInput, setPaidAmountInput] = useState<number>(0);
  const [usePoints, setUsePoints] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  // Approval Workflow State for High Discounts (> 10% or > 50 EGP)
  const [adminPinModalOpen, setAdminPinModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [isDiscountApproved, setIsDiscountApproved] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState<boolean | null>(null);

  // Copying Tariff
  const [copyTariffId, setCopyTariffId] = useState('');
  const [copyPages, setCopyPages] = useState(1);
  const [copyPrice, setCopyPrice] = useState(1);

  // Invoices Archive & Recall State
  const [recallArchiveOpen, setRecallArchiveOpen] = useState(false);
  const [recallSearchQ, setRecallSearchQ] = useState('');
  const [recallDateFilter, setRecallDateFilter] = useState<'today' | '7days' | 'month' | 'all'>('today');
  const [recallPayFilter, setRecallPayFilter] = useState<string>('all');

  const filteredRecallInvoices = (db.invoices || [])
    .filter(inv => {
      const q = recallSearchQ.trim().toLowerCase();
      if (q) {
        const match = `#${inv.number} ${inv.number} ${inv.customerName || ''} ${inv.customerPhone || ''} ${inv.date || ''}`
          .toLowerCase()
          .includes(q);
        if (!match) return false;
      }

      if (recallPayFilter !== 'all' && inv.paymentMethod !== recallPayFilter) {
        return false;
      }

      const today = todayStr();
      if (recallDateFilter === 'today') {
        return inv.date === today;
      } else if (recallDateFilter === '7days') {
        const d7 = new Date();
        d7.setDate(d7.getDate() - 7);
        const d7Str = d7.toISOString().slice(0, 10);
        return inv.date >= d7Str;
      } else if (recallDateFilter === 'month') {
        const mStr = today.slice(0, 7);
        return inv.date.startsWith(mStr);
      }
      return true;
    })
    .slice()
    .reverse();

  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus barcode on load
  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeInput.trim();
      if (code) {
        processInvoiceBarcode(code, 'scanner');
        setBarcodeInput('');
        setTimeout(() => barcodeRef.current?.focus(), 0);
      }
    }
  };

  // Filter Categories & Institutions
  const categoriesList = Array.from(
    new Set([...CATEGORIES, ...(db.products || []).map(p => p.category)])
  ).filter(Boolean);

  const institutions = posCategory
    ? Array.from(
        new Set(
          (db.products || [])
            .filter(p => p.category === posCategory && p.institution)
            .map(p => p.institution!)
        )
      ).sort()
    : [];

  const quickFilteredProducts = (db.products || []).filter(p => {
    if (posCategory && p.category !== posCategory) return false;
    if (posInstitution && p.institution !== posInstitution) return false;
    if (posGrade && p.grade !== posGrade) return false;
    return true;
  });

  // Autocomplete matching
  const matchingProducts = prodSearch.trim()
    ? (db.products || [])
        .filter(p =>
          `${productFullName(p)} ${p.barcode || ''} ${p.category}`
            .toLowerCase()
            .includes(prodSearch.trim().toLowerCase())
        )
        .slice(0, 8)
    : [];

  const matchingCustomers = custSearch.trim()
    ? (db.customers || [])
        .filter(c => `${c.name} ${c.phone || ''}`.toLowerCase().includes(custSearch.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  const selectCustomer = (c: any) => {
    setSelectedCustomerId(c.id);
    setCustSearch(`${c.name} ${c.phone ? ' - ' + c.phone : ''}`);
    setCustomerName(c.name);
    setCustomerPhone(c.phone || '');
    setCustomerAddress(c.address || '');
    setCustResultsOpen(false);
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomerId(null);
    setCustSearch('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
  };

  const selectProduct = (p: any) => {
    setSelectedProductId(p.id);
    setProdSearch(productLabel(p));
    setItemPrice(p.sellPrice);
    setItemQty(1);
    setProdResultsOpen(false);
  };

  const handleManualAddProduct = () => {
    if (!selectedProductId) {
      toast('اختر صنفاً من نتائج البحث أولاً');
      return;
    }
    const p = (db.products || []).find(x => x.id === selectedProductId);
    if (!p) return;

    const price = typeof itemPrice === 'number' ? itemPrice : p.sellPrice;
    const added = addSaleItemByProduct(p.id, itemQty);
    if (added) {
      if (typeof itemPrice === 'number' && itemPrice !== p.sellPrice) {
        setSaleCartItems(prev => {
          const next = [...prev];
          const lastIdx = next.findIndex(x => x.productId === p.id);
          if (lastIdx >= 0) {
            next[lastIdx] = { ...next[lastIdx], price, manualOverride: true };
          }
          return next;
        });
      }
      setSelectedProductId(null);
      setProdSearch('');
      setItemQty(1);
      setItemPrice('');
      barcodeRef.current?.focus();
    }
  };

  const handleAddCopyService = () => {
    if (copyPages <= 0 || copyPrice <= 0) {
      toast('أدخل بيانات خدمة صحيحة');
      return;
    }
    let desc = 'خدمة تصوير / طباعة';
    let cost = 0;
    if (copyTariffId) {
      const t = (db.printingTariffs || []).find(x => x.id === copyTariffId);
      if (t) {
        desc = t.title;
        cost = t.cost;
      }
    }

    setSaleCartItems(prev => [
      ...prev,
      {
        productId: null,
        name: desc,
        qty: copyPages,
        price: copyPrice,
        originalPrice: copyPrice,
        cost,
        term: ''
      }
    ]);
    toast(`تمت إضافة ${desc} × ${copyPages}`);
  };

  const getItemCategory = (it: any) => {
    if (!it.productId) return 'خدمات';
    const p = (db.products || []).find(x => x.id === it.productId);
    return p?.category || 'أخرى';
  };

  // Apply Category Discounts
  const cartWithDiscounts = saleCartItems.map(it => {
    if (it.manualOverride) return it;
    const cat = getItemCategory(it);
    const rule = saleCategoryDiscounts[cat];
    const orig = it.originalPrice ?? it.price;
    if (rule && rule.value > 0) {
      const computed = rule.type === 'percent' ? orig * (1 - rule.value / 100) : orig - rule.value;
      return { ...it, price: Math.max(0, Math.round(computed * 100) / 100) };
    }
    return { ...it, price: orig };
  });

  const categoryDiscountBreakdown: Record<string, number> = {};
  cartWithDiscounts.forEach(it => {
    const diff = it.qty * ((it.originalPrice ?? it.price) - it.price);
    if (diff > 0.001) {
      const cat = getItemCategory(it);
      categoryDiscountBreakdown[cat] = (categoryDiscountBreakdown[cat] || 0) + diff;
    }
  });
  const totalCatDiscountSum = Object.values(categoryDiscountBreakdown).reduce((s, v) => s + v, 0);

  const selectedCustObj = (db.customers || []).find(x => x.id === selectedCustomerId);
  const custPrevBalance = selectedCustObj?.balance
    ? (Number(selectedCustObj.balance.invoiced) || 0) - (Number(selectedCustObj.balance.paid) || 0)
    : 0;

  const loyaltyBalance = selectedCustObj?.loyaltyPoints || 0;

  const preCalc = calculateSale({
    items: cartWithDiscounts,
    discountType,
    discountValue,
    usedPoints: 0
  });
  const afterDiscount = preCalc.subtotal - preCalc.generalDiscount;
  const sanitizedUsedPoints = Math.min(usePoints, loyaltyBalance, afterDiscount);

  // Centralized Financial Engine Calculation
  const financialResult = calculateSale({
    items: cartWithDiscounts,
    discountType,
    discountValue,
    usedPoints: sanitizedUsedPoints
  });

  const originalSubtotal = financialResult.originalSubtotal;
  const subtotal = financialResult.subtotal;
  const generalDiscount = financialResult.generalDiscount;
  const netTotal = financialResult.netSales;
  const earnedPoints = Math.floor(netTotal / 10);
  const totalAllDiscounts = totalCatDiscountSum + generalDiscount + financialResult.usedPoints;

  const dueAmount = paymentMethod === 'credit' ? Math.max(0, netTotal - paidAmountInput) : 0;
  const changeAmount = paymentMethod === 'cash' ? Math.max(0, paidAmountInput - netTotal) : 0;

  // Real-time Dual-Display Sync to Customer Facing Screen
  useEffect(() => {
    const payload: CustomerDisplayPayload = {
      items: cartWithDiscounts.map(it => ({
        name: it.name,
        qty: it.qty,
        price: it.price,
        total: it.qty * it.price
      })),
      subtotal,
      discount: totalAllDiscounts,
      total: netTotal,
      receivedAmount: paidAmountInput > 0 ? paidAmountInput : undefined,
      changeAmount: changeAmount > 0 ? changeAmount : undefined,
      customerName: customerName.trim() || undefined,
      loyaltyPoints: loyaltyBalance,
      lastScanned:
        cartWithDiscounts.length > 0
          ? {
              name: cartWithDiscounts[cartWithDiscounts.length - 1].name,
              qty: cartWithDiscounts[cartWithDiscounts.length - 1].qty,
              price: cartWithDiscounts[cartWithDiscounts.length - 1].price,
              total:
                cartWithDiscounts[cartWithDiscounts.length - 1].qty *
                cartWithDiscounts[cartWithDiscounts.length - 1].price
            }
          : null,
      status: saleCartItems.length === 0 ? 'idle' : 'scanning'
    };

    try {
      localStorage.setItem(CUSTOMER_DISPLAY_CHANNEL, JSON.stringify(payload));
      const channel = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    } catch {}
  }, [
    saleCartItems,
    cartWithDiscounts,
    subtotal,
    totalAllDiscounts,
    netTotal,
    paidAmountInput,
    changeAmount,
    customerName,
    loyaltyBalance
  ]);

  // Add / Apply Category Discount
  const handleApplyCategoryDiscount = (cat: string, val: number, type: 'percent' | 'amount') => {
    if (val <= 0) {
      setSaleCategoryDiscounts(prev => {
        const next = { ...prev };
        delete next[cat];
        return next;
      });
      toast(`تم إلغاء خصم قسم "${cat}"`);
    } else {
      setSaleCategoryDiscounts(prev => ({
        ...prev,
        [cat]: { type, value: val }
      }));
      toast(`✅ تم تطبيق خصم ${val}${type === 'percent' ? '%' : ' ج'} على قسم "${cat}"`);
    }
  };

  // Check if general discount exceeds cashier threshold
  const isHighDiscount =
    (discountType === 'percent' && discountValue > 10) ||
    (discountType === 'amount' && discountValue > 50) ||
    totalCatDiscountSum > 100;

  // Invoice Save Transaction
  const handleSaveInvoice = async (isReceipt = false, forceApproved = false) => {
    if (!saleCartItems.length) {
      toast('أضف أصنافاً للفاتورة أولاً');
      return;
    }

    if (paymentMethod === 'credit' && !selectedCustomerId && !customerName.trim()) {
      toast('البيع بالآجل يتطلب إدخال أو اختيار عميل');
      return;
    }

    if (
      isHighDiscount &&
      !isDiscountApproved &&
      !forceApproved &&
      currentProfile?.role !== 'admin' &&
      !currentProfile?.permissions?.allowDiscountOverride
    ) {
      setPendingSaveAction(isReceipt);
      setAdminPinModalOpen(true);
      return;
    }

    const stockValidation = validateCartStock(cartWithDiscounts, db.products);
    if (!stockValidation.valid) {
      toast(stockValidation.error || 'المخزون غير كافٍ');
      return;
    }

    setSaving(true);
    const invoiceId = uid();
    const opId = 'op_' + invoiceId;
    const actor = auditActor();

    try {
      const counterRef = fsdb.collection('meta').doc('counters');
      const opRef = fsdb.collection('operationKeys').doc(opId);
      const invoiceRef = fsdb.collection('invoices').doc(invoiceId);

      let finalCustId = selectedCustomerId;
      const newCustId = !selectedCustomerId && customerName.trim() ? uid() : null;
      if (newCustId) finalCustId = newCustId;

      const customerRef = finalCustId ? fsdb.collection('customers').doc(finalCustId) : null;
      const physicalDeductions = expandItemsToPhysicalDeductions(cartWithDiscounts, db.products);

      const allProductIdsToTouch = Array.from(
        new Set([
          ...physicalDeductions.map(d => d.productId),
          ...saleCartItems.filter(it => it.productId).map(it => it.productId!)
        ])
      );
      const productRefs = allProductIdsToTouch.map(id => fsdb.collection('products').doc(id));

      let savedInvoice: any = null;
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      const executeOfflineSave = () => {
        const number = OfflineSyncManager.getNextInvoiceNumber(db.invoices);
        const paid = paymentMethod === 'credit' ? Math.min(netTotal, paidAmountInput) : netTotal;

        let customerPreviousBal = 0;
        let customerNewBal = 0;
        let customerPreviousPoints = 0;
        let customerNewPoints = 0;

        const currentCust = (db.customers || []).find(c => c.id === finalCustId);
        if (currentCust) {
          const currentBal = currentCust.balance || { invoiced: 0, paid: 0 };
          customerPreviousBal = (Number(currentBal.invoiced) || 0) - (Number(currentBal.paid) || 0);
          const newInvoiced = (Number(currentBal.invoiced) || 0) + netTotal;
          const newPaid = (Number(currentBal.paid) || 0) + paid;
          customerNewBal = newInvoiced - newPaid;
          customerPreviousPoints = Number(currentCust.loyaltyPoints) || 0;
          customerNewPoints = Math.max(0, customerPreviousPoints - sanitizedUsedPoints + earnedPoints);
        } else {
          customerNewBal = netTotal - paid;
          customerNewPoints = earnedPoints;
        }

        const stockDeductions: Array<{ productId: string; newQty: number; delta: number; name: string }> = [];
        const stockMovements: any[] = [];

        // Track running quantities per product for local state and movements
        const localRunningQtyTracker: Record<string, number> = {};
        for (const d of physicalDeductions) {
          if (localRunningQtyTracker[d.productId] === undefined) {
            const prod = (db.products || []).find(p => p.id === d.productId);
            localRunningQtyTracker[d.productId] = prod ? Number(prod.qty) || 0 : 0;
          }
        }

        for (let idx = 0; idx < physicalDeductions.length; idx++) {
          const d = physicalDeductions[idx];
          const prod = (db.products || []).find(p => p.id === d.productId);
          const oldQty = localRunningQtyTracker[d.productId];
          const newQty = oldQty - d.qty;
          localRunningQtyTracker[d.productId] = newQty;

          stockDeductions.push({
            productId: d.productId,
            newQty,
            delta: -d.qty,
            name: d.name
          });

          const mid = `sm_${opId}_${d.productId}_${idx}`;
          const movementNote =
            d.isBundleComponent && d.bundleName
              ? `مكون في باقة مباعة: ${d.bundleName} (أوفلاين)`
              : 'بيع — نقطة البيع POS (أوفلاين)';

          stockMovements.push({
            id: mid,
            date: todayStr(),
            createdAt: new Date().toISOString(),
            type: 'sale',
            productId: d.productId,
            productName: d.name,
            barcode: prod?.barcode || '',
            qtyBefore: oldQty,
            delta: -d.qty,
            qtyAfter: newQty,
            referenceId: invoiceId,
            referenceNumber: number,
            note: movementNote,
            actorUid: actor.uid,
            createdBy: actor.uid
          });
        }

        const costSum = financialResult.costOfGoodsSold;
        const profit = financialResult.grossProfit;

        const offlineInv: any = {
          id: invoiceId,
          number,
          date: todayStr(),
          status: 'paid',
          customerId: finalCustId,
          customerName: customerName.trim() || 'عميل نقدي',
          customerPhone: customerPhone.trim(),
          customerAddress: customerAddress.trim(),
          customerCode: finalCustId ? `#${finalCustId.slice(-6).toUpperCase()}` : 'نقدي',
          previousBalance: customerPreviousBal,
          newBalance: customerNewBal,
          previousPoints: customerPreviousPoints,
          newPoints: customerNewPoints,
          items: cartWithDiscounts.map(it => ({
            productId: it.productId,
            name: it.name,
            qty: it.qty,
            originalPrice: it.originalPrice ?? it.price,
            price: it.price,
            cost: it.cost || 0,
            term: it.term || '',
            category: getItemCategory(it)
          })),
          originalSubtotal,
          categoryDiscounts: categoryDiscountBreakdown,
          totalCatDiscount: totalCatDiscountSum,
          subtotal,
          discountType,
          discountValue,
          discount: generalDiscount,
          totalDiscount: totalAllDiscounts,
          paymentMethod,
          usedPoints: sanitizedUsedPoints,
          earnedPoints,
          total: netTotal,
          paidAmount: paid,
          dueAmount: netTotal - paid,
          changeAmount,
          profit,
          operationId: opId,
          actorUid: actor.uid,
          createdBy: actor.uid,
          createdAt: new Date().toISOString(),
          isOfflineDraft: true
        };

        OfflineSyncManager.enqueueInvoice({
          opId,
          invoice: offlineInv,
          stockDeductions,
          customerUpdate: finalCustId
            ? {
                customerId: finalCustId,
                balance: { invoiced: customerPreviousBal + netTotal, paid: paid },
                loyaltyPoints: customerNewPoints
              }
            : undefined,
          stockMovements
        });

        // Offline mode: Pure local state and queue persistence only.
        // No partial, non-atomic Firestore fire-and-forget writes from offline save.
        // The cloud sync will be executed atomically via OfflineSyncManager.syncSingleOperation.

        // Aggregate total deduction per productId for local products state update
        const totalLocalDeductionByProduct: Record<string, number> = {};
        for (const d of physicalDeductions) {
          totalLocalDeductionByProduct[d.productId] = (totalLocalDeductionByProduct[d.productId] || 0) + d.qty;
        }

        setDb(prev => {
          const updatedProducts = prev.products.map(p => {
            const totalDeducted = totalLocalDeductionByProduct[p.id];
            return totalDeducted !== undefined
              ? { ...p, qty: (Number(p.qty) || 0) - totalDeducted }
              : p;
          });

          let updatedCustomers = prev.customers;
          if (finalCustId) {
            const custIdx = prev.customers.findIndex(c => c.id === finalCustId);
            if (custIdx >= 0) {
              updatedCustomers = [...prev.customers];
              updatedCustomers[custIdx] = {
                ...updatedCustomers[custIdx],
                balance: {
                  invoiced: (Number(updatedCustomers[custIdx].balance?.invoiced) || 0) + netTotal,
                  paid: (Number(updatedCustomers[custIdx].balance?.paid) || 0) + paid,
                  updatedAt: new Date().toISOString()
                },
                loyaltyPoints: customerNewPoints
              };
            }
          }

          return {
            ...prev,
            invoices: [offlineInv, ...(prev.invoices || [])],
            products: updatedProducts,
            customers: updatedCustomers,
            stockMovements: [...stockMovements, ...(prev.stockMovements || [])]
          };
        });

        return offlineInv;
      };

      if (!isOnline) {
        savedInvoice = executeOfflineSave();
        toast(`💾 تم حفظ الفاتورة #${savedInvoice.number} في وضع عدم الاتصال (ستتم المزامنة تلقائياً عند عودة النت)`);
      } else {
        try {
          await fsdb.runTransaction(async tx => {
            const reads = await Promise.all([
              tx.get(opRef),
              tx.get(counterRef),
              tx.get(invoiceRef),
              ...(customerRef ? [tx.get(customerRef)] : []),
              ...productRefs.map(ref => tx.get(ref))
            ]);

            const opSnap = reads[0];
            const counterSnap = reads[1];
            const invSnap = reads[2];

            // Case 1: opSnap exists -> transaction was already committed. Exit immediately.
            if (opSnap.exists) {
              return;
            }

            // Check if invoice doc exists without opSnap (Cases 3, 4, 5)
            if (invSnap.exists) {
              const existingInvData = (invSnap.data() || {}) as any;
              const existingOpId = existingInvData.operationId;
              if (existingOpId && existingOpId === opId) {
                throw new Error('تعارض في حفظ الفاتورة: الفاتورة موجودة مسبقاً ولكن لم يكتمل تسجيل العملية السابقة');
              } else if (existingOpId && existingOpId !== opId) {
                throw new Error('تعارض أمني: معرف الفاتورة مسجل لعملية بيع أخرى');
              } else {
                throw new Error('فاتورة سابقة بدون معرف عملية (Legacy): تتطلب مراجعة يدوية');
              }
            }

            const counterData = counterSnap.exists ? counterSnap.data() || {} : {};
            const number = (Number(counterData.invoice) || 0) + 1;

            const customerSnap = customerRef ? reads[3] : null;
            const productSnaps = reads.slice(customerRef ? 4 : 3);
            const stockMap: Record<string, any> = {};
            productRefs.forEach((ref, idx) => {
              stockMap[ref.id] = productSnaps[idx];
            });

            for (const d of physicalDeductions) {
              const snap = stockMap[d.productId];
              if (!snap || !snap.exists) throw new Error(`الصنف غير موجود: ${d.name}`);
              const currentQty = Number(snap.data().qty) || 0;
              if (currentQty < d.qty) {
                throw new Error(`الكمية غير كافية للصنف: ${d.name} (المتاح: ${currentQty} فقط)`);
              }
            }

            const paid = paymentMethod === 'credit' ? Math.min(netTotal, paidAmountInput) : netTotal;

            let customerPreviousBal = 0;
            let customerNewBal = 0;
            let customerPreviousPoints = 0;
            let customerNewPoints = 0;

            if (customerRef && customerSnap && customerSnap.exists) {
              const custData = customerSnap.data() || {};
              const currentBal = custData.balance || { invoiced: 0, paid: 0 };
              customerPreviousBal = (Number(currentBal.invoiced) || 0) - (Number(currentBal.paid) || 0);
              const newInvoiced = (Number(currentBal.invoiced) || 0) + netTotal;
              const newPaid = (Number(currentBal.paid) || 0) + paid;
              customerNewBal = newInvoiced - newPaid;
              customerPreviousPoints = Number(custData.loyaltyPoints) || 0;
              customerNewPoints = Math.max(0, customerPreviousPoints - sanitizedUsedPoints + earnedPoints);

              tx.set(
                customerRef,
                {
                  balance: {
                    invoiced: newInvoiced,
                    paid: newPaid,
                    updatedAt: new Date().toISOString()
                  },
                  loyaltyPoints: customerNewPoints,
                  lastTransactionDate: todayStr(),
                  name: customerName.trim() || custData.name,
                  phone: customerPhone.trim() || custData.phone || '',
                  address: customerAddress.trim() || custData.address || ''
                },
                { merge: true }
              );
            } else if (customerRef) {
              customerNewBal = netTotal - paid;
              customerNewPoints = earnedPoints;
              tx.set(customerRef, {
                id: finalCustId,
                name: customerName.trim() || 'عميل نقدي',
                phone: customerPhone.trim(),
                address: customerAddress.trim(),
                createdAt: new Date().toISOString(),
                balance: {
                  invoiced: netTotal,
                  paid,
                  updatedAt: new Date().toISOString()
                },
                loyaltyPoints: earnedPoints,
                lastTransactionDate: todayStr()
              });
            }

            physicalDeductions.forEach((d, idx) => {
              const snap = stockMap[d.productId];
              const oldQty = Number(snap.data().qty) || 0;
              const newQty = oldQty - d.qty;
              const pRef = fsdb.collection('products').doc(d.productId);
              tx.update(pRef, { qty: newQty });

              const mid = `sm_${opId}_${d.productId}_${idx}`;
              const movementRef = fsdb.collection('stockMovements').doc(mid);
              const movementNote =
                d.isBundleComponent && d.bundleName
                  ? `مكون في باقة مباعة: ${d.bundleName}`
                  : 'بيع — نقطة البيع POS';

              tx.set(movementRef, {
                id: mid,
                date: todayStr(),
                createdAt: new Date().toISOString(),
                type: 'sale',
                productId: d.productId,
                productName: d.name,
                barcode: snap.data().barcode || '',
                qtyBefore: oldQty,
                delta: -d.qty,
                qtyAfter: newQty,
                referenceId: invoiceId,
                referenceNumber: number,
                note: movementNote,
                actorUid: actor.uid,
                createdBy: actor.uid
              });
            });

            const costSum = financialResult.costOfGoodsSold;
            const profit = financialResult.grossProfit;

            savedInvoice = {
              id: invoiceId,
              number,
              date: todayStr(),
              status: 'paid',
              customerId: finalCustId,
              customerName: customerName.trim() || 'عميل نقدي',
              customerPhone: customerPhone.trim(),
              customerAddress: customerAddress.trim(),
              customerCode: finalCustId ? `#${finalCustId.slice(-6).toUpperCase()}` : 'نقدي',
              previousBalance: customerPreviousBal,
              newBalance: customerNewBal,
              previousPoints: customerPreviousPoints,
              newPoints: customerNewPoints,
              items: cartWithDiscounts.map(it => ({
                productId: it.productId,
                name: it.name,
                qty: it.qty,
                originalPrice: it.originalPrice ?? it.price,
                price: it.price,
                cost: it.cost || 0,
                term: it.term || '',
                category: getItemCategory(it)
              })),
              originalSubtotal,
              categoryDiscounts: categoryDiscountBreakdown,
              totalCatDiscount: totalCatDiscountSum,
              subtotal,
              discountType,
              discountValue,
              discount: generalDiscount,
              totalDiscount: totalAllDiscounts,
              paymentMethod,
              usedPoints: sanitizedUsedPoints,
              earnedPoints,
              total: netTotal,
              paidAmount: paid,
              dueAmount: netTotal - paid,
              changeAmount,
              profit,
              operationId: opId,
              actorUid: actor.uid,
              createdBy: actor.uid,
              createdAt: new Date().toISOString()
            };

            tx.set(counterRef, { invoice: number }, { merge: true });
            tx.set(invoiceRef, savedInvoice);
            tx.set(opRef, {
              id: opId,
              type: 'sale',
              targetId: invoiceId,
              number,
              date: todayStr(),
              createdAt: new Date().toISOString(),
              actorUid: actor.uid,
              createdBy: actor.uid
            });
          });

          toast(`✅ تم حفظ الفاتورة رقم #${savedInvoice.number} بنجاح`);
        } catch (onlineErr: any) {
          // Strict error differentiation:
          // ONLY reliable transient/network errors qualify for offline queue fallback.
          // Business logic rejections (insufficient stock, invalid product, permission denied) MUST NOT fall back to offline.
          if (isNetworkOrTransientError(onlineErr)) {
            console.warn('Online transaction failed due to network/transient error, executing offline fallback:', onlineErr);
            savedInvoice = executeOfflineSave();
            toast(`💾 تم حفظ الفاتورة #${savedInvoice.number} محلياً في وضع عدم الاتصال (ستتم المزامنة لاحقاً)`);
          } else {
            console.error('Online transaction rejected due to business logic or validation error:', onlineErr);
            throw onlineErr;
          }
        }
      }
      clearSaleCart();
      setDiscountValue(0);
      setPaidAmountInput(0);
      setUsePoints(0);
      clearSelectedCustomer();

      if (isReceipt) {
        showReceiptPrint(savedInvoice);
      } else {
        showA4Print(savedInvoice);
      }
    } catch (err: any) {
      console.error('Invoice save failed:', err);
      toast(`⚠️ تعذر حفظ الفاتورة: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const showA4Print = (inv: any) => {
    const cashierName = currentProfile?.name || 'المدير المسؤول';
    const bodyHtml = generateA4SaleInvoiceHtml({
      invoice: inv,
      cashierName
    });

    showPrintModal({
      bodyHtml,
      phone: inv.customerPhone,
      filename: `فاتورة_رقم_${inv.number}.pdf`,
      waMessage: generateWhatsAppReceiptMessage(inv, cashierName)
    });
  };

  const showReceiptPrint = (inv: any) => {
    const cashierName = currentProfile?.name || 'كاشير';
    const bodyHtml = generateThermalReceiptHtml({
      invoice: inv,
      cashierName
    });

    showPrintModal({
      bodyHtml,
      phone: inv.customerPhone,
      filename: `إيصال_رقم_${inv.number}.pdf`,
      waMessage: generateWhatsAppReceiptMessage(inv, cashierName)
    });
  };

  const handleDownloadInvoicePdf = async (inv: any) => {
    try {
      toast('⏳ جاري إنشاء وتحميل ملف PDF الفاتورة...');
      const cashierName = currentProfile?.name || 'المدير المسؤول';
      const bodyHtml = generateA4SaleInvoiceHtml({
        invoice: inv,
        cashierName
      });

      await exportElementToPdf({
        html: bodyHtml,
        filename: `فاتورة_مبيعات_رقم_${inv.number}.pdf`,
        isThermal: false
      });

      toast(`✅ تم تنزيل ملف (فاتورة_مبيعات_رقم_${inv.number}.pdf) بنجاح`);
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      toast('❌ حدث خطأ أثناء إنشاء ملف PDF');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top POS Action Toolbar & Invoices Recall Button */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRecallArchiveOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
            title="استدعاء فواتير البيع السابقة لإعادة الطباعة أو التكرار أو المرتجع"
          >
            <FolderOpen className="w-4 h-4" />
            <span>استدعاء وأرشيف الفواتير السابقة</span>
            <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full font-num">
              {(db.invoices || []).length}
            </span>
          </button>

          <span className="text-xs text-slate-500 hidden md:inline">
            (ابحث برقم الفاتورة أو العميل لإعادة الطباعة A4 أو إيصال كاشير)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              window.open('/?page=customerDisplay', '_blank', 'width=1024,height=768');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer border border-slate-300"
            title="فتح شاشة عرض الأسعار للعميل على شاشة ثانية مستقلة"
          >
            <Tv className="w-4 h-4 text-amber-600" />
            <span>شاشة العميل (Dual Screen)</span>
          </button>

          {saleCartItems.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('هل أنت متأكد من مسح سلة البيع الحالية؟')) {
                  clearSaleCart();
                }
              }}
              className="text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer"
            >
              مسح السلة ({saleCartItems.length})
            </button>
          )}
        </div>
      </div>

      {/* Top Customer Bar */}
      <PosCustomerBar
        custSearch={custSearch}
        setCustSearch={setCustSearch}
        custResultsOpen={custResultsOpen}
        setCustResultsOpen={setCustResultsOpen}
        matchingCustomers={matchingCustomers}
        selectCustomer={selectCustomer}
        clearSelectedCustomer={clearSelectedCustomer}
        selectedCustomerId={selectedCustomerId}
        customerName={customerName}
        setCustomerName={setCustomerName}
        customerPhone={customerPhone}
        setCustomerPhone={setCustomerPhone}
        customerAddress={customerAddress}
        setCustomerAddress={setCustomerAddress}
        selectedCustObj={selectedCustObj}
        custPrevBalance={custPrevBalance}
        loyaltyBalance={loyaltyBalance}
      />

      {/* Main POS Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Product Search, Quick Pickers & Category Discounts (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <PosProductInputBar
            barcodeRef={barcodeRef}
            barcodeInput={barcodeInput}
            setBarcodeInput={setBarcodeInput}
            handleBarcodeKeyDown={handleBarcodeKeyDown}
            openScanModal={openScanModal}
            searchRef={searchRef}
            prodSearch={prodSearch}
            setProdSearch={setProdSearch}
            prodResultsOpen={prodResultsOpen}
            setProdResultsOpen={setProdResultsOpen}
            matchingProducts={matchingProducts}
            selectProduct={selectProduct}
            itemQty={itemQty}
            setItemQty={setItemQty}
            itemPrice={itemPrice}
            setItemPrice={setItemPrice}
            handleManualAddProduct={handleManualAddProduct}
            openQuickAdd={openQuickAdd}
          />

          <PosQuickCategoryBar
            catDiscountOpen={catDiscountOpen}
            setCatDiscountOpen={setCatDiscountOpen}
            saleCategoryDiscounts={saleCategoryDiscounts}
            categoriesList={categoriesList}
            selectedCatForDiscount={selectedCatForDiscount}
            setSelectedCatForDiscount={setSelectedCatForDiscount}
            catDiscountVal={catDiscountVal}
            setCatDiscountVal={setCatDiscountVal}
            catDiscountType={catDiscountType}
            setCatDiscountType={setCatDiscountType}
            handleApplyCategoryDiscount={handleApplyCategoryDiscount}
            posCategory={posCategory}
            setPosCategory={setPosCategory}
            posInstitution={posInstitution}
            setPosInstitution={setPosInstitution}
            posGrade={posGrade}
            setPosGrade={setPosGrade}
            institutions={institutions}
            quickFilteredProducts={quickFilteredProducts}
            addSaleItemByProduct={addSaleItemByProduct}
            copyTariffId={copyTariffId}
            setCopyTariffId={setCopyTariffId}
            copyPages={copyPages}
            setCopyPages={setCopyPages}
            copyPrice={copyPrice}
            setCopyPrice={setCopyPrice}
            handleAddCopyService={handleAddCopyService}
            printingTariffs={db.printingTariffs || []}
          />
        </div>

        {/* Right Column: Invoice Cart & Checkout Summary (5 Cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-16">
          <PosCartTable
            saleCartItems={saleCartItems}
            setSaleCartItems={setSaleCartItems}
            cartWithDiscounts={cartWithDiscounts}
          />

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-md">
            <PosCheckoutPanel
              discountValue={discountValue}
              setDiscountValue={setDiscountValue}
              discountType={discountType}
              setDiscountType={setDiscountType}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              loyaltyBalance={loyaltyBalance}
              usePoints={usePoints}
              setUsePoints={setUsePoints}
              paidAmountInput={paidAmountInput}
              setPaidAmountInput={setPaidAmountInput}
              originalSubtotal={originalSubtotal}
              categoryDiscountBreakdown={categoryDiscountBreakdown}
              generalDiscount={generalDiscount}
              sanitizedUsedPoints={sanitizedUsedPoints}
              totalAllDiscounts={totalAllDiscounts}
              netTotal={netTotal}
              changeAmount={changeAmount}
              dueAmount={dueAmount}
              saving={saving}
              cartLength={saleCartItems.length}
              handleSaveInvoice={handleSaveInvoice}
              clearSaleCart={clearSaleCart}
            />
          </div>
        </div>
      </div>

      {/* Admin / Supervisor Approval Modal */}
      <PosAdminPinModal
        adminPinModalOpen={adminPinModalOpen}
        setAdminPinModalOpen={setAdminPinModalOpen}
        adminPinInput={adminPinInput}
        setAdminPinInput={setAdminPinInput}
        totalAllDiscounts={totalAllDiscounts}
        netTotal={netTotal}
        userProfiles={db.userProfiles || []}
        setIsDiscountApproved={setIsDiscountApproved}
        toast={toast}
        pendingSaveAction={pendingSaveAction}
        setPendingSaveAction={setPendingSaveAction}
        handleSaveInvoice={handleSaveInvoice}
      />

      {/* 📂 Invoices Archive & Recall Modal */}
      <PosInvoiceArchiveModal
        recallArchiveOpen={recallArchiveOpen}
        setRecallArchiveOpen={setRecallArchiveOpen}
        filteredRecallInvoices={filteredRecallInvoices}
        totalInvoicesCount={(db.invoices || []).length}
        recallSearchQ={recallSearchQ}
        setRecallSearchQ={setRecallSearchQ}
        recallDateFilter={recallDateFilter}
        setRecallDateFilter={setRecallDateFilter}
        recallPayFilter={recallPayFilter}
        setRecallPayFilter={setRecallPayFilter}
        openInvoiceModal={openInvoiceModal}
        handleDownloadInvoicePdf={handleDownloadInvoicePdf}
        showA4Print={showA4Print}
        showReceiptPrint={showReceiptPrint}
        reorderInvoiceToCart={reorderInvoiceToCart}
        setReturnInvoice={setReturnInvoice}
        goTo={goTo}
      />
    </div>
  );
};
