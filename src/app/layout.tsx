"use client";

import "./globals.css";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5D286C]" size={40} />
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  // Se não houver usuário, renderizamos os 'children' de qualquer forma
  // para que o useEffect de redirecionamento dentro das páginas funcione.
  if (!user) {
    return <>{children}</>;
  }

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