"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else {
        // Redirecionamento baseado no cargo (Role)
        if (role === 'OP_ESTOQUE' || role === 'OP_PRODUCAO') {
          router.push("/operator/production");
        } else if (role === 'ADMIN') {
          router.push("/dashboard"); 
        } else {
          // Fallback para qualquer outro caso
          router.push("/operator/production");
        }
      }
    }
  }, [user, role, loading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-[#5D286C] mb-4" size={48} />
      <p className="text-gray-400 font-black uppercase text-[10px] tracking-[0.3em]">
        Sincronizando Acesso...
      </p>
    </div>
  );
}