"use client";

import { Box } from "lucide-react";

export interface MaterialStock {
  id: number;
  nome: string;
  estoque_kg: number;
}

const KG_POR_SACO = 25;

export default function MaterialStockPanel({ materials }: { materials: MaterialStock[] }) {
  const sorted = [...materials].sort((a, b) => Number(a.estoque_kg) - Number(b.estoque_kg));
  const max = Math.max(1, ...sorted.map((m) => Number(m.estoque_kg) || 0));

  return (
    <div className="bg-white p-6 md:p-8 rounded-[3rem] shadow-sm border border-gray-100 min-w-0">
      <div className="mb-5">
        <h2 className="text-xl font-black text-[#262626] flex items-center gap-2">
          <Box className="text-[#5D286C]" size={22} /> Estoque de Material
        </h2>
        <p className="text-[10px] font-bold text-gray-400 uppercase">Saldo atual · menor saldo primeiro</p>
      </div>

      {sorted.length === 0 ? (
        <p className="text-center text-gray-400 font-bold py-10">Nenhum material cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((m, i) => {
            const kg = Number(m.estoque_kg) || 0;
            const baixo = i === 0 && sorted.length > 1;
            return (
              <div
                key={m.id}
                className={`p-4 rounded-2xl border ${baixo ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}
              >
                <div className="flex justify-between items-baseline gap-2">
                  <span className="font-black text-[#262626] text-sm truncate">{m.nome}</span>
                  <span className={`font-black shrink-0 ${baixo ? "text-red-600" : "text-[#262626]"}`}>
                    {kg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg
                  </span>
                </div>
                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full ${baixo ? "bg-red-500" : "bg-[#5D286C]"}`}
                    style={{ width: `${Math.max(2, (kg / max) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                  ≈ {Math.floor(kg / KG_POR_SACO)} saco(s) de {KG_POR_SACO} kg
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
