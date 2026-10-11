import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fsdb, auditActor } from '../lib/firebase';
import {
  fmt,
  todayStr,
  uid,
  productFullName,
  stockMovementId
} from '../lib/utils';
import { generateBarcodeLabelHtml, generatePurchaseOrderHtml } from '../lib/invoiceTemplates';

import { InventoryAddProductForm } from './inventory/InventoryAddProductForm';
import { InventoryKpiFiltersBar } from './inventory/InventoryKpiFiltersBar';
import { InventoryTreeView } from './inventory/InventoryTreeView';
import { InventoryBatchTableView } from './inventory/InventoryBatchTableView';
import { InventoryReorderView } from './inventory/InventoryReorderView';
import { EgyptianCatalogModal } from './inventory/EgyptianCatalogModal';

export const InventoryPage: React.FC = () => {
  const { db, currentProfile, hasPerm, isAdmin, showPrintModal, setPurchaseCartItems, goTo, toast } = useApp();

  // View mode
  const [viewMode, setViewMode] = useState<'tree' | 'table' | 'reorder'>('tree');
  const [isEgyptianCatalogOpen, setIsEgyptianCatalogOpen] = useState(false);

  // Filters
  const [filterQ, setFilterQ] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'zero'>('all');

  // Add Product Form State
  const [newName, setNewName] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newCategory, setNewCategory] = useState('أدوات مكتبية');
  const [newInstitution, setNewInstitution] = useState('');
  const [newGrade, setNewGrade] = useState('بدون تحديد');
  const [newTerm, setNewTerm] = useState('غير محدد');
  const [newUnit] = useState('قطعة');
  const [newCost, setNewCost] = useState<number>(0);
  const [newSell, setNewSell] = useState<number>(0);
  const [newQty, setNewQty] = useState<number>(0);
  const [newMinQty, setNewMinQty] = useState<number>(5);
  const [newMaxQty, setNewMaxQty] = useState<number>(25);

  // Batch edits state (Product ID -> new value)
  const [costEdits, setCostEdits] = useState<Record<string, number>>({});
  const [sellEdits, setSellEdits] = useState<Record<string, number>>({});
  const [qtyEdits, setQtyEdits] = useState<Record<string, number>>({});
  const [minQtyEdits, setMinQtyEdits] = useState<Record<string, number>>({});
  const [maxQtyEdits, setMaxQtyEdits] = useState<Record<string, number>>({});

  // Auto Reorder State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [customReorderQtys, setCustomReorderQtys] = useState<Record<string, number>>({});
  const [poNotes, setPoNotes] = useState<string>('');

  const canSeeCost = isAdmin || hasPerm('viewCostPrice') || currentProfile?.role === 'manager';

  const stockState = (p: any) => {
    const q = p.qty || 0;
    const min = p.minQty || 5;
    if (q <= 0) return 'zero';
    if (q <= min) return 'low';
    return 'normal';
  };

  const filteredProducts = (db.products || []).filter(p => {
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterGrade && p.grade !== filterGrade) return false;
    const st = stockState(p);
    if (filterStatus === 'low' && st !== 'low') return false;
    if (filterStatus === 'zero' && st !== 'zero') return false;
    if (filterQ.trim()) {
      const q = filterQ.trim().toLowerCase();
      const match = `${p.name} ${p.barcode || ''} ${p.institution || ''} ${p.grade || ''}`
        .toLowerCase()
        .includes(q);
      if (!match) return false;
    }
    return true;
  });

  const lowCount = (db.products || []).filter(p => stockState(p) === 'low').length;
  const zeroCount = (db.products || []).filter(p => stockState(p) === 'zero').length;
  const totalCostValue = filteredProducts.reduce(
    (s, p) => s + (Number(p.qty) || 0) * (Number(p.costPrice) || 0),
    0
  );
  const totalUnitsCount = filteredProducts.reduce((s, p) => s + (Number(p.qty) || 0), 0);

  // Products needing reorder across all products
  const reorderProducts = (db.products || []).filter(p => (p.qty || 0) <= (p.minQty || 5));

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast('أدخل اسم الصنف');
      return;
    }

    const actor = auditActor();
    const product = {
      id: uid(),
      name: newName.trim(),
      category: newCategory,
      barcode: newBarcode.trim(),
      institution: newInstitution.trim(),
      grade: newGrade === 'بدون تحديد' ? '' : newGrade,
      term: newTerm === 'غير محدد' ? '' : newTerm,
      unit: newUnit.trim() || 'قطعة',
      costPrice: Number(newCost) || 0,
      sellPrice: Number(newSell) || 0,
      qty: Number(newQty) || 0,
      minQty: Number(newMinQty) || 5,
      maxQty: Number(newMaxQty) || 25,
      createdBy: actor.uid,
      actorUid: actor.uid,
      createdAt: new Date().toISOString()
    };

    try {
      await fsdb.collection('products').doc(product.id).set(product);
      toast(`تمت إضافة "${product.name}" بنجاح`);
      setNewName('');
      setNewBarcode('');
      setNewInstitution('');
      setNewCost(0);
      setNewSell(0);
      setNewQty(0);
    } catch (err: any) {
      toast(`خطأ أثناء إضافة الصنف: ${err.message}`);
    }
  };

  const handleAdjustQty = async (id: string, delta: number) => {
    const p = (db.products || []).find(x => x.id === id);
    if (!p) return;

    if (p.isBundle) {
      toast('رصيد الباقة يُحسب تلقائياً من كميات الأصناف المكونة لها في المخزن');
      return;
    }

    const operationId = uid();
    const productRef = fsdb.collection('products').doc(id);
    const moveRef = fsdb.collection('stockMovements').doc(stockMovementId(operationId, id, 'adjust'));
    const actor = auditActor();

    try {
      await fsdb.runTransaction(async tx => {
        const snap = await tx.get(productRef);
        if (!snap.exists) throw new Error('الصنف غير موجود');
        const before = Number(snap.data().qty) || 0;
        const after = Math.max(0, before + delta);

        tx.update(productRef, {
          qty: after,
          lastOperationId: operationId,
          lastOperationType: 'adjustment',
          lastOperationActorUid: actor.uid
        });

        tx.set(fsdb.collection('operationKeys').doc(operationId), {
          id: operationId,
          type: 'adjustment',
          targetId: id,
          createdAt: new Date().toISOString(),
          actorUid: actor.uid,
          createdBy: actor.uid
        });

        tx.set(moveRef, {
          id: moveRef.id,
          date: todayStr(),
          createdAt: new Date().toISOString(),
          type: 'adjustment',
          productId: id,
          productName: snap.data().name || p.name,
          barcode: snap.data().barcode || p.barcode || '',
          qtyBefore: before,
          delta: after - before,
          qtyAfter: after,
          referenceId: operationId,
          referenceNumber: '',
          note: 'تعديل يدوي سريع من شاشة المخزون',
          operationId,
          actorUid: actor.uid,
          createdBy: actor.uid
        });
      });
      toast(`تم تعديل الكمية لـ ${p.name}`);
    } catch (err: any) {
      toast(`خطأ: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('هل تريد حذف هذا الصنف نهائياً من المخزون؟')) return;
    try {
      await fsdb.collection('products').doc(id).delete();
      toast('تم حذف الصنف');
    } catch (err: any) {
      toast(`خطأ أثناء الحذف: ${err.message}`);
    }
  };

  const handlePrintBarcode = (p: any, copies: number = 2) => {
    const html = generateBarcodeLabelHtml({
      productName: productFullName(p),
      barcode: p.barcode || p.id,
      price: p.sellPrice || 0,
      copies,
      labelSize: '38x25'
    });
    showPrintModal({
      bodyHtml: html,
      filename: `استيكر_باركود_${p.barcode || p.name}.pdf`
    });
  };

  const handleSaveBatchEdits = async () => {
    const patches: Record<string, any> = {};
    Object.entries(costEdits).forEach(([id, costPrice]) => {
      patches[id] = { ...patches[id], costPrice };
    });
    Object.entries(sellEdits).forEach(([id, sellPrice]) => {
      patches[id] = { ...patches[id], sellPrice };
    });
    Object.entries(qtyEdits).forEach(([id, qty]) => {
      patches[id] = { ...patches[id], qty };
    });
    Object.entries(minQtyEdits).forEach(([id, minQty]) => {
      patches[id] = { ...patches[id], minQty };
    });
    Object.entries(maxQtyEdits).forEach(([id, maxQty]) => {
      patches[id] = { ...patches[id], maxQty };
    });

    const ids = Object.keys(patches);
    if (!ids.length) {
      toast('لا توجد تعديلات جديدة للحفظ');
      return;
    }

    try {
      const CHUNK = 200;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const batch = fsdb.batch();
        ids.slice(i, i + CHUNK).forEach(id => {
          batch.set(fsdb.collection('products').doc(id), patches[id], { merge: true });
        });
        await batch.commit();
      }
      setCostEdits({});
      setSellEdits({});
      setQtyEdits({});
      setMinQtyEdits({});
      setMaxQtyEdits({});
      toast(`تم حفظ التعديلات بنجاح (${ids.length} صنف)`);
    } catch (err: any) {
      toast(`خطأ أثناء حفظ التعديلات: ${err.message}`);
    }
  };

  // Reorder calculations
  const selectedSupplier = (db.suppliers || []).find(s => s.id === selectedSupplierId);

  const getSuggestedOrderQty = (p: any) => {
    if (customReorderQtys[p.id] !== undefined) return customReorderQtys[p.id];
    const target = p.maxQty && p.maxQty > (p.minQty || 5) ? p.maxQty : (p.minQty || 5) * 4;
    return Math.max(1, target - (p.qty || 0));
  };

  const reorderItemsData = reorderProducts.map(p => {
    const orderQty = getSuggestedOrderQty(p);
    const estCost = orderQty * (p.costPrice || 0);
    return {
      productId: p.id,
      productName: productFullName(p),
      category: p.category,
      unit: p.unit || 'قطعة',
      currentQty: p.qty || 0,
      minQty: p.minQty || 5,
      maxQty: p.maxQty || 25,
      suggestedQty: orderQty,
      costPrice: p.costPrice || 0,
      totalCost: estCost
    };
  });

  const totalReorderCost = reorderItemsData.reduce((s, it) => s + it.totalCost, 0);

  const handlePrintPurchaseOrder = () => {
    if (!reorderItemsData.length) {
      toast('لا توجد أصناف تحتاج لإعادة الطلب حالياً');
      return;
    }

    const poNumber = `PO-${todayStr().replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const html = generatePurchaseOrderHtml({
      poNumber,
      date: todayStr(),
      supplierName: selectedSupplier?.name || 'مورد عام',
      supplierPhone: selectedSupplier?.phone || '',
      items: reorderItemsData.map(it => {
        const p = (db.products || []).find(x => x.id === it.productId);
        return {
          name: it.productName,
          barcode: p?.barcode || '',
          currentQty: it.currentQty,
          orderQty: it.suggestedQty,
          estimatedCost: it.costPrice,
          unit: it.unit
        };
      }),
      totalEstimatedCost: totalReorderCost,
      notes: poNotes
    });

    showPrintModal({
      bodyHtml: html,
      filename: `أمر_شراء_${poNumber}.pdf`,
      phone: selectedSupplier?.phone,
      waMessage: `أمر شراء توريد بضائع رقم ${poNumber}\nالمورد: ${selectedSupplier?.name || 'العام'}\nعدد الأصناف: ${reorderItemsData.length}\nإجمالي التكلفة المقدرة: ${fmt(totalReorderCost)} ج`
    });
  };

  const handleConvertToPurchaseInvoice = () => {
    if (!reorderItemsData.length) {
      toast('لا توجد أصناف لنقلها إلى فاتورة المشتريات');
      return;
    }

    const purchaseCart = reorderItemsData.map(it => {
      const p = (db.products || []).find(x => x.id === it.productId);
      return {
        productId: it.productId,
        name: it.productName,
        productName: it.productName,
        category: it.category,
        unit: it.unit,
        qty: it.suggestedQty,
        cost: it.costPrice,
        sellPrice: p?.sellPrice || 0,
        subtotal: it.suggestedQty * it.costPrice
      };
    });

    setPurchaseCartItems(purchaseCart);
    toast(`✅ تم تجهيز فاتورة مشتريات تحتوي على ${purchaseCart.length} صنف ناقص تلقائياً`);
    goTo('purchaseInvoice');
  };

  // Build Hierarchical Tree
  const buildTree = () => {
    const tree: Record<string, Record<string, Record<string, any[]>>> = {};
    filteredProducts.forEach(p => {
      const inst = (p.institution || '').trim() || 'بدون مؤسسة';
      const name = p.name || 'بدون اسم';
      const grade = (p.grade || '').trim() || 'بدون تحديد';
      (tree[inst] = tree[inst] || {});
      (tree[inst][name] = tree[inst][name] || {});
      (tree[inst][name][grade] = tree[inst][name][grade] || []).push(p);
    });
    return tree;
  };

  const productTree = buildTree();

  return (
    <div className="space-y-4">
      {/* 1. Add Product Form */}
      <InventoryAddProductForm
        newName={newName}
        setNewName={setNewName}
        newBarcode={newBarcode}
        setNewBarcode={setNewBarcode}
        newCategory={newCategory}
        setNewCategory={setNewCategory}
        newInstitution={newInstitution}
        setNewInstitution={setNewInstitution}
        newGrade={newGrade}
        setNewGrade={setNewGrade}
        newTerm={newTerm}
        setNewTerm={setNewTerm}
        newCost={newCost}
        setNewCost={setNewCost}
        newSell={newSell}
        setNewSell={setNewSell}
        newQty={newQty}
        setNewQty={setNewQty}
        newMinQty={newMinQty}
        setNewMinQty={setNewMinQty}
        newMaxQty={newMaxQty}
        setNewMaxQty={setNewMaxQty}
        handleAddProduct={handleAddProduct}
        onOpenEgyptianCatalog={() => setIsEgyptianCatalogOpen(true)}
      />

      {/* 2. Inventory KPIs & Filters */}
      <InventoryKpiFiltersBar
        filteredCount={filteredProducts.length}
        lowCount={lowCount}
        zeroCount={zeroCount}
        totalCostValue={totalCostValue}
        totalUnitsCount={totalUnitsCount}
        canSeeCost={canSeeCost}
        filterQ={filterQ}
        setFilterQ={setFilterQ}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        filterGrade={filterGrade}
        setFilterGrade={setFilterGrade}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        viewMode={viewMode}
        setViewMode={setViewMode}
        reorderCount={reorderProducts.length}
        onOpenEgyptianCatalog={() => setIsEgyptianCatalogOpen(true)}
      />

      {/* Egyptian Stationery Catalog Review & Download Modal */}
      <EgyptianCatalogModal
        isOpen={isEgyptianCatalogOpen}
        onClose={() => setIsEgyptianCatalogOpen(false)}
        onToast={toast}
      />

      {/* Batch Save Trigger */}
      {(Object.keys(costEdits).length > 0 ||
        Object.keys(sellEdits).length > 0 ||
        Object.keys(qtyEdits).length > 0 ||
        Object.keys(minQtyEdits).length > 0 ||
        Object.keys(maxQtyEdits).length > 0) && (
        <div className="p-3 bg-[#FBF3E1] border border-[#C99A4C] rounded-xl flex items-center justify-between">
          <span className="text-xs font-bold text-[#1F2A3C]">
            يوجد تعديلات غير محفوظة على الأسعار أو الكميات أو حدود المخزون!
          </span>
          <button
            onClick={handleSaveBatchEdits}
            className="px-4 py-1.5 rounded-lg bg-[#A9762F] hover:bg-[#96682A] text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            💾 حفظ كافة التعديلات الآن
          </button>
        </div>
      )}

      {/* 3. Tree View */}
      {viewMode === 'tree' && (
        <InventoryTreeView
          productTree={productTree}
          canSeeCost={canSeeCost}
          stockState={stockState}
          handleAdjustQty={handleAdjustQty}
          handleDeleteProduct={handleDeleteProduct}
          allProducts={db.products || []}
        />
      )}

      {/* 4. Table View with Inline Edits */}
      {viewMode === 'table' && (
        <InventoryBatchTableView
          filteredProducts={filteredProducts}
          canSeeCost={canSeeCost}
          stockState={stockState}
          setCostEdits={setCostEdits}
          setSellEdits={setSellEdits}
          setMinQtyEdits={setMinQtyEdits}
          setMaxQtyEdits={setMaxQtyEdits}
          handleAdjustQty={handleAdjustQty}
          handlePrintBarcode={handlePrintBarcode}
          handleDeleteProduct={handleDeleteProduct}
          allProducts={db.products || []}
        />
      )}

      {/* 5. Smart Stock Reorder & Purchase Order Generation View */}
      {viewMode === 'reorder' && (
        <InventoryReorderView
          selectedSupplierId={selectedSupplierId}
          setSelectedSupplierId={setSelectedSupplierId}
          suppliers={db.suppliers || []}
          reorderItemsData={reorderItemsData}
          totalReorderCost={totalReorderCost}
          setCustomReorderQtys={setCustomReorderQtys}
          poNotes={poNotes}
          setPoNotes={setPoNotes}
          handlePrintPurchaseOrder={handlePrintPurchaseOrder}
          handleConvertToPurchaseInvoice={handleConvertToPurchaseInvoice}
        />
      )}
    </div>
  );
};
