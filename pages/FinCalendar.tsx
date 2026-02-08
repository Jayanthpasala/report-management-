import React, { useState, useMemo } from 'react';
import { ICONS } from '../constants.tsx';
import { SaleRecord, VendorBill, Outlet, SaleRecordType, ExpenseCategory } from '../types.ts';

interface FinCalendarProps {
  currentOutlet: Outlet | null;
  sales: SaleRecord[];
  bills: VendorBill[];
  onRemoveSale: (id: string) => void;
  onRemoveBill: (id: string) => void;
}

type RangeType = 'weekly' | 'monthly' | 'custom';

export const FinCalendar: React.FC<FinCalendarProps> = ({ currentOutlet, sales, bills, onRemoveSale, onRemoveBill }) => {
  const [rangeType, setRangeType] = useState<RangeType>('monthly');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentViewMonth, setCurrentViewMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Normalization helper for consistent date keys
  const normalize = (d: string) => {
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      return date.toISOString().split('T')[0];
    } catch {
      return d;
    }
  };

  // Grouping logic for performance
  const dataMap = useMemo(() => {
    const groups: Record<string, { sales: SaleRecord[], bills: VendorBill[], revenue: number, expense: number }> = {};
    const filteredSales = sales.filter(s => s.outletId === currentOutlet?.id);
    const filteredBills = bills.filter(b => b.outletId === currentOutlet?.id);

    // Sales aggregation
    filteredSales.forEach(s => {
      const normDate = normalize(s.date);
      if (!groups[normDate]) groups[normDate] = { sales: [], bills: [], revenue: 0, expense: 0 };
      groups[normDate].sales.push(s);
      // Double counting prevention (Prioritize Segregation for Revenue)
      if (s.type === SaleRecordType.SEGREGATION || !filteredSales.some(fs => normalize(fs.date) === normDate && fs.type === SaleRecordType.SEGREGATION)) {
        groups[normDate].revenue += s.amountINR;
      }
    });

    // Bills aggregation
    filteredBills.forEach(b => {
      const normDate = normalize(b.date);
      if (!groups[normDate]) groups[normDate] = { sales: [], bills: [], revenue: 0, expense: 0 };
      groups[normDate].bills.push(b);
      groups[normDate].expense += b.amountINR;
    });

    return groups;
  }, [sales, bills, currentOutlet]);

  const getStatsForRange = (start: Date, end: Date) => {
    let rev = 0, exp = 0;
    Object.keys(dataMap).forEach(dateStr => {
      const d = new Date(dateStr);
      // Use date comparison without time
      const checkDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const startDateNoTime = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDateNoTime = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      
      if (checkDate >= startDateNoTime && checkDate <= endDateNoTime) {
        rev += dataMap[dateStr].revenue;
        exp += dataMap[dateStr].expense;
      }
    });
    return { rev, exp, profit: rev - exp };
  };

  const weeklyStats = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    return getStatsForRange(start, end);
  }, [dataMap]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return getStatsForRange(start, end);
  }, [dataMap]);

  const activeRangeStats = useMemo(() => {
    let start = new Date();
    let end = new Date();

    if (rangeType === 'weekly') {
      start.setDate(end.getDate() - 7);
    } else if (rangeType === 'monthly') {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
      end = new Date(end.getFullYear(), end.getMonth() + 1, 0);
    } else if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    }
    return getStatsForRange(start, end);
  }, [rangeType, startDate, endDate, dataMap]);

  const handleDownload = () => {
    let start = new Date();
    let end = new Date();
    if (rangeType === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else if (rangeType === 'weekly') {
      start.setDate(end.getDate() - 7);
    } else {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    }

    const filteredEntries = Object.keys(dataMap)
      .filter(d => {
        const date = new Date(d);
        return date >= start && date <= end;
      })
      .map(d => ({ date: d, ...dataMap[d] }));

    const blob = new Blob([JSON.stringify({
      outlet: currentOutlet?.name,
      range: `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
      summary: activeRangeStats,
      data: filteredEntries
    }, null, 2)], { type: 'application/json' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FinOut_Audit_${rangeType}_${currentOutlet?.name}.json`;
    a.click();
  };

  // Calendar rendering logic
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const year = currentViewMonth.getFullYear();
  const month = currentViewMonth.getMonth();
  const totalDays = daysInMonth(year, month);
  const offset = startDayOfMonth(year, month);
  const daysGrid = [];
  for (let i = 0; i < offset; i++) daysGrid.push(null);
  for (let d = 1; d <= totalDays; d++) daysGrid.push(d);

  return (
    <div className="space-y-8 animate-in fade-in pb-24">
      {/* 1. Header & Bulk Download */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Audit Ecosystem</h2>
          <div className="flex flex-wrap gap-2">
            {(['weekly', 'monthly', 'custom'] as RangeType[]).map(type => (
              <button
                key={type}
                onClick={() => setRangeType(type)}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${rangeType === type ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {rangeType === 'custom' && (
          <div className="flex items-center gap-4 animate-in slide-in-from-left-4">
            <input type="date" className="bg-slate-50 p-3 rounded-xl text-xs font-bold border-0 ring-1 ring-slate-200" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-[10px] font-black text-slate-300 uppercase">to</span>
            <input type="date" className="bg-slate-50 p-3 rounded-xl text-xs font-bold border-0 ring-1 ring-slate-200" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        )}

        <button 
          onClick={handleDownload}
          className="flex items-center space-x-3 px-10 py-5 bg-slate-900 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-200"
        >
          <ICONS.Download className="w-5 h-5" />
          <span>Export {rangeType} Ledger</span>
        </button>
      </div>

      {/* 2. Global Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm ring-4 ring-indigo-50/50">
           <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Selected Range Profit</p>
           <h3 className={`text-2xl font-black tracking-tighter ${activeRangeStats.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
             ₹{activeRangeStats.profit.toLocaleString()}
           </h3>
           <div className="mt-4 flex justify-between text-[9px] font-bold text-slate-400 uppercase">
             <span>Rev: ₹{activeRangeStats.rev.toLocaleString()}</span>
             <span>Exp: ₹{activeRangeStats.exp.toLocaleString()}</span>
           </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/20 blur-3xl"></div>
           <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Weekly Inflow</p>
           <h3 className="text-2xl font-black">₹{weeklyStats.rev.toLocaleString()}</h3>
           <p className="text-[9px] font-medium text-slate-500 mt-2 uppercase">Last 7 Calendar Days</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly Yield</p>
           <h3 className="text-2xl font-black text-slate-900">₹{monthlyStats.rev.toLocaleString()}</h3>
           <p className="text-[9px] font-black text-emerald-500 mt-2 uppercase">Current Month Summary</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly Opex</p>
           <h3 className="text-2xl font-black text-rose-500">₹{monthlyStats.exp.toLocaleString()}</h3>
           <p className="text-[9px] font-black text-slate-300 mt-2 uppercase">Current Month Costs</p>
        </div>
      </div>

      {/* 3. Main Calendar & Daily Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Calendar Grid */}
        <div className="lg:col-span-8 bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
              {currentViewMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-2">
              <button onClick={() => setCurrentViewMonth(new Date(year, month - 1))} className="p-3 hover:bg-slate-50 rounded-2xl border border-slate-100"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg></button>
              <button onClick={() => setCurrentViewMonth(new Date(year, month + 1))} className="p-3 hover:bg-slate-50 rounded-2xl border border-slate-100"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-4 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-3">
            {daysGrid.map((d, i) => {
              if (!d) return <div key={`e-${i}`} className="aspect-square" />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const hasData = dataMap[dateStr];
              const isToday = new Date().toISOString().split('T')[0] === dateStr;
              const isSelected = selectedDay === dateStr;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDay(dateStr)}
                  className={`aspect-square rounded-[1.8rem] flex flex-col items-center justify-center relative transition-all group border-2 ${
                    isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl scale-110 z-10' : 
                    (isToday ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-50 hover:border-indigo-100')
                  }`}
                >
                  <span className={`text-sm font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>{d}</span>
                  {hasData && (
                    <div className="flex gap-1 mt-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`} />
                      <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/50' : 'bg-amber-500'}`} />
                    </div>
                  )}
                  {hasData && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Daily Trace Detail Panel */}
        <div className="lg:col-span-4 space-y-6 sticky top-8">
           <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm min-h-[400px]">
              {selectedDay ? (
                <div className="animate-in slide-in-from-right-4">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-1">Trace Summary</p>
                      <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">{new Date(selectedDay).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</h4>
                    </div>
                    {dataMap[selectedDay] && (
                       <div className="px-4 py-2 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-widest">₹{(dataMap[selectedDay].revenue - dataMap[selectedDay].expense).toLocaleString()} Profit</div>
                    )}
                  </div>

                  {!dataMap[selectedDay] ? (
                    <div className="py-20 text-center space-y-4">
                       <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-200">
                          <ICONS.Calendar className="w-8 h-8" />
                       </div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No entries documented for this node</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {dataMap[selectedDay].sales.map(s => (
                        <div key={s.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center group">
                          <div>
                            <p className="text-[9px] font-black text-indigo-600 uppercase mb-0.5">{s.paymentMethod || 'Manual'}</p>
                            <p className="text-xs font-bold text-slate-900">{s.itemName || 'POS Entry'}</p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <span className="text-xs font-black text-slate-900">₹{s.amountINR.toLocaleString()}</span>
                            <button onClick={() => onRemoveSale(s.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-rose-300 hover:text-rose-500 transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg></button>
                          </div>
                        </div>
                      ))}
                      {dataMap[selectedDay].bills.map(b => (
                        <div key={b.id} className="bg-amber-50/30 p-4 rounded-2xl border border-amber-100 flex justify-between items-center group">
                          <div>
                            <p className="text-[9px] font-black text-amber-600 uppercase mb-0.5">{b.category}</p>
                            <p className="text-xs font-bold text-slate-900">{b.vendorName}</p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <span className="text-xs font-black text-rose-500">₹{b.amountINR.toLocaleString()}</span>
                            <button onClick={() => onRemoveBill(b.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-rose-300 hover:text-rose-500 transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                   <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center mb-6 text-indigo-200">
                      <ICONS.Search className="w-10 h-10" />
                   </div>
                   <h5 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-2">Select a Trace</h5>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Click any date in the ecosystem to view granular P&L data and entry traces.</p>
                </div>
              )}
           </div>

           <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl">
              <div className="flex items-center space-x-4 mb-6">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400">Live Health Trace</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 leading-relaxed mb-6">Accounting engines are synchronized with your POS and Vendor systems. All discrepancies are auto-detected.</p>
              <div className="flex justify-between items-center pt-6 border-t border-white/10">
                 <span className="text-[10px] font-black uppercase tracking-widest">Active Outlet</span>
                 <span className="text-[10px] font-black uppercase text-indigo-400">{currentOutlet?.name}</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};