"use client";

import { Cpu } from "lucide-react";
import { MACHINE_STATUS_BADGE, MACHINE_STATUS_LABEL, MachineState } from "@/lib/machines";
import { formatDateTime } from "@/lib/date-utils";
import MachineIllustration from "@/components/MachineIllustration";
import MaterialStockPanel, { MaterialStock } from "./MaterialStockPanel";

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
  materials: MaterialStock[];
}

interface MachineSummary {
  total: number;
  lastAt: string | null;
  byMolde: Map<number, { nome: string; qtd: number }>;
}

interface MachineView {
  machine: MachineState;
  emAndamento: boolean;
  qtdAtual: number;
  outros: { id: number; nome: string; qtd: number }[];
  total: number;
  lastAt: string | null;
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

function buildViews(machines: MachineState[], production: ProductionRow[]): MachineView[] {
  const summaries = summarize(production);
  return machines.map((machine) => {
    const s = summaries.get(machine.id);
    const outros = s
      ? [...s.byMolde.entries()]
          .filter(([id]) => id !== machine.current_molde_id)
          .map(([id, m]) => ({ id, ...m }))
          .sort((a, b) => b.qtd - a.qtd)
      : [];
    return {
      machine,
      emAndamento: machine.status === "EM_OPERACAO" && machine.current_molde_id != null,
      qtdAtual: machine.current_molde_id != null ? s?.byMolde.get(machine.current_molde_id)?.qtd ?? 0 : 0,
      outros,
      total: s?.total ?? 0,
      lastAt: s?.lastAt ?? null,
    };
  });
}

function StatusBadge({ view, className = "" }: { view: MachineView; className?: string }) {
  const { machine, emAndamento } = view;
  return (
    <span
      className={`text-[10px] font-black uppercase px-2 py-1 rounded-full whitespace-nowrap ${
        emAndamento ? "bg-blue-100 text-blue-700" : MACHINE_STATUS_BADGE[machine.status]
      } ${className}`}
    >
      {emAndamento ? "Em andamento" : MACHINE_STATUS_LABEL[machine.status]}
    </span>
  );
}

/** Outros moldes do período: faixa com rolagem horizontal, sem aumentar o card. */
function OutrosMoldes({ outros }: { outros: MachineView["outros"] }) {
  if (outros.length === 0) return null;
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Também produziu</p>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {outros.map((m) => (
          <span
            key={m.id}
            className="shrink-0 bg-white border border-gray-200 rounded-xl px-2 py-1 text-xs font-bold text-gray-500 whitespace-nowrap"
          >
            {m.nome} · <span className="text-[#262626]">{m.qtd} un</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Computador/tablet: máquina grande em cima, resumo embaixo, cards preenchem a altura. */
function MachineCard({ view }: { view: MachineView }) {
  const { machine } = view;
  return (
    <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 flex flex-col gap-4 min-w-0 min-h-[24rem]">
      <div className="h-44 2xl:h-56 shrink-0 flex items-center justify-center">
        <MachineIllustration
          status={machine.status}
          running={view.emAndamento}
          className="w-full h-full max-h-56 max-w-xs"
        />
      </div>

      <div className="flex-1 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-black text-xl text-[#262626] truncate">{machine.nome}</p>
          <StatusBadge view={view} />
        </div>

        <div className="bg-white rounded-2xl p-3 border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase">Molde atual</p>
          {machine.moldes ? (
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-black text-[#5D286C] break-words min-w-0">{machine.moldes.nome}</p>
              <p className="text-3xl font-black text-[#262626] shrink-0">
                {view.qtdAtual}
                <span className="text-xs text-gray-400 ml-1">un</span>
              </p>
            </div>
          ) : (
            <p className="font-bold text-amber-600">Sem molde definido</p>
          )}
        </div>

        {machine.status !== "EM_OPERACAO" && machine.status_observacao && (
          <p className="text-xs font-bold text-gray-600 bg-white rounded-xl p-2 border border-gray-100 break-words">
            Obs.: {machine.status_observacao}
          </p>
        )}

        <OutrosMoldes outros={view.outros} />

        <div className="mt-auto flex flex-wrap justify-between gap-x-3 gap-y-1 pt-3 border-t border-gray-200 text-[10px] font-bold text-gray-400 uppercase">
          <span>
            Total: <span className="text-[#262626]">{view.total} un</span>
          </span>
          <span>
            {view.lastAt ? (
              <>
                Último: <span className="text-[#262626]">{formatDateTime(view.lastAt)}</span>
              </>
            ) : (
              "Sem lançamento"
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Celular: linha compacta, rápida de ler. */
function MachineListItem({ view }: { view: MachineView }) {
  const { machine } = view;
  return (
    <div className="py-3 space-y-2">
      <div className="flex items-center gap-3">
        <MachineIllustration status={machine.status} running={view.emAndamento} className="w-12 h-auto shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-black text-[#262626] truncate">{machine.nome}</p>
            <StatusBadge view={view} />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-sm font-bold truncate ${machine.moldes ? "text-[#5D286C]" : "text-amber-600"}`}>
              {machine.moldes?.nome ?? "Sem molde"}
            </p>
            {machine.moldes && (
              <p className="font-black text-[#262626] shrink-0">
                {view.qtdAtual} <span className="text-[10px] text-gray-400">un</span>
              </p>
            )}
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase truncate">
            {machine.status !== "EM_OPERACAO" && machine.status_observacao
              ? `Obs.: ${machine.status_observacao}`
              : view.lastAt
                ? `Total ${view.total} un · último ${formatDateTime(view.lastAt)}`
                : "Sem lançamento no período"}
          </p>
        </div>
      </div>
      <OutrosMoldes outros={view.outros} />
    </div>
  );
}

export default function MachinesPanel({ machines, production, materials }: MachinesPanelProps) {
  const views = buildViews(machines, production);

  return (
    <section className="bg-white p-4 md:p-8 rounded-3xl md:rounded-[2.5rem] shadow-sm border border-gray-100 min-w-0 md:min-h-[calc(100vh-6rem)] flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 md:gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-[#262626] flex items-center gap-2">
            <Cpu className="text-[#5D286C]" size={24} /> Máquinas
          </h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase">Produção no período filtrado</p>
        </div>
        <MaterialStockPanel materials={materials} />
      </div>

      {views.length === 0 ? (
        <p className="text-center text-gray-400 font-bold py-10">Nenhuma máquina cadastrada.</p>
      ) : (
        <>
          <div className="md:hidden divide-y divide-gray-100">
            {views.map((view) => (
              <MachineListItem key={view.machine.id} view={view} />
            ))}
          </div>
          <div className="hidden md:grid grid-cols-2 xl:grid-cols-3 auto-rows-fr gap-4 flex-1">
            {views.map((view) => (
              <MachineCard key={view.machine.id} view={view} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
