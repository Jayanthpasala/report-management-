import React from 'react';
import { Discrepancy, Outlet } from '../types.ts';
import { ICONS } from '../constants.tsx';

interface MismatchesProps {
  currentOutlet: Outlet | null;
  mismatches: Discrepancy[];
  setMismatches: React.Dispatch<React.SetStateAction<Discrepancy[]>>;
}

export const Mismatches: React.FC<MismatchesProps> = ({ currentOutlet, mismatches, setMismatches }) => {
  const filtered = mismatches.filter(m => m.outletId === currentOutlet?.id);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800 uppercase">Mismatch Detection</h2>
      <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-200">
        <p className="text-slate-400 font-black uppercase tracking-widest">No discrepancies detected.</p>
      </div>
    </div>
  );
};