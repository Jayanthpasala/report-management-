import React, { useMemo } from 'react';
import { MetricCard } from '../components/MetricCard.tsx';
import { ICONS } from '../constants.tsx';
import { SaleRecord, VendorBill, Discrepancy, Outlet, SaleRecordType } from '../types.ts';
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl ring-1 ring-white/10">
         <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/20 rounded-full blur-[120px]"></div>
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
               <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">Financial Intelligence</h2>
               <p className="text-indigo-200/60 font-medium text-sm max-w-xl">
                 Real-time verification for <span className="text-white font-black underline decoration-indigo-500/50 underline-offset-4">{currentOutlet?.name || 'Unconfigured Outlet'}</span>.
               </p>
            </div>
            <div className="flex gap-4">
               <div className="bg-white/5 px-8 py-5 rounded-[2rem] backdrop-blur-3xl border border-white/10 shadow-2xl">
                  <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest mb-1">Cash Flow Index</p>
                  <p className="text-2xl font-black tracking-tight">{cashFlowIndex}</p>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard label="Verified Revenue" value={`${symbol}${totalSales.toLocaleString()}`} icon={<ICONS.Sales />} />
        <MetricCard label="Verified Opex" value={`${symbol}${totalExpenses.toLocaleString()}`} icon={<ICONS.Vendors />} />
        <MetricCard label="Audit Queue" value={pendingMismatches.toString()} icon={<ICONS.Mismatch />} />
        <MetricCard label="Margin" value={`${totalSales > 0 ? Math.round(((totalSales - totalExpenses) / totalSales) * 100) : 0}%`} icon={<ICONS.Reports />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-10 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col hover:border-indigo-100 transition-colors">
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-12">SKU Performance</h3>
          <div className="h-80">
            {itemRanking.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={itemRanking}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 10}} />
                  <YAxis tick={{fill: '#94a3b8', fontSize: 10}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="revenue" fill="#4f46e5" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Awaiting Data Categorization</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-2xl font-black text-slate-900 mb-6 uppercase tracking-tighter">Payment Segregation</h3>
          <div className="h-60 flex-1 flex items-center justify-center">
            {paymentDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentDistribution} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {paymentDistribution.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">No Data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};