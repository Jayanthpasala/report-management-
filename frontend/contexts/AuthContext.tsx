import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken, clearToken } from '../utils/api';

type User = {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'manager' | 'staff' | 'accounts';
  org_id: string;
  outlet_ids: string[];
};

type AuthState = {
  user: User | null;
  organization: any;
  outlets: any[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  organization: null,
  outlets: [],
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    await setToken(res.token);
    setUser(res.user);
    // Fetch full profile
    try {
      const me = await api.getMe();
      setOrganization(me.organization);
      setOutlets(me.outlets || []);
    } catch {}
  };

  const logout = async () => {
    await clearToken();
    setUser(null);
    setOrganization(null);
    setOutlets([]);
  };

  const refresh = async () => {
    try {
      const me = await api.getMe();
      setUser(me.user);
      setOrganization(me.organization);
      setOutlets(me.outlets || []);
    } catch {
      await logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, organization, outlets, isLoading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
