"use client";

import { Box } from "lucide-react";

export interface MaterialStock {
  id: number;
  nome: string;
  estoque_kg: number;
}

const KG_POR_SACO = 25;

/** Resumo compacto do estoque de material (fica no canto do painel de máquinas). */
export default function MaterialStockPanel({ materials }: { materials: MaterialStock[] }) {
  const sorted = [...materials].sort((a, b) => Number(a.estoque_kg) - Number(b.estoque_kg));
  const max = Math.max(1, ...sorted.map((m) => Number(m.estoque_kg) || 0));

  return (
    <div className="w-full md:w-72 shrink-0 bg-gray-50 border border-gray-100 rounded-2xl p-3">
      <p className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1 mb-2">
        <Box size={12} className="text-[#5D286C]" /> Estoque de material
      </p>

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 font-bold">Nenhum material cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((m, i) => {
            const kg = Number(m.estoque_kg) || 0;
            const baixo = i === 0 && sorted.length > 1;
            return (
              <div key={m.id} title={`≈ ${Math.floor(kg / KG_POR_SACO)} saco(s) de ${KG_POR_SACO} kg`}>
                <div className="flex justify-between items-baseline gap-2 text-xs">
                  <span className="font-bold text-[#262626] truncate">{m.nome}</span>
                  <span className={`font-black shrink-0 ${baixo ? "text-red-600" : "text-[#262626]"}`}>
                    {kg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg
                  </span>
                </div>
                <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full ${baixo ? "bg-red-500" : "bg-[#5D286C]"}`}
                    style={{ width: `${Math.max(2, (kg / max) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
