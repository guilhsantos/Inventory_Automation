"use client";

import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Activity } from "lucide-react";

export default function Header() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Não mostra o cabeçalho se estiver carregando ou se for a tela de login
  if (loading || !user) return null;

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo e Nome do Sistema */}
          <div className="flex items-center cursor-pointer" onClick={() => router.push("/")}>
            <div className="bg-purple-600 p-2 rounded-xl mr-3 shadow-lg shadow-purple-100">
              <Activity className="text-white" size={24} />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tighter text-gray-900 leading-none">
                SGA <span className="text-purple-600">|</span> REAUTO
              </h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Controle de Fluxo</p>
            </div>
          </div>

          {/* Info do Usuário e Logout */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Operador</p>
              <p className="text-sm font-black text-gray-900 truncate max-w-[150px]">
                {user.email?.split('@')[0].toUpperCase()}
              </p>
              <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                {role}
              </span>
            </div>

            <div className="h-10 w-[1px] bg-gray-100 hidden sm:block"></div>

            <button 
              onClick={handleLogout}
              className="flex items-center justify-center p-3 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all group"
              title="Sair do Sistema"
            >
              <LogOut size={22} className="group-hover:-translate-x-1 transition-transform" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}