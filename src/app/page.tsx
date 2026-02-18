import { Package, QrCode, ClipboardList, Activity, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Header com degradê roxo discreto */}
      <nav className="bg-white border-b border-gray-100 p-6 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="font-black text-2xl tracking-tighter text-gray-900">
              SGA <span className="text-purple-600">|</span> REAUTO CAR
            </h1>
            <p className="text-[10px] text-purple-600 font-bold uppercase tracking-[0.2em]">Sistemas de Gestão de Automação</p>
          </div>
          <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
            <Activity size={24} />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-8">
        <div className="mb-12">
          <h2 className="text-4xl font-black text-gray-900 leading-tight">
            Olá, <br/>
            <span className="text-purple-600">O que vamos fazer hoje?</span>
          </h2>
        </div>

        {/* Grid de Botões Estilo "Cards" */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <Link href="/scanner" className="group p-8 bg-white rounded-3xl border-2 border-gray-100 hover:border-purple-600 hover:shadow-2xl hover:shadow-purple-100 transition-all text-left relative overflow-hidden">
            <div className="bg-purple-600 text-white p-4 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform">
              <QrCode size={32} />
            </div>
            <h3 className="font-bold text-2xl text-gray-900">Bipar QR Code</h3>
            <p className="text-gray-500 mt-2">Dar baixa em kits e peças no estoque real.</p>
            <ArrowRight className="absolute bottom-8 right-8 text-gray-300 group-hover:text-purple-600 transition-colors" />
          </Link>

          <button className="group p-8 bg-gray-50 rounded-3xl border-2 border-transparent hover:border-gray-200 transition-all text-left relative">
            <div className="bg-gray-200 text-gray-600 p-4 rounded-2xl w-fit mb-6">
              <Package size={32} />
            </div>
            <h3 className="font-bold text-2xl text-gray-900 text-gray-400">Lançar Produção</h3>
            <p className="text-gray-400 mt-2">Módulo de saída de máquinas (Fase 2).</p>
          </button>

          <button className="group p-8 bg-gray-50 rounded-3xl border-2 border-transparent hover:border-gray-200 transition-all text-left relative">
            <div className="bg-gray-200 text-gray-600 p-4 rounded-2xl w-fit mb-6">
              <ClipboardList size={32} />
            </div>
            <h3 className="font-bold text-2xl text-gray-900 text-gray-400">Ver Estoque</h3>
            <p className="text-gray-400 mt-2">Consultar saldos e inventário atual.</p>
          </button>

          <div className="p-8 bg-purple-600 rounded-3xl text-white flex flex-col justify-center">
            <h3 className="font-bold text-xl">Dica Sênior:</h3>
            <p className="opacity-80 mt-2 text-sm">
              Use o leitor em locais iluminados para garantir 100% de precisão na bipagem dos kits.
            </p>
          </div>
        </div>

        {/* Rodapé técnico */}
        <div className="mt-16 border-t border-gray-100 pt-8 flex justify-between items-center">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">
            Cloud Sync Active
          </p>
          <div className="flex gap-2">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
             <span className="text-[10px] font-bold text-gray-500">SERVER ONLINE</span>
          </div>
        </div>
      </main>
    </div>
  );
}