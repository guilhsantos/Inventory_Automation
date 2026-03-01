"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import { usePathname } from "next/navigation";
import { Loader2, Menu, X } from "lucide-react";
import { ToastProvider } from "@/lib/toast-context"; 
import Image from "next/image";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isLoginPage = pathname === "/login";

  // 1. Enquanto carrega o estado do usuário
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5D286C]" size={40} />
      </div>
    );
  }

  // Definição do conteúdo principal para evitar repetição dentro do Provider
  const renderContent = () => {
    if (isLoginPage || !user) {
      return <>{children}</>;
    }

    return (
      <div className="flex min-h-screen bg-gray-50/50 flex-col md:flex-row">
        {/* Menu Mobile Header */}
        <div className="md:hidden bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50">
          <Image src="/logo.jpg" alt="Logo" width={120} height={32} className="h-8 w-auto" />
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Sidebar - Oculta no mobile a menos que aberto */}
        <div className={`${isMobileMenuOpen ? "block" : "hidden"} md:block fixed md:sticky top-0 z-40 h-full`}>
          <Sidebar onCloseMobile={() => setIsMobileMenuOpen(false)} />
        </div>

        {/* Overlay para fechar menu mobile ao clicar fora */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-30 md:hidden" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    );
  };

  return (
    <ToastProvider>
      {renderContent()}
    </ToastProvider>
  );
}