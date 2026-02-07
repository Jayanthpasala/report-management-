import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { User, Outlet } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  currentOutlet: Outlet | null;
  setCurrentOutlet: (outlet: Outlet) => void;
  availableOutlets: Outlet[];
  currentPage: string;
  onPageChange: (page: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  user,
  currentOutlet,
  setCurrentOutlet,
  availableOutlets,
  currentPage,
  onPageChange
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <div className={`fixed inset-y-0 left-0 z-50 transform lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} w-64`}>
        <Sidebar 
          user={user} 
          currentPage={currentPage} 
          onPageChange={(page) => {
            onPageChange(page);
            setIsSidebarOpen(false);
          }}
        />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 glass border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-30">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <div className="flex flex-col">
               <h2 className="text-xl font-black text-slate-900 capitalize tracking-tight leading-none">
                 {currentPage.replace('-', ' ')}
               </h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Management Portal</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 md:space-x-6">
            {availableOutlets.length > 0 && (
              <div className="relative flex items-center bg-slate-900 text-white rounded-[1.2rem] px-4 py-2 shadow-xl ring-4 ring-indigo-50 border border-indigo-500/20">
                <div className="mr-3 p-1.5 bg-indigo-600 rounded-lg">
                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>
                </div>
                <div className="flex flex-col">
                   <span className="text-[8px] font-black uppercase text-indigo-400 tracking-widest leading-none mb-1">Active Control</span>
                   <select 
                     className="bg-transparent border-none p-0 text-xs font-black uppercase tracking-tighter focus:ring-0 outline-none cursor-pointer appearance-none pr-6"
                     value={currentOutlet?.id || ''}
                     onChange={(e) => {
                       const selected = availableOutlets.find(o => o.id === e.target.value);
                       if (selected) setCurrentOutlet(selected);
                     }}
                   >
                     {availableOutlets.map(o => (
                       <option key={o.id} value={o.id} className="bg-slate-900 text-white">{o.name}</option>
                     ))}
                   </select>
                </div>
                <div className="absolute right-3 pointer-events-none text-indigo-400">
                   <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
            )}
            
            <div className="flex items-center space-x-3 border-l border-slate-200 pl-4 md:pl-6">
              <div className="hidden sm:block text-right">
                <p className="text-[11px] font-black text-slate-900 leading-none mb-1">{user.name}</p>
                <div className="flex justify-end">
                   <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[8px] font-black uppercase tracking-widest rounded-md">{user.role}</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-slate-200 ring-2 ring-white">
                {user.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};