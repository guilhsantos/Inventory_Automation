"use client";

import "./globals.css";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

// Criamos um "Wrapper" interno para ter acesso ao useAuth()
function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  // 1. Enquanto carrega o estado do usuário, mostra uma tela limpa de carregamento
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5D286C]" size={40} />
      </div>
    );
  }

  // 2. Se for a tela de login, renderiza APENAS o conteúdo dela (sem Sidebar)
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 3. Se não estiver logado e não for a tela de login, não renderiza nada 
  // (o useEffect nas páginas vai mandar para o /login)
  if (!user) {
    return null;
  }

  // 4. Se estiver logado, renderiza o App completo (Sidebar + Conteúdo) juntos
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 bg-gray-50/30 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br">
      <body className="antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}