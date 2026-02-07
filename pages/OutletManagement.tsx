
import React, { useState } from 'react';
import { ICONS } from '../constants.tsx';
import { Outlet } from '../types.ts';

interface OutletManagementProps {
  outlets: Outlet[];
  onAddOutlet: (outlet: Outlet) => void;
  onUpdateOutlet: (outlet: Outlet) => void;
  onDeleteOutlet: (id: string) => void;
}

const SUPPORTED_CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee (₹)' },
  { code: 'USD', name: 'US Dollar ($)' },
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'GBP', name: 'British Pound (£)' },
  { code: 'AED', name: 'UAE Dirham (د.إ)' },
  { code: 'SAR', name: 'Saudi Riyal (SR)' },
  { code: 'QAR', name: 'Qatari Riyal (QR)' },
  { code: 'KWD', name: 'Kuwaiti Dinar (KD)' },
  { code: 'OMR', name: 'Omani Rial (RO)' },
  { code: 'BHD', name: 'Bahraini Dinar (BD)' },
  { code: 'SGD', name: 'Singapore Dollar (S$)' },
  { code: 'AUD', name: 'Australian Dollar (A$)' },
  { code: 'CAD', name: 'Canadian Dollar (C$)' },
  { code: 'JPY', name: 'Japanese Yen (¥)' },
  { code: 'HKD', name: 'Hong Kong Dollar (HK$)' },
  { code: 'CHF', name: 'Swiss Franc (CHF)' },
  { code: 'MYR', name: 'Malaysian Ringgit (RM)' },
  { code: 'THB', name: 'Thai Baht (฿)' },
];

export const OutletManagement: React.FC<OutletManagementProps> = ({ outlets, onAddOutlet, onUpdateOutlet, onDeleteOutlet }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  const [formData, setFormData] = useState({ 
    name: '', 
    location: '', 
    city: '', 
    country: 'India', 
    currency: 'INR' 
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.city || !formData.name) return;
    
    if (editingId) {
      onUpdateOutlet({ id: editingId, ...formData });
    } else {
      onAddOutlet({ id: `O-${Date.now()}`, ...formData });
    }
    
    resetForm();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', location: '', city: '', country: 'India', currency: 'INR' });
  };

  const handleEdit = (outlet: Outlet) => {
    setFormData({
      name: outlet.name,
      location: outlet.location,
      city: outlet.city,
      country: outlet.country,
      currency: outlet.currency
    });
    setEditingId(outlet.id);
    setShowForm(true);
  };

  const confirmDelete = () => {
    if (deleteConfirmText === 'DELETE' && deletingId) {
      onDeleteOutlet(deletingId);
      setDeletingId(null);
      setDeleteConfirmText('');
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Enterprise Node Config</h2>
          <p className="text-sm text-slate-500 font-medium">Provisioning and managing global business entities.</p>
        </div>
        <button 
          onClick={() => (showForm ? resetForm() : setShowForm(true))} 
          className={`px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl ${
            showForm ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1'
          }`}
        >
          {showForm ? 'Exit Portal' : 'Add New Node'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl space-y-8 animate-in slide-in-from-top-4 ring-2 ring-indigo-50">
           <div className="flex justify-between items-center">
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
               {editingId ? 'Modify Business Node' : 'Provision New Node'}
             </h3>
             {editingId && <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest">Editing: {editingId}</span>}
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Name</label>
                <input 
                  required 
                  className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" 
                  placeholder="e.g. Downtown Cafe" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Operational City</label>
                <input 
                  required 
                  className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" 
                  placeholder="e.g. Chennai" 
                  value={formData.city} 
                  onChange={e => setFormData({...formData, city: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Street Address / Location</label>
                <input 
                  required 
                  className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" 
                  placeholder="e.g. Anna Nagar, Block 4" 
                  value={formData.location} 
                  onChange={e => setFormData({...formData, location: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Functional Currency</label>
                <select 
                  className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                  value={formData.currency}
                  onChange={e => setFormData({...formData, currency: e.target.value})}
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
           </div>
           
           <div className="pt-6 border-t border-slate-50 flex justify-end space-x-4">
              <button type="button" onClick={resetForm} className="px-8 py-5 bg-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl">Cancel</button>
              <button type="submit" className="px-12 py-5 bg-slate-900 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-2xl hover:bg-indigo-600 transition-colors">
                {editingId ? 'Update Node' : 'Authorize & Provision'}
              </button>
           </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {outlets.map(o => (
          <div key={o.id} className="group bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 flex space-x-2 opacity-10 group-hover:opacity-100 transition-opacity">
               <button 
                onClick={() => handleEdit(o)}
                className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-colors"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
               </button>
               <button 
                onClick={() => setDeletingId(o.id)}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
               </button>
            </div>
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 text-indigo-600">
               <ICONS.Dashboard />
            </div>
            <h3 className="font-black text-2xl uppercase tracking-tighter mb-2 text-slate-900">{o.name}</h3>
            <div className="flex flex-col space-y-1">
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest flex items-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                 {o.city}, {o.country}
              </p>
              <p className="text-[10px] text-indigo-500 uppercase font-black tracking-widest flex items-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
                 Reporting in {o.currency}
              </p>
            </div>
          </div>
        ))}
        {outlets.length === 0 && !showForm && (
          <div className="lg:col-span-3 py-32 text-center bg-slate-100/50 rounded-[3rem] border-2 border-dashed border-slate-200">
             <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-xs">No Nodes Active: Please provision a business node</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setDeletingId(null)}></div>
           <div className="relative bg-white w-full max-w-md rounded-[3.5rem] p-12 shadow-2xl border border-white/20 animate-in zoom-in-95">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-8 mx-auto ring-8 ring-rose-50/50">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 text-center uppercase tracking-tighter mb-2">Destructive Action</h3>
              <p className="text-sm text-slate-500 text-center font-medium leading-relaxed mb-8">
                This will permanently purge all sales data, vendor records, and financial history for <span className="text-slate-900 font-black uppercase">{outlets.find(o => o.id === deletingId)?.name}</span>.
              </p>
              
              <div className="space-y-4">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Type <span className="text-rose-500 underline">DELETE</span> to confirm wipe</p>
                 <input 
                   type="text" 
                   className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-center text-sm font-black tracking-[0.2em] outline-none ring-2 ring-transparent focus:ring-rose-200 transition-all uppercase" 
                   placeholder="Type Here"
                   value={deleteConfirmText}
                   onChange={(e) => setDeleteConfirmText(e.target.value)}
                 />
                 
                 <div className="flex space-x-4 pt-4">
                    <button 
                      onClick={() => setDeletingId(null)} 
                      className="flex-1 py-4 bg-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-slate-200 transition-colors"
                    >
                      Abort
                    </button>
                    <button 
                      onClick={confirmDelete}
                      disabled={deleteConfirmText !== 'DELETE'}
                      className="flex-1 py-4 bg-rose-500 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-rose-200 disabled:opacity-30 disabled:shadow-none transition-all hover:bg-rose-600"
                    >
                      Permanent Wipe
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
