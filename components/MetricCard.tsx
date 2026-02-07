
import React from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  trend?: number | null;
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, trend, icon }) => {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{label}</p>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
          
          {trend !== undefined && trend !== null && (
            <div className={`mt-2 flex items-center text-[10px] font-black uppercase tracking-wider ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend >= 0 ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
              )}
              {Math.abs(trend)}% vs Period Prev
            </div>
          )}
          {(!trend && trend !== 0) && (
             <div className="mt-2 text-[9px] font-bold text-slate-300 uppercase tracking-widest">Awaiting comparison</div>
          )}
        </div>
        <div className="p-3 bg-slate-50 text-slate-900 rounded-2xl border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
          {icon}
        </div>
      </div>
    </div>
  );
};
