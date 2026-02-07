import React, { useState } from 'react';
import { SaleRecord, SaleRecordType, Outlet } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { parsePaymentSegregation, parseItemWiseBreakdown } from '../services/geminiService.ts';
import { getExchangeRateToINR } from '../services/currencyService.ts';

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

  const symbol = currentOutlet?.currency === 'INR' ? '₹' : (currentOutlet?.currency === 'USD' ? '$' : '£');

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-20 px-4">
      <div className="text-center space-y-4">
        <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tight">Sales Verification</h2>
        <p className="text-slate-500 font-medium max-w-xl mx-auto text-lg leading-relaxed">
           Upload POS summaries for AI-driven payment categorization.
        </p>
      </div>

      {!analysisReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="group relative bg-white p-12 rounded-[3.5rem] border-2 border-dashed border-slate-200 transition-all flex flex-col items-center justify-center min-h-[350px]">
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileSelect(e, 'payment')} />
            <div className="w-24 h-24 rounded-3xl bg-slate-100 flex items-center justify-center mb-8"><ICONS.Sales className="w-12 h-12" /></div>
            <p className="font-black text-slate-900 uppercase tracking-widest text-xs">1. Payment Summary</p>
            {paymentFile && <p className="mt-4 text-xs text-indigo-600 font-black">{paymentFile.name}</p>}
          </div>
          
          <div className="group relative bg-white p-12 rounded-[3.5rem] border-2 border-dashed border-slate-200 transition-all flex flex-col items-center justify-center min-h-[350px]">
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileSelect(e, 'items')} />
            <div className="w-24 h-24 rounded-3xl bg-slate-100 flex items-center justify-center mb-8"><ICONS.Reports className="w-12 h-12" /></div>
            <p className="font-black text-slate-900 uppercase tracking-widest text-xs">2. Itemized Breakdown</p>
            {itemsFile && <p className="mt-4 text-xs text-emerald-600 font-black">{itemsFile.name}</p>}
          </div>
        </div>
      )}

      {!analysisReport && (
        <div className="flex justify-center">
          <button 
            onClick={handleProceed} 
            disabled={!paymentFile || !itemsFile || isProcessing}
            className="px-20 py-6 rounded-[2.5rem] bg-indigo-600 text-white font-black uppercase tracking-[0.25em] text-sm shadow-2xl disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Run AI Categorization'}
          </button>
        </div>
      )}

      {analysisReport && (
        <div className="bg-white rounded-[4rem] border border-slate-200 shadow-3xl overflow-hidden p-12">
           <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-8">Verification Report</h3>
           <div className="bg-slate-900 p-12 rounded-[3.5rem] text-white text-center mb-12">
              <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-3">Total Verified Sales</p>
              <h2 className="text-7xl font-black tracking-tighter">{symbol}{analysisReport.totalPaymentValue.toLocaleString()}</h2>
              <div className="mt-10 flex justify-center space-x-4">
                 <button onClick={confirmReport} className="px-12 py-5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-[1.5rem]">Commit to Ledger</button>
                 <button onClick={() => setAnalysisReport(null)} className="px-12 py-5 bg-white/10 text-white text-[10px] font-black uppercase rounded-[1.5rem]">Cancel</button>
              </div>
           </div>
        </div>
      )}

      {statusMsg && <div className="text-center font-black uppercase text-xs text-slate-400 tracking-widest">{statusMsg}</div>}
    </div>
  );
};