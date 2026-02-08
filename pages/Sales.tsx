import React, { useState, useEffect } from 'react';
import { SaleRecord, SaleRecordType, Outlet } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { parsePaymentSegregation, parseItemWiseBreakdown } from '../services/geminiService.ts';
import { getExchangeRateToINR } from '../services/currencyService.ts';
import { uploadFile } from '../services/db.ts';

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
  const [fxRate, setFxRate] = useState<number>(1);
  const [isFxVerified, setIsFxVerified] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<{
    paymentRecords: SaleRecord[],
    itemRecords: SaleRecord[],
    totalPaymentValue: number,
    totalItemValue: number,
    paymentTotals: Record<string, number>,
    paymentFile: File,
    itemsFile: File,
    baseCurrency: string,
    targetOutletId: string
  } | null>(null);

  const cleanNumber = (item: any): number => {
    const val = item.amount ?? item.Amount ?? item.total ?? item.Total ?? item.value ?? item.Value;
    if (typeof val === 'number') return val;
    if (val === null || val === undefined) return 0;
    const cleaned = String(val).replace(/[^0-9.-]+/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const normalizeDate = (d: any): string => {
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
      return date.toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
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
    const targetOutletId = currentOutlet.id;
    setIsProcessing(true);
    setStatusMsg("AI reconciling payment streams and item data...");
    try {
      const rate = await getExchangeRateToINR(currentOutlet.currency);
      setFxRate(rate);
      setIsFxVerified(currentOutlet.currency === 'INR');

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

      const mapToRecords = (data: any[], fileName: string, type: SaleRecordType) => 
        data.map((item: any) => {
          const rawAmount = cleanNumber(item);
          return {
            id: `S-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            date: normalizeDate(item.date),
            outletId: targetOutletId,
            type: type,
            paymentMethod: item.paymentMethod || 'Other',
            amount: rawAmount,
            amountINR: rawAmount * rate,
            itemCategory: item.itemCategory,
            itemName: item.itemName,
            quantity: Number(item.quantity || 0),
            source: fileName
          } as SaleRecord;
        });

      const pRecords = mapToRecords(paymentData, paymentFile.name, SaleRecordType.SEGREGATION);
      const iRecords = mapToRecords(itemsData, itemsFile.name, SaleRecordType.ITEM_WISE);

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
        paymentFile: paymentFile,
        itemsFile: itemsFile,
        baseCurrency: currentOutlet.currency,
        targetOutletId
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
    if (analysisReport) {
      setStatusMsg("Synchronizing with cloud storage...");
      try {
        const payUrl = await uploadFile(analysisReport.paymentFile, `sales/${analysisReport.targetOutletId}/${Date.now()}_payment.pdf`);
        const itemUrl = await uploadFile(analysisReport.itemsFile, `sales/${analysisReport.targetOutletId}/${Date.now()}_items.pdf`);

        const allRecords = [
          ...analysisReport.paymentRecords.map(r => ({
            ...r,
            amountINR: r.amount * fxRate,
            fileData: payUrl,
            fileMimeType: analysisReport.paymentFile.type
          })),
          ...analysisReport.itemRecords.map(r => ({
            ...r,
            amountINR: r.amount * fxRate,
            fileData: itemUrl,
            fileMimeType: analysisReport.itemsFile.type
          }))
        ];

        // Process sequentially through the abstraction
        for(const r of allRecords) {
           await setSales(r);
        }

        setStatusMsg("Success! Ledger updated.");
        setTimeout(() => {
          setAnalysisReport(null);
          setPaymentFile(null);
          setItemsFile(null);
          setFxRate(1);
          setIsFxVerified(false);
          setStatusMsg(null);
        }, 1500);
      } catch (err) {
        console.error("Ledger synchronization failed:", err);
        setStatusMsg("Failed to synchronize data. Check network.");
      }
    }
  };

  const symbol = currentOutlet?.currency === 'INR' ? '₹' : (currentOutlet?.currency === 'USD' ? '$' : '£');

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-20 px-4">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">POS Data Integration</h2>
        <p className="text-slate-500 font-medium max-w-xl mx-auto text-lg leading-relaxed">
           Upload POS summaries for automated payment categorization (UPI, Card, Cash, Online) and item-wise tracking.
        </p>
      </div>

      {!analysisReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="group relative bg-white p-12 rounded-[3.5rem] border-2 border-dashed border-slate-200 hover:border-indigo-200 transition-all flex flex-col items-center justify-center min-h-[350px]">
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileSelect(e, 'payment')} />
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mb-8 transition-colors group-hover:bg-indigo-50 text-slate-400 group-hover:text-indigo-600">
               <ICONS.Sales className="w-10 h-10" />
            </div>
            <p className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Payment Summary (PDF/Excel)</p>
            {paymentFile && <p className="mt-4 text-[10px] text-indigo-600 font-black px-4 py-2 bg-indigo-50 rounded-full">{paymentFile.name}</p>}
          </div>
          
          <div className="group relative bg-white p-12 rounded-[3.5rem] border-2 border-dashed border-slate-200 hover:border-emerald-200 transition-all flex flex-col items-center justify-center min-h-[350px]">
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileSelect(e, 'items')} />
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mb-8 transition-colors group-hover:bg-emerald-50 text-slate-400 group-hover:text-emerald-600">
               <ICONS.Reports className="w-10 h-10" />
            </div>
            <p className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Itemized Breakdown (PDF/Excel)</p>
            {itemsFile && <p className="mt-4 text-[10px] text-emerald-600 font-black px-4 py-2 bg-emerald-50 rounded-full">{itemsFile.name}</p>}
          </div>
        </div>
      )}

      {!analysisReport && (
        <div className="flex justify-center">
          <button 
            onClick={handleProceed} 
            disabled={!paymentFile || !itemsFile || isProcessing}
            className="px-16 py-6 rounded-3xl bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl disabled:opacity-50 hover:bg-indigo-600 transition-all"
          >
            {isProcessing ? 'AI Processing POS Data...' : 'Start Categorization Engine'}
          </button>
        </div>
      )}

      {analysisReport && (
        <div className="space-y-8 animate-in zoom-in-95">
           {analysisReport.baseCurrency !== 'INR' && (
             <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden ring-4 ring-indigo-500/20">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                   <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                         <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">FX Conversion Engine</p>
                      </div>
                      <h3 className="text-2xl font-black uppercase tracking-tight">Verify Exchange Rate</h3>
                      <p className="text-slate-400 text-xs font-medium max-w-xs">Data extracted in {analysisReport.baseCurrency}. Verify the rate for INR settlement.</p>
                   </div>
                   
                   <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex items-center space-x-6">
                         <div className="text-center">
                            <p className="text-[8px] font-black text-indigo-300 uppercase mb-1">Base (1 {analysisReport.baseCurrency})</p>
                            <p className="text-2xl font-black">₹</p>
                         </div>
                         <input 
                            type="number"
                            step="0.01"
                            value={fxRate}
                            onChange={(e) => setFxRate(parseFloat(e.target.value) || 0)}
                            className="bg-slate-800 border-0 rounded-2xl p-4 text-xl font-black w-32 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                         />
                         <button 
                            onClick={() => setIsFxVerified(true)}
                            className={`p-4 rounded-2xl transition-all ${isFxVerified ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}
                         >
                            <ICONS.Check className="w-6 h-6" />
                         </button>
                      </div>
                      
                      <div className="text-right">
                         <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Converted Value</p>
                         <p className="text-3xl font-black text-emerald-400">₹{(analysisReport.totalPaymentValue * fxRate).toLocaleString()}</p>
                      </div>
                   </div>
                </div>
             </div>
           )}

           <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-3xl overflow-hidden p-10">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Categorization Result</h3>
                 <div className="px-4 py-2 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-full border border-emerald-100">Verified by Gemini</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                 <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Payment Breakdown ({analysisReport.baseCurrency})</p>
                    <div className="space-y-3">
                       {Object.entries(analysisReport.paymentTotals).map(([method, total]) => (
                          <div key={method} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                             <span className="text-[11px] font-black text-slate-900 uppercase">{method}</span>
                             <span className="text-[11px] font-black text-slate-900">{symbol}{total.toLocaleString()}</span>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="flex flex-col justify-center items-center bg-slate-900 p-8 rounded-3xl text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-600/30 rounded-full blur-[60px]"></div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2 relative z-10">Settlement in INR</p>
                    <h2 className="text-5xl font-black tracking-tighter relative z-10">₹{(analysisReport.totalPaymentValue * fxRate).toLocaleString()}</h2>
                    <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest opacity-60">
                      Rate: 1 {analysisReport.baseCurrency} = ₹{fxRate}
                    </p>
                    <div className="mt-8 flex space-x-3 relative z-10 w-full">
                       <button 
                        onClick={confirmReport} 
                        disabled={!isFxVerified && analysisReport.baseCurrency !== 'INR'}
                        className="flex-1 px-8 py-5 bg-indigo-600 text-white text-[11px] font-black uppercase rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-950/40 disabled:opacity-50"
                       >
                         Commit Ledger Entry
                       </button>
                       <button onClick={() => setAnalysisReport(null)} className="flex-1 px-8 py-5 bg-white/10 text-white text-[11px] font-black uppercase rounded-2xl border border-white/10">Discard Analysis</button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {statusMsg && (
        <div className="flex items-center justify-center space-x-3 bg-white py-4 px-8 rounded-full border border-slate-200 shadow-xl w-fit mx-auto animate-in slide-in-from-bottom-4">
           <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
           <div className="font-black uppercase text-[10px] text-slate-500 tracking-widest">{statusMsg}</div>
        </div>
      )}
    </div>
  );
};