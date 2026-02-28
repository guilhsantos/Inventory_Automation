"use client";

import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { LogOut, Activity } from "lucide-react";

export default function Header() {
  const { user, role, loading } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Refresh total para garantir que o AuthContext limpe tudo
    window.location.href = "/login";
  };

  if (loading || !user) return null;

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
        <div className="flex items-center cursor-pointer" onClick={() => window.location.href = "/"}>
          <div className="bg-purple-600 p-2 rounded-xl mr-3 shadow-md shadow-purple-100">
            <Activity className="text-white" size={24} />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tighter text-gray-900 leading-none">
              SGA <span className="text-purple-600">|</span> REAUTO
            </h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">Controle de Fluxo</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Operador</p>
            <p className="text-sm font-black text-gray-900 leading-none">{user.email?.split('@')[0].toUpperCase()}</p>
            <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase">{role}</span>
          </div>
          <button onClick={handleLogout} className="p-3 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all">
            <LogOut size={22} />
          </button>
        </div>
      </div>
    </header>
  );
}