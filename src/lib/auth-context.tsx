"use client";
import { createContext, useContext, useEffect, useState } from "react";
// Corrigindo o erro 1: Importando explicitamente o cliente que criamos
import { supabase } from "./supabase"; 
// Importando tipos para corrigir os erros 2 e 3
import { User, AuthChangeEvent, Session } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  role: string | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        setRole(data?.role || null);
      }
      setLoading(false);
    };

    getUserData();

    // Corrigindo erros 2 e 3: Definindo tipos para 'event' e 'session'
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user || null);
        if (session?.user) {
          const { data } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();
          setRole(data?.role || null);
        } else {
          setRole(null);
        }
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