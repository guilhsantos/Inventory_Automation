"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabase";
import { User, AuthChangeEvent, Session } from "@supabase/supabase-js";

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
        // Tenta pegar a sessão inicial
        const { data: { session } } = await supabase.auth.getSession();
        await handleUserSession(session);
      } catch (err) {
        console.error("Erro na inicialização do Auth:", err);
      } finally {
        setLoading(false); // Garante o fim do loading de qualquer jeito
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
            setRole('OP_ESTOQUE'); // Fallback caso não tenha perfil
          }
        } catch (e) {
          setRole('OP_ESTOQUE');
        }
      } else {
        setUser(null);
        setRole(null);
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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