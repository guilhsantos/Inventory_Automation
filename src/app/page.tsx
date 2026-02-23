"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, QrCode, Package, Activity } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    
    // REDIRECIONAMENTO POR CARGO
    // Se for operador de estoque, manda direto pro scanner pra ele não perder tempo
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

  // Se for ADMIN, ele vê a Dashboard Completa
  return (
    <div className="min-h-screen bg-white text-gray-900 p-6">
      <nav className="max-w-4xl mx-auto flex justify-between items-center mb-12">
        <h1 className="font-black text-2xl tracking-tighter">SGA <span className="text-purple-600">|</span> ADM</h1>
        <div className="flex items-center gap-3">
          <div className="text-right mr-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Usuário Logado</p>
            <p className="text-sm font-black text-purple-600 uppercase">{user?.email?.split('@')[0]}</p>
          </div>
          <button onClick={() => router.push('/api/auth/logout')} className="bg-gray-100 p-2 rounded-lg text-gray-400">
            Sair
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto">
        <div className="mb-10">
          <h2 className="text-4xl font-black leading-tight">Painel de <span className="text-purple-600">Controle GERAL</span></h2>
          <p className="text-gray-400 mt-2 font-medium uppercase tracking-widest text-xs">Visão Administrativa - Reauto Car</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/scanner" className="p-8 bg-white border-2 border-gray-100 rounded-[2.5rem] hover:border-purple-600 transition-all group shadow-sm">
            <div className="bg-purple-600 text-white p-4 rounded-2xl w-fit mb-6">
              <QrCode size={32} />
            </div>
            <h3 className="font-bold text-2xl">Módulo de Estoque</h3>
            <p className="text-gray-400 mt-2">Acesso ao scanner e baixa de kits.</p>
          </Link>

          <Link href="/producao" className="p-8 bg-white border-2 border-gray-100 rounded-[2.5rem] hover:border-purple-600 transition-all group shadow-sm opacity-50 cursor-not-allowed">
            <div className="bg-gray-100 text-gray-400 p-4 rounded-2xl w-fit mb-6">
              <Package size={32} />
            </div>
            <h3 className="font-bold text-2xl">Módulo Produção</h3>
            <p className="text-gray-400 mt-2">Controle de saída de máquinas (Em breve).</p>
          </Link>
        </div>
      </main>
    </div>
  );
}