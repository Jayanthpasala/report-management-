import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

// Simple in-memory fallback for web
let webToken: string | null = null;

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return webToken;
  try {
    return await SecureStore.getItemAsync('auth_token');
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    webToken = token;
    return;
  }
  await SecureStore.setItemAsync('auth_token', token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    webToken = null;
    return;
  }
  await SecureStore.deleteItemAsync('auth_token');
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => request('/auth/me'),

  // Users
  inviteUser: (data: { email: string; name: string; role: string; outlet_ids?: string[] }) =>
    request('/users/invite', { method: 'POST', body: JSON.stringify(data) }),
  listUsers: () => request('/users'),

  // Outlets
  listOutlets: () => request('/outlets'),

  // Documents
  uploadDocument: (file: any, outletId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('outlet_id', outletId);
    return request('/documents/upload', { method: 'POST', body: formData });
  },
  listDocuments: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/documents${qs}`);
  },
  getDocument: (id: string) => request(`/documents/${id}`),
  updateDocument: (id: string, data: any) =>
    request(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getReviewQueue: () => request('/documents/review-queue'),

  // Suppliers
  listSuppliers: () => request('/suppliers'),

  // Dashboard
  globalDashboard: (days?: number) => request(`/dashboard/global${days ? `?days=${days}` : ''}`),
  outletDashboard: (outletId: string, days?: number) =>
    request(`/dashboard/outlet/${outletId}${days ? `?days=${days}` : ''}`),

  // Calendar
  calendar: (outletId: string, year: number, month: number) =>
    request(`/calendar/${outletId}/${year}/${month}`),

  // Stats
  stats: () => request('/stats'),

  // Organization
  getOrganization: () => request('/organizations/me'),

  // Phase 2: Currency
  syncRates: () => request('/currency/sync', { method: 'POST' }),
  getRates: () => request('/currency/rates'),
  getRateHistory: (days?: number) => request(`/currency/history${days ? `?days=${days}` : ''}`),

  // Phase 2: Intelligence
  getInsights: (days?: number, severity?: string) => {
    const params = new URLSearchParams();
    if (days) params.set('days', String(days));
    if (severity) params.set('severity', severity);
    const qs = params.toString();
    return request(`/insights${qs ? `?${qs}` : ''}`);
  },
  generateInsights: () => request('/insights/generate', { method: 'POST' }),
  markInsightRead: (id: string) => request(`/insights/${id}/read`, { method: 'PUT' }),

  // Phase 2: Notifications
  getNotifications: (unreadOnly?: boolean) =>
    request(`/notifications${unreadOnly ? '?unread_only=true' : ''}`),
  markNotificationRead: (id: string) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PUT' }),
  triggerNotificationCheck: () => request('/notifications/trigger-check', { method: 'POST' }),

  // Phase 2: Export
  getExportUrl: (reportType: string, format: string, outletId?: string, dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams({ format });
    if (outletId) params.set('outlet_id', outletId);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    return `${API_BASE}/export/${reportType}?${params.toString()}`;
  },

  // Phase 2: Bulk Operations
  bulkAction: (action: string, documentIds: string[]) => {
    const formData = new FormData();
    formData.append('action', action);
    formData.append('document_ids', JSON.stringify(documentIds));
    return request('/documents/bulk-action', { method: 'POST', body: formData });
  },

  // Phase 2: Document versions
  getDocumentVersions: (id: string) => request(`/documents/${id}/versions`),

  // Phase 3: Notification Preferences
  getNotificationPrefs: () => request('/notifications/preferences'),
  updateNotificationPrefs: (prefs: Record<string, boolean>) =>
    request('/notifications/preferences', { method: 'PUT', body: JSON.stringify(prefs) }),

  // Phase 3: Processor Info
  getProcessorInfo: () => request('/processor/info'),

  // Phase 4: Supplier Hub
  getSupplier: (id: string) => request(`/suppliers/${id}`),
  getSupplierDocuments: (id: string, page?: number) =>
    request(`/suppliers/${id}/documents${page ? `?page=${page}` : ''}`),
  createSupplier: (data: { name: string; gst_id?: string; category?: string }) => {
    const formData = new FormData();
    formData.append('name', data.name);
    if (data.gst_id) formData.append('gst_id', data.gst_id);
    if (data.category) formData.append('category', data.category);
    return request('/suppliers', { method: 'POST', body: formData });
  },

  // Phase 4: Outlet Config
  getOutlet: (id: string) => request(`/outlets/${id}`),
  getOutletConfig: (id: string) => request(`/outlets/${id}/config`),
  updateOutletConfig: (id: string, data: any) =>
    request(`/outlets/${id}/config`, { method: 'PUT', body: JSON.stringify(data) }),
  updateOutlet: (id: string, data: any) =>
    request(`/outlets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Phase 4: Enhanced Supplier Operations
  updateSupplier: (id: string, data: { name?: string; gst_id?: string; category?: string; country?: string; is_verified?: boolean }) => {
    const formData = new FormData();
    if (data.name) formData.append('name', data.name);
    if (data.gst_id !== undefined) formData.append('gst_id', data.gst_id);
    if (data.category) formData.append('category', data.category);
    if (data.country) formData.append('country', data.country);
    if (data.is_verified !== undefined) formData.append('is_verified', String(data.is_verified));
    return request(`/suppliers/${id}`, { method: 'PUT', body: formData });
  },
  validateGST: (gst_id: string, country: string = 'India') => {
    const formData = new FormData();
    formData.append('gst_id', gst_id);
    formData.append('country', country);
    return request('/suppliers/validate-gst', { method: 'POST', body: formData });
  },
  checkSupplierDuplicate: (name: string) => {
    const formData = new FormData();
    formData.append('name', name);
    return request('/suppliers/check-duplicate', { method: 'POST', body: formData });
  },
};
