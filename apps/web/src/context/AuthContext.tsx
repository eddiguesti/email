'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  email: string;
  displayName: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loginAsDemo: () => void;
  isDevMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = '/api';
const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

const DEMO_USER: User = {
  id: 'demo-user-1',
  email: 'demo@brosset-techer.fr',
  displayName: 'Utilisateur Demo',
};

// lb_session is httpOnly — only demo_mode is readable from JS
function setCookie(name: string, value: string, days: number) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const initializedRef = useRef(false);

  // The session cookie is httpOnly — the browser sends it automatically via credentials: 'include'
  const fetchUser = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser({
          id: data.id,
          email: data.email,
          displayName: data.displayName,
        });
        setError(null);
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch {
      setUser(null);
      setError('Erreur de connexion au serveur');
      return false;
    }
  };

  const loginAsDemo = () => {
    if (!DEV_MODE) return;
    setCookie('lb_demo_mode', 'true', 1);
    setUser(DEMO_USER);
    setError(null);
    router.push('/dashboard');
  };

  const logout = async () => {
    const isDemo = getCookie('lb_demo_mode') === 'true';

    if (!isDemo) {
      try {
        // Server clears the httpOnly lb_session cookie in its response
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // Ignore errors
      }
    }

    deleteCookie('lb_demo_mode');
    setUser(null);
    router.push('/login');
  };

  const refreshUser = async () => {
    setLoading(true);

    const isDemo = getCookie('lb_demo_mode') === 'true';
    if (DEV_MODE && isDemo) {
      setUser(DEMO_USER);
      setLoading(false);
      return;
    }

    await fetchUser();
    setLoading(false);
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      // Check demo mode (only in dev)
      const isDemo = getCookie('lb_demo_mode') === 'true';
      if (DEV_MODE && isDemo) {
        setUser(DEMO_USER);
        setLoading(false);
        return;
      }

      // Try to load user via session cookie (sent automatically by browser)
      const success = await fetchUser();
      if (!success && pathname?.startsWith('/dashboard')) {
        router.push('/login');
      }

      setLoading(false);
    };

    init();
  }, []); // Empty deps - only run once

  return (
    <AuthContext.Provider value={{ user, loading, error, logout, refreshUser, loginAsDemo, isDevMode: DEV_MODE }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
