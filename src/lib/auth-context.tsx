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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const resetLogoutTimer = () => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    // 3.600.000 ms = 1 hora
    logoutTimerRef.current = setTimeout(() => {
      handleLogout();
    }, 3600000);
  };

  const handleUserSession = async (session: Session | null) => {
    if (session?.user) {
      setUser(session.user);
      resetLogoutTimer();
      
      try {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        
        setRole(data?.role || 'OP_ESTOQUE');
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
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await handleUserSession(session);
      setLoading(false);
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
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);