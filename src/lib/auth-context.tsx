"use client";
import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { supabase } from "./supabase";
import { User, Session } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  role: string | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const authTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const resetLogoutTimer = () => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    logoutTimerRef.current = setTimeout(() => {
      handleLogout();
    }, 3600000);
  };

  const handleUserSession = async (session: Session | null) => {
    if (session?.user) {
      setUser(session.user);
      resetLogoutTimer();
      
      try {
        // Timeout de 3 segundos para a query do profile
        const profileTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Profile query timeout")), 3000)
        );

        const profilePromise = supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        const result = await Promise.race([profilePromise, profileTimeout]) as any;
        setRole(result?.data?.role || 'OP_ESTOQUE');
      } catch {
        setRole('OP_ESTOQUE');
      }
    } else {
      setUser(null);
      setRole(null);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    }
  };

  useEffect(() => {
    // Timeout de segurança: força loading = false após 5 segundos
    authTimeoutRef.current = setTimeout(() => {
      console.warn("Auth initialization timeout - forcing loading false");
      setLoading(false);
    }, 5000);

    const initializeAuth = async () => {
      try {
        // Timeout de 3 segundos para getSession
        const sessionTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Session timeout")), 3000)
        );

        const sessionPromise = supabase.auth.getSession();
        const result = await Promise.race([sessionPromise, sessionTimeout]) as any;
        
        if (result?.data?.session) {
          await handleUserSession(result.data.session);
        } else {
          await handleUserSession(null);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        await handleUserSession(null);
      } finally {
        if (authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current);
          authTimeoutRef.current = null;
        }
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await handleUserSession(session);
        } else if (event === 'SIGNED_OUT') {
          handleUserSession(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);