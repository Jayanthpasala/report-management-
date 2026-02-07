
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { User, UserRole, Outlet, SaleRecord, VendorBill, Discrepancy, Vendor } from './types';
import { collection, db } from './services/db';
import { Dashboard } from './pages/Dashboard';
import { Sales } from './pages/Sales';
import { Vendors } from './pages/Vendors';
import { Mismatches } from './pages/Mismatches';
import { Reports } from './pages/Reports';
import { UserManagement } from './pages/UserManagement';
import { FinCalendar } from './pages/FinCalendar';
import { OutletManagement } from './pages/OutletManagement';
import { AllOutlets } from './pages/AllOutlets';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [mismatches, setMismatches] = useState<Discrepancy[]>([]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    // Local Data Subscriptions
    const unsubOutlets = collection.subscribe('outlets', setOutlets);
    const unsubVendors = collection.subscribe('vendors', setVendors);
    const unsubSales = collection.subscribe('sales', setSales);
    const unsubBills = collection.subscribe('bills', setBills);
    const unsubMismatches = collection.subscribe('mismatches', setMismatches);
    const unsubUsers = collection.subscribe('users', setAllUsers);

    const session = db.get('session');
    if (session) setCurrentUser(session);
    
    setIsAuthLoading(false);

    return () => {
      unsubOutlets();
      unsubVendors();
      unsubSales();
      unsubBills();
      unsubMismatches();
      unsubUsers();
    };
  }, []);

  useEffect(() => {
    if (currentUser && outlets.length > 0 && !currentOutlet) {
      const permitted = outlets.filter(o => currentUser.outlets.includes(o.id));
      if (permitted.length > 0) setCurrentOutlet(permitted[0]);
    }
  }, [currentUser, outlets, currentOutlet]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword.trim();

    // 1. Owner Override
    if (email === 'jayanthpasala10@gmail.com' && password === 'jayanth@12345') {
      const owner: User = {
        id: 'owner-001',
        name: 'Jayanth Pasala',
        email: email,
        role: UserRole.OWNER,
        outlets: outlets.map(o => o.id)
      };
      setCurrentUser(owner);
      db.save('session', owner);
      return;
    }

    // 2. Local User Check
    const foundUser = allUsers.find(u => u.email.trim().toLowerCase() === email);
    
    if (foundUser) {
      if (foundUser.password === password) {
        setCurrentUser(foundUser);
        db.save('session', foundUser);
        return;
      } else {
        setLoginError('Incorrect access key.');
        return;
      }
    }

    setLoginError('Identity not recognized.');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentOutlet(null);
    db.save('session', null);
    setCurrentPage('dashboard');
  };

  const handleAddOutlet = async (o: Outlet) => await collection.add('outlets', o);
  const handleAddUser = async (u: User, password?: string) => await collection.add('users', { ...u, password });
  const handleDeleteUser = async (id: string) => await collection.remove('users', id);
  const handleSaveSale = async (s: SaleRecord) => await collection.add('sales', s);
  const handleSaveBill = async (b: VendorBill) => await collection.add('bills', b);
  const handleAddVendor = async (v: Vendor) => await collection.add('vendors', v);
  const handleUpdateVendor = async (v: Vendor) => await collection.update('vendors', v.id, v);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-[3rem] shadow-2xl p-10 w-full max-w-md border border-slate-100">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-600 text-white font-black text-4xl mb-6 shadow-2xl">F</div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">FinOut Portal</h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-3">Local Access Point</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Email</label>
               <input 
                 type="email" 
                 required 
                 value={loginEmail} 
                 onChange={e => setLoginEmail(e.target.value)} 
                 placeholder="Email Address" 
                 className="w-full bg-slate-50 border-0 rounded-2xl p-5 text-sm font-bold outline-none ring-1 ring-slate-100 focus:ring-indigo-500/20" 
               />
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Key</label>
               <input 
                 type="password" 
                 required 
                 value={loginPassword} 
                 onChange={e => setLoginPassword(e.target.value)} 
                 placeholder="Secret Key" 
                 className="w-full bg-slate-50 border-0 rounded-2xl p-5 text-sm font-bold outline-none ring-1 ring-slate-100 focus:ring-indigo-500/20" 
               />
            </div>
            {loginError && (
              <p className="text-rose-500 text-[10px] font-black uppercase text-center bg-rose-50 p-4 rounded-xl border border-rose-100">
                {loginError}
              </p>
            )}
            <button type="submit" className="w-full py-5 px-4 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs hover:bg-indigo-600 transition-all shadow-xl">Authenticate</button>
          </form>
        </div>
      </div>
    );
  }

  const availableOutlets = outlets.filter(o => currentUser.outlets.includes(o.id));

  const renderPage = () => {
    switch(currentPage) {
      case 'all-outlets':
        return currentUser.role === UserRole.OWNER ? <AllOutlets outlets={outlets} sales={sales} bills={bills} /> : <Dashboard currentOutlet={currentOutlet} sales={sales} bills={bills} mismatches={mismatches} onPageChange={setCurrentPage} />;
      case 'dashboard':
        return <Dashboard currentOutlet={currentOutlet} sales={sales} bills={bills} mismatches={mismatches} onPageChange={setCurrentPage} />;
      case 'sales':
        return <Sales currentOutlet={currentOutlet} sales={sales} setSales={handleSaveSale} />;
      case 'vendors':
        return <Vendors currentOutlet={currentOutlet} outlets={outlets} vendors={vendors} onAddVendor={handleAddVendor} onUpdateVendor={handleUpdateVendor} bills={bills} userRole={currentUser.role} setBills={handleSaveBill} />;
      case 'calendar':
        return <FinCalendar currentOutlet={currentOutlet} sales={sales} bills={bills} />;
      case 'mismatches':
        return <Mismatches currentOutlet={currentOutlet} mismatches={mismatches} setMismatches={setMismatches} />;
      case 'outlets':
        return currentUser.role === UserRole.OWNER ? <OutletManagement outlets={outlets} onAddOutlet={handleAddOutlet} /> : <Dashboard currentOutlet={currentOutlet} sales={sales} bills={bills} mismatches={mismatches} onPageChange={setCurrentPage} />;
      case 'reports':
        return <Reports currentOutlet={currentOutlet} sales={sales} bills={bills} />;
      case 'users':
        return currentUser.role === UserRole.OWNER ? <UserManagement allUsers={allUsers} outlets={outlets} onAddUser={handleAddUser} onDeleteUser={handleDeleteUser} /> : <Dashboard currentOutlet={currentOutlet} sales={sales} bills={bills} mismatches={mismatches} onPageChange={setCurrentPage} />;
      default:
        return <Dashboard currentOutlet={currentOutlet} sales={sales} bills={bills} mismatches={mismatches} onPageChange={setCurrentPage} />;
    }
  };

  return (
    <Layout user={currentUser} currentOutlet={currentOutlet} setCurrentOutlet={setCurrentOutlet} availableOutlets={availableOutlets} onLogout={handleLogout} currentPage={currentPage} onPageChange={setCurrentPage}>
      <div className="page-transition">{renderPage()}</div>
    </Layout>
  );
};

export default App;
