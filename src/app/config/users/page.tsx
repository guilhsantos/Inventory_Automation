"use client";

import { Users } from "lucide-react";

export default function UsersConfigPage() {
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-black text-[#262626] flex items-center gap-3">
        <Users className="text-[#5D286C]" /> Configuração de Usuários
      </h1>
      <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-50 shadow-sm">
        <p className="text-gray-500 font-bold">
          Tela de gerenciamento de usuários e permissões em desenvolvimento...
        </p>
      </div>
    </div>
  );
}