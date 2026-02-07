import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout.tsx';
import { User, UserRole, Outlet, SaleRecord, VendorBill, Discrepancy, Vendor } from './types.ts';
import { collection } from './services/db.ts';
import { Dashboard } from './pages/Dashboard.tsx';
import { Sales } from './pages/Sales.tsx';
import { Vendors } from './pages/Vendors.tsx';
import { Mismatches } from './pages/Mismatches.tsx';
import { Reports } from './pages/Reports.tsx';
import { FinCalendar } from './pages/FinCalendar.tsx';
import { OutletManagement } from './pages/OutletManagement.tsx';
import { AllOutlets } from './pages/AllOutlets.tsx';

const DEFAULT_OWNER: User = {
  id: 'owner-001',
  name: 'Jayanth Pasala',
  email: 'jayanthpasala10@gmail.com',
  role: UserRole.OWNER,
  outlets: [] 
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_OWNER);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [mismatches, setMismatches] = useState<Discrepancy[]>([]);

  useEffect(() => {
    // Local Data Subscriptions
    const unsubOutlets = collection.subscribe('outlets', (data) => {
      setOutlets(data);
      setCurrentUser(prev => ({
        ...prev,
        outlets: data.map(o => o.id)
      }));
    });
    const unsubVendors = collection.subscribe('vendors', setVendors);
    const unsubSales = collection.subscribe('sales', setSales);
    const unsubBills = collection.subscribe('bills', setBills);
    const unsubMismatches = collection.subscribe('mismatches', setMismatches);

    setIsDataLoading(false);

    return () => {
      unsubOutlets();
      unsubVendors();
      unsubSales();
      unsubBills();
      unsubMismatches();
    };
  }, []);

  // Selection Logic: If no outlets exist, force navigation to config
  useEffect(() => {
    if (!isDataLoading) {
      if (outlets.length > 0) {
        if (!currentOutlet) {
          setCurrentOutlet(outlets[0]);
        }
      } else if (currentPage !== 'outlets') {
        setCurrentPage('outlets');
      }
    }
  }, [outlets, currentOutlet, isDataLoading, currentPage]);

  const handleAddOutlet = async (o: Outlet) => await collection.add('outlets', o);
  const handleUpdateOutlet = async (o: Outlet) => await collection.update('outlets', o.id, o);
  const handleDeleteOutlet = async (id: string) => {
    await collection.remove('outlets', id);
    if (currentOutlet?.id === id) {
      setCurrentOutlet(null);
    }
  };

  const handleSaveSale = async (s: SaleRecord) => await collection.add('sales', s);
  const handleSaveBill = async (b: VendorBill) => await collection.add('bills', b);
  const handleRemoveSale = async (id: string) => await collection.remove('sales', id);
  const handleRemoveBill = async (id: string) => await collection.remove('bills', id);
  const handleAddVendor = async (v: Vendor) => await collection.add('vendors', v);
  const handleUpdateVendor = async (v: Vendor) => await collection.update('vendors', v.id, v);

  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const renderPage = () => {
    const requiresOutlet = ['dashboard', 'sales', 'vendors', 'calendar', 'mismatches', 'reports'].includes(currentPage);
    if (requiresOutlet && !currentOutlet && outlets.length === 0) {
       return <OutletManagement outlets={outlets} onAddOutlet={handleAddOutlet} onUpdateOutlet={handleUpdateOutlet} onDeleteOutlet={handleDeleteOutlet} />;
    }

    switch(currentPage) {
      case 'all-outlets':
        return <AllOutlets outlets={outlets} sales={sales} bills={bills} />;
      case 'dashboard':
        return <Dashboard currentOutlet={currentOutlet} sales={sales} bills={bills} mismatches={mismatches} onPageChange={setCurrentPage} />;
      case 'sales':
        return <Sales currentOutlet={currentOutlet} sales={sales} setSales={handleSaveSale} />;
      case 'vendors':
        return <Vendors currentOutlet={currentOutlet} outlets={outlets} vendors={vendors} onAddVendor={handleAddVendor} onUpdateVendor={handleUpdateVendor} bills={bills} userRole={currentUser.role} setBills={handleSaveBill} />;
      case 'calendar':
        return <FinCalendar currentOutlet={currentOutlet} sales={sales} bills={bills} onRemoveSale={handleRemoveSale} onRemoveBill={handleRemoveBill} />;
      case 'mismatches':
        return <Mismatches currentOutlet={currentOutlet} mismatches={mismatches} setMismatches={setMismatches} />;
      case 'outlets':
        return <OutletManagement outlets={outlets} onAddOutlet={handleAddOutlet} onUpdateOutlet={handleUpdateOutlet} onDeleteOutlet={handleDeleteOutlet} />;
      case 'reports':
        return <Reports currentOutlet={currentOutlet} sales={sales} bills={bills} />;
      default:
        return <Dashboard currentOutlet={currentOutlet} sales={sales} bills={bills} mismatches={mismatches} onPageChange={setCurrentPage} />;
    }
  };

  return (
    <Layout 
      user={currentUser} 
      currentOutlet={currentOutlet} 
      setCurrentOutlet={setCurrentOutlet} 
      availableOutlets={outlets} 
      currentPage={currentPage} 
      onPageChange={setCurrentPage}
    >
      <div className="page-transition">{renderPage()}</div>
    </Layout>
  );
};

export default App;