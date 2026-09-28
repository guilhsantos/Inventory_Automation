"use client";

import { useState } from "react";
import { AlertTriangle, Cpu, Loader2, Pause, Play, Wrench, X } from "lucide-react";
import {
  MACHINE_STATUS_BADGE,
  MACHINE_STATUS_LABEL,
  MachineState,
  MachineStatus,
  setMachineState,
} from "@/lib/machines";
import { useToast } from "@/lib/toast-context";

interface MachineRowProps {
  machine: MachineState;
  moldes: { id: number; nome: string }[];
  onUpdated: () => void;
}

const STATUS_BUTTONS: { status: MachineStatus; icon: React.ReactNode; active: string }[] = [
  { status: "EM_OPERACAO", icon: <Play size={14} />, active: "bg-green-600 text-white border-green-600" },
  { status: "PARADA", icon: <Pause size={14} />, active: "bg-red-600 text-white border-red-600" },
  { status: "MANUTENCAO", icon: <Wrench size={14} />, active: "bg-amber-500 text-white border-amber-500" },
];

export default function MachineRow({ machine, moldes, onUpdated }: MachineRowProps) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<MachineStatus | null>(null);
  const [observacao, setObservacao] = useState("");

  const semMolde = machine.current_molde_id === null;

  async function save(status: MachineStatus, moldeId: number | null, obs: string | null) {
    setSaving(true);
    try {
      await setMachineState(machine.id, status, moldeId, obs);
      showToast(`${machine.nome}: atualizado.`);
      onUpdated();
      return true;
    } catch (err: any) {
      showToast(`Erro: ${err.message}`, "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handleMoldeChange(value: string) {
    const moldeId = value ? parseInt(value) : null;
    void save(machine.status, moldeId, machine.status_observacao);
  }

  function handleStatusClick(status: MachineStatus) {
    if (status === machine.status) return;
    if (status === "EM_OPERACAO") {
      if (semMolde) {
        showToast("Selecione o molde antes de colocar a máquina em operação.", "error");
        return;
      }
      void save(status, machine.current_molde_id, null);
      return;
    }
    setObservacao("");
    setPendingStatus(status);
  }

  async function confirmStatus() {
    if (!pendingStatus) return;
    if (pendingStatus === "PARADA" && !observacao.trim()) {
      showToast("Informe o motivo da máquina parada.", "error");
      return;
    }
    const ok = await save(pendingStatus, machine.current_molde_id, observacao.trim() || null);
    if (ok) setPendingStatus(null);
  }

  return (
    <div
      className={`bg-white rounded-2xl border-2 p-4 flex flex-col lg:flex-row lg:items-center gap-3 transition-colors ${
        semMolde ? "border-amber-300 bg-amber-50/40" : "border-gray-100"
      }`}
    >
      <div className="flex items-center gap-3 lg:w-56 shrink-0">
        <div className="p-2 rounded-xl bg-gray-50 text-[#5D286C]">
          <Cpu size={20} />
        </div>
        <div className="min-w-0">
          <p className="font-black text-[#262626] truncate">{machine.nome}</p>
          <span className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${MACHINE_STATUS_BADGE[machine.status]}`}>
            {MACHINE_STATUS_LABEL[machine.status]}
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <label className="sr-only" htmlFor={`molde-${machine.id}`}>Molde na máquina</label>
        <select
          id={`molde-${machine.id}`}
          value={machine.current_molde_id ?? ""}
          disabled={saving}
          onChange={(e) => handleMoldeChange(e.target.value)}
          className={`w-full p-3 rounded-xl font-bold outline-none border-2 focus:border-[#5D286C] appearance-none disabled:opacity-60 ${
            semMolde ? "bg-white border-amber-300 text-amber-700" : "bg-gray-50 border-transparent"
          }`}
        >
          <option value="">Defina o molde...</option>
          {moldes.map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </select>
        {semMolde && (
          <p className="text-[11px] font-bold text-amber-700 mt-1 ml-1 flex items-center gap-1">
            <AlertTriangle size={12} /> Defina o molde que está nesta máquina
          </p>
        )}
        {machine.status !== "EM_OPERACAO" && machine.status_observacao && (
          <p className="text-[11px] font-bold text-gray-500 mt-1 ml-1 truncate" title={machine.status_observacao}>
            Obs.: {machine.status_observacao}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 lg:w-[22rem] shrink-0">
        {STATUS_BUTTONS.map(({ status, icon, active }) => (
          <button
            key={status}
            type="button"
            disabled={saving}
            onClick={() => handleStatusClick(status)}
            className={`flex items-center justify-center gap-1 px-2 py-2 rounded-xl border-2 text-[11px] font-black uppercase transition-all disabled:opacity-60 ${
              machine.status === status ? active : "bg-white text-gray-500 border-gray-100 hover:border-gray-300"
            }`}
          >
            {saving && machine.status !== status ? null : icon}
            {MACHINE_STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      {pendingStatus && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md p-6 rounded-[2rem] shadow-2xl space-y-4 relative">
            <button
              type="button"
              onClick={() => setPendingStatus(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"
            >
              <X size={22} />
            </button>
            <div>
              <h2 className="text-xl font-black text-[#262626]">
                {pendingStatus === "PARADA" ? "Máquina parada" : "Máquina em manutenção"}
              </h2>
              <p className="text-sm font-bold text-gray-400">{machine.nome}</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase ml-1">
                Observação {pendingStatus === "PARADA" ? "(obrigatória)" : "(opcional)"}
              </label>
              <textarea
                autoFocus
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                maxLength={500}
                placeholder={pendingStatus === "PARADA" ? "Ex: falta de material, troca de molde..." : "Ex: troca de resistência"}
                className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C] min-h-[110px]"
              />
            </div>
            <button
              type="button"
              disabled={saving || (pendingStatus === "PARADA" && !observacao.trim())}
              onClick={confirmStatus}
              className="w-full bg-[#5D286C] text-white p-4 rounded-2xl font-black hover:bg-[#7B1470] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : "CONFIRMAR"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
