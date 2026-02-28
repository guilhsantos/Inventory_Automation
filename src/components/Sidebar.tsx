"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, QrCode, Settings, LogOut, User, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image"; // Importado aqui

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
    <aside className={`relative bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0 transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"}`}>
      <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute -right-3 top-10 bg-[#5D286C] text-white rounded-full p-1 shadow-md z-50">
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className="p-6 flex justify-center items-center border-b border-gray-50 h-24 overflow-hidden">
        {/* Usando o componente Image do Next.js */}
        <Image 
          src="/logo.jpg" 
          alt="Reauto Logo" 
          width={isCollapsed ? 32 : 120}
          height={32}
          className={`transition-all duration-300 ${isCollapsed ? "object-cover rounded-lg" : "h-8 w-auto"}`} 
        />
      </div>

      <nav className="flex-1 p-3 space-y-2 mt-4">
        {menuItems.map((item) => {
          if (item.roles.includes(role || "")) {
            const isActive = pathname === item.path;
            return (
              <Link key={item.name} href={item.path} className={`flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${isActive ? "bg-[#5D286C] text-white shadow-lg" : "text-[#262626] hover:bg-[#F8F1F9]"}`}>
                {item.icon}
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            );
          }
          return null;
        })}
      </nav>

      <div className={`p-4 border-t border-gray-50 ${isCollapsed ? "bg-white" : "bg-gray-50/50"}`}>
        <div className={`flex items-center gap-3 px-2 mb-4 ${isCollapsed ? "justify-center" : ""}`}>
          <div className="bg-white p-2 rounded-xl border border-gray-100">
            <User size={20} className="text-[#7B1470]" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-black text-[#262626] truncate uppercase">{user.email?.split("@")[0]}</p>
              <p className="text-[10px] font-bold text-[#5D286C] uppercase tracking-widest">{role}</p>
            </div>
          )}
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 text-[#44213F] font-bold hover:bg-red-50 rounded-2xl">
          <LogOut size={20} />
          {!isCollapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}