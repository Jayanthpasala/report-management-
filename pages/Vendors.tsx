import React, { useState } from 'react';
import { VendorBill, Outlet, UserRole, Vendor, ExpenseCategory } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { parseVendorBill } from '../services/geminiService.ts';
import { getExchangeRateToINR } from '../services/currencyService.ts';
import { uploadFile } from '../services/db.ts';

interface VendorsProps {
  currentOutlet: Outlet | null;
  outlets: Outlet[];
  vendors: Vendor[];
  onAddVendor: (vendor: Vendor) => void;
  onUpdateVendor: (vendor: Vendor) => void;
  bills: VendorBill[];
  userRole: UserRole;
  setBills: (bill: VendorBill) => void;
}

export const Vendors: React.FC<VendorsProps> = ({ currentOutlet, outlets, vendors, onAddVendor, onUpdateVendor, bills, userRole, setBills }) => {
  const [activeTab, setActiveTab] = useState<'vendors' | 'fixed' | 'manage'>('vendors');
  const [processingVendorId, setProcessingVendorId] = useState<string | null>(null);
  const [showFixedForm, setShowFixedForm] = useState(false);
  const [newVendorData, setNewVendorData] = useState({ name: '', category: ExpenseCategory.RAW_MATERIAL, outletId: currentOutlet?.id || '' });
  const [fixedData, setFixedData] = useState({ category: ExpenseCategory.RENT, amount: '', date: new Date().toISOString().split('T')[0], note: '' });
  const [billAnalysis, setBillAnalysis] = useState<{ raw: any; bill: VendorBill; file: File } | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

  const outletVendors = vendors.filter(v => v.outletId === currentOutlet?.id);

  const getCurrencySymbol = (code: string = 'INR') => {
    switch (code) {
      case 'USD': return '$';
      case 'GBP': return '£';
      case 'EUR': return '€';
      case 'AED': return 'د.إ';
      default: return '₹';
    }
  };

  const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>, vendor: Vendor) => {
    const file = e.target.files?.[0];
    if (!file || !currentOutlet) return;
    e.target.value = '';
    setProcessingVendorId(vendor.id);
    setBillAnalysis(null);
    setStatusMsg({ text: `AI analyzing bill...`, type: 'info' });
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const data = await parseVendorBill(base64, file.type);
      if (data && typeof data.amount === 'number') {
        const rate = await getExchangeRateToINR(data.currency || currentOutlet.currency);
        const newBill: VendorBill = {
          id: `B-${Date.now()}`,
          vendorId: vendor.id,
          vendorName: data.vendorName || vendor.name,
          outletId: currentOutlet.id,
          date: data.date || new Date().toISOString().split('T')[0],
          amount: data.amount,
          currency: data.currency || currentOutlet.currency,
          amountINR: data.amount * rate,
          category: data.category || vendor.category,
          status: 'Approved',
          fileName: file.name
        };
        setBillAnalysis({ raw: data, bill: newBill, file: file });
        setStatusMsg(null);
      }
    } catch (err) { setStatusMsg({ text: "Extraction failed.", type: 'error' }); } finally { setProcessingVendorId(null); }
  };

  const confirmBill = async () => {
    if (billAnalysis && currentOutlet) {
      setStatusMsg({ text: 'Syncing to cloud...', type: 'info' });
      try {
        const fileUrl = await uploadFile(billAnalysis.file, `bills/${currentOutlet.id}/${Date.now()}_${billAnalysis.file.name}`);
        const finalizedBill = { 
          ...billAnalysis.bill, 
          fileData: fileUrl, 
          fileMimeType: billAnalysis.file.type 
        };
        await setBills(finalizedBill);
        setBillAnalysis(null);
        setStatusMsg({ text: `Bill recorded successfully`, type: 'success' });
        setTimeout(() => setStatusMsg(null), 3000);
      } catch (err) {
        setStatusMsg({ text: "Sync failed.", type: 'error' });
      }
    }
  };

  const handleFixedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet) return;
    const rate = await getExchangeRateToINR(currentOutlet.currency);
    const amt = parseFloat(fixedData.amount);
    const newBill: VendorBill = {
      id: `FIX-${Date.now()}`,
      vendorId: 'INTERNAL',
      vendorName: fixedData.category,
      outletId: currentOutlet.id,
      date: fixedData.date,
      amount: amt,
      currency: currentOutlet.currency,
      amountINR: amt * rate,
      category: fixedData.category,
      status: 'Approved',
      isFixedExpense: true,
      note: fixedData.note
    };
    await setBills(newBill);
    setShowFixedForm(false);
    setFixedData({ ...fixedData, amount: '', note: '' });
    setStatusMsg({ text: `${fixedData.category} logged`, type: 'success' });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleAddVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet) return;
    const v: Vendor = {
      id: `V-${Date.now()}`,
      name: newVendorData.name,
      outletId: currentOutlet.id,
      category: newVendorData.category,
      totalSpent: 0
    };
    onAddVendor(v);
    setNewVendorData({ name: '', category: ExpenseCategory.RAW_MATERIAL, outletId: currentOutlet.id });
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Operational Expenditures</h2>
          <p className="text-sm text-slate-500 font-medium">Syncing {currentOutlet?.name} ledger in real-time.</p>
        </div>
        <div className="flex bg-slate-200/50 p-1 rounded-xl">
          <button onClick={() => setActiveTab('vendors')} className={`px-4 py-2 text-xs font-black uppercase rounded-lg transition-all ${activeTab === 'vendors' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Bill Portal</button>
          <button onClick={() => setActiveTab('fixed')} className={`px-4 py-2 text-xs font-black uppercase rounded-lg transition-all ${activeTab === 'fixed' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Fixed Logs</button>
          <button onClick={() => setActiveTab('manage')} className={`px-4 py-2 text-xs font-black uppercase rounded-lg transition-all ${activeTab === 'manage' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Manage Vendors</button>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-xl text-xs font-black uppercase text-center transition-all ${
          statusMsg.type === 'success' ? 'bg-emerald-600 text-white' : statusMsg.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'
        }`}>
          {statusMsg.text}
        </div>
      )}

      {activeTab === 'vendors' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {outletVendors.map((vendor) => {
            const isProcessing = processingVendorId === vendor.id;
            return (
              <div key={vendor.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group hover:border-indigo-200 transition-colors">
                {isProcessing && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-3xl">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] font-black uppercase text-indigo-600 mt-3 tracking-widest">AI Audit...</span>
                  </div>
                )}
                <h3 className="font-black text-slate-900 uppercase">{vendor.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">{vendor.category}</p>
                <div className="relative">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleBillUpload(e, vendor)} />
                    <button className="w-full py-3 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-xl group-hover:bg-slate-900 transition-colors shadow-lg shadow-indigo-100">Scan & Log Bill</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {billAnalysis && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-6 backdrop-blur-md animate-in fade-in">
           <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl max-w-md w-full animate-in zoom-in-95">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
                 <ICONS.Check className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black uppercase mb-2 text-center">Confirm Cloud Entry</h3>
              <p className="text-xs text-slate-400 font-bold uppercase mb-8 text-center">{billAnalysis.bill.vendorName}</p>
              <p className="text-5xl font-black mb-10 text-center tracking-tighter text-slate-900">{getCurrencySymbol(billAnalysis.bill.currency)}{billAnalysis.bill.amount}</p>
              <div className="flex space-x-4">
                 <button onClick={confirmBill} className="flex-1 py-5 bg-indigo-600 text-white font-black uppercase text-xs rounded-2xl shadow-xl shadow-indigo-100">Confirm & Sync</button>
                 <button onClick={() => setBillAnalysis(null)} className="flex-1 py-5 bg-slate-100 text-slate-400 font-black uppercase text-xs rounded-2xl">Cancel</button>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
           <h3 className="text-xl font-black uppercase mb-8">Register New Vendor</h3>
           <form onSubmit={handleAddVendorSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vendor Name</label>
                 <input required className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold" value={newVendorData.name} onChange={e => setNewVendorData({...newVendorData, name: e.target.value})} placeholder="e.g. Fresh Produce Co." />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expense Type</label>
                 <select className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold" value={newVendorData.category} onChange={e => setNewVendorData({...newVendorData, category: e.target.value as ExpenseCategory})}>
                    {Object.values(ExpenseCategory).map(cat => (
                       <option key={cat} value={cat}>{cat}</option>
                    ))}
                 </select>
              </div>
              <div className="flex items-end">
                 <button type="submit" className="w-full py-4 bg-slate-900 text-white font-black uppercase text-xs rounded-2xl shadow-xl">Authorize Vendor</button>
              </div>
           </form>
        </div>
      )}
    </div>
  );
};