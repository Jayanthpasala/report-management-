
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { User, UserRole, Outlet, SaleRecord, VendorBill, Discrepancy, Vendor } from './types';
import { collection, db } from './services/db';
import { Dashboard } from './pages/Dashboard';
import { Sales } from './pages/Sales';
import { Vendors } from './pages/Vendors';
import { Mismatches } from './pages/Mismatches';
import { Reports } from './pages/Reports';
import { FinCalendar } from './pages/FinCalendar';
import { OutletManagement } from './pages/OutletManagement';
import { AllOutlets } from './pages/AllOutlets';

const DEFAULT_OWNER: User = {
  id: 'owner-001',
  name: 'Jayanth Pasala',
  email: 'jayanthpasala10@gmail.com',
  role: UserRole.OWNER,
  outlets: [] // Will be populated once outlets load
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
      // Update owner permissions to include all loaded outlets
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

  // Automatically select first outlet if none selected
  useEffect(() => {
    if (outlets.length > 0 && !currentOutlet) {
      setCurrentOutlet(outlets[0]);
    }
  }, [outlets, currentOutlet]);

  const handleLogout = () => {
    setCurrentPage('dashboard');
  };

  const handleAddOutlet = async (o: Outlet) => await collection.add('outlets', o);
  const handleSaveSale = async (s: SaleRecord) => await collection.add('sales', s);
  const handleSaveBill = async (b: VendorBill) => await collection.add('bills', b);
  const handleAddVendor = async (v: Vendor) => await collection.add('vendors', v);
  const handleUpdateVendor = async (v: Vendor) => await collection.update('vendors', v.id, v);

  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const availableOutlets = outlets; // Global owner sees all nodes

  const renderPage = () => {
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
        return <FinCalendar currentOutlet={currentOutlet} sales={sales} bills={bills} />;
      case 'mismatches':
        return <Mismatches currentOutlet={currentOutlet} mismatches={mismatches} setMismatches={setMismatches} />;
      case 'outlets':
        return <OutletManagement outlets={outlets} onAddOutlet={handleAddOutlet} />;
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
      availableOutlets={availableOutlets} 
      onLogout={handleLogout} 
      currentPage={currentPage} 
      onPageChange={setCurrentPage}
    >
      <div className="page-transition">{renderPage()}</div>
    </Layout>
  );
};

export default App;
