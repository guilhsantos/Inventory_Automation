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
    // Se não estiver logado, manda para o login
    if (!loading && !user) {
      router.push("/login");
    }
    
    // Se for operador de estoque, manda direto pro scanner para agilizar o trabalho
    if (!loading && role === 'OP_ESTOQUE') {
      router.push("/scanner");
    }
  }, [user, role, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5D286C]" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto">
      <main className="mt-8">
        <div className="mb-12">
          {/* AQUI ENTRA O PASSO 3: Título com as cores da Reauto */}
          <h2 className="text-5xl font-black text-[#262626] leading-tight">
            Painel de <span className="text-[#5D286C]">Gestão Geral</span>
          </h2>
          <p className="text-gray-400 mt-3 font-bold uppercase tracking-[0.2em] text-xs italic">
            SGA Industrial - Reauto Car
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* AQUI ENTRA O PASSO 3: Link do Scanner com a paleta */}
          <Link 
            href="/scanner" 
            className="p-10 bg-white border-2 border-gray-100 rounded-[3rem] hover:border-[#7B1470] transition-all group shadow-sm relative overflow-hidden"
          >
            <div className="bg-[#5D286C] text-white p-5 rounded-3xl w-fit mb-8 group-hover:bg-[#7B1470] transition-colors shadow-lg shadow-purple-100">
              <QrCode size={40} />
            </div>
            
            <h3 className="font-black text-3xl text-[#262626]">Módulo de Estoque</h3>
            <p className="text-gray-500 mt-3 text-lg leading-relaxed">
              Acesso ao scanner de alta precisão para identificação e baixa de kits no sistema.
            </p>
            
            <div className="mt-8 flex items-center gap-2 text-[#5D286C] font-black uppercase text-sm tracking-widest group-hover:text-[#7B1470]">
              Acessar Módulo <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
            </div>
          </Link>

          {/* Módulo de Produção (Desabilitado por enquanto) */}
          <div className="p-10 bg-gray-50/50 border-2 border-transparent rounded-[3rem] opacity-40 cursor-not-allowed">
            <div className="bg-gray-200 text-gray-400 p-5 rounded-3xl w-fit mb-8">
              <Package size={40} />
            </div>
            <h3 className="font-black text-3xl text-gray-400">Módulo Produção</h3>
            <p className="text-gray-400 mt-3 text-lg leading-relaxed">
              Controle de saída de máquinas e peças da linha de montagem (Em breve).
            </p>
          </div>
        </div>
      </main>

      {/* Rodapé Interno */}
      <footer className="mt-20 pt-8 border-t border-gray-100">
        <p className="text-center text-[10px] text-gray-300 font-bold uppercase tracking-[0.5em]">
          Powered by Reauto Intelligence
        </p>
      </footer>
    </div>
  );
}