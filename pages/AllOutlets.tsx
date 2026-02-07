
import React from 'react';
import { Outlet, SaleRecord, VendorBill } from '../types';
import { MetricCard } from '../components/MetricCard';
import { ICONS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

interface AllOutletsProps {
  outlets: Outlet[];
  sales: SaleRecord[];
  bills: VendorBill[];
}

export const AllOutlets: React.FC<AllOutletsProps> = ({ outlets, sales, bills }) => {
  const totalGlobalRevenueINR = sales.reduce((acc, s) => acc + s.amountINR, 0);
  const totalGlobalExpensesINR = bills.reduce((acc, b) => acc + b.amountINR, 0);
  const globalMargin = totalGlobalRevenueINR > 0 ? ((totalGlobalRevenueINR - totalGlobalExpensesINR) / totalGlobalRevenueINR) * 100 : 0;

  const comparisonData = outlets.map(outlet => {
    const outletSales = sales.filter(s => s.outletId === outlet.id).reduce((sum, s) => sum + s.amountINR, 0);
    const outletBills = bills.filter(b => b.outletId === outlet.id).reduce((sum, b) => sum + b.amountINR, 0);
    const margin = outletSales > 0 ? ((outletSales - outletBills) / outletSales) * 100 : 0;

    return {
      id: outlet.id,
      name: outlet.name,
      Revenue: outletSales,
      Expenses: outletBills,
      Profit: outletSales - outletBills,
      Margin: margin,
      currency: outlet.currency,
      city: outlet.city
    };
  });

  const sortedData = [...comparisonData].sort((a, b) => b.Revenue - a.Revenue);
  const revenueKing = sortedData.length > 0 && sortedData[0].Revenue > 0 ? sortedData[0] : null;
  const sortedByMargin = [...comparisonData].sort((a, b) => b.Margin - a.Margin);
  const efficiencyMaster = sortedByMargin.length > 0 && sortedByMargin[0].Margin > 0 ? sortedByMargin[0] : null;

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Global Performance Grid</h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Unified Group Dashboard • Normalized INR</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-900 p-10 rounded-[3rem] shadow-3xl text-white relative overflow-hidden group border border-white/5">
           <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-700">
              <span className="text-9xl">👑</span>
           </div>
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-4">Volume Leader</p>
           <h4 className="text-3xl font-black mb-2 uppercase tracking-tighter">{revenueKing ? revenueKing.name : 'N/A'}</h4>
           <p className="text-sm font-bold opacity-60 tracking-tight">
             {revenueKing ? `Capturing ₹${revenueKing.Revenue.toLocaleString()} in normalized sales.` : 'Awaiting production data sync.'}
           </p>
        </div>
        <div className="bg-emerald-900 p-10 rounded-[3rem] shadow-3xl text-white relative overflow-hidden group border border-white/5">
           <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-700">
              <span className="text-9xl">💎</span>
           </div>
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400 mb-4">Margin Champion</p>
           <h4 className="text-3xl font-black mb-2 uppercase tracking-tighter">{efficiencyMaster ? efficiencyMaster.name : 'N/A'}</h4>
           <p className="text-sm font-bold opacity-60 tracking-tight">
             {efficiencyMaster ? `Operating at ${Math.round(efficiencyMaster.Margin)}% gross efficiency.` : 'Awaiting financial log verification.'}
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <MetricCard label="Group Gross Yield" value={`₹${totalGlobalRevenueINR.toLocaleString()}`} icon={<ICONS.Sales />} />
        <MetricCard label="Group Operational Cost" value={`₹${totalGlobalExpensesINR.toLocaleString()}`} icon={<ICONS.Vendors />} />
        <MetricCard label="Average Group Margin" value={`${Math.round(globalMargin)}%`} icon={<ICONS.Reports />} />
      </div>

      {outlets.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 mb-10 uppercase tracking-tighter">Yield Comparison</h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '20px'}}
                  />
                  <Legend iconType="circle" wrapperStyle={{paddingTop: '30px', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px'}} />
                  <Bar dataKey="Revenue" fill="#4f46e5" radius={[8, 8, 0, 0]} name="Verified Revenue" />
                  <Bar dataKey="Expenses" fill="#e2e8f0" radius={[8, 8, 0, 0]} name="Verified Opex" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
            <h3 className="text-xl font-black text-slate-800 mb-10 uppercase tracking-tighter">Market Share Analysis</h3>
            <div className="h-[400px]">
              {totalGlobalRevenueINR > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={comparisonData} 
                      innerRadius={100} 
                      outerRadius={140} 
                      paddingAngle={8} 
                      dataKey="Revenue"
                      nameKey="name"
                      stroke="none"
                    >
                      {comparisonData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Legend verticalAlign="bottom" align="center" wrapperStyle={{paddingTop: '20px'}} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center space-y-4 bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
                  <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm"><ICONS.Reports className="w-8 h-8 text-slate-200" /></div>
                  <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Share Distribution Offline</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-24 bg-white rounded-[3rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-4">
           <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center border border-slate-100"><ICONS.Plus className="w-10 h-10 text-slate-300" /></div>
           <div className="text-center">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">No Active Nodes Detected</h3>
              <p className="text-sm text-slate-400 font-medium">Head to 'Outlet Config' to provision your first business entity.</p>
           </div>
        </div>
      )}
    </div>
  );
};
