"use client";

import { Cpu } from "lucide-react";
import { MACHINE_STATUS_BADGE, MACHINE_STATUS_LABEL, MachineState } from "@/lib/machines";
import { formatDateTime } from "@/lib/date-utils";

export interface ProductionRow {
  machine_id: number | null;
  molde_id: number | null;
  quantidade_boa: number | null;
  created_at: string;
  moldes: { nome: string } | null;
}

interface MachinesPanelProps {
  machines: MachineState[];
  production: ProductionRow[];
}

interface MachineSummary {
  total: number;
  lastAt: string | null;
  byMolde: Map<number, { nome: string; qtd: number }>;
}

function summarize(production: ProductionRow[]): Map<number, MachineSummary> {
  const byMachine = new Map<number, MachineSummary>();
  for (const row of production) {
    if (row.machine_id == null || row.molde_id == null) continue;
    let s = byMachine.get(row.machine_id);
    if (!s) {
      s = { total: 0, lastAt: null, byMolde: new Map() };
      byMachine.set(row.machine_id, s);
    }
    const qtd = row.quantidade_boa || 0;
    s.total += qtd;
    if (!s.lastAt || row.created_at > s.lastAt) s.lastAt = row.created_at;
    const m = s.byMolde.get(row.molde_id) ?? { nome: row.moldes?.nome ?? `Molde #${row.molde_id}`, qtd: 0 };
    m.qtd += qtd;
    s.byMolde.set(row.molde_id, m);
  }
  return byMachine;
}

export default function MachinesPanel({ machines, production }: MachinesPanelProps) {
  const summaries = summarize(production);

  return (
    <div className="bg-white p-6 md:p-8 rounded-[3rem] shadow-sm border border-gray-100 min-w-0">
      <div className="mb-5">
        <h2 className="text-xl font-black text-[#262626] flex items-center gap-2">
          <Cpu className="text-[#5D286C]" size={22} /> Máquinas
        </h2>
        <p className="text-[10px] font-bold text-gray-400 uppercase">Produção no período filtrado</p>
      </div>

      {machines.length === 0 ? (
        <p className="text-center text-gray-400 font-bold py-10">Nenhuma máquina cadastrada.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {machines.map((machine) => {
            const summary = summaries.get(machine.id);
            const atual = machine.current_molde_id != null ? summary?.byMolde.get(machine.current_molde_id) : undefined;
            const outros = summary
              ? [...summary.byMolde.entries()]
                  .filter(([moldeId]) => moldeId !== machine.current_molde_id)
                  .sort((a, b) => b[1].qtd - a[1].qtd)
              : [];
            const emAndamento = machine.status === "EM_OPERACAO" && machine.current_molde_id != null;

            return (
              <div key={machine.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-black text-[#262626] truncate">{machine.nome}</p>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-1 rounded-full shrink-0 ${
                      emAndamento ? "bg-blue-100 text-blue-700" : MACHINE_STATUS_BADGE[machine.status]
                    }`}
                  >
                    {emAndamento ? "Em andamento" : MACHINE_STATUS_LABEL[machine.status]}
                  </span>
                </div>

                <div className="bg-white rounded-xl p-3 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase">Molde atual</p>
                  {machine.moldes ? (
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-black text-[#5D286C] truncate">{machine.moldes.nome}</p>
                      <p className="text-2xl font-black text-[#262626] shrink-0">
                        {atual?.qtd ?? 0}
                        <span className="text-xs text-gray-400 ml-1">un</span>
                      </p>
                    </div>
                  ) : (
                    <p className="font-bold text-amber-600 text-sm">Sem molde definido</p>
                  )}
                </div>

                {machine.status !== "EM_OPERACAO" && machine.status_observacao && (
                  <p className="text-xs font-bold text-gray-600 bg-white rounded-xl p-2 border border-gray-100">
                    Obs.: {machine.status_observacao}
                  </p>
                )}

                {outros.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Também produziu no período</p>
                    {outros.map(([moldeId, m]) => (
                      <div key={moldeId} className="flex justify-between text-xs font-bold text-gray-400">
                        <span className="truncate">{m.nome}</span>
                        <span className="shrink-0">{m.qtd} un</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase pt-2 border-t border-gray-200">
                  <span>Total: <span className="text-[#262626]">{summary?.total ?? 0} un</span></span>
                  <span>
                    {summary?.lastAt ? `Último lançamento: ${formatDateTime(summary.lastAt)}` : "Sem lançamento no período"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
