import React, { useState, useMemo } from 'react';
import { ICONS } from '../constants.tsx';
import { SaleRecord, SaleRecordType, VendorBill, Outlet } from '../types.ts';

interface FinCalendarProps {
  currentOutlet: Outlet | null;
  sales: SaleRecord[];
  bills: VendorBill[];
  onRemoveSale: (id: string) => void;
  onRemoveBill: (id: string) => void;
}

export const FinCalendar: React.FC<FinCalendarProps> = ({ currentOutlet, sales, bills, onRemoveSale, onRemoveBill }) => {
  const targetDate = useMemo(() => {
    const all = [...sales, ...bills].filter(x => x.outletId === currentOutlet?.id);
    if (all.length > 0) return new Date(all[0].date);
    return new Date();
  }, [sales, bills, currentOutlet]);

  const monthName = targetDate.toLocaleString('default', { month: 'long' });
  const year = targetDate.getFullYear();

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Upload Log</h2>
      <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-2xl p-10">
          <h3 className="font-black text-slate-900 uppercase text-2xl mb-8">{monthName} {year}</h3>
          <p className="text-sm text-slate-500 font-medium">History of verified uploads for {currentOutlet?.name}.</p>
          <div className="grid grid-cols-7 gap-4 mt-8">
             {/* Simple Calendar Placeholder */}
             {Array.from({length: 31}).map((_, i) => (
               <div key={i} className="aspect-square bg-slate-50 rounded-2xl flex items-center justify-center font-black text-slate-300">
                  {i + 1}
               </div>
             ))}
          </div>
      </div>
    </div>
  );
};