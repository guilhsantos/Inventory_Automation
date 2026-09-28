"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Hammer, Package, AlertTriangle, CheckCircle, Archive, Cpu, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchMachineStates, MachineState } from "@/lib/machines";
import { useToast } from "@/lib/toast-context";
import MachineRow from "@/components/operator/MachineRow";

const actions = [
  { title: "Produção", icon: <Hammer size={22} />, path: "/operator/manual-production", color: "bg-blue-600" },
  { title: "Kits", icon: <Package size={22} />, path: "/operator/scanner", color: "bg-[#5D286C]" },
  { title: "Defeito", icon: <AlertTriangle size={22} />, path: "/operator/defects", color: "bg-red-600" },
  { title: "Reservar", icon: <Archive size={22} />, path: "/operator/reserve", color: "bg-amber-600" },
  { title: "Baixa de Pedido", icon: <CheckCircle size={22} />, path: "/operator/checkout", color: "bg-green-600" },
];

export default function OperatorProductionPage() {
  const { showToast } = useToast();
  const [machines, setMachines] = useState<MachineState[]>([]);
  const [moldes, setMoldes] = useState<{ id: number; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMachines = useCallback(async () => {
    try {
      setMachines(await fetchMachineStates());
    } catch (err: any) {
      showToast(`Erro ao carregar máquinas: ${err.message}`, "error");
    }
  }, [showToast]);

  useEffect(() => {
    async function load() {
      const [, moldesRes] = await Promise.all([
        loadMachines(),
        supabase.from("moldes").select("id, nome").order("nome"),
      ]);
      if (moldesRes.data) setMoldes(moldesRes.data);
      setLoading(false);
    }
    void load();
  }, [loadMachines]);

  const semMolde = machines.filter((m) => m.current_molde_id === null).length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center md:text-left">
        <h1 className="text-3xl md:text-4xl font-black text-[#262626]">Operação de Produção</h1>
        <p className="text-gray-500 font-bold mt-1">Selecione a atividade ou atualize as máquinas.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {actions.map((action) => (
          <Link
            key={action.title}
            href={action.path}
            className="group flex items-center gap-3 bg-white p-3 rounded-2xl border-2 border-gray-100 shadow-sm hover:shadow-md hover:border-transparent transition-all min-h-[72px] last:col-span-2 md:last:col-span-1"
          >
            <div className={`${action.color} text-white p-3 rounded-xl shadow group-hover:scale-105 transition-transform shrink-0`}>
              {action.icon}
            </div>
            <span className="font-black text-[#262626] leading-tight">{action.title}</span>
          </Link>
        ))}
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-[#262626] flex items-center gap-2">
            <Cpu className="text-[#5D286C]" size={22} /> Máquinas
          </h2>
          <button
            type="button"
            onClick={() => void loadMachines()}
            className="p-2 rounded-xl text-gray-400 hover:text-[#5D286C] hover:bg-white transition-all"
            title="Atualizar"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {semMolde > 0 && (
          <div className="bg-amber-50 border-2 border-amber-200 text-amber-800 rounded-2xl p-3 text-sm font-bold flex items-center gap-2">
            <AlertTriangle size={16} />
            {semMolde === 1 ? "1 máquina está sem molde definido." : `${semMolde} máquinas estão sem molde definido.`}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-[#5D286C]" size={32} />
          </div>
        ) : machines.length === 0 ? (
          <p className="text-center text-gray-400 font-bold py-10">Nenhuma máquina cadastrada.</p>
        ) : (
          <div className="space-y-3">
            {machines.map((machine) => (
              <MachineRow key={machine.id} machine={machine} moldes={moldes} onUpdated={() => void loadMachines()} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
