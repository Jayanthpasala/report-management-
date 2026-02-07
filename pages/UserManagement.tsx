
import React, { useState } from 'react';
import { ICONS } from '../constants';
import { User, UserRole, Outlet } from '../types';

interface UserManagementProps {
  allUsers: User[];
  outlets: Outlet[];
  onAddUser: (user: User, password?: string) => void;
  onDeleteUser: (userId: string) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ allUsers, outlets, onAddUser, onDeleteUser }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: UserRole.MANAGER,
    selectedOutlets: [] as string[]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    
    // Explicit Validation Check
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      setValidationError("Core identity fields (Name, Email, Password) are mandatory.");
      return;
    }

    if (formData.selectedOutlets.length === 0) {
      setValidationError("You must map this user to at least one business node (Outlet).");
      return;
    }

    setIsProvisioning(true);
    
    // Simulate Cryptographic Generation
    await new Promise(r => setTimeout(r, 600));

    const newUser: User = {
      id: '', // Generated in App.tsx
      name: formData.name,
      email: formData.email,
      role: formData.role,
      outlets: formData.selectedOutlets
    };

    onAddUser(newUser, formData.password);
    
    setIsProvisioning(false);
    setSuccessToast(true);
    setShowAddForm(false);
    setFormData({ name: '', email: '', password: '', role: UserRole.MANAGER, selectedOutlets: [] });
    
    setTimeout(() => setSuccessToast(false), 3000);
  };

  const toggleOutlet = (id: string) => {
    setFormData(prev => ({
      ...prev,
      selectedOutlets: prev.selectedOutlets.includes(id)
        ? prev.selectedOutlets.filter(oid => oid !== id)
        : [...prev.selectedOutlets, id]
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Identity Management</h2>
          <p className="text-sm text-slate-500 font-medium mt-2">Managing the local cryptographic user vault.</p>
        </div>
        <button 
          onClick={() => {
            setShowAddForm(!showAddForm);
            setValidationError('');
          }}
          className={`flex items-center space-x-3 px-8 py-4 rounded-[1.5rem] font-black uppercase text-xs tracking-widest transition-all shadow-xl ${
            showAddForm ? 'bg-slate-100 text-slate-500' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1'
          }`}
        >
          {showAddForm ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ) : (
            <>
              <ICONS.Plus className="w-5 h-5" />
              <span>Provision Account</span>
            </>
          )}
        </button>
      </div>

      {successToast && (
        <div className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl flex items-center animate-in slide-in-from-top-4">
           <ICONS.Check className="w-4 h-4 mr-3" />
           Identity successfully committed to secure vault.
        </div>
      )}

      {showAddForm && (
        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl space-y-8 relative overflow-hidden animate-in slide-in-from-top-4 ring-2 ring-indigo-50">
          <div className="flex justify-between items-center">
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Access Provisioning</h3>
             {validationError && <span className="text-rose-500 text-[9px] font-black uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full border border-rose-100">{validationError}</span>}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <input 
                  required
                  className={`w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-4 transition-all ${!formData.name.trim() && validationError ? 'ring-2 ring-rose-200' : 'focus:ring-indigo-500/10'}`}
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. David Grant"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Official Email</label>
                <input 
                  required
                  type="email"
                  className={`w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-4 transition-all ${!formData.email.trim() && validationError ? 'ring-2 ring-rose-200' : 'focus:ring-indigo-500/10'}`}
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="david@finout.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secure Password</label>
                <input 
                  required
                  type="password"
                  className={`w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-4 transition-all ${!formData.password.trim() && validationError ? 'ring-2 ring-rose-200' : 'focus:ring-indigo-500/10'}`}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder="Assign key"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Role</label>
                <select 
                  className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold outline-none cursor-pointer appearance-none"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                >
                  <option value={UserRole.MANAGER}>Store Manager</option>
                  <option value={UserRole.OWNER}>Global Owner</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
               <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Authorized Outlets (Permitted Viewports)</label>
                  {outlets.length === 0 && <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">No Outlets provisioned. User will have limited access.</span>}
               </div>
               <div className="flex flex-wrap gap-3">
                 {outlets.map(o => (
                   <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleOutlet(o.id)}
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                      formData.selectedOutlets.includes(o.id)
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xl'
                        : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-400'
                    }`}
                   >
                     {o.name}
                   </button>
                 ))}
               </div>
            </div>

            <div className="pt-6 border-t border-slate-50 flex justify-end">
              <button 
                type="submit" 
                disabled={isProvisioning}
                className={`px-12 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl flex items-center space-x-3 ${
                   isProvisioning ? 'bg-slate-100 text-slate-400 cursor-wait' : 'bg-indigo-600 text-white hover:bg-slate-900 shadow-indigo-100'
                }`}
              >
                {isProvisioning && <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>}
                <span>{isProvisioning ? 'Generating Identity...' : 'Generate Identity'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden ring-1 ring-slate-50">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-10 py-5">System Identity</th>
                <th className="px-10 py-5">Authority Level</th>
                <th className="px-10 py-5">Permitted Scopes</th>
                <th className="px-10 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-10 py-8">
                    <div className="flex items-center space-x-5">
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-xl shadow-lg ring-4 ring-white">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-md font-black text-slate-900 uppercase tracking-tight">{u.name}</p>
                        <p className="text-xs text-slate-400 font-medium lowercase mt-1">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      u.role === UserRole.OWNER 
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex flex-wrap gap-2 max-w-[300px]">
                      {u.outlets.map(oid => {
                        const outlet = outlets.find(o => o.id === oid);
                        return outlet ? (
                          <span key={oid} className="px-2 py-1 bg-slate-100 text-slate-500 text-[9px] font-black uppercase rounded-lg border border-slate-200">
                            {outlet.name}
                          </span>
                        ) : null;
                      })}
                      {u.outlets.length === 0 && <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">No Assigned Nodes</span>}
                    </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex justify-end items-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onDeleteUser(u.id)}
                        className="p-3 bg-white text-rose-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-rose-100"
                        disabled={u.email === 'jayanthpasala10@gmail.com'}
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {allUsers.length === 0 && (
                <tr>
                   <td colSpan={4} className="px-10 py-20 text-center text-slate-300 font-black uppercase tracking-[0.2em] text-[10px]">Vault empty: No provisioned users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
