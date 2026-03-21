"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import { usePathname } from "next/navigation";
import { Loader2, Menu, X } from "lucide-react";
import { ToastProvider } from "@/lib/toast-context";
import Image from "next/image";
import { useStuckLoadingRecovery } from "@/lib/use-stuck-loading-recovery";

function StuckAuthLoadingRecovery({ active }: { active: boolean }) {
  useStuckLoadingRecovery(active, 16000);
  return null;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isLoginPage = pathname === "/login";

  const showAuthSplash = Boolean(loading && !user && !isLoginPage);

  const renderContent = () => {
    if (isLoginPage) {
      return <>{children}</>;
    }

    if (!user && !loading) {
      return <>{children}</>;
    }

    return (
      <div className="flex min-h-screen bg-gray-50/50 flex-col md:flex-row">
        <div className="md:hidden bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50">
          <Image src="/logo.jpg" alt="Logo" width={120} height={32} className="h-8 w-auto" />
          <button type="button" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        <div className={`${isMobileMenuOpen ? "block" : "hidden"} md:block fixed md:sticky top-0 z-40 h-full`}>
          <Sidebar onCloseMobile={() => setIsMobileMenuOpen(false)} />
        </div>

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-30 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden
          />
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8 min-w-0">{children}</main>
      </div>
    );
  };

  return (
    <ToastProvider>
      <StuckAuthLoadingRecovery active={showAuthSplash} />
      {showAuthSplash ? (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loader2 className="animate-spin text-[#5D286C]" size={40} />
        </div>
      ) : (
        renderContent()
      )}
    </ToastProvider>
  );
}
