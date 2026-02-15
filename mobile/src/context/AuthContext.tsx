import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { api, UserProfile } from "../services/api";

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, securityAnswer: string) => Promise<void>;

  partnerLogin: (code: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({} as AuthState);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync("aura_token");
      const savedUser = await SecureStore.getItemAsync("aura_user");
      if (saved && savedUser) {
        setToken(saved);
        setUser(JSON.parse(savedUser));
      }
      setLoading(false);
    })();
  }, []);

  const saveSession = async (t: string, u: UserProfile) => {
    setToken(t);
    setUser(u);
    await SecureStore.setItemAsync("aura_token", t);
    await SecureStore.setItemAsync("aura_user", JSON.stringify(u));
  };

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    await saveSession(res.access_token, res.user);
  };

  const register = async (name: string, email: string, password: string, securityAnswer: string) => {
    const res = await api.register(name, email, password, securityAnswer);
    await saveSession(res.access_token, res.user);
  };

  const partnerLogin = async (code: string) => {
    const res = await api.partnerLogin(code);
    await saveSession(res.access_token, res.user);
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync("aura_token");
    await SecureStore.deleteItemAsync("aura_user");
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await api.getMe(token);
      setUser(res.user);
      await SecureStore.setItemAsync("aura_user", JSON.stringify(res.user));
    } catch { }
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, partnerLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
