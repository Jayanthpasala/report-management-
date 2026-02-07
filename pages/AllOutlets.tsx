import React from 'react';
import { Outlet, SaleRecord, VendorBill } from '../types.ts';
import { MetricCard } from '../components/MetricCard.tsx';
import { ICONS } from '../constants.tsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface AllOutletsProps {
  outlets: Outlet[];
  sales: SaleRecord[];
  bills: VendorBill[];
}

export const AllOutlets: React.FC<AllOutletsProps> = ({ outlets, sales, bills }) => {
  const totalGlobalRevenueINR = sales.reduce((acc, s) => acc + s.amountINR, 0);
  const totalGlobalExpensesINR = bills.reduce((acc, b) => acc + b.amountINR, 0);

  const comparisonData = outlets.map(outlet => {
    const outletSales = sales.filter(s => s.outletId === outlet.id).reduce((sum, s) => sum + s.amountINR, 0);
    const outletBills = bills.filter(b => b.outletId === outlet.id).reduce((sum, b) => sum + b.amountINR, 0);
    return { name: outlet.name, Revenue: outletSales, Expenses: outletBills };
  });

  return (
    <div className="space-y-10 pb-20">
      <h2 className="text-3xl font-black text-slate-900 uppercase">Global Performance Grid</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <MetricCard label="Global Yield" value={`₹${totalGlobalRevenueINR.toLocaleString()}`} icon={<ICONS.Sales />} />
        <MetricCard label="Global Opex" value={`₹${totalGlobalExpensesINR.toLocaleString()}`} icon={<ICONS.Vendors />} />
      </div>
      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm h-96">
         <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData}>
               <CartesianGrid strokeDasharray="3 3" />
               <XAxis dataKey="name" />
               <YAxis />
               <Tooltip />
               <Bar dataKey="Revenue" fill="#4f46e5" />
               <Bar dataKey="Expenses" fill="#e2e8f0" />
            </BarChart>
         </ResponsiveContainer>
      </div>
    </div>
  );
};