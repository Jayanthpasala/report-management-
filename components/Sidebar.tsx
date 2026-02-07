
import React from 'react';
import { ICONS } from '../constants';
import { User, UserRole } from '../types';

interface SidebarProps {
  user: User;
  currentPage: string;
  onPageChange: (page: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, currentPage, onPageChange, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Outlet Dashboard', icon: ICONS.Dashboard },
    { id: 'sales', label: 'Sales & Uploads', icon: ICONS.Sales },
    { id: 'vendors', label: 'Vendors & Bills', icon: ICONS.Vendors },
    { id: 'calendar', label: 'Upload Log', icon: ICONS.Calendar },
    { id: 'mismatches', label: 'Discrepancies', icon: ICONS.Mismatch },
    { id: 'reports', label: 'Financial Reports', icon: ICONS.Reports },
  ];

  // Logic: Owners have administrative capabilities.
  const isOwner = user.role === UserRole.OWNER;

  if (isOwner) {
    // Add Owner-only global items
    menuItems.unshift({ 
      id: 'all-outlets', 
      label: 'Global Comparison', 
      icon: (props: any) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-8"/></svg>
      )
    });
    
    // Add bottom administrative configuration
    menuItems.push({ id: 'outlets', label: 'Outlet Config', icon: ICONS.Settings });
  }

  return (
    <div className="w-64 flex-shrink-0 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-white/5">
      <div className="p-8 flex items-center space-x-4 border-b border-white/5">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-2xl shadow-indigo-950">
          F
        </div>
        <div>
          <h1 className="text-xl font-black text-white tracking-tighter leading-none">FinOut</h1>
          <p className="text-[10px] text-indigo-400 font-black tracking-widest uppercase mt-1">Enterprise</p>
        </div>
      </div>

      <nav className="flex-1 p-6 space-y-2 mt-4 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onPageChange(item.id)}
            className={`w-full flex items-center space-x-4 px-5 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
              currentPage === item.id 
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/40 translate-x-2' 
                : 'text-slate-500 hover:bg-white/5 hover:text-white'
            }`}
          >
            <item.icon className={currentPage === item.id ? 'text-white' : 'text-slate-600'} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-6 mt-auto">
        <div className="bg-white/5 p-5 rounded-[2rem] border border-white/10 mb-6">
           <div className="flex items-center space-x-3 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">System Health</span>
           </div>
           <p className="text-[10px] font-bold text-slate-400 leading-tight">All accounting engines are operating within normal delta ranges.</p>
        </div>

        <button 
          onClick={onLogout}
          className="w-full flex items-center space-x-4 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-rose-500 hover:text-white transition-all group"
        >
          <svg className="group-hover:scale-110 transition-transform" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          <span>End Session</span>
        </button>
      </div>
    </div>
  );
};
