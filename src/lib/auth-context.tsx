"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabase";
import { User, Session } from "@supabase/supabase-js"; // AuthChangeEvent removido

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

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await handleUserSession(session);
      } catch (err) {
        console.error("Erro na inicialização do Auth:", err);
      } finally {
        setLoading(false);
      }
    };

    const handleUserSession = async (session: Session | null) => {
      if (session?.user) {
        setUser(session.user);
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();
          
          if (!error && data) {
            setRole(data.role);
          } else {
            setRole('OP_ESTOQUE');
          }
        } catch { // Variável (e) removida
          setRole('OP_ESTOQUE');
        }
      } else {
        setUser(null);
        setRole(null);
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => { // _event com underline para indicar que não é usado
        await handleUserSession(session);
        setLoading(false);
      }
    );

    return () => authListener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);