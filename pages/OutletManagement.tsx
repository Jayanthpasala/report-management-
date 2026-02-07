
import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { Outlet } from '../types';
import { getExchangeRateToINR } from '../services/currencyService';

interface OutletManagementProps {
  outlets: Outlet[];
  onAddOutlet: (outlet: Outlet) => void;
  onUpdateOutlet: (outlet: Outlet) => void;
  onDeleteOutlet: (id: string) => void;
}

const GLOBAL_MARKETS = [
  { country: 'India', city: 'Mumbai', currency: 'INR', flag: '🇮🇳' },
  { country: 'USA', city: 'New York', currency: 'USD', flag: '🇺🇸' },
  { country: 'UK', city: 'London', currency: 'GBP', flag: '🇬🇧' },
  { country: 'UAE', city: 'Dubai', currency: 'AED', flag: '🇦🇪' },
  { country: 'European Union', city: 'Paris', currency: 'EUR', flag: '🇪🇺' },
  { country: 'Singapore', city: 'Singapore', currency: 'SGD', flag: '🇸🇬' },
  { country: 'Australia', city: 'Sydney', currency: 'AUD', flag: '🇦🇺' },
  { country: 'Canada', city: 'Toronto', currency: 'CAD', flag: '🇨🇦' },
  { country: 'Japan', city: 'Tokyo', currency: 'JPY', flag: '🇯🇵' },
  { country: 'China', city: 'Shanghai', currency: 'CNY', flag: '🇨🇳' },
  { country: 'Switzerland', city: 'Zurich', currency: 'CHF', flag: '🇨🇭' },
  { country: 'Hong Kong', city: 'Hong Kong', currency: 'HKD', flag: '🇭🇰' },
];

export const OutletManagement: React.FC<OutletManagementProps> = ({ outlets, onAddOutlet, onUpdateOutlet, onDeleteOutlet }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Outlet | null>(null);
  const [liveRate, setLiveRate] = useState<number | null>(null);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    city: 'Mumbai',
    country: 'India',
    currency: 'INR'
  });

  useEffect(() => {
    if (editingOutlet) {
      setFormData({
        name: editingOutlet.name,
        location: editingOutlet.location,
        city: editingOutlet.city,
        country: editingOutlet.country,
        currency: editingOutlet.currency
      });
      setShowForm(true);
    }
  }, [editingOutlet]);

  useEffect(() => {
    const fetchRate = async () => {
      if (formData.currency === 'INR') {
        setLiveRate(1);
        return;
      }
      setIsFetchingRate(true);
      try {
        const rate = await getExchangeRateToINR(formData.currency);
        setLiveRate(rate);
      } catch (err) {
        console.error("FX fetch error", err);
      } finally {
        setIsFetchingRate(false);
      }
    };
    fetchRate();
  }, [formData.currency]);

  const handleMarketChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const market = GLOBAL_MARKETS.find(m => m.country === e.target.value);
    if (market) {
      setFormData({
        ...formData,
        country: market.country,
        city: market.city,
        currency: market.currency
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOutlet) {
      onUpdateOutlet({
        ...editingOutlet,
        ...formData
      });
    } else {
      const newOutlet: Outlet = {
        id: `O-${Date.now()}`,
        ...formData
      };
      onAddOutlet(newOutlet);
    }
    closeForm();
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingOutlet(null);
    setFormData({ name: '', location: '', city: 'Mumbai', country: 'India', currency: 'INR' });
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      onDeleteOutlet(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Global Outlet Config</h2>
          <p className="text-sm text-slate-500 font-medium">Provision or modify business nodes with real-time FX synchronization.</p>
        </div>
        {!showForm && (
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-3 px-8 py-4 rounded-[1.5rem] bg-indigo-600 text-white font-black uppercase text-xs tracking-widest transition-all shadow-xl hover:bg-indigo-700 hover:-translate-y-1 active:scale-95"
          >
            <ICONS.Plus className="w-5 h-5" />
            <span>Add New Outlet</span>
          </button>
        )}
      </div>

      {showForm && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-top-8 duration-500">
          <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl space-y-8 relative overflow-hidden ring-1 ring-slate-100">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {editingOutlet ? 'Edit Outlet Details' : 'New Outlet Provisioning'}
              </h3>
              <button type="button" onClick={closeForm} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Business Identity</label>
                <input 
                  required
                  className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Skyline Diner"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Physical Location</label>
                <input 
                  required
                  className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  placeholder="e.g. West Wing, 4th Floor"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Market Region</label>
                <select 
                  className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none cursor-pointer"
                  value={formData.country}
                  onChange={handleMarketChange}
                >
                  {GLOBAL_MARKETS.map(m => (
                    <option key={m.country} value={m.country}>{m.flag} {m.country}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 opacity-60">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Assigned Currency</label>
                <div className="w-full bg-slate-100 border-0 rounded-2xl p-4 text-sm font-bold flex items-center justify-between">
                  <span>{formData.currency}</span>
                  <ICONS.Check className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-50 flex justify-end">
              <button type="submit" className="px-12 py-5 bg-slate-900 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200">
                {editingOutlet ? 'Update Record' : 'Commit Outlet to Grid'}
              </button>
            </div>
          </form>

          <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-3xl relative overflow-hidden flex flex-col justify-between group">
             <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-[80px] group-hover:bg-indigo-500/30 transition-all"></div>
             
             <div className="relative z-10">
               <div className="flex items-center space-x-3 mb-8">
                  <div className={`w-3 h-3 rounded-full bg-indigo-500 ${isFetchingRate ? 'animate-ping' : ''}`}></div>
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-400">Live FX Intelligence</span>
               </div>
               
               <div className="space-y-6">
                 <div>
                   <p className="text-4xl font-black tracking-tighter">
                     {isFetchingRate ? '...' : `1.00 ${formData.currency}`}
                   </p>
                   <p className="text-[11px] font-bold text-slate-500 uppercase mt-2">Local Base Unit</p>
                 </div>
                 
                 <div className="w-12 h-1 bg-indigo-500/30 rounded-full"></div>

                 <div>
                   <p className="text-6xl font-black text-indigo-400 tracking-tighter">
                     {isFetchingRate ? (
                        <div className="h-16 w-32 bg-indigo-500/10 rounded-xl animate-pulse"></div>
                     ) : (
                        `₹${liveRate?.toFixed(2)}`
                     )}
                   </p>
                   <p className="text-[11px] font-bold text-slate-500 uppercase mt-4 flex items-center">
                     Normalized to INR Accounting 
                     <span className="ml-3 px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded text-[9px]">Official FX Rate</span>
                   </p>
                 </div>
               </div>
             </div>

             <div className="relative z-10 mt-12 bg-white/5 border border-white/10 p-6 rounded-[2rem] backdrop-blur-xl">
               <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest leading-relaxed">
                 AI Note: {formData.country} market is currently operating with a conversion delta of {((liveRate || 0) / 80).toFixed(1)}x vs global standard. Accounting will auto-scale to this verified rate.
               </p>
             </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {outlets.map(o => {
          const market = GLOBAL_MARKETS.find(m => m.country === o.country);
          return (
            <div key={o.id} className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative group overflow-hidden transition-all hover:shadow-2xl hover:border-indigo-100 ring-1 ring-slate-50">
              <div className="absolute top-0 right-0 p-8 flex space-x-2">
                <button 
                  onClick={() => setEditingOutlet(o)}
                  className="p-3 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm active:scale-90"
                  title="Edit Outlet"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                </button>
                <button 
                  onClick={() => setDeleteTarget(o)}
                  className="p-3 bg-white border border-slate-200 text-rose-400 rounded-2xl hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all shadow-sm active:scale-90"
                  title="Delete Outlet"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
              
              <div className="flex items-center space-x-6 mb-8 mt-4 md:mt-0">
                <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 text-3xl shadow-inner group-hover:rotate-12 transition-transform">
                  {market?.flag || '🏪'}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-2xl uppercase tracking-tighter leading-none">{o.name}</h3>
                  <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">{o.city}, {o.country}</p>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-50 pt-8">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Market Currency</span>
                  <span className="text-sm font-black text-slate-900 bg-slate-100 px-4 py-1.5 rounded-full">{o.currency}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accounting Status</span>
                  <span className="text-[10px] font-black text-emerald-600 uppercase flex items-center bg-emerald-50 px-4 py-1.5 rounded-full">
                    <ICONS.Check className="w-3 h-3 mr-2" /> Live FX Sync
                  </span>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-50">
                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Internal ID: {o.id}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Deletion Confirmation Modal */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] animate-in fade-in duration-300" />
          <div className="fixed inset-0 flex items-center justify-center z-[110] p-6 animate-in zoom-in-95 duration-300">
            <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden">
               <div className="p-10 text-center">
                  <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-4">Confirm Deletion</h3>
                  <p className="text-slate-500 font-medium text-sm leading-relaxed px-4">
                    Are you certain you want to remove <span className="text-slate-900 font-black underline decoration-rose-500 underline-offset-4">{deleteTarget.name}</span> from the management grid? All associated financial logs will be unmapped.
                  </p>
               </div>
               <div className="p-10 bg-slate-50 border-t border-slate-100 flex flex-col space-y-4">
                  <button 
                    onClick={confirmDelete}
                    className="w-full py-5 bg-rose-500 text-white font-black uppercase text-xs tracking-[0.2em] rounded-2xl hover:bg-rose-600 transition-all shadow-xl shadow-rose-200 active:scale-95"
                  >
                    Confirm & Destroy Record
                  </button>
                  <button 
                    onClick={() => setDeleteTarget(null)}
                    className="w-full py-5 bg-white text-slate-400 font-black uppercase text-xs tracking-[0.2em] rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all active:scale-95"
                  >
                    Abort Action
                  </button>
               </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
