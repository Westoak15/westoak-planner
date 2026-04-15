import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, token } from "./api";

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  firmName?: string | null;
  role: "ga" | "fa";
  level: "standard" | "enhanced";
  mustResetPassword: boolean;
}

interface Ctx {
  user: User | null;
  loading: boolean;
  login: (email: string, pw: string) => Promise<void>;
  register: (d: any) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token.get()) { setLoading(false); return; }
    api.get<User>("/api/auth/me").then(setUser).catch(token.clear).finally(() => setLoading(false));
  }, []);

  const login = async (email: string, pw: string) => {
    const r = await api.post<{ token: string; user: User }>("/api/auth/login", { email, password: pw });
    token.set(r.token); setUser(r.user);
  };

  const register = async (d: any) => {
    const r = await api.post<{ token: string; user: User }>("/api/auth/register", d);
    token.set(r.token); setUser(r.user);
  };

  const logout = () => { token.clear(); setUser(null); };

  const refreshUser = async () => {
    const u = await api.get<User>("/api/auth/me");
    setUser(u);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("No AuthProvider");
  return c;
};
