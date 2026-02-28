"use client";

import { useAuth } from "@/lib/auth-context"; //
import Sidebar from "@/components/Sidebar"; //
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth(); //
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  // 1. Enquanto carrega o estado do usuário
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5D286C]" size={40} />
      </div>
    );
  }

  // 2. Se for a tela de login, renderiza apenas o conteúdo
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 3. Se não estiver logado, permitimos renderizar os children para que
  // o useEffect de redirecionamento nas páginas (ex: page.tsx) funcione.
  if (!user) {
    return <>{children}</>;
  }

  // 4. Se estiver logado, renderiza a estrutura completa com Sidebar
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar /> 
      <main className="flex-1 bg-gray-50/30 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}