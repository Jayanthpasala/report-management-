import React, { useState } from 'react';
import { SaleRecord, VendorBill, Outlet } from '../types.ts';
import { ICONS } from '../constants.tsx';

interface ReportsProps {
  currentOutlet: Outlet | null;
  sales: SaleRecord[];
  bills: VendorBill[];
}

type TabType = 'pnl' | 'journal' | 'balance-sheet' | 'trial-balance';

export const Reports: React.FC<ReportsProps> = ({ currentOutlet, sales, bills }) => {
  const [activeTab, setActiveTab] = useState<TabType>('pnl');

  const filteredSales = sales.filter(s => s.outletId === currentOutlet?.id);
  const filteredBills = bills.filter(b => b.outletId === currentOutlet?.id);

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.amount, 0);
  const totalExpenses = filteredBills.reduce((sum, b) => sum + b.amountINR, 0);
  const netProfit = totalRevenue - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Accounting Suite</h2>
          <p className="text-sm text-slate-500">Reports for {currentOutlet?.name}</p>
        </div>
      </div>

      <div className="flex gap-2 bg-slate-200/50 p-1 rounded-xl w-fit">
        {['pnl', 'journal', 'balance-sheet', 'trial-balance'].map(id => (
          <button
            key={id}
            onClick={() => setActiveTab(id as TabType)}
            className={`px-4 py-2 text-xs font-bold rounded-lg ${activeTab === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            {id.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
         <h3 className="text-2xl font-black uppercase mb-8">{activeTab.replace('-', ' ')}</h3>
         <div className="space-y-4">
           <div className="flex justify-between border-b pb-4"><span className="font-bold text-slate-500 uppercase">Revenue</span><span className="font-black">₹{totalRevenue.toLocaleString()}</span></div>
           <div className="flex justify-between border-b pb-4"><span className="font-bold text-slate-500 uppercase">Expenses</span><span className="font-black text-rose-500">₹{totalExpenses.toLocaleString()}</span></div>
           <div className="flex justify-between pt-4"><span className="font-black text-slate-900 uppercase">Net Profit</span><span className={`font-black text-2xl ${netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>₹{netProfit.toLocaleString()}</span></div>
         </div>
      </div>
    </div>
  );
};