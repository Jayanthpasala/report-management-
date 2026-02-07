import React, { useState, useMemo } from 'react';
import { ICONS } from '../constants.tsx';
import { SaleRecord, VendorBill, Outlet, SaleRecordType } from '../types.ts';

interface FinCalendarProps {
  currentOutlet: Outlet | null;
  sales: SaleRecord[];
  bills: VendorBill[];
  onRemoveSale: (id: string) => void;
  onRemoveBill: (id: string) => void;
}

type FilterRange = 'weekly' | 'monthly' | 'custom';

export const FinCalendar: React.FC<FinCalendarProps> = ({ currentOutlet, sales, bills, onRemoveSale, onRemoveBill }) => {
  const [range, setRange] = useState<FilterRange>('monthly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const filteredItems = useMemo(() => {
    const all = [
      ...sales.map(s => ({ ...s, entryType: 'Sale' as const })),
      ...bills.map(b => ({ ...b, entryType: 'Bill' as const }))
    ].filter(x => x.outletId === currentOutlet?.id);

    const now = new Date();
    
    return all.filter(item => {
      const itemDate = new Date(item.date);
      if (range === 'weekly') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        return itemDate >= oneWeekAgo;
      }
      if (range === 'monthly') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(now.getMonth() - 1);
        return itemDate >= oneMonthAgo;
      }
      if (range === 'custom' && customStart && customEnd) {
        return itemDate >= new Date(customStart) && itemDate <= new Date(customEnd);
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, bills, currentOutlet, range, customStart, customEnd]);

  const stats = useMemo(() => {
    const totalSales = filteredItems.filter(i => i.entryType === 'Sale').reduce((acc, i) => acc + (i as SaleRecord).amountINR, 0);
    const totalBills = filteredItems.filter(i => i.entryType === 'Bill').reduce((acc, i) => acc + (i as VendorBill).amountINR, 0);
    return { totalSales, totalBills };
  }, [filteredItems]);

  const handleBulkDownload = () => {
    if (filteredItems.length === 0) return;
    
    const exportData = {
      outlet: currentOutlet?.name,
      location: `${currentOutlet?.city}, ${currentOutlet?.country}`,
      exportedAt: new Date().toISOString(),
      filterRange: range.toUpperCase(),
      dateRange: range === 'custom' ? `${customStart} to ${customEnd}` : range,
      summary: {
        totalEntries: filteredItems.length,
        totalSalesINR: stats.totalSales,
        totalBillsINR: stats.totalBills,
        netCashFlow: stats.totalSales - stats.totalBills
      },
      ledger: filteredItems
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Audit_Log_${currentOutlet?.name.replace(/\s+/g, '_')}_${range}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const groupedData = useMemo(() => {
    const groups: Record<string, { items: any[], revenue: number, expenses: number }> = {};
    
    filteredItems.forEach(item => {
      const date = item.date;
      if (!groups[date]) groups[date] = { items: [], revenue: 0, expenses: 0 };
      groups[date].items.push(item);
      
      if (item.entryType === 'Sale') {
        // Only count SEGREGATION sales towards total revenue to avoid double counting item-wise data
        if ((item as SaleRecord).type === SaleRecordType.SEGREGATION) {
          groups[date].revenue += item.amountINR;
        } else if (!filteredItems.some(i => i.date === date && i.entryType === 'Sale' && (i as SaleRecord).type === SaleRecordType.SEGREGATION)) {
          // Fallback: if no segregation exists for this day, use item-wise sum
          groups[date].revenue += item.amountINR;
        }
      } else {
        groups[date].expenses += item.amountINR;
      }
    });
    return groups;
  }, [filteredItems]);

  const dates = Object.keys(groupedData).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-3">Audit Timeline</h2>
          <p className="text-sm text-slate-500 font-medium max-w-md">Real-time daily P&L tracking from POS uploads and bill entries.</p>
        </div>
        
        <button 
          onClick={handleBulkDownload}
          disabled={filteredItems.length === 0}
          className="flex items-center space-x-3 px-8 py-5 bg-slate-900 text-white rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-2xl shadow-indigo-100 disabled:opacity-30 disabled:cursor-not-allowed group"
        >
          <ICONS.Download className="w-5 h-5 group-hover:animate-bounce" />
          <span>Bulk Export {range}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 flex flex-col md:flex-row gap-4 items-center bg-white p-5 rounded-[2.2rem] border border-slate-200 shadow-sm">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            {(['weekly', 'monthly', 'custom'] as FilterRange[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-8 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${range === r ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {r}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <div className="flex items-center gap-4 animate-in slide-in-from-left-4">
              <input 
                type="date" 
                className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none" 
                value={customStart} 
                onChange={e => setCustomStart(e.target.value)}
              />
              <span className="text-[10px] font-black text-slate-300 uppercase">to</span>
              <input 
                type="date" 
                className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none" 
                value={customEnd} 
                onChange={e => setCustomEnd(e.target.value)}
              />
            </div>
          )}

          <div className="hidden md:flex ml-auto items-center gap-4 px-6 py-3 bg-indigo-50/50 text-indigo-600 rounded-2xl border border-indigo-100">
             <div className="text-right">
                <p className="text-[8px] font-black uppercase opacity-50 mb-1">Global Inflow</p>
                <p className="text-sm font-black tracking-tight">₹{stats.totalSales.toLocaleString()}</p>
             </div>
             <div className="w-px h-6 bg-indigo-200"></div>
             <div className="text-right">
                <p className="text-[8px] font-black uppercase opacity-50 mb-1">Global Outflow</p>
                <p className="text-sm font-black tracking-tight text-rose-500">₹{stats.totalBills.toLocaleString()}</p>
             </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.2rem] border border-slate-200 shadow-sm flex items-center justify-center">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                 <ICONS.Check className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Verified Nodes</p>
                 <p className="text-lg font-black text-slate-900 leading-none">{filteredItems.length} Traces</p>
              </div>
           </div>
        </div>
      </div>

      <div className="space-y-20">
        {dates.length > 0 ? (
          dates.map(date => {
            const dayData = groupedData[date];
            const dayProfit = dayData.revenue - dayData.expenses;
            
            return (
              <div key={date} className="relative">
                <div className="sticky top-0 z-20 py-6 -mx-4 px-4 bg-slate-50/95 backdrop-blur-md mb-8 border-b border-slate-200/50">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center space-x-6">
                      <div className="flex-shrink-0 w-14 h-14 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center ring-4 ring-slate-100">
                        <span className="text-[10px] font-black text-indigo-600 uppercase leading-none mb-1">
                          {new Date(date).toLocaleDateString(undefined, { month: 'short' })}
                        </span>
                        <span className="text-xl font-black text-slate-900 leading-none">
                          {new Date(date).getDate()}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                          {new Date(date).toLocaleDateString(undefined, { weekday: 'long' })}
                        </h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {dayData.items.length} Financial Events Logged
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="px-6 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-end">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Daily Rev</span>
                        <span className="text-sm font-black text-slate-900">₹{dayData.revenue.toLocaleString()}</span>
                      </div>
                      <div className="px-6 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-end">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Daily Opex</span>
                        <span className="text-sm font-black text-rose-500">₹{dayData.expenses.toLocaleString()}</span>
                      </div>
                      <div className={`px-6 py-3 rounded-2xl border shadow-lg flex flex-col items-end ${
                        dayProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'
                      }`}>
                        <span className="text-[8px] font-black uppercase tracking-widest mb-1 opacity-60">Daily Profit</span>
                        <span className={`text-sm font-black ${dayProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          ₹{dayProfit.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pl-0 md:pl-20">
                  {dayData.items.map((item: any) => (
                    <div key={item.id} className="bg-white p-8 rounded-[2.8rem] border border-slate-200 shadow-sm hover:border-indigo-200 transition-all relative group hover:-translate-y-1">
                      <div className="flex justify-between items-start mb-6">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          item.entryType === 'Sale' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {item.entryType}
                        </span>
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => item.entryType === 'Sale' ? onRemoveSale(item.id) : onRemoveBill(item.id)}
                            className="p-3 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                          >
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-1 mb-6">
                        <h4 className="font-black text-slate-900 uppercase tracking-tight text-xl leading-tight">
                          {item.entryType === 'Sale' ? (item.paymentMethod || item.itemName || 'POS Stream') : item.vendorName}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wide">
                          {item.source || item.category || 'Manual Entry'}
                        </p>
                      </div>
                      
                      <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                         <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Audit Amount</p>
                            <span className="text-2xl font-black text-slate-900 tracking-tighter">
                              ₹{item.amountINR.toLocaleString()}
                            </span>
                         </div>
                         <div className="text-right">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Source Value</p>
                            <span className="text-[10px] font-black text-slate-500 uppercase">
                              {item.amount.toLocaleString()} {item.currency || currentOutlet?.currency}
                            </span>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-40 text-center bg-white rounded-[4rem] border-2 border-dashed border-slate-100 shadow-inner">
             <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-slate-200">
                <ICONS.Calendar className="w-12 h-12" />
             </div>
             <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Audit Chamber Empty</h3>
             <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">No historical data found for the selected range</p>
          </div>
        )}
      </div>
    </div>
  );
};