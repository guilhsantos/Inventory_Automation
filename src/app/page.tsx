"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, QrCode, Package, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    
    // Redireciona Operador de Estoque direto para o Scanner
    if (!loading && role === 'OP_ESTOQUE') {
      router.push("/scanner");
    }
  }, [user, role, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <main className="mt-8">
        <div className="mb-12">
          <h2 className="text-4xl font-black leading-tight text-gray-900">
            Painel de <span className="text-purple-600">Gestão Geral</span>
          </h2>
          <p className="text-gray-400 mt-2 font-medium uppercase tracking-widest text-xs">
            Visão Administrativa Autorizada
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/scanner" className="p-8 bg-white border-2 border-gray-100 rounded-[2.5rem] hover:border-purple-600 transition-all group shadow-sm relative overflow-hidden">
            <div className="bg-purple-600 text-white p-4 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform">
              <QrCode size={32} />
            </div>
            <h3 className="font-bold text-2xl text-gray-900">Módulo de Estoque</h3>
            <p className="text-gray-500 mt-2">Acesso ao scanner de alta precisão e baixa de kits.</p>
            <ArrowRight className="absolute bottom-8 right-8 text-gray-200 group-hover:text-purple-600 transition-colors" />
          </Link>

          <div className="p-8 bg-white border-2 border-gray-100 rounded-[2.5rem] opacity-50 cursor-not-allowed">
            <div className="bg-gray-100 text-gray-400 p-4 rounded-2xl w-fit mb-6">
              <Package size={32} />
            </div>
            <h3 className="font-bold text-2xl text-gray-400">Módulo de Produção</h3>
            <p className="text-gray-400 mt-2">Controle de saída de máquinas e peças (Em breve).</p>
          </div>
        </div>
      </main>
    </div>
  );
}