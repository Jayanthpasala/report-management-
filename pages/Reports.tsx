
import React, { useState } from 'react';
import { SaleRecord, VendorBill, Outlet } from '../types';
import { ICONS } from '../constants';

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

  const renderTabContent = () => {
    switch(activeTab) {
      case 'pnl':
        return (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in duration-300">
            <h3 className="text-xl font-bold text-slate-900">Profit & Loss Statement</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-50 text-lg font-bold">
                <span className="text-slate-600">Total Operating Revenue</span>
                <span className="text-emerald-600">₹{totalRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-50 text-lg font-bold">
                <span className="text-slate-600">Cost of Operations (Opex)</span>
                <span className="text-rose-600">(₹{totalExpenses.toLocaleString()})</span>
              </div>
              <div className="flex justify-between items-center py-4 bg-slate-900 text-white rounded-xl px-4 text-2xl font-black">
                <span>Net Operating Income</span>
                <span className={netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>₹{netProfit.toLocaleString()}</span>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <p className="text-xs text-blue-700 font-medium leading-relaxed">
                <strong>Note:</strong> P&L is calculated based on synced POS data and approved vendor bills for {currentOutlet?.name}.
              </p>
            </div>
          </div>
        );
      case 'journal':
        const journalEntries = [
          ...filteredSales.map(s => ({ date: s.date, desc: `Sales Revenue - ${s.source}`, dr: s.amount, cr: 0, type: 'Income' })),
          ...filteredBills.map(b => ({ date: b.date, desc: `Expense - ${b.vendorName}`, dr: 0, cr: b.amountINR, type: 'Expense' }))
        ].sort((a,b) => b.date.localeCompare(a.date));

        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase">Chronological Ledger</span>
              <span className="text-xs text-slate-400">{journalEntries.length} entries found</span>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Particulars</th>
                  <th className="px-6 py-3 text-right">Debit (Dr)</th>
                  <th className="px-6 py-3 text-right">Credit (Cr)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {journalEntries.map((e, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-mono">{e.date}</td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{e.desc}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-tighter">{e.type}</p>
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-bold">{e.dr > 0 ? `₹${e.dr.toLocaleString()}` : '-'}</td>
                    <td className="px-6 py-4 text-right text-rose-600 font-bold">{e.cr > 0 ? `₹${e.cr.toLocaleString()}` : '-'}</td>
                  </tr>
                ))}
                {journalEntries.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No journal entries available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      case 'balance-sheet':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="font-black text-slate-400 text-[10px] uppercase mb-4 tracking-widest">Assets</h4>
              <div className="space-y-3">
                <div className="flex justify-between font-bold text-sm"><span className="text-slate-600">Cash & Equivalents</span><span>₹{totalRevenue.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-sm"><span className="text-slate-600">Inventory Stocks</span><span>₹45,000</span></div>
                <div className="flex justify-between font-bold text-sm"><span className="text-slate-600">Security Deposits</span><span>₹2,50,000</span></div>
                <div className="pt-4 border-t border-slate-100 flex justify-between text-lg font-black text-slate-900"><span>Total Assets</span><span>₹{(totalRevenue + 45000 + 250000).toLocaleString()}</span></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="font-black text-slate-400 text-[10px] uppercase mb-4 tracking-widest">Liabilities & Equity</h4>
              <div className="space-y-3">
                <div className="flex justify-between font-bold text-sm"><span className="text-slate-600">Accounts Payable (Vendor Bills)</span><span>₹{totalExpenses.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-sm"><span className="text-slate-600">Retained Earnings (MTD)</span><span>₹{netProfit.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-sm"><span className="text-slate-600">Owner Capital Contribution</span><span>₹2,95,000</span></div>
                <div className="pt-4 border-t border-slate-100 flex justify-between text-lg font-black text-slate-900"><span>Total Liab. & Equity</span><span>₹{(totalExpenses + netProfit + 295000).toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        );
      case 'trial-balance':
        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm animate-in fade-in overflow-hidden">
             <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-white text-[10px] font-black uppercase">
                <tr><th className="px-6 py-3">Account Head</th><th className="px-6 py-3 text-right">Debit Balance</th><th className="px-6 py-3 text-right">Credit Balance</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr><td className="px-6 py-4 font-bold">Sales Income Account</td><td className="px-6 py-4 text-right">-</td><td className="px-6 py-4 text-right font-black">₹{totalRevenue.toLocaleString()}</td></tr>
                <tr><td className="px-6 py-4 font-bold">Direct Expense Account</td><td className="px-6 py-4 text-right font-black">₹{totalExpenses.toLocaleString()}</td><td className="px-6 py-4 text-right">-</td></tr>
                <tr><td className="px-6 py-4 font-bold">Main Cash Account</td><td className="px-6 py-4 text-right font-black">₹{netProfit.toLocaleString()}</td><td className="px-6 py-4 text-right">-</td></tr>
                <tr><td className="px-6 py-4 font-bold">Accounts Payable Control</td><td className="px-6 py-4 text-right">-</td><td className="px-6 py-4 text-right font-black">₹{totalExpenses.toLocaleString()}</td></tr>
              </tbody>
              <tfoot className="bg-slate-50 font-black text-lg">
                <tr>
                   <td className="px-6 py-4">Totals</td>
                   <td className="px-6 py-4 text-right">₹{(totalExpenses + netProfit).toLocaleString()}</td>
                   <td className="px-6 py-4 text-right">₹{(totalRevenue + totalExpenses).toLocaleString()}</td>
                </tr>
              </tfoot>
             </table>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Accounting Suite</h2>
          <p className="text-sm text-slate-500">Full ledger and reporting system for {currentOutlet?.name}</p>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            className="flex items-center space-x-2 px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg transition-transform active:scale-95"
            onClick={() => alert('To download source documents, please go to the "Upload Log" section and select your desired date range on the calendar.')}
          >
            <ICONS.Calendar className="w-5 h-5" />
            <span>Go to Calendar Export</span>
          </button>
        </div>
      </div>

      {/* Report Navigation Tabs */}
      <div className="flex flex-wrap gap-2 bg-slate-200/50 p-1 rounded-xl w-fit">
        {[
          { id: 'pnl', label: 'P&L Statement' },
          { id: 'journal', label: 'General Journal' },
          { id: 'balance-sheet', label: 'Balance Sheet' },
          { id: 'trial-balance', label: 'Trial Balance' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {renderTabContent()}
    </div>
  );
};
