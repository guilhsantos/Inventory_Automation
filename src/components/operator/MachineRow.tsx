"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Lock, Pause, Play, Wrench, X } from "lucide-react";
import {
  MACHINE_STATUS_BADGE,
  MACHINE_STATUS_LABEL,
  MachineState,
  MachineStatus,
  setMachineState,
} from "@/lib/machines";
import { useToast } from "@/lib/toast-context";
import MachineIllustration from "@/components/MachineIllustration";

interface MachineRowProps {
  machine: MachineState;
  moldes: { id: number; nome: string }[];
  onUpdated: () => void;
}

const STATUS_BUTTONS: { status: MachineStatus; icon: React.ReactNode; label: string; active: string }[] = [
  { status: "EM_OPERACAO", icon: <Play size={16} />, label: "Operação", active: "bg-green-600 text-white border-green-600" },
  { status: "PARADA", icon: <Pause size={16} />, label: "Parada", active: "bg-red-600 text-white border-red-600" },
  { status: "MANUTENCAO", icon: <Wrench size={16} />, label: "Manutenção", active: "bg-amber-500 text-white border-amber-500" },
];

export default function MachineRow({ machine, moldes, onUpdated }: MachineRowProps) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  // Modal aberto ao trocar de status: PARADA/MANUTENCAO pedem observação,
  // EM_OPERACAO (vindo de parada/manutenção) pede o molde
  const [pendingStatus, setPendingStatus] = useState<MachineStatus | null>(null);
  const [observacao, setObservacao] = useState("");
  const [moldeRetorno, setMoldeRetorno] = useState("");

  const emOperacao = machine.status === "EM_OPERACAO";
  const semMolde = machine.current_molde_id === null;
  const emAndamento = emOperacao && !semMolde;

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
    if (!value) return;
    void save("EM_OPERACAO", parseInt(value), null);
  }

  function handleStatusClick(status: MachineStatus) {
    if (status === machine.status || saving) return;
    setObservacao("");
    setMoldeRetorno(machine.current_molde_id ? String(machine.current_molde_id) : "");
    setPendingStatus(status);
  }

  async function confirmStatus() {
    if (!pendingStatus) return;
    let ok: boolean;
    if (pendingStatus === "EM_OPERACAO") {
      if (!moldeRetorno) {
        showToast("Selecione o molde que está na máquina.", "error");
        return;
      }
      ok = await save("EM_OPERACAO", parseInt(moldeRetorno), null);
    } else {
      if (pendingStatus === "PARADA" && !observacao.trim()) {
        showToast("Informe o motivo da máquina parada.", "error");
        return;
      }
      // Parada libera o molde; manutenção mantém o molde que está na máquina
      const molde = pendingStatus === "PARADA" ? null : machine.current_molde_id;
      ok = await save(pendingStatus, molde, observacao.trim() || null);
    }
    if (ok) setPendingStatus(null);
  }

  const confirmDisabled =
    saving ||
    (pendingStatus === "PARADA" && !observacao.trim()) ||
    (pendingStatus === "EM_OPERACAO" && !moldeRetorno);

  return (
    <div
      className={`bg-white rounded-3xl border-2 p-3 sm:p-4 space-y-2 sm:space-y-3 transition-colors ${
        emOperacao && semMolde ? "border-amber-300" : "border-gray-100"
      }`}
    >
      {/* Cabeçalho: desenho + nome + status */}
      <div className="flex items-center gap-3">
        <MachineIllustration status={machine.status} running={emAndamento} className="w-11 sm:w-16 h-auto shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-black sm:text-lg text-[#262626] truncate">{machine.nome}</p>
          <span className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${MACHINE_STATUS_BADGE[machine.status]}`}>
            {MACHINE_STATUS_LABEL[machine.status]}
          </span>
        </div>
        {saving && <Loader2 className="animate-spin text-[#5D286C] shrink-0" size={20} />}
      </div>

      {/* Molde: só pode ser trocado com a máquina em operação */}
      <div>
        <label className="text-[10px] font-black text-gray-400 uppercase ml-1" htmlFor={`molde-${machine.id}`}>
          Molde na máquina
        </label>
        {emOperacao ? (
          <>
            <select
              id={`molde-${machine.id}`}
              value={machine.current_molde_id ?? ""}
              disabled={saving}
              onChange={(e) => handleMoldeChange(e.target.value)}
              className={`w-full h-11 sm:h-12 px-3 rounded-2xl text-base font-bold outline-none border-2 focus:border-[#5D286C] disabled:opacity-60 ${
                semMolde ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-gray-50 border-transparent"
              }`}
            >
              <option value="" disabled>
                Defina o molde...
              </option>
              {moldes.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
            {semMolde && (
              <p className="text-xs font-bold text-amber-700 mt-1 ml-1 flex items-center gap-1">
                <AlertTriangle size={12} /> Defina o molde para liberar o lançamento de produção
              </p>
            )}
          </>
        ) : (
          <div className="w-full min-h-11 sm:min-h-12 px-3 py-2 rounded-2xl bg-gray-100 text-gray-500 font-bold flex items-center gap-2">
            <Lock size={14} className="shrink-0" />
            <span className="truncate">{machine.moldes?.nome ?? "Sem molde"}</span>
          </div>
        )}
        {!emOperacao && machine.status_observacao && (
          <p className="text-xs font-bold text-gray-500 mt-1 ml-1 break-words">Obs.: {machine.status_observacao}</p>
        )}
      </div>

      {/* Status: botões grandes para toque */}
      <div className="grid grid-cols-3 gap-2">
        {STATUS_BUTTONS.map(({ status, icon, label, active }) => (
          <button
            key={status}
            type="button"
            disabled={saving}
            onClick={() => handleStatusClick(status)}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-12 sm:min-h-14 px-1 rounded-2xl border-2 text-[11px] font-black uppercase transition-all active:scale-95 disabled:opacity-60 ${
              machine.status === status ? active : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {pendingStatus && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full sm:max-w-md p-6 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl space-y-4 relative">
            <button
              type="button"
              onClick={() => setPendingStatus(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"
              aria-label="Fechar"
            >
              <X size={22} />
            </button>
            <div>
              <h2 className="text-xl font-black text-[#262626]">
                {pendingStatus === "EM_OPERACAO"
                  ? "Voltar para operação"
                  : pendingStatus === "PARADA"
                    ? "Máquina parada"
                    : "Máquina em manutenção"}
              </h2>
              <p className="text-sm font-bold text-gray-400">{machine.nome}</p>
            </div>

            {pendingStatus === "EM_OPERACAO" ? (
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase ml-1" htmlFor={`molde-retorno-${machine.id}`}>
                  Qual molde está na máquina?
                </label>
                <select
                  id={`molde-retorno-${machine.id}`}
                  autoFocus
                  value={moldeRetorno}
                  onChange={(e) => setMoldeRetorno(e.target.value)}
                  className="w-full h-12 px-3 bg-gray-50 rounded-2xl text-base font-bold outline-none border-2 border-transparent focus:border-[#5D286C]"
                >
                  <option value="" disabled>
                    Selecione o molde...
                  </option>
                  {moldes.map((m) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>
            ) : (
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
                  className="w-full p-4 bg-gray-50 rounded-2xl text-base font-bold outline-none border-2 border-transparent focus:border-[#5D286C] min-h-[110px]"
                />
              </div>
            )}

            <button
              type="button"
              disabled={confirmDisabled}
              onClick={confirmStatus}
              className="w-full bg-[#5D286C] text-white h-14 rounded-2xl font-black hover:bg-[#7B1470] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : "CONFIRMAR"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
