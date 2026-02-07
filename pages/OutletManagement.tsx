import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants.tsx';
import { Outlet } from '../types.ts';
import { getExchangeRateToINR } from '../services/currencyService.ts';

interface OutletManagementProps {
  outlets: Outlet[];
  onAddOutlet: (outlet: Outlet) => void;
  onUpdateOutlet: (outlet: Outlet) => void;
  onDeleteOutlet: (id: string) => void;
}

export const OutletManagement: React.FC<OutletManagementProps> = ({ outlets, onAddOutlet, onUpdateOutlet, onDeleteOutlet }) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', location: '', city: 'Mumbai', country: 'India', currency: 'INR' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddOutlet({ id: `O-${Date.now()}`, ...formData });
    setShowForm(false);
    setFormData({ name: '', location: '', city: 'Mumbai', country: 'India', currency: 'INR' });
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-900 uppercase">Outlet Config</h2>
        <button onClick={() => setShowForm(true)} className="px-8 py-4 bg-indigo-600 text-white font-black uppercase text-xs rounded-2xl">Add Outlet</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-6">
           <input required className="w-full bg-slate-50 p-4 rounded-2xl" placeholder="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
           <input required className="w-full bg-slate-50 p-4 rounded-2xl" placeholder="Location" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
           <button type="submit" className="w-full py-4 bg-slate-900 text-white font-black uppercase rounded-2xl">Save Outlet</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {outlets.map(o => (
          <div key={o.id} className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
            <h3 className="font-black text-2xl uppercase mb-2">{o.name}</h3>
            <p className="text-xs text-slate-400 uppercase font-bold">{o.city}, {o.country}</p>
          </div>
        ))}
      </div>
    </div>
  );
};