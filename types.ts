
export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER'
}

export enum SaleRecordType {
  SEGREGATION = 'SEGREGATION',
  ITEM_WISE = 'ITEM_WISE'
}

export enum ExpenseCategory {
  RAW_MATERIAL = 'Raw Material',
  RENT = 'Rent',
  SALARY = 'Salary',
  PETTY_CASH = 'Petty Cash',
  UTILITIES = 'Utilities',
  MARKETING = 'Marketing',
  OTHER = 'Other'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Added for local auth persistence
  role: UserRole;
  outlets: string[];
}

export interface Outlet {
  id: string;
  name: string;
  location: string;
  city: string;
  country: string;
  currency: string;
}

export interface Vendor {
  id: string;
  name: string;
  outletId: string;
  category: string;
  totalSpent: number;
}

export interface SaleRecord {
  id: string;
  date: string;
  outletId: string;
  type: SaleRecordType;
  paymentMethod?: 'Card' | 'UPI' | 'Cash' | 'Online';
  amount: number;
  amountINR: number;
  itemCategory?: string;
  itemName?: string;
  quantity?: number;
  source: string;
  fileData?: string; // base64 data
  fileMimeType?: string;
}

export interface VendorBill {
  id: string;
  vendorId: string;
  vendorName: string;
  outletId: string;
  date: string;
  amount: number;
  currency: string;
  amountINR: number;
  category: string | ExpenseCategory;
  status: 'Pending' | 'Approved';
  fileName?: string;
  isFixedExpense?: boolean;
  fileData?: string; // base64 data
  fileMimeType?: string;
  note?: string; // For tracking who took the cash or specific remarks
}

export interface Discrepancy {
  id: string;
  date: string;
  outletId: string;
  sourceA: string;
  amountA: number;
  sourceB: string;
  amountB: number;
  difference: number;
  resolved: boolean;
}
