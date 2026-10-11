import React, { useEffect, useState } from 'react';
import { fmt } from '../lib/utils';
import { SHOP_NAME, SHOP_ADDRESS, SHOP_PHONES, SHOP_DEFAULT_LOGO } from '../lib/constants';
import { getShopSettings } from '../lib/settings';
import { ShoppingBag, CheckCircle, Sparkles, X, Clock, Award } from 'lucide-react';
import { CustomerDisplayItem, CustomerDisplayPayload, CUSTOMER_DISPLAY_CHANNEL } from '../types';

export type { CustomerDisplayItem, CustomerDisplayPayload };
export { CUSTOMER_DISPLAY_CHANNEL };

export const CustomerDisplayScreen: React.FC = () => {
  const [data, setData] = useState<CustomerDisplayPayload>({
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    status: 'idle'
  });

  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    // Clock
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    // BroadcastChannel or Storage Listener for real-time dual display sync
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data) {
          setData(event.data);
        }
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === CUSTOMER_DISPLAY_CHANNEL && e.newValue) {
        try {
          setData(JSON.parse(e.newValue));
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorage);

    // Initial read
    try {
      const init = localStorage.getItem(CUSTOMER_DISPLAY_CHANNEL);
      if (init) setData(JSON.parse(init));
    } catch {}

    return () => {
      clearInterval(timer);
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const hasItems = data.items && data.items.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between p-4 md:p-8 select-none" dir="rtl">
      {/* 1. Header Bar */}
      <header className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white p-1 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-500/30 overflow-hidden">
            <img
              src={getShopSettings().logoUrl || SHOP_DEFAULT_LOGO}
              alt={SHOP_NAME}
              className="w-full h-full object-contain rounded-xl"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-serif text-amber-400">{getShopSettings().shopName || SHOP_NAME}</h1>
            <p className="text-xs text-slate-400">{getShopSettings().address || SHOP_ADDRESS}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
          <Clock className="w-4 h-4 text-amber-500" />
          <span>{currentTime}</span>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-auto py-6 items-stretch">
        {/* Left Column: Items List */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col h-[520px]">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800 text-sm font-bold text-slate-300">
            <span>قائمة المشتريات ({data.items?.length || 0} صنف)</span>
            {data.customerName && (
              <span className="text-amber-400 bg-amber-950/60 border border-amber-800/60 px-3 py-1 rounded-lg text-xs flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" />
                أهلاً بك: {data.customerName}
              </span>
            )}
          </div>

          {/* Items Container */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 py-2 space-y-1">
            {!hasItems ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-3">
                <Sparkles className="w-12 h-12 text-amber-500/40 animate-pulse" />
                <p className="text-lg font-bold text-slate-400">أهلاً وسهلاً بك في {SHOP_NAME}</p>
                <p className="text-xs text-slate-500 max-w-sm">سيتم عرض الأصناف والأسعار هنا لحظياً عند تمرير المنتجات على الماسح الضوئي</p>
              </div>
            ) : (
              data.items.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex justify-between items-center p-3 rounded-2xl transition-all ${
                    idx === data.items.length - 1 ? 'bg-amber-500/10 border border-amber-500/30' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <p className="font-bold text-sm md:text-base text-slate-100 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400 font-mono">
                      {item.qty} × {fmt(item.price)} ج
                    </p>
                  </div>
                  <div className="text-left font-mono font-black text-amber-400 text-base md:text-lg pl-1">
                    {fmt(item.total)} <span className="text-xs font-sans text-slate-400">ج.م</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Last Scanned Item Banner */}
          {data.lastScanned && (
            <div className="mt-2 bg-gradient-to-r from-amber-950/80 to-slate-900 border border-amber-500/40 p-3 rounded-2xl flex justify-between items-center text-xs">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>تمت الإضافة: {data.lastScanned.name}</span>
              </div>
              <span className="font-mono font-black text-amber-300 text-sm">
                +{fmt(data.lastScanned.price)} ج
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Totals & State */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
              ملخص الحساب الإجمالي
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>المجموع الفرعي:</span>
                <span className="font-mono font-bold text-base">{fmt(data.subtotal || 0)} ج</span>
              </div>

              {data.discount > 0 && (
                <div className="flex justify-between text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-xl">
                  <span>الخصم الممنوح:</span>
                  <span className="font-mono font-bold text-base">-{fmt(data.discount)} ج</span>
                </div>
              )}

              <div className="pt-4 border-t border-slate-700/80 flex justify-between items-baseline">
                <div>
                  <span className="text-xs text-slate-400 block">المبلغ المطلوب للدفع:</span>
                  <span className="text-lg font-bold text-slate-200">الإجمالي النهائي</span>
                </div>
                <div className="text-right">
                  <span className="text-4xl md:text-5xl font-black font-mono text-amber-400 tracking-tight">
                    {fmt(data.total || 0)}
                  </span>
                  <span className="text-sm font-bold text-amber-500/80 mr-1.5">ج.م</span>
                </div>
              </div>
            </div>

            {/* Payment Received / Change Display if provided */}
            {data.receivedAmount && data.receivedAmount > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-slate-800/80 rounded-xl">
                  <span className="text-slate-400 block">المدفوع نقداً:</span>
                  <b className="text-sm font-mono text-slate-100">{fmt(data.receivedAmount)} ج</b>
                </div>
                <div className="p-2.5 bg-emerald-950/60 border border-emerald-800/50 rounded-xl">
                  <span className="text-emerald-400 block">المتبقي (الفكة):</span>
                  <b className="text-sm font-mono text-emerald-300">{fmt(data.changeAmount || 0)} ج</b>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Promotional Box */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-1">
            <p className="text-xs font-bold text-slate-300">نسعد دائماً بخدمتكم في {SHOP_NAME}</p>
            <p className="text-[11px] text-slate-500 font-mono">{SHOP_PHONES}</p>
          </div>
        </div>
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-slate-800 pt-3 flex justify-between items-center text-[11px] text-slate-500">
        <span>نظام نقاط البيع وإدارة المكتبات الذكي</span>
        <span>Customer Dual-Display Mode Active</span>
      </footer>
    </div>
  );
};
