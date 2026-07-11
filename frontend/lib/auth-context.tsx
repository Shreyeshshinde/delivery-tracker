"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { AuthResponse, User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string; email: string; phone: string; password: string; role: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  function persistSession(data: AuthResponse) {
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  }

  async function login(email: string, password: string) {
    const data = await api.post<AuthResponse>("/auth/login", { email, password });
    persistSession(data);
    redirectByRole(data.user.role);
  }

  async function register(payload: {
    name: string; email: string; phone: string; password: string; role: string;
  }) {
    const data = await api.post<AuthResponse>("/auth/register", payload);
    persistSession(data);
    redirectByRole(data.user.role);
  }

  function redirectByRole(role: string) {
    if (role === "admin") router.push("/admin");
    else if (role === "agent") router.push("/agent");
    else router.push("/customer");
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}