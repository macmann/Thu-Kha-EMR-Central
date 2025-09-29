import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAccessToken, setAccessToken, subscribeAccessToken } from '../api/http';
import { login as apiLogin, type LoginResponse, type Role } from '../api/client';

interface User {
  userId: string;
  role: Role;
  email: string;
  doctorId?: string | null;
}

interface AuthContextType {
  accessToken: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [accessToken, setAccessTokenState] = useState<string | null>(
    getAccessToken(),
  );
  const [user, setUser] = useState<User | null>(() => decodeAccessToken(getAccessToken()));

  useEffect(() => {
    const unsubscribe = subscribeAccessToken((token) => {
      setAccessTokenState(token);
      setUser(decodeAccessToken(token));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setUser(decodeAccessToken(accessToken));
  }, [accessToken]);

  const login = async (email: string, password: string) => {
    const data: LoginResponse = await apiLogin(email, password);
    setAccessToken(data.accessToken);
    setUser({
      userId: data.user.userId,
      role: data.user.role,
      email: data.user.email,
      doctorId: data.user.doctorId ?? null,
    });
  };

  const logout = () => {
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ accessToken, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

function decodeAccessToken(token: string | null): User | null {
  if (!token) return null;
  const [, payload] = token.split('.');
  if (!payload) return null;
  try {
    const normalized = normalizeBase64(payload);
    const parsed = JSON.parse(atob(normalized)) as {
      sub?: string;
      role?: Role;
      email?: string;
      doctorId?: string | null;
    };
    if (!parsed.sub || !parsed.role || !parsed.email) {
      return null;
    }
    return {
      userId: parsed.sub,
      role: parsed.role,
      email: parsed.email,
      doctorId: parsed.doctorId ?? null,
    };
  } catch {
    return null;
  }
}

function normalizeBase64(value: string): string {
  const replaced = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = replaced.length % 4;
  if (padding === 2) return `${replaced}==`;
  if (padding === 3) return `${replaced}=`;
  if (padding === 1) return `${replaced}===`;
  return replaced;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
