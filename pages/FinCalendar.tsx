
import React, { useState, useMemo } from 'react';
import { ICONS } from '../constants';
import { SaleRecord, SaleRecordType, VendorBill, Outlet } from '../types';

interface FinCalendarProps {
  currentOutlet: Outlet | null;
  sales: SaleRecord[];
  bills: VendorBill[];
  onRemoveSale: (id: string) => void;
  onRemoveBill: (id: string) => void;
}

export const FinCalendar: React.FC<FinCalendarProps> = ({ currentOutlet, sales, bills, onRemoveSale, onRemoveBill }) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isRangePanelOpen, setIsRangePanelOpen] = useState(false);

  // Range selection states
  const todayStr = new Date().toISOString().split('T')[0];
  const [rangeFrom, setRangeFrom] = useState(todayStr);
  const [rangeTo, setRangeTo] = useState(todayStr);

  const targetDate = useMemo(() => {
    const outletSales = sales.filter(s => s.outletId === currentOutlet?.id);
    const outletBills = bills.filter(b => b.outletId === currentOutlet?.id);
    const allDates = [...outletSales.map(s => s.date), ...outletBills.map(b => b.date)];
    
    if (allDates.length > 0) {
      const sorted = allDates.sort((a, b) => b.localeCompare(a));
      return new Date(sorted[0]);
    }
    return new Date();
  }, [sales, bills, currentOutlet]);

  const currentYear = targetDate.getFullYear();
  const currentMonthIndex = targetDate.getMonth();
  const monthName = targetDate.toLocaleString('default', { month: 'long' });

  const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const firstDayOfMonth = new Date(currentYear, currentMonthIndex, 1).getDay();
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const symbol = currentOutlet?.currency === 'INR' ? '₹' : (currentOutlet?.currency === 'USD' ? '$' : '£');

  const getDayDataForDate = (dateStr: string) => {
    const daySales = sales.filter(s => s.outletId === currentOutlet?.id && s.date === dateStr);
    const dayBills = bills.filter(b => b.outletId === currentOutlet?.id && b.date === dateStr);
    
    const segregationRevenue = daySales.filter(s => s.type === SaleRecordType.SEGREGATION).reduce((sum, r) => sum + r.amount, 0);
    const itemizedRevenue = daySales.filter(s => s.type === SaleRecordType.ITEM_WISE).reduce((sum, r) => sum + r.amount, 0);
    
    const revenue = segregationRevenue > 0 ? segregationRevenue : itemizedRevenue;
    const expenses = dayBills.reduce((sum, r) => sum + r.amount, 0);
    
    return { dateStr, revenue, expenses, daySales, dayBills };
  };

  const getDayData = (day: number) => {
    const dateStr = `${currentYear}-${(currentMonthIndex + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return getDayDataForDate(dateStr);
  };

  const getFileExtension = (mimeType?: string) => {
    if (!mimeType) return 'bin';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('openxmlformats')) return 'xlsx';
    return 'bin';
  };

  const handleDownloadRange = async (start: string, end: string, label: string) => {
    setIsZipping(true);
    try {
      // @ts-ignore
      const JSZip = (window as any).JSZip;
      const zip = new JSZip();
      const rootFolder = zip.folder(`${label}_Audit_${start}_to_${end}`);
      
      const startDate = new Date(start);
      const endDate = new Date(end);
      let totalDocs = 0;

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayData = getDayDataForDate(dateStr);
        if (dayData.daySales.length > 0 || dayData.dayBills.length > 0) {
          const dayFolder = rootFolder.folder(`Audit_${dateStr}`);
          addDayToZip(dayFolder, dayData, symbol, currentOutlet?.name || 'Unknown');
          totalDocs += dayData.daySales.length + dayData.dayBills.length;
        }
      }

      if (totalDocs === 0) {
        alert("No documents found in this date range.");
        setIsZipping(false);
        return;
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${label}_Audit_Bundle.zip`;
      link.click();
      setIsRangePanelOpen(false);
    } catch (e) {
      console.error(e);
      alert("Bundle creation failed.");
    } finally {
      setIsZipping(false);
    }
  };

  const setRangeLastDays = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setRangeFrom(start.toISOString().split('T')[0]);
    setRangeTo(end.toISOString().split('T')[0]);
  };

  const setRangeMonth = () => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    setRangeFrom(start.toISOString().split('T')[0]);
    setRangeTo(end.toISOString().split('T')[0]);
  };

  const addDayToZip = (zipObj: any, dayData: any, symbol: string, outletName: string) => {
    const salesSub = zipObj.folder("Original_Sales_Docs");
    const billsSub = zipObj.folder("Original_Vendor_Bills");
    const reportSub = zipObj.folder("AI_Reports");

    const uniqueSalesDocs = new Set<string>();
    dayData.daySales.forEach((s: SaleRecord) => {
      if (s.fileData && !uniqueSalesDocs.has(s.source)) {
        uniqueSalesDocs.add(s.source);
        const ext = getFileExtension(s.fileMimeType);
        salesSub.file(`DOC_${s.source}.${ext}`, s.fileData, { base64: true });
      }
      reportSub.file(`Sale_Breakdown_${s.id}.txt`, `Audit Detail: ${s.itemName || s.paymentMethod}\nAmount: ${s.amount}\nDate: ${s.date}`);
    });
    
    const uniqueBillDocs = new Set<string>();
    dayData.dayBills.forEach((b: VendorBill) => {
      if (b.fileData && b.fileName && !uniqueBillDocs.has(b.fileName)) {
        uniqueBillDocs.add(b.fileName);
        const ext = getFileExtension(b.fileMimeType);
        billsSub.file(`BILL_${b.fileName}.${ext}`, b.fileData, { base64: true });
      }
      reportSub.file(`Bill_Summary_${b.id}.txt`, `Vendor: ${b.vendorName}\nCategory: ${b.category}\nAmount: ${b.amount}\nStatus: ${b.status}\nNote: ${b.note || 'None'}`);
    });

    const summary = `DAILY AUDIT SUMMARY - ${dayData.dateStr}\n====================================\nOutlet: ${outletName}\nVerified Revenue: ${symbol}${dayData.revenue.toLocaleString()}\nVerified Expenses: ${symbol}${dayData.expenses.toLocaleString()}\n\nStatus: FULLY RECONCILED BY AI\nDocuments included: ${uniqueSalesDocs.size + uniqueBillDocs.size}`;
    zipObj.file("Executive_Summary.txt", summary);
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    setIsPanelOpen(true);
  };

  const selectedDayData = selectedDay ? getDayData(selectedDay) : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Smart Audit Calendar</h2>
          <p className="text-sm text-slate-500 font-medium italic">Monthly log of verified revenue stream and vendor logs.</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => setIsRangePanelOpen(true)}
            className="flex items-center space-x-3 px-8 py-4 bg-white border border-slate-200 text-slate-900 rounded-[1.5rem] font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all shadow-lg active:scale-95"
          >
            <ICONS.Download className="w-4 h-4" />
            <span>Range Export</span>
          </button>
          <button 
            onClick={() => handleDownloadRange(
              new Date(currentYear, currentMonthIndex, 1).toISOString().split('T')[0],
              new Date(currentYear, currentMonthIndex + 1, 0).toISOString().split('T')[0],
              monthName
            )}
            disabled={isZipping}
            className="flex items-center space-x-3 px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-95 disabled:opacity-50"
          >
            {isZipping ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <ICONS.Calendar className="w-4 h-4" />
            )}
            <span>{isZipping ? 'Bundling...' : 'Export Current Month'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col ring-1 ring-slate-100">
          <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-black text-slate-900 uppercase text-2xl tracking-tighter">{monthName} {currentYear}</h3>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2"><div className="w-4 h-4 rounded-full bg-indigo-500 shadow-lg shadow-indigo-100"></div><span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Revenue</span></div>
              <div className="flex items-center space-x-2"><div className="w-4 h-4 rounded-full bg-orange-500 shadow-lg shadow-orange-100"></div><span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bills</span></div>
            </div>
          </div>
          
          <div className="p-6 md:p-10">
            <div className="calendar-grid border-b border-slate-100 mb-8 pb-4">
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
                <div key={d} className="py-2 text-center text-[11px] font-black text-slate-400 tracking-[0.4em]">{d}</div>
              ))}
            </div>
            
            <div className="calendar-grid gap-4 md:gap-6">
              {emptyDays.map(i => <div key={`empty-${i}`} className="aspect-square opacity-0"></div>)}
              {days.map(day => {
                const data = getDayData(day);
                const hasData = data.revenue > 0 || data.dayBills.length > 0;
                
                return (
                  <div 
                    key={day} 
                    onClick={() => handleDayClick(day)}
                    className={`aspect-square p-4 md:p-6 rounded-[2.5rem] flex flex-col items-center justify-between transition-all cursor-pointer border-2 relative group overflow-hidden ${
                      hasData 
                        ? 'bg-white border-slate-100 hover:border-indigo-400 hover:shadow-2xl hover:-translate-y-2' 
                        : 'bg-slate-50/50 border-transparent opacity-20 hover:opacity-100'
                    }`}
                  >
                    <div className="w-full flex justify-between items-start relative z-10">
                       <span className={`text-sm md:text-lg font-black ${hasData ? 'text-slate-900' : 'text-slate-400'}`}>{day}</span>
                    </div>
                    
                    {data.revenue > 0 ? (
                      <div className="text-center w-full relative z-10">
                        <p className="text-[10px] md:text-2xl font-black text-indigo-600 tracking-tighter leading-none transition-all group-hover:scale-110">
                          {symbol}{Math.round(data.revenue / 1000)}k
                        </p>
                        <p className="text-[8px] font-black text-slate-400 uppercase mt-2 tracking-[0.2em]">Verified</p>
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-slate-100"></div>
                    )}

                    <div className="flex gap-1.5 w-full justify-center relative z-10">
                       {data.daySales.length > 0 && (
                         <div className="flex items-center space-x-1 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                           <span className="text-[8px] font-black text-indigo-600">{data.daySales.length}</span>
                         </div>
                       )}
                       {data.dayBills.length > 0 && (
                         <div className="flex items-center space-x-1 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                           <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                           <span className="text-[8px] font-black text-orange-600">{data.dayBills.length}</span>
                         </div>
                       )}
                    </div>

                    {hasData && (
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
      </div>

      {/* Custom Range Selection Panel */}
      {isRangePanelOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/80 z-[60] backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setIsRangePanelOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl z-[70] border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-500 rounded-l-[4rem] overflow-hidden">
             <div className="p-12 bg-slate-900 text-white">
                <div className="flex justify-between items-start mb-10">
                   <div>
                      <h4 className="font-black text-4xl tracking-tighter uppercase leading-none">Bulk Audit Export</h4>
                      <p className="text-indigo-400 font-bold text-[10px] uppercase tracking-widest mt-3">Select range or use quick-select</p>
                   </div>
                   <button onClick={() => setIsRangePanelOpen(false)} className="p-4 bg-white/10 hover:bg-white/20 rounded-3xl transition-all">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                   </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <button 
                      onClick={() => setRangeLastDays(7)}
                      className="p-6 bg-white/5 border border-white/10 rounded-[2rem] text-left hover:bg-indigo-600 transition-all group"
                   >
                      <p className="text-[10px] font-black uppercase text-indigo-400 group-hover:text-white mb-2">Weekly</p>
                      <p className="text-xl font-black">Last 7 Days</p>
                   </button>
                   <button 
                      onClick={setRangeMonth}
                      className="p-6 bg-white/5 border border-white/10 rounded-[2rem] text-left hover:bg-indigo-600 transition-all group"
                   >
                      <p className="text-[10px] font-black uppercase text-indigo-400 group-hover:text-white mb-2">Monthly</p>
                      <p className="text-xl font-black">Current Month</p>
                   </button>
                </div>
             </div>

             <div className="p-12 flex-1 space-y-10">
                <div className="space-y-6">
                   <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manual Range Selection</h5>
                   <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Audit Start Date</label>
                        <input 
                           type="date" 
                           value={rangeFrom}
                           onChange={(e) => setRangeFrom(e.target.value)}
                           className="w-full bg-slate-50 border-0 rounded-[2rem] p-6 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Audit End Date</label>
                        <input 
                           type="date" 
                           value={rangeTo}
                           onChange={(e) => setRangeTo(e.target.value)}
                           className="w-full bg-slate-50 border-0 rounded-[2rem] p-6 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                        />
                      </div>
                   </div>
                </div>

                <div className="pt-10 border-t border-slate-50">
                   <button 
                      onClick={() => handleDownloadRange(rangeFrom, rangeTo, "Custom_Range")}
                      disabled={isZipping}
                      className="w-full p-8 bg-indigo-600 text-white rounded-[3rem] shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-2 transition-all active:scale-95 flex items-center justify-center space-x-4 group"
                   >
                      {isZipping ? (
                         <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                         <ICONS.Download className="w-8 h-8 group-hover:rotate-12 transition-transform" />
                      )}
                      <div className="text-left">
                         <p className="text-xl font-black tracking-tight leading-none uppercase">Generate Bundle</p>
                         <p className="text-[10px] text-indigo-200 font-bold uppercase mt-2 tracking-widest">Exporting range to ZIP archive</p>
                      </div>
                   </button>
                </div>
             </div>
          </div>
        </>
      )}

      {/* Day Details Panel */}
      {isPanelOpen && selectedDayData && (
        <>
          <div className="fixed inset-0 bg-slate-900/80 z-[60] backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setIsPanelOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl z-[70] border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-500 rounded-l-[4rem] overflow-hidden">
            <div className="p-12 bg-slate-900 text-white relative">
              <div className="absolute top-0 right-0 p-12 opacity-5 -rotate-12">
                <ICONS.Sales className="w-48 h-48" />
              </div>
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <h4 className="font-black text-5xl tracking-tighter uppercase leading-none">Daily Archive</h4>
                  <p className="text-indigo-400 font-black text-xs uppercase tracking-widest mt-4 bg-indigo-500/10 inline-block px-4 py-1 rounded-full">{selectedDayData.dateStr}</p>
                </div>
                <button onClick={() => setIsPanelOpen(false)} className="p-4 bg-white/10 hover:bg-white/20 rounded-3xl transition-all group active:scale-90">
                  <svg className="group-hover:rotate-90 transition-transform" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="mt-12 p-8 bg-white/5 rounded-[3rem] border border-white/10 backdrop-blur-3xl shadow-2xl ring-1 ring-white/20">
                 <h5 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">Audit Briefing</h5>
                 <p className="text-lg font-bold leading-tight italic tracking-tight">
                   {selectedDayData.revenue > 0 || selectedDayData.dayBills.length > 0
                     ? `Verified ${symbol}${selectedDayData.revenue.toLocaleString()} revenue and ${selectedDayData.dayBills.length} expense logs. Use the tools below to download or manage entries.` 
                     : "No entries for this date."}
                 </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-12 space-y-12">
              {(selectedDayData.revenue > 0 || selectedDayData.dayBills.length > 0) && (
                <div className="space-y-5">
                  <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Daily Audit Bundle</h5>
                  <button 
                    onClick={() => handleDownloadRange(selectedDayData.dateStr, selectedDayData.dateStr, "Day")}
                    disabled={isZipping}
                    className="w-full p-10 bg-indigo-600 rounded-[3rem] text-white flex items-center justify-between group hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 hover:-translate-y-2 active:scale-95"
                  >
                    <div className="flex items-center space-x-6 text-left">
                      <div className="p-5 bg-white text-indigo-600 rounded-[1.5rem] shadow-xl group-hover:rotate-12 transition-transform">
                        {isZipping ? <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div> : <ICONS.Download className="w-8 h-8" />}
                      </div>
                      <div>
                        <p className="text-2xl font-black tracking-tight leading-none">Download Day Archive</p>
                        <p className="text-[11px] text-indigo-200 font-bold uppercase mt-2 tracking-widest">Original Docs + Reports</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              <div className="space-y-6">
                 <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Verified Entries</h5>
                 {selectedDayData.daySales.map((s: SaleRecord) => (
                   <div key={s.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] flex items-center justify-between group hover:bg-white hover:shadow-2xl hover:border-indigo-100 transition-all">
                      <div className="flex items-center space-x-5">
                        <div className={`p-4 rounded-2xl ${s.type === SaleRecordType.SEGREGATION ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                           <ICONS.Sales className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">{s.type.replace('_', ' ')}</p>
                          <p className="text-[11px] text-slate-400 font-bold truncate max-w-[150px] mt-2 italic">{s.source}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <p className="text-xl font-black text-slate-900 tracking-tighter">{symbol}{s.amount.toLocaleString()}</p>
                        <button 
                          onClick={() => { if(confirm("Prune this record from ledger?")) onRemoveSale(s.id); }}
                          className="p-3 bg-white text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl shadow-sm transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                   </div>
                 ))}
                 
                 {selectedDayData.dayBills.map((b: VendorBill) => (
                   <div key={b.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] flex items-center justify-between group hover:bg-white hover:shadow-2xl hover:border-orange-100 transition-all">
                      <div className="flex items-center space-x-5">
                        <div className="p-4 bg-orange-100 text-orange-600 rounded-2xl">
                           <ICONS.Vendors className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase tracking-widest truncate max-w-[150px] leading-none">{b.vendorName}</p>
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-2">{b.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <p className="text-xl font-black text-orange-600 tracking-tighter">{getCurrencySymbol(b.currency)}{b.amount.toLocaleString()}</p>
                        <button 
                          onClick={() => { if(confirm("Prune this bill from ledger?")) onRemoveBill(b.id); }}
                          className="p-3 bg-white text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl shadow-sm transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  function getCurrencySymbol(code: string = 'INR') {
    switch (code) {
      case 'USD': return '$';
      case 'GBP': return '£';
      case 'EUR': return '€';
      case 'AED': return 'د.إ';
      default: return '₹';
    }
  }
};
