
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

      setAnalysisReport({
        paymentRecords: pRecords,
        itemRecords: iRecords,
        totalPaymentValue: pRecords.reduce((sum, r) => sum + r.amount, 0),
        totalItemValue: iRecords.reduce((sum, r) => sum + r.amount, 0),
        paymentBase64,
        itemsBase64
      });
      setStatusMsg(null);
    } catch (err) {
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

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 px-4">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center space-x-2 bg-indigo-50 px-4 py-1 rounded-full text-indigo-600">
           <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
           <span className="text-[10px] font-black uppercase tracking-widest">Revenue Integrity System</span>
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Sales Data Verification</h2>
        <p className="text-slate-500 font-medium max-w-xl mx-auto">Upload POS summaries for instantaneous local-first reconciliation.</p>
      </div>

      {!analysisReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className={`group relative bg-white p-10 rounded-[2.5rem] border-2 border-dashed transition-all flex flex-col items-center justify-center min-h-[300px] shadow-sm ${paymentFile ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-200 hover:border-indigo-400'}`}>
            {!paymentFile && <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileSelect(e, 'payment')} />}
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${paymentFile ? 'bg-indigo-600 text-white shadow-2xl' : 'bg-slate-100 text-slate-400'}`}>
              <ICONS.Sales className="w-10 h-10" />
            </div>
            <div className="text-center">
              <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs">Payment Summary</h4>
              {paymentFile ? <p className="mt-3 text-sm font-bold text-indigo-600 truncate max-w-[220px]">{paymentFile.name}</p> : <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Drop POS Summary PDF</p>}
            </div>
          </div>
          <div className={`group relative bg-white p-10 rounded-[2.5rem] border-2 border-dashed transition-all flex flex-col items-center justify-center min-h-[300px] shadow-sm ${itemsFile ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 hover:border-emerald-400'}`}>
            {!itemsFile && <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileSelect(e, 'items')} />}
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${itemsFile ? 'bg-emerald-600 text-white shadow-2xl' : 'bg-slate-100 text-slate-400'}`}>
              <ICONS.Reports className="w-10 h-10" />
            </div>
            <div className="text-center">
              <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs">Itemized Breakdown</h4>
              {itemsFile ? <p className="mt-3 text-sm font-bold text-emerald-600 truncate max-w-[220px]">{itemsFile.name}</p> : <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Drop Itemized Audit PDF</p>}
            </div>
          </div>
        </div>
      )}

      {!analysisReport && (
        <div className="flex flex-col items-center justify-center pt-4">
          <button onClick={handleProceed} disabled={!paymentFile || !itemsFile || isProcessing} className={`px-16 py-5 rounded-[2.2rem] font-black uppercase tracking-[0.2em] text-sm transition-all shadow-2xl ${(!paymentFile || !itemsFile) ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none' : isProcessing ? 'bg-slate-900 text-white cursor-wait' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
            {isProcessing ? 'AI Reconciling...' : 'Run Reconciliation'}
          </button>
        </div>
      )}

      {statusMsg && (
        <div className="bg-slate-900 text-white p-6 rounded-3xl flex items-center justify-center space-x-4 animate-in slide-in-from-bottom-4 shadow-2xl border border-slate-700 mx-auto max-w-lg">
          <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping"></div>
          <span className="text-xs font-black uppercase tracking-widest">{statusMsg}</span>
        </div>
      )}

      {analysisReport && (
        <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 ring-1 ring-slate-100">
          <div className="p-10 bg-slate-50 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-10">
            <div className="max-w-md">
              <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Audit Analysis Ready</h3>
              <p className="text-xs font-bold text-slate-400 mt-3 uppercase tracking-wide leading-relaxed">Both documents will be committed to the local database after approval.</p>
            </div>
            <div className="bg-slate-900 p-10 rounded-[3rem] text-white flex flex-col items-center justify-center min-w-[340px] shadow-3xl">
               <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">Verified Revenue</p>
               <h2 className="text-6xl font-black">{symbol}{(analysisReport.totalPaymentValue || analysisReport.totalItemValue).toLocaleString()}</h2>
               <div className="flex items-center space-x-3 mt-8">
                  <button onClick={confirmReport} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-2xl transition-all shadow-xl">Confirm & Commit</button>
                  <button onClick={() => setAnalysisReport(null)} className="p-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
