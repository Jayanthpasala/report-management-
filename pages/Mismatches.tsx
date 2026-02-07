
import React from 'react';
import { Discrepancy, Outlet } from '../types';
import { ICONS } from '../constants';

interface MismatchesProps {
  currentOutlet: Outlet | null;
  mismatches: Discrepancy[];
  setMismatches: React.Dispatch<React.SetStateAction<Discrepancy[]>>;
}

export const Mismatches: React.FC<MismatchesProps> = ({ currentOutlet, mismatches, setMismatches }) => {
  const filtered = mismatches.filter(m => m.outletId === currentOutlet?.id);

  const resolveMismatch = (id: string) => {
    setMismatches(prev => prev.map(m => m.id === id ? {...m, resolved: true} : m));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Mismatch Detection</h2>
          <p className="text-sm text-slate-500">Cross-referencing sales data from POS vs Bank vs Manual records</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg flex items-center space-x-2">
          <ICONS.Mismatch className="text-amber-600" />
          <span className="text-xs font-bold text-amber-800">{filtered.filter(m => !m.resolved).length} Pending Review</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filtered.map((m) => (
          <div key={m.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${m.resolved ? 'border-slate-200 opacity-60' : 'border-rose-200 shadow-md shadow-rose-50'}`}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${m.resolved ? 'bg-slate-100 text-slate-400' : 'bg-rose-50 text-rose-600'}`}>
                    <ICONS.Mismatch className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-lg font-bold text-slate-900">{m.date}</h4>
                      {m.resolved && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded">Resolved</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">Conflict between {m.sourceA} and {m.sourceB}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Variance</p>
                  <p className={`text-2xl font-black ${m.resolved ? 'text-slate-400' : 'text-rose-600'}`}>₹{m.difference.toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase">{m.sourceA}</p>
                  <p className="text-xl font-bold text-slate-800">₹{m.amountA.toLocaleString()}</p>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full w-[100%]"></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase">{m.sourceB}</p>
                  <p className="text-xl font-bold text-slate-800">₹{m.amountB.toLocaleString()}</p>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-400 h-full w-[95%]"></div>
                  </div>
                </div>
              </div>

              {!m.resolved && (
                <div className="mt-6 flex justify-end space-x-3">
                  <button className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900">Add Remark</button>
                  <button 
                    onClick={() => resolveMismatch(m.id)}
                    className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Mark as Resolved
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mb-4">
              <ICONS.Check className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Perfect Reconciliation</h3>
            <p className="text-slate-500">No discrepancies found in the recent records.</p>
          </div>
        )}
      </div>
    </div>
  );
};
