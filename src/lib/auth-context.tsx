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

const PROFILE_ROLE_KEY = "reauto-profile-role";
const PROFILE_USER_KEY = "reauto-profile-user";

function loadCachedRole(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (sessionStorage.getItem(PROFILE_USER_KEY) === userId) {
      return sessionStorage.getItem(PROFILE_ROLE_KEY);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveCachedRole(userId: string, role: string) {
  try {
    sessionStorage.setItem(PROFILE_USER_KEY, userId);
    sessionStorage.setItem(PROFILE_ROLE_KEY, role);
  } catch {
    /* ignore */
  }
}

async function fetchProfileRoleOnce(userId: string): Promise<"error" | string> {
  const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (error) {
    if (error.code === "PGRST116") return "OP_ESTOQUE";
    return "error";
  }
  return data?.role ?? "OP_ESTOQUE";
}

async function fetchProfileRoleWithRetry(userId: string, attempts = 4): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const r = await fetchProfileRoleOnce(userId);
    if (r !== "error") {
      saveCachedRole(userId, r);
      return r;
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
  }
  return loadCachedRole(userId);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const authTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authInitFinishedRef = useRef(false);

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

      const resolved = await fetchProfileRoleWithRetry(session.user.id);
      if (resolved) {
        setRole(resolved);
      } else {
        const cached = loadCachedRole(session.user.id);
        setRole(cached);
      }
    } else {
      setUser(null);
      setRole(null);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    }
  };

  useEffect(() => {
    authInitFinishedRef.current = false;

    authTimeoutRef.current = setTimeout(() => {
      if (authInitFinishedRef.current) return;

      setLoading(false);

      const onLoginPage =
        typeof window !== "undefined" &&
        (window.location.pathname === "/login" || window.location.pathname.endsWith("/login"));

      if (onLoginPage) {
        return;
      }

      void supabase.auth.signOut().finally(() => {
        window.location.href = "/login";
      });
    }, 12000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (
          event === "INITIAL_SESSION" ||
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED"
        ) {
          await handleUserSession(session);
        } else if (event === "SIGNED_OUT") {
          await handleUserSession(null);
        }
      } finally {
        if (!authInitFinishedRef.current) {
          authInitFinishedRef.current = true;
          if (authTimeoutRef.current) {
            clearTimeout(authTimeoutRef.current);
            authTimeoutRef.current = null;
          }
        }
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AuthContext.Provider value={{ user, role, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
