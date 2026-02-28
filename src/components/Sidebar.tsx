"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { 
  LayoutDashboard, QrCode, Settings, LogOut, 
  User, ChevronLeft, ChevronRight 
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const { user, role, loading } = useAuth();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (loading || !user) return null;

  const menuItems = [
    { name: "Dashboard", icon: <LayoutDashboard size={22} />, path: "/", roles: ["ADMIN"] },
    { name: "Operador", icon: <QrCode size={22} />, path: "/scanner", roles: ["ADMIN", "OP_ESTOQUE"] },
    { name: "Configurações", icon: <Settings size={22} />, path: "/config", roles: ["ADMIN"] },
  ];

  return (
    <aside 
      className={`relative bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Botão de Minimizar */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-10 bg-[#5D286C] text-white rounded-full p-1 shadow-md hover:bg-[#7B1470] transition-colors z-50"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Logo da Empresa */}
      <div className={`p-6 flex justify-center items-center border-b border-gray-50 h-24 overflow-hidden`}>
        <img 
          src="/logo.jpg" 
          alt="Reauto Logo" 
          className={`transition-all duration-300 ${isCollapsed ? "h-8 w-8 object-cover rounded-lg" : "h-8 w-auto"}`} 
        />
      </div>

      {/* Menu de Navegação */}
      <nav className="flex-1 p-3 space-y-2 mt-4">
        {menuItems.map((item) => {
          if (item.roles.includes(role || "")) {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.name}
                href={item.path}
                title={isCollapsed ? item.name : ""}
                className={`flex items-center gap-4 p-4 rounded-2xl font-bold transition-all group ${
                  isActive 
                    ? "bg-[#5D286C] text-white shadow-lg shadow-purple-200" 
                    : "text-[#262626] hover:bg-[#F8F1F9] hover:text-[#7B1470]"
                }`}
              >
                <span className={`${isActive ? "text-white" : "text-[#5D286C] group-hover:text-[#7B1470]"}`}>
                  {item.icon}
                </span>
                {!isCollapsed && <span className="animate-in fade-in duration-500">{item.name}</span>}
              </Link>
            );
          }
          return null;
        })}
      </nav>

      {/* Parte Inferior: Usuário e Sair */}
      <div className={`p-4 border-t border-gray-50 ${isCollapsed ? "bg-white" : "bg-gray-50/50"}`}>
        <div className={`flex items-center gap-3 px-2 mb-4 ${isCollapsed ? "justify-center" : ""}`}>
          <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex-shrink-0">
            <User size={20} className="text-[#7B1470]" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden animate-in fade-in">
              <p className="text-sm font-black text-[#262626] truncate uppercase">
                {user.email?.split("@")[0]}
              </p>
              <p className="text-[10px] font-bold text-[#5D286C] uppercase tracking-widest">{role}</p>
            </div>
          )}
        </div>
        
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 p-4 text-[#44213F] font-bold hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all ${
            isCollapsed ? "justify-center" : ""
          }`}
          title={isCollapsed ? "Sair" : ""}
        >
          <LogOut size={20} />
          {!isCollapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}