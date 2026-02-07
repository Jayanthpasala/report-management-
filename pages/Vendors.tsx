import React, { useState } from 'react';
import { VendorBill, Outlet, UserRole, Vendor, ExpenseCategory } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { parseVendorBill } from '../services/geminiService.ts';
import { getExchangeRateToINR } from '../services/currencyService.ts';

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
          <p className="text-sm text-slate-500 font-medium">Managing {currentOutlet?.name} local ledger.</p>
        </div>
        <div className="flex bg-slate-200/50 p-1 rounded-xl">
          <button onClick={() => setActiveTab('vendors')} className={`px-4 py-2 text-xs font-black uppercase rounded-lg ${activeTab === 'vendors' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Bill Portal</button>
          <button onClick={() => setActiveTab('fixed')} className={`px-4 py-2 text-xs font-black uppercase rounded-lg ${activeTab === 'fixed' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Fixed Logs</button>
          <button onClick={() => setActiveTab('manage')} className={`px-4 py-2 text-xs font-black uppercase rounded-lg ${activeTab === 'manage' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Manage Vendors</button>
        </div>
      </div>

      {statusMsg && (
        <div className="bg-slate-900 text-white p-4 rounded-xl text-xs font-black uppercase text-center">{statusMsg.text}</div>
      )}

      {activeTab === 'vendors' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {outletVendors.map((vendor) => {
            const isProcessing = processingVendorId === vendor.id;
            return (
              <div key={vendor.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative">
                {isProcessing && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">...</div>}
                <h3 className="font-black text-slate-900 uppercase">{vendor.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">{vendor.category}</p>
                <div className="relative">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleBillUpload(e, vendor)} />
                    <button className="w-full py-2 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-lg">Scan & Log Bill</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {billAnalysis && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] p-6 backdrop-blur-sm">
           <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-md w-full">
              <h3 className="text-xl font-black uppercase mb-4">Confirm Entry</h3>
              <p className="text-4xl font-black mb-8">{getCurrencySymbol(billAnalysis.bill.currency)}{billAnalysis.bill.amount}</p>
              <div className="flex space-x-4">
                 <button onClick={confirmBill} className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase rounded-2xl">Confirm</button>
                 <button onClick={() => setBillAnalysis(null)} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black uppercase rounded-2xl">Cancel</button>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'fixed' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200">
           <form onSubmit={handleFixedSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <input required type="number" className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold" value={fixedData.amount} onChange={e => setFixedData({...fixedData, amount: e.target.value})} placeholder="Amount" />
              <select className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold" value={fixedData.category} onChange={e => setFixedData({...fixedData, category: e.target.value as ExpenseCategory})}>
                <option value={ExpenseCategory.RENT}>Rent</option>
                <option value={ExpenseCategory.SALARY}>Salary</option>
              </select>
              <button type="submit" className="w-full py-4 bg-slate-900 text-white font-black uppercase rounded-2xl">Log Entry</button>
           </form>
        </div>
      )}
    </div>
  );
};