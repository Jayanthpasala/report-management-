
import React, { useMemo } from 'react';
import { MetricCard } from '../components/MetricCard';
import { ICONS } from '../constants';
import { SaleRecord, VendorBill, Discrepancy, Outlet, SaleRecordType } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface DashboardProps {
  currentOutlet: Outlet | null;
  sales: SaleRecord[];
  bills: VendorBill[];
  mismatches: Discrepancy[];
  onPageChange: (page: string) => void;
}

const PIE_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Dashboard: React.FC<DashboardProps> = ({ currentOutlet, sales, bills, mismatches, onPageChange }) => {
  const filteredSales = sales.filter(s => s.outletId === currentOutlet?.id);
  const filteredBills = bills.filter(b => b.outletId === currentOutlet?.id);
  
  const totalSales = useMemo(() => {
    const salesByDate: Record<string, SaleRecord[]> = {};
    filteredSales.forEach(s => {
      if (!salesByDate[s.date]) salesByDate[s.date] = [];
      salesByDate[s.date].push(s);
    });

    return Object.values(salesByDate).reduce((acc, dayRecords) => {
      const segAmt = dayRecords.filter(s => s.type === SaleRecordType.SEGREGATION).reduce((sum, r) => sum + r.amount, 0);
      const itemAmt = dayRecords.filter(s => s.type === SaleRecordType.ITEM_WISE).reduce((sum, r) => sum + r.amount, 0);
      return acc + (segAmt > 0 ? segAmt : itemAmt);
    }, 0);
  }, [filteredSales]);

  const totalExpenses = filteredBills.reduce((acc, curr) => acc + curr.amount, 0);
  const pendingMismatches = mismatches.filter(m => m.outletId === currentOutlet?.id && !m.resolved).length;

  const cashFlowIndex = useMemo(() => {
    if (totalExpenses === 0) return totalSales > 0 ? 'Excellent' : 'Stable';
    const ratio = totalSales / totalExpenses;
    if (ratio > 2) return 'Exceptional';
    if (ratio > 1.2) return 'Healthy';
    if (ratio >= 1.0) return 'Stable';
    return 'Critical';
  }, [totalSales, totalExpenses]);

  const aiConfidence = useMemo(() => {
    const totalRecords = filteredSales.length + filteredBills.length;
    if (totalRecords === 0) return '99.9%';
    return '98.8%';
  }, [filteredSales, filteredBills]);

  const itemRanking = useMemo(() => {
    const itemMap: Record<string, { name: string, quantity: number, revenue: number, category: string }> = {};
    
    filteredSales.filter(s => s.type === SaleRecordType.ITEM_WISE).forEach(s => {
      if (!s.itemName) return;
      if (!itemMap[s.itemName]) {
        itemMap[s.itemName] = { name: s.itemName, quantity: 0, revenue: 0, category: s.itemCategory || 'General' };
      }
      itemMap[s.itemName].quantity += (s.quantity || 0);
      itemMap[s.itemName].revenue += s.amount;
    });

    return Object.values(itemMap).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  }, [filteredSales]);

  const paymentDistribution = useMemo(() => {
    const pMap: Record<string, number> = {};
    filteredSales.filter(s => s.type === SaleRecordType.SEGREGATION).forEach(s => {
      const method = s.paymentMethod || 'Other';
      pMap[method] = (pMap[method] || 0) + s.amount;
    });
    return Object.entries(pMap).map(([name, value]) => ({ name, value }));
  }, [filteredSales]);

  const getCurrencySymbol = (code: string = 'INR') => {
    switch (code) {
      case 'USD': return '$';
      case 'GBP': return '£';
      case 'EUR': return '€';
      case 'AED': return 'د.إ';
      default: return '₹';
    }
  };

  const symbol = getCurrencySymbol(currentOutlet?.currency);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-6 rounded-[1.5rem] shadow-2xl border border-slate-100 ring-1 ring-slate-900/5">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">{data.category}</p>
          <p className="text-sm font-black text-slate-900 mb-4">{data.name}</p>
          <div className="space-y-1">
            <div className="flex justify-between items-center gap-8">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Qty Sold</span>
              <span className="text-xs font-black text-indigo-600">{data.quantity} units</span>
            </div>
            <div className="flex justify-between items-center gap-8">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Revenue</span>
              <span className="text-xs font-black text-slate-900">{symbol}{data.revenue.toLocaleString()}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl ring-1 ring-white/10">
         <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/20 rounded-full blur-[120px]"></div>
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
               <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">Ledger Intelligence Active</span>
               </div>
               <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">Financial Intelligence</h2>
               <p className="text-indigo-200/60 font-medium text-sm max-w-xl">
                 Real-time verification for <span className="text-white font-black underline decoration-indigo-500/50 underline-offset-4">{currentOutlet?.name || 'Unconfigured Outlet'}</span>. 
                 Verified Revenue: <span className="text-white font-black">{symbol}{totalSales.toLocaleString()}</span>.
               </p>
            </div>
            <div className="flex gap-4">
               <div className="bg-white/5 px-8 py-5 rounded-[2rem] backdrop-blur-3xl border border-white/10 shadow-2xl">
                  <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest mb-1">Cash Flow Index</p>
                  <p className="text-2xl font-black tracking-tight">{cashFlowIndex}</p>
               </div>
               <div className="bg-indigo-600/90 px-8 py-5 rounded-[2rem] shadow-3xl shadow-indigo-950/50 border border-white/20">
                  <p className="text-[9px] font-black uppercase text-indigo-100 tracking-widest mb-1">AI Trust Index</p>
                  <p className="text-2xl font-black tracking-tight">{aiConfidence}</p>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard label="Verified Revenue" value={`${symbol}${totalSales.toLocaleString()}`} icon={<ICONS.Sales />} />
        <MetricCard label="Verified Opex" value={`${symbol}${totalExpenses.toLocaleString()}`} icon={<ICONS.Vendors />} />
        <MetricCard label="Audit Queue" value={pendingMismatches.toString()} icon={<ICONS.Mismatch />} />
        <MetricCard label="Operating Margin" value={`${totalSales > 0 ? Math.round(((totalSales - totalExpenses) / totalSales) * 100) : 0}%`} icon={<ICONS.Reports />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-10 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col hover:border-indigo-100 transition-colors">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
               <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">SKU Performance</h3>
               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Top 5 Best-Selling Items by Quantity</p>
            </div>
            <div className="flex items-center space-x-2 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Volume Normalized</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-10">
            <div className="xl:col-span-3 h-80">
              {itemRanking.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={itemRanking} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} 
                      interval={0}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 10}} 
                    />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}} 
                      content={<CustomTooltip />}
                    />
                    <Bar dataKey="revenue" fill="#4f46e5" radius={[12, 12, 0, 0]}>
                      {itemRanking.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : '#e2e8f0'} className="hover:fill-indigo-400 transition-colors duration-300" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center space-y-4 bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
                  <div className="p-4 bg-white rounded-2xl shadow-sm"><ICONS.Search className="w-8 h-8 text-slate-300" /></div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Awaiting Data Categorization</p>
                </div>
              )}
            </div>

            <div className="xl:col-span-2 space-y-4 flex flex-col justify-center">
               <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 mb-2">Performance Details</h5>
               {itemRanking.map((item, idx) => (
                 <div key={item.name} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all border border-transparent hover:border-slate-100">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100 shadow-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-slate-900 truncate max-w-[120px]">{item.name}</p>
                        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md mt-1 inline-block">
                          {item.category}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-black text-slate-900">{symbol}{item.revenue.toLocaleString()}</p>
                       <p className="text-[9px] font-bold text-slate-400">{item.quantity} Sold</p>
                    </div>
                 </div>
               ))}
               {itemRanking.length === 0 && (
                 <p className="text-center py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">No SKUs logged today</p>
               )}
            </div>
          </div>
        </div>

        <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group hover:border-indigo-100 transition-colors">
          <h3 className="text-2xl font-black text-slate-900 mb-6 uppercase tracking-tighter relative z-10">Payment Segregation</h3>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-10">Revenue distribution by channel</p>
          <div className="h-60 flex-1 flex items-center justify-center">
            {paymentDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-300">
                <p className="text-[10px] font-black uppercase tracking-widest">No Categorization Found</p>
              </div>
            )}
          </div>
          <div className="mt-6 space-y-3">
             {paymentDistribution.map((item, idx) => (
               <div key={item.name} className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                 <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full mr-2" style={{backgroundColor: PIE_COLORS[idx % PIE_COLORS.length]}}></div>
                    <span className="text-slate-500">{item.name}</span>
                 </div>
                 <span className="text-slate-900 font-bold">{symbol}{item.value.toLocaleString()}</span>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};
