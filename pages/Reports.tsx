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

  const handleBulkDownload = () => {
    if (!currentOutlet) return;
    
    const exportData = {
      outlet: currentOutlet,
      generatedAt: new Date().toISOString(),
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit
      },
      sales: filteredSales,
      bills: filteredBills
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FinOut_Ledger_${currentOutlet.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Accounting Suite</h2>
          <p className="text-sm text-slate-500">Reports for {currentOutlet?.name}</p>
        </div>
        <button 
          onClick={handleBulkDownload}
          className="flex items-center space-x-3 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200"
        >
          <ICONS.Download className="w-4 h-4" />
          <span>Bulk Export Ledger</span>
        </button>
      </div>

      <div className="flex gap-2 bg-slate-200/50 p-1 rounded-xl w-fit">
        {['pnl', 'journal', 'balance-sheet', 'trial-balance'].map(id => (
          <button
            key={id}
            onClick={() => setActiveTab(id as TabType)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {id.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50"></div>
         <div className="relative z-10">
            <h3 className="text-2xl font-black uppercase mb-10 tracking-tighter text-slate-900">{activeTab.replace('-', ' ')}</h3>
            <div className="space-y-6">
              <div className="flex justify-between border-b border-slate-100 pb-6 items-center">
                <span className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Gross Verified Revenue</span>
                <span className="font-black text-xl text-slate-900">₹{totalRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-6 items-center">
                <span className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Operational Expenditures</span>
                <span className="font-black text-xl text-rose-500">₹{totalExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-6 items-center bg-slate-50 -mx-8 px-8 py-6 rounded-2xl border border-slate-100">
                <span className="font-black text-slate-900 uppercase tracking-widest text-[11px]">Net Operating Profit</span>
                <span className={`font-black text-3xl tracking-tighter ${netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  ₹{netProfit.toLocaleString()}
                </span>
              </div>
            </div>
         </div>
      </div>
    </div>
  );
};