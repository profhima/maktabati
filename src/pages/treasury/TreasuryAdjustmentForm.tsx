import React from 'react';
import { Plus } from 'lucide-react';

export interface TreasuryAdjustmentFormProps {
  actionType: 'deposit' | 'withdraw';
  setActionType: (type: 'deposit' | 'withdraw') => void;
  amount: number | '';
  setAmount: (amount: number | '') => void;
  reason: string;
  setReason: (reason: string) => void;
  saving: boolean;
  handleSaveAdjustment: (e: React.FormEvent) => void;
}

export const TreasuryAdjustmentForm: React.FC<TreasuryAdjustmentFormProps> = ({
  actionType,
  setActionType,
  amount,
  setAmount,
  reason,
  setReason,
  saving,
  handleSaveAdjustment
}) => {
  return (
    <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs">
      <h3 className="font-serif font-bold text-sm md:text-base text-[#1F2A3C] mb-3 flex items-center gap-2">
        <Plus className="w-4 h-4 text-[#A9762F]" />
        إجراء حركة خزانة يدوية (إيداع / سحب)
      </h3>

      <form onSubmit={handleSaveAdjustment} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-right">
        <div>
          <label className="block text-xs font-semibold text-[#3A4A63] mb-1">نوع الحركة</label>
          <div className="grid grid-cols-2 gap-1 bg-[#F6F1E7] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActionType('deposit')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                actionType === 'deposit' ? 'bg-[#5C7A5E] text-white shadow-xs' : 'text-[#3A4A63]'
              }`}
            >
              إيداع (+)
            </button>
            <button
              type="button"
              onClick={() => setActionType('withdraw')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                actionType === 'withdraw' ? 'bg-[#A8503A] text-white shadow-xs' : 'text-[#3A4A63]'
              }`}
            >
              سحب (-)
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3A4A63] mb-1">المبلغ (ج.م) *</label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            required
            className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl font-mono font-bold"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(parseFloat(e.target.value) || '')}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-[#3A4A63] mb-1">السبب / البيان</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
              placeholder="مثال: رصيد افتتاحي / سحب مسحوبات شخصية..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <button
              disabled={saving}
              type="submit"
              className="px-5 py-2 bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
            >
              {saving ? 'جاري...' : 'تسجيل'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
