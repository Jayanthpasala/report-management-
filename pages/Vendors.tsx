
import React, { useState } from 'react';
import { VendorBill, Outlet, UserRole, Vendor, ExpenseCategory } from '../types';
import { ICONS } from '../constants';
import { parseVendorBill } from '../services/geminiService';
import { getExchangeRateToINR } from '../services/currencyService';

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
  const [billAnalysis, setBillAnalysis] = useState<{ raw: any; bill: VendorBill; fileName: string; fileBase64: string; } | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

  const outletVendors = vendors.filter(v => v.outletId === currentOutlet?.id);
  const filteredBills = bills.filter(b => b.outletId === currentOutlet?.id);

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
          fileName: file.name,
          fileData: base64,
          fileMimeType: file.type
        };
        setBillAnalysis({ raw: data, bill: newBill, fileName: file.name, fileBase64: base64 });
        setStatusMsg(null);
      }
    } catch (err) { setStatusMsg({ text: "Extraction failed.", type: 'error' }); } finally { setProcessingVendorId(null); }
  };

  const confirmBill = () => {
    if (billAnalysis && currentOutlet) {
      setBills(billAnalysis.bill);
      setBillAnalysis(null);
      setStatusMsg({ text: `Bill recorded successfully`, type: 'success' });
      setTimeout(() => setStatusMsg(null), 3000);
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
    setBills(newBill);
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
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Operational Expenditures</h2>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Managing {currentOutlet?.name} local ledger.</p>
        </div>
        <div className="flex bg-slate-200/50 p-1 rounded-xl">
          <button onClick={() => setActiveTab('vendors')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg ${activeTab === 'vendors' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Bill Portal</button>
          <button onClick={() => setActiveTab('fixed')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg ${activeTab === 'fixed' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Fixed Logs</button>
          <button onClick={() => setActiveTab('manage')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg ${activeTab === 'manage' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Manage Vendors</button>
        </div>
      </div>

      {statusMsg && (
        <div className={`px-4 py-3 rounded-2xl text-[10px] font-black animate-in slide-in-from-top-4 border shadow-sm ${statusMsg.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-900 border-slate-800 text-white'}`}>
          <span>{statusMsg.text.toUpperCase()}</span>
        </div>
      )}

      {billAnalysis && (
        <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
           <div className="p-10 bg-slate-50 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-8">
              <div className="max-w-md">
                 <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Verify Vendor Entry</h3>
                 <p className="text-xs font-bold text-slate-400 mt-3 uppercase tracking-wide leading-relaxed">Extracted from <span className="text-indigo-600 underline">{billAnalysis.fileName}</span></p>
              </div>
              <div className="bg-slate-900 p-8 rounded-[3rem] text-white flex flex-col items-center justify-center min-w-[320px] shadow-3xl">
                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Invoice Value</p>
                 <h2 className="text-5xl font-black">{getCurrencySymbol(billAnalysis.bill.currency)}{billAnalysis.bill.amount.toLocaleString()}</h2>
                 <div className="flex gap-3 mt-6">
                    <button onClick={confirmBill} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-2xl shadow-xl shadow-indigo-950/20">Commit Locally</button>
                    <button onClick={() => setBillAnalysis(null)} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase rounded-2xl">Discard</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'vendors' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {outletVendors.map((vendor) => {
            const isProcessing = processingVendorId === vendor.id;
            const vendorBills = filteredBills.filter(b => b.vendorId === vendor.id);
            const vendorTotal = vendorBills.reduce((sum, b) => sum + b.amount, 0);
            return (
              <div key={vendor.id} className={`bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group relative ${isProcessing ? 'opacity-50' : 'hover:shadow-md'}`}>
                {isProcessing && <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm"><div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>}
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-lg">{vendor.name.charAt(0)}</div>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black uppercase rounded tracking-wider">{vendor.category}</span>
                  </div>
                  <h3 className="font-black text-slate-900 text-md truncate uppercase tracking-tight">{vendor.name}</h3>
                  <div className="mt-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aggregate Spend</p>
                    <p className="text-lg font-black text-slate-900">{getCurrencySymbol(currentOutlet?.currency)}{vendorTotal.toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 border-t border-slate-100">
                  <div className="relative">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleBillUpload(e, vendor)} />
                    <button className="w-full py-2 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg">Scan & Log</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'fixed' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div><h3 className="font-black text-slate-900 uppercase tracking-tight">Direct Expense Logs</h3><p className="text-xs text-slate-500">Capture Rent, Salaries, and Petty Cash disbursements</p></div>
            <button onClick={() => setShowFixedForm(true)} className="px-6 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl">New Log Entry</button>
          </div>
          {showFixedForm && (
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-50 shadow-2xl animate-in zoom-in-95">
              <form onSubmit={handleFixedSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <select className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold outline-none" value={fixedData.category} onChange={e => setFixedData({...fixedData, category: e.target.value as ExpenseCategory})}>
                    <option value={ExpenseCategory.RENT}>Rent</option>
                    <option value={ExpenseCategory.SALARY}>Salary / Wages</option>
                    <option value={ExpenseCategory.PETTY_CASH}>Petty Cash</option>
                    <option value={ExpenseCategory.UTILITIES}>Utilities</option>
                  </select>
                  <input required type="number" className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold outline-none" value={fixedData.amount} onChange={e => setFixedData({...fixedData, amount: e.target.value})} placeholder="Value" />
                  <input required type="date" className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold outline-none" value={fixedData.date} onChange={e => setFixedData({...fixedData, date: e.target.value})} />
                </div>
                <input type="text" className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold outline-none" value={fixedData.note} onChange={e => setFixedData({...fixedData, note: e.target.value})} placeholder="Note / Remarks" />
                <div className="flex items-center space-x-3 pt-4 border-t border-slate-50">
                   <button type="submit" className="flex-1 py-4 bg-slate-900 text-white text-[10px] font-black uppercase rounded-2xl">Log Record</button>
                   <button type="button" onClick={() => setShowFixedForm(false)} className="px-8 py-4 bg-slate-100 text-slate-400 text-[10px] font-black uppercase rounded-2xl">Cancel</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
           <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-8">Provision Vendor</h3>
           <form onSubmit={handleAddVendorSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <input required className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold outline-none" value={newVendorData.name} onChange={e => setNewVendorData({...newVendorData, name: e.target.value})} placeholder="Vendor Name" />
              <select className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold outline-none" value={newVendorData.category} onChange={e => setNewVendorData({...newVendorData, category: e.target.value as ExpenseCategory})}>
                {Object.values(ExpenseCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-2xl shadow-lg">Add to Registry</button>
           </form>
        </div>
      )}
    </div>
  );
};
