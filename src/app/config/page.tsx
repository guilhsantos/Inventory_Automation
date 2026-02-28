"use client";

import { Settings } from "lucide-react";

export default function ConfigPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-[#5D286C] p-3 rounded-2xl text-white">
          <Settings size={32} />
        </div>
        <h1 className="text-4xl font-black text-[#262626]">Configurações</h1>
      </div>
      
      <div className="bg-white border-2 border-gray-100 rounded-[2.5rem] p-10 shadow-sm">
        <p className="text-gray-500 font-medium">
          Módulo de configurações do sistema. Em breve você poderá gerenciar usuários e kits por aqui.
        </p>
      </div>
    </div>
  );
}