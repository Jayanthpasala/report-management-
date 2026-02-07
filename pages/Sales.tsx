
import React, { useState } from 'react';
import { SaleRecord, SaleRecordType, Outlet } from '../types';
import { ICONS } from '../constants';
import { parsePaymentSegregation, parseItemWiseBreakdown } from '../services/geminiService';
import { getExchangeRateToINR } from '../services/currencyService';

interface SalesProps {
  currentOutlet: Outlet | null;
  sales: SaleRecord[];
  setSales: (record: SaleRecord) => void;
}

export const Sales: React.FC<SalesProps> = ({ currentOutlet, setSales }) => {
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [itemsFile, setItemsFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [analysisReport, setAnalysisReport] = useState<{
    paymentRecords: SaleRecord[],
    itemRecords: SaleRecord[],
    totalPaymentValue: number,
    totalItemValue: number,
    paymentTotals: Record<string, number>,
    paymentBase64: string,
    itemsBase64: string
  } | null>(null);

  const cleanNumber = (item: any): number => {
    const val = item.amount ?? item.Amount ?? item.total ?? item.Total ?? item.value ?? item.Value;
    if (typeof val === 'number') return val;
    if (val === null || val === undefined) return 0;
    const cleaned = String(val).replace(/[^0-9.-]+/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'payment' | 'items') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === 'payment') setPaymentFile(file);
    else setItemsFile(file);
    setAnalysisReport(null);
  };

  const handleProceed = async () => {
    if (!paymentFile || !itemsFile || !currentOutlet) return;
    setIsProcessing(true);
    setStatusMsg("AI reconciling dual-stream data...");
    try {
      const rate = await getExchangeRateToINR(currentOutlet.currency);
      const readFile = (file: File): Promise<string> => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const [paymentBase64, itemsBase64] = await Promise.all([readFile(paymentFile), readFile(itemsFile)]);
      const [paymentDataRaw, itemsDataRaw] = await Promise.all([
        parsePaymentSegregation(paymentBase64, paymentFile.type), 
        parseItemWiseBreakdown(itemsBase64, itemsFile.type)
      ]);
      
      const paymentData = Array.isArray(paymentDataRaw) ? paymentDataRaw : (paymentDataRaw?.items || []);
      const itemsData = Array.isArray(itemsDataRaw) ? itemsDataRaw : (itemsDataRaw?.items || []);

      const mapToRecords = (data: any[], fileName: string, type: SaleRecordType, base64: string, mime: string) => 
        data.map((item: any) => {
          const rawAmount = cleanNumber(item);
          return {
            id: `S-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            date: item.date || new Date().toISOString().split('T')[0],
            outletId: currentOutlet.id,
            type: type,
            paymentMethod: item.paymentMethod || 'General',
            amount: rawAmount,
            amountINR: rawAmount * rate,
            itemCategory: item.itemCategory,
            itemName: item.itemName,
            quantity: Number(item.quantity || 0),
            source: fileName,
            fileData: base64,
            fileMimeType: mime
          };
        });

      const pRecords = mapToRecords(paymentData, paymentFile.name, SaleRecordType.SEGREGATION, paymentBase64, paymentFile.type);
      const iRecords = mapToRecords(itemsData, itemsFile.name, SaleRecordType.ITEM_WISE, itemsBase64, itemsFile.type);

      // Calculate Payment Totals for UI breakdown
      const payTotals: Record<string, number> = {};
      pRecords.forEach(r => {
        const method = r.paymentMethod || 'Other';
        payTotals[method] = (payTotals[method] || 0) + r.amount;
      });

      setAnalysisReport({
        paymentRecords: pRecords,
        itemRecords: iRecords,
        totalPaymentValue: pRecords.reduce((sum, r) => sum + r.amount, 0),
        totalItemValue: iRecords.reduce((sum, r) => sum + r.amount, 0),
        paymentTotals: payTotals,
        paymentBase64,
        itemsBase64
      });
      setStatusMsg(null);
    } catch (err) {
      console.error(err);
      setStatusMsg("AI analysis encountered an error.");
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmReport = async () => {
    if (analysisReport && currentOutlet) {
      setStatusMsg("Pushing to local ledger...");
      const allRecords = [...analysisReport.paymentRecords, ...analysisReport.itemRecords];
      allRecords.forEach(r => setSales(r));
      
      setAnalysisReport(null);
      setPaymentFile(null);
      setItemsFile(null);
      setStatusMsg("Success! Local Ledger Updated.");
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const getCurrencySymbol = (code: string = 'INR') => {
    switch (code) {
      case 'USD': return '$';
      case 'GBP': return '£';
      case 'EUR': return '€';
      case 'AED': return 'د.إ';
      default: return '₹';
    }
  };

  const symbol = getCurrencySymbol(currentOutlet?.currency);

  const getPaymentIcon = (method: string) => {
    const m = method.toLowerCase();
    if (m.includes('upi')) return '📱';
    if (m.includes('card')) return '💳';
    if (m.includes('cash')) return '💵';
    if (m.includes('online')) return '🌐';
    return '💰';
  };

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-20 px-4">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center space-x-2 bg-indigo-50 px-4 py-1 rounded-full text-indigo-600">
           <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
           <span className="text-[10px] font-black uppercase tracking-widest">Revenue Integrity System</span>
        </div>
        <h2 className="text-5xl font-black text-slate-900 tracking-tight uppercase leading-none">Sales Verification</h2>
        <p className="text-slate-500 font-medium max-w-xl mx-auto text-lg leading-relaxed">
           Upload POS summaries for <span className="text-indigo-600 font-bold underline decoration-indigo-200 underline-offset-4">AI-driven payment categorization</span> and itemized audit.
        </p>
      </div>

      {!analysisReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className={`group relative bg-white p-12 rounded-[3.5rem] border-2 border-dashed transition-all flex flex-col items-center justify-center min-h-[350px] shadow-sm ${paymentFile ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-200 hover:border-indigo-400'}`}>
            {!paymentFile && <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileSelect(e, 'payment')} />}
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-8 transition-transform group-hover:rotate-6 ${paymentFile ? 'bg-indigo-600 text-white shadow-2xl' : 'bg-slate-100 text-slate-400'}`}>
              <ICONS.Sales className="w-12 h-12" />
            </div>
            <div className="text-center">
              <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-2">1. Payment Summary</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Daily POS Segregation PDF/Excel</p>
              {paymentFile && (
                <div className="mt-6 px-4 py-2 bg-white rounded-xl border border-indigo-100 shadow-sm animate-in fade-in">
                  <p className="text-sm font-black text-indigo-600 truncate max-w-[200px]">{paymentFile.name}</p>
                </div>
              )}
            </div>
          </div>
          
          <div className={`group relative bg-white p-12 rounded-[3.5rem] border-2 border-dashed transition-all flex flex-col items-center justify-center min-h-[350px] shadow-sm ${itemsFile ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 hover:border-emerald-400'}`}>
            {!itemsFile && <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileSelect(e, 'items')} />}
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-8 transition-transform group-hover:-rotate-6 ${itemsFile ? 'bg-emerald-600 text-white shadow-2xl' : 'bg-slate-100 text-slate-400'}`}>
              <ICONS.Reports className="w-12 h-12" />
            </div>
            <div className="text-center">
              <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-2">2. Itemized Breakdown</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Product-wise Sales Log</p>
              {itemsFile && (
                <div className="mt-6 px-4 py-2 bg-white rounded-xl border border-emerald-100 shadow-sm animate-in fade-in">
                  <p className="text-sm font-black text-emerald-600 truncate max-w-[200px]">{itemsFile.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!analysisReport && (
        <div className="flex flex-col items-center justify-center">
          <button 
            onClick={handleProceed} 
            disabled={!paymentFile || !itemsFile || isProcessing} 
            className={`px-20 py-6 rounded-[2.5rem] font-black uppercase tracking-[0.25em] text-sm transition-all shadow-2xl ${
               (!paymentFile || !itemsFile) 
               ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none' 
               : isProcessing 
               ? 'bg-slate-900 text-white cursor-wait' 
               : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-2 active:scale-95'
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center space-x-3">
                 <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                 <span>Reconciling Ledger...</span>
              </div>
            ) : 'Run AI Categorization'}
          </button>
        </div>
      )}

      {statusMsg && (
        <div className="bg-slate-900 text-white p-6 rounded-[2rem] flex items-center justify-center space-x-4 animate-in slide-in-from-bottom-4 shadow-2xl border border-white/10 mx-auto max-w-md relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent"></div>
          <div className="relative z-10 flex items-center space-x-4">
             <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping"></div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em]">{statusMsg}</span>
          </div>
        </div>
      )}

      {analysisReport && (
        <div className="space-y-8 animate-in zoom-in-95 duration-500">
           <div className="bg-white rounded-[4rem] border border-slate-200 shadow-3xl overflow-hidden ring-1 ring-slate-100">
              <div className="p-12 bg-slate-50 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-12">
                 <div className="max-w-md">
                    <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-4">Audit Categorized</h3>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                       AI has mapped <span className="text-indigo-600 underline">{analysisReport.paymentRecords.length}</span> payment nodes and <span className="text-emerald-600 underline">{analysisReport.itemRecords.length}</span> itemized entries.
                    </p>
                 </div>
                 <div className="bg-slate-900 p-12 rounded-[3.5rem] text-white flex flex-col items-center justify-center min-w-[380px] shadow-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
                    <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-3 relative z-10">Total Verified Sales</p>
                    <h2 className="text-7xl font-black tracking-tighter relative z-10">{symbol}{analysisReport.totalPaymentValue.toLocaleString()}</h2>
                    <div className="flex items-center space-x-4 mt-10 relative z-10">
                       <button onClick={confirmReport} className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-[1.5rem] transition-all shadow-2xl shadow-indigo-950/40 active:scale-95">Commit to Ledger</button>
                       <button onClick={() => setAnalysisReport(null)} className="p-5 bg-white/10 hover:bg-white/20 text-white rounded-[1.5rem] transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                 </div>
              </div>

              <div className="p-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
                 {/* Payment Breakdown Card */}
                 <div className="space-y-8">
                    <div>
                       <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-2">Payment Segregation</h4>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Verified distribution across channels</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                       {Object.entries(analysisReport.paymentTotals).map(([method, amount]) => {
                          const percentage = (amount / analysisReport.totalPaymentValue) * 100;
                          return (
                            <div key={method} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col space-y-4 hover:bg-white hover:shadow-xl transition-all group">
                               <div className="flex justify-between items-center">
                                  <div className="flex items-center space-x-4">
                                     <div className="text-2xl p-3 bg-white rounded-2xl shadow-sm group-hover:rotate-12 transition-transform">{getPaymentIcon(method)}</div>
                                     <div>
                                        <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{method}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{percentage.toFixed(1)}% of total</p>
                                     </div>
                                  </div>
                                  <p className="text-2xl font-black text-slate-900 tracking-tighter">{symbol}{amount.toLocaleString()}</p>
                               </div>
                               <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                                </div>
                            </div>
                          );
                       })}
                    </div>
                 </div>

                 {/* SKU Quick View Card */}
                 <div className="space-y-8">
                    <div>
                       <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-2">Inventory Mapping</h4>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Top processed item logs</p>
                    </div>
                    <div className="space-y-3">
                       {analysisReport.itemRecords.slice(0, 6).map((item, idx) => (
                         <div key={idx} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-emerald-200 transition-colors">
                            <div className="flex items-center space-x-4">
                               <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-black uppercase">{idx + 1}</div>
                               <div>
                                  <p className="text-xs font-black text-slate-900 truncate max-w-[150px] uppercase tracking-tight">{item.itemName}</p>
                                  <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md">{item.itemCategory}</span>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className="text-sm font-black text-slate-900">{symbol}{item.amount.toLocaleString()}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase">Qty: {item.quantity}</p>
                            </div>
                         </div>
                       ))}
                       {analysisReport.itemRecords.length > 6 && (
                         <div className="text-center pt-2">
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">+ {analysisReport.itemRecords.length - 6} additional SKU logs identified</span>
                         </div>
                       )}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
