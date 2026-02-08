import React, { useMemo } from 'react';
import { MetricCard } from '../components/MetricCard.tsx';
import { ICONS } from '../constants.tsx';
import { SaleRecord, VendorBill, Discrepancy, Outlet, SaleRecordType } from '../types.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface DashboardProps {
  currentOutlet: Outlet | null;
  outlets: Outlet[];
  sales: SaleRecord[];
  bills: VendorBill[];
  mismatches: Discrepancy[];
  onPageChange: (page: string) => void;
}

const PIE_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const CrownIcon = ({ className, color = "currentColor" }: { className?: string, color?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/>
    <path d="M5 16h14v2H5z"/>
  </svg>
);

export const Dashboard: React.FC<DashboardProps> = ({ currentOutlet, outlets, sales, bills, mismatches, onPageChange }) => {
  const filteredSales = sales.filter(s => s.outletId === currentOutlet?.id);
  const filteredBills = bills.filter(b => b.outletId === currentOutlet?.id);
  
  // Calculate specific outlet stats
  const calculateOutletStats = (targetSales: SaleRecord[], targetBills: VendorBill[]) => {
    const salesByDate: Record<string, SaleRecord[]> = {};
    targetSales.forEach(s => {
      if (!salesByDate[s.date]) salesByDate[s.date] = [];
      salesByDate[s.date].push(s);
    });

    const revenue = Object.values(salesByDate).reduce((acc, dayRecords) => {
      const segAmt = dayRecords.filter(s => s.type === SaleRecordType.SEGREGATION).reduce((sum, r) => sum + r.amountINR, 0);
      const itemAmt = dayRecords.filter(s => s.type === SaleRecordType.ITEM_WISE).reduce((sum, r) => sum + r.amountINR, 0);
      return acc + (segAmt > 0 ? segAmt : itemAmt);
    }, 0);

    const expenses = targetBills.reduce((acc, curr) => acc + curr.amountINR, 0);
    const margin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
    const expenseRatio = revenue > 0 ? (expenses / revenue) * 100 : 100;

    return { revenue, expenses, profit: revenue - expenses, margin, expenseRatio };
  };

  const currentStats = useMemo(() => calculateOutletStats(filteredSales, filteredBills), [filteredSales, filteredBills]);

  // Global Rankings Calculation
  const globalLeaderboard = useMemo(() => {
    return outlets.map(outlet => {
      const oSales = sales.filter(s => s.outletId === outlet.id);
      const oBills = bills.filter(b => b.outletId === outlet.id);
      return {
        id: outlet.id,
        name: outlet.name,
        ...calculateOutletStats(oSales, oBills)
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [outlets, sales, bills]);

  const topByRevenue = [...globalLeaderboard].sort((a, b) => b.revenue - a.revenue)[0];
  const topByMargin = [...globalLeaderboard].filter(o => o.revenue > 100).sort((a, b) => b.margin - a.margin)[0];
  const topByEfficiency = [...globalLeaderboard].filter(o => o.revenue > 100).sort((a, b) => a.expenseRatio - b.expenseRatio)[0];

  const pendingMismatches = mismatches.filter(m => m.outletId === currentOutlet?.id && !m.resolved).length;

  const cashFlowIndex = useMemo(() => {
    if (currentStats.expenses === 0) return currentStats.revenue > 0 ? 'Excellent' : 'Stable';
    const ratio = currentStats.revenue / currentStats.expenses;
    if (ratio > 2) return 'Exceptional';
    if (ratio > 1.2) return 'Healthy';
    if (ratio >= 1.0) return 'Stable';
    return 'Critical';
  }, [currentStats]);

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
      itemMap[s.itemName].revenue += s.amountINR;
    });
    return Object.values(itemMap).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  }, [filteredSales]);

  const paymentDistribution = useMemo(() => {
    const pMap: Record<string, number> = {};
    filteredSales.filter(s => s.type === SaleRecordType.SEGREGATION).forEach(s => {
      const method = s.paymentMethod || 'Other';
      pMap[method] = (pMap[method] || 0) + s.amountINR;
    });
    return Object.entries(pMap).map(([name, value]) => ({ name, value }));
  }, [filteredSales]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Hero Section */}
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl ring-1 ring-white/10">
         <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/20 rounded-full blur-[120px]"></div>
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
               <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">Intelligence Hub</h2>
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

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard label="Verified Revenue" value={`${symbol}${currentStats.revenue.toLocaleString()}`} icon={<ICONS.Sales />} />
        <MetricCard label="Verified Opex" value={`${symbol}${currentStats.expenses.toLocaleString()}`} icon={<ICONS.Vendors />} />
        <MetricCard label="Audit Queue" value={pendingMismatches.toString()} icon={<ICONS.Mismatch />} />
        <MetricCard label="Profit Margin" value={`${Math.round(currentStats.margin)}%`} icon={<ICONS.Reports />} />
      </div>

      {/* Leaderboard Section - GAMIFICATION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">Network Leaderboard</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Node Performance Ranking</p>
            </div>
            <div className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
               {outlets.length} Nodes Active
            </div>
          </div>

          <div className="space-y-4">
            {globalLeaderboard.slice(0, 5).map((node, idx) => {
              const isFirst = idx === 0;
              const isCurrent = node.id === currentOutlet?.id;
              return (
                <div 
                  key={node.id} 
                  className={`flex items-center justify-between p-6 rounded-[2rem] transition-all border ${
                    isFirst ? 'bg-slate-900 text-white border-slate-900 shadow-2xl scale-[1.02]' : 
                    (isCurrent ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 hover:border-slate-200')
                  }`}
                >
                  <div className="flex items-center space-x-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${isFirst ? 'bg-indigo-600' : 'bg-white text-slate-400 border border-slate-200'}`}>
                      {isFirst ? <CrownIcon className="w-6 h-6 text-white" /> : (idx + 1)}
                    </div>
                    <div>
                      <h4 className={`font-black uppercase tracking-tight ${isFirst ? 'text-white' : 'text-slate-900'}`}>{node.name}</h4>
                      <p className={`text-[9px] font-bold uppercase tracking-widest ${isFirst ? 'text-indigo-400' : 'text-slate-400'}`}>
                        {isFirst ? 'Revenue Champion' : (node.margin > 30 ? 'Profit Powerhouse' : 'Steady Growth')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black tracking-tighter ${isFirst ? 'text-white' : 'text-slate-900'}`}>₹{node.revenue.toLocaleString()}</p>
                    <p className={`text-[9px] font-black uppercase ${isFirst ? 'text-indigo-400' : 'text-emerald-500'}`}>
                      {Math.round(node.margin)}% Margin
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Achievement Tiles */}
        <div className="space-y-6">
           <div className="bg-indigo-600 p-10 rounded-[3rem] text-white shadow-xl relative overflow-hidden group hover:-translate-y-1 transition-transform">
              <div className="absolute -top-4 -right-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
              <CrownIcon className="w-12 h-12 text-indigo-300 mb-6" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200 mb-2">Revenue King</h4>
              <p className="text-2xl font-black uppercase tracking-tight mb-1">{topByRevenue?.name || 'N/A'}</p>
              <p className="text-sm font-bold opacity-60">₹{topByRevenue?.revenue.toLocaleString() || '0'}</p>
           </div>

           <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:-translate-y-1 transition-transform">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-6">
                 <ICONS.Reports className="w-6 h-6" />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600 mb-2">Margin Master</h4>
              <p className="text-2xl font-black uppercase tracking-tight mb-1 text-slate-900">{topByMargin?.name || 'N/A'}</p>
              <p className="text-sm font-bold text-slate-400">{Math.round(topByMargin?.margin || 0)}% Operating Profit</p>
           </div>

           <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-xl relative overflow-hidden group hover:-translate-y-1 transition-transform">
              <div className="w-12 h-12 bg-white/5 text-amber-500 rounded-2xl flex items-center justify-center mb-6">
                 <ICONS.Settings className="w-6 h-6" />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-2">Opex Optimizer</h4>
              <p className="text-2xl font-black uppercase tracking-tight mb-1">{topByEfficiency?.name || 'N/A'}</p>
              <p className="text-sm font-bold text-slate-500">{(topByEfficiency?.expenseRatio || 0).toFixed(1)}% Expense/Rev</p>
           </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col hover:border-indigo-100 transition-colors">
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