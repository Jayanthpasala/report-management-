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
};
