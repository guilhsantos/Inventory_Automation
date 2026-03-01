"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { 
  LayoutDashboard, QrCode, Settings, LogOut, 
  User, ChevronLeft, ChevronRight, ShoppingCart,
  ChevronDown, Package, Cpu, Box, Users, PlusCircle, List
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

interface SidebarProps {
  onCloseMobile?: () => void;
}

export default function Sidebar({ onCloseMobile }: SidebarProps) {
  const { user, role, loading } = useAuth();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const toggleSubmenu = (name: string) => {
    setOpenSubmenu(openSubmenu === name ? null : name);
  };

  if (loading || !user) return null;

  const menuItems = [
    { name: "Dashboard", icon: <LayoutDashboard size={22} />, path: "/dashboard", roles: ["ADMIN"] },
    { 
      name: "Pedidos", 
      icon: <ShoppingCart size={22} />, 
      path: "/orders", 
      roles: ["ADMIN"],
      subItems: [
        { name: "Novo Pedido", path: "/orders/new", icon: <PlusCircle size={18} /> },
        { name: "Lista de Pedidos", path: "/orders/list", icon: <List size={18} /> },
      ]
    },
    { 
      name: "Operador", 
      icon: <QrCode size={22} />, 
      path: "/operator/production", 
      roles: ["ADMIN", "OP_ESTOQUE"],
    },
    { 
      name: "Configurações", 
      icon: <Settings size={22} />, 
      path: "/config", 
      roles: ["ADMIN"],
      subItems: [
        { name: "Kits", path: "/config/kits", icon: <Package size={18} /> },
        { name: "Máquinas", path: "/config/machine", icon: <Cpu size={18} /> },
        { name: "Material", path: "/config/material", icon: <Box size={18} /> },
        { name: "Usuários", path: "/config/users", icon: <Users size={18} /> },
      ]
    },
  ];

  return (
    <aside className={`relative bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0 transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"}`}>
      <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden md:flex absolute -right-3 top-10 bg-[#5D286C] text-white rounded-full p-1 shadow-md z-50">
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className="p-6 flex justify-center items-center border-b border-gray-50 h-24">
        <Image src="/logo.jpg" alt="Logo" width={isCollapsed ? 32 : 120} height={32} className={`${isCollapsed ? "rounded-lg" : "w-auto h-8"}`} />
      </div>

      <nav className="flex-1 p-3 space-y-1 mt-4 overflow-y-auto">
        {menuItems.map((item) => {
          if (!item.roles.includes(role || "")) return null;
          
          const hasSubItems = !!item.subItems;
          const isActive = pathname.startsWith(item.path);
          const isOpen = openSubmenu === item.name || (isActive && hasSubItems);

          return (
            <div key={item.name} className="space-y-1">
              {hasSubItems ? (
                <button
                  onClick={() => toggleSubmenu(item.name)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl font-bold transition-all ${isActive ? "bg-[#F8F1F9] text-[#5D286C]" : "text-[#262626] hover:bg-gray-50"}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-[#5D286C]">{item.icon}</span>
                    {!isCollapsed && <span>{item.name}</span>}
                  </div>
                  {!isCollapsed && <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />}
                </button>
              ) : (
                <Link
                  href={item.path}
                  onClick={onCloseMobile}
                  className={`flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${isActive ? "bg-[#5D286C] text-white" : "text-[#262626] hover:bg-gray-50"}`}
                >
                  <span className={isActive ? "text-white" : "text-[#5D286C]"}>{item.icon}</span>
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              )}

              {hasSubItems && isOpen && !isCollapsed && (
                <div className="ml-4 pl-4 border-l-2 border-gray-100 space-y-1 animate-in slide-in-from-left-2">
                  {item.subItems?.map((sub) => (
                    <Link
                      key={sub.path}
                      href={sub.path}
                      onClick={onCloseMobile}
                      className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${pathname === sub.path ? "text-[#5D286C] bg-purple-50" : "text-gray-500 hover:text-[#5D286C] hover:bg-gray-50"}`}
                    >
                      {sub.icon}
                      <span>{sub.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-50 bg-gray-50/50">
        <div className={`flex items-center gap-3 px-2 mb-4 ${isCollapsed ? "justify-center" : ""}`}>
          <User size={20} className="text-[#7B1470]" />
          {!isCollapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-black text-[#262626] truncate uppercase">{user.email?.split("@")[0]}</p>
              <p className="text-[10px] font-bold text-[#5D286C] uppercase tracking-widest">{role}</p>
            </div>
          )}
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 text-[#44213F] font-bold hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all">
          <LogOut size={20} />
          {!isCollapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}