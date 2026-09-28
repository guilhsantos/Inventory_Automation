"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Hammer, Box, Save, ArrowLeft, Cpu, AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast-context";
import { clearClientStorageAndGoLogin } from "@/lib/session-recovery";
import { fetchMachineStates, MACHINE_STATUS_LABEL, MachineState } from "@/lib/machines";

interface Material {
  id: number;
  nome: string;
  estoque_kg: number;
}

export default function ManualProductionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [machines, setMachines] = useState<MachineState[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [issubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { showToast } = useToast();

  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [bagsUsed, setBagsUsed] = useState<string>("");
  const [observacao, setObservacao] = useState<string>("");

  const submittingRef = useRef(false);
  // Identifica este lançamento: reenvios/duplo clique não contam a produção duas vezes
  const requestIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    const loadTimeoutMs = 15000;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        void supabase.auth.signOut();
        clearClientStorageAndGoLogin();
      }
    }, loadTimeoutMs);

    async function fetchData() {
      try {
        const [machinesRes, materialsRes] = await Promise.all([
          fetchMachineStates().then(
            (data) => ({ data, error: null }),
            (error) => ({ data: null, error })
          ),
          supabase.from("materials").select("id, nome, estoque_kg").order("nome"),
        ]);

        if (cancelled) return;

        const failed = !!machinesRes.error && !!materialsRes.error;
        if (failed) {
          void supabase.auth.signOut();
          clearClientStorageAndGoLogin();
          return;
        }

        if (machinesRes.data) setMachines(machinesRes.data);
        if (materialsRes.data) setMaterials(materialsRes.data);
      } catch {
        if (!cancelled) {
          void supabase.auth.signOut();
          clearClientStorageAndGoLogin();
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    }

    void fetchData();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  // O molde é sempre o definido na máquina (tela de Operação), sem opção de troca aqui
  const machine = machines.find((m) => String(m.id) === selectedMachine) ?? null;
  const machineBlockReason = !machine
    ? null
    : machine.status !== "EM_OPERACAO"
      ? `Esta máquina está ${MACHINE_STATUS_LABEL[machine.status].toLowerCase()} e não pode receber produção.`
      : machine.current_molde_id === null
        ? "Defina o molde desta máquina na tela de Operação antes de lançar a produção."
        : null;

  const handleProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine || !quantity || !selectedMaterial || !user) {
      showToast("Preencha todos os campos obrigatórios.", "error");
      return;
    }
    if (machineBlockReason || machine.current_molde_id === null) {
      showToast(machineBlockReason ?? "Máquina sem molde definido.", "error");
      return;
    }

    const qtyInt = parseInt(quantity);
    if (!Number.isFinite(qtyInt) || qtyInt <= 0) {
      showToast("A quantidade produzida deve ser maior que zero.", "error");
      return;
    }
    // Trava síncrona: o estado do React só desabilita o botão no próximo render
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      // Peça + material + registro numa única transação no banco (tudo ou nada)
      const { error: rpcError } = await supabase.rpc("register_production", {
        p_machine_id: machine.id,
        p_molde_id: machine.current_molde_id,
        p_material_id: parseInt(selectedMaterial),
        p_quantidade: qtyInt,
        p_sacos: parseInt(bagsUsed || "0"),
        p_observacao: observacao.trim() || null,
        p_request_id: requestIdRef.current,
      });

      if (rpcError) {
        if (rpcError.message.startsWith("Material insuficiente")) {
          setValidationError(rpcError.message);
          return;
        }
        throw rpcError;
      }

      showToast("Produção registrada com sucesso!");
      router.push("/operator/production");
    } catch (err: any) {
      showToast(`Erro ao registrar: ${err.message}`, "error");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCloseErrorModal = () => {
    setValidationError(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-[#5D286C]" size={40} />
        <p className="mt-4 text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Dados...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8 p-4">
      <div className="flex items-center gap-4">
        <Link href="/operator/production" className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-[#5D286C] transition-all shadow-sm">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-[#262626]">Registrar Produção</h1>
          <p className="text-gray-400 font-bold text-xs uppercase">Peças Avulsas / Injeção</p>
        </div>
      </div>

      <form onSubmit={handleProduction} className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-50 shadow-sm space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase ml-2">Máquina utilizada</label>
          <div className="relative">
            <Cpu className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
            <select
              required
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="w-full p-4 pl-12 bg-gray-50 border-2 border-transparent focus:border-[#5D286C] focus:bg-white rounded-2xl font-bold outline-none transition-all appearance-none"
            >
              <option value="">Selecione a máquina...</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {machine && (
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase ml-2">Molde (Peça) na máquina</label>
            {machineBlockReason ? (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl text-amber-800 text-sm font-bold space-y-2">
                <p className="flex items-start gap-2">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" /> {machineBlockReason}
                </p>
                <Link href="/operator/production" className="inline-block underline">
                  Ir para a tela de Operação
                </Link>
              </div>
            ) : (
              <div className="w-full p-4 bg-purple-50 border-2 border-purple-100 rounded-2xl font-black text-[#5D286C]">
                {machine.moldes?.nome}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase ml-2">Material utilizado</label>
          <div className="relative">
            <Box className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
            <select
              required
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="w-full p-4 pl-12 bg-gray-50 border-2 border-transparent focus:border-[#5D286C] focus:bg-white rounded-2xl font-bold outline-none transition-all appearance-none"
            >
              <option value="">Selecione o material...</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} - {m.estoque_kg || 0} kg disponível
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase ml-2">Quantidade Produzida (un)</label>
          <div className="relative">
            <Hammer className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
            <input
              type="number"
              required
              placeholder="Ex: 500"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full p-4 pl-12 bg-gray-50 border-2 border-transparent focus:border-[#5D286C] focus:bg-white rounded-2xl font-bold outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase ml-2">Sacos de 25kg Usados</label>
          <div className="relative">
            <Box className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
            <input
              type="number"
              required
              placeholder="Ex: 2"
              value={bagsUsed}
              onChange={(e) => setBagsUsed(e.target.value)}
              className="w-full p-4 pl-12 bg-gray-50 border-2 border-transparent focus:border-[#5D286C] focus:bg-white rounded-2xl font-bold outline-none transition-all"
            />
          </div>
          {selectedMaterial && bagsUsed && (
            <p className="text-xs text-gray-500 ml-2">
              Total necessário: {parseInt(bagsUsed || "0") * 25} kg
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase ml-2">Observação (opcional)</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            maxLength={500}
            placeholder="Ex: troca de material no meio do lote"
            className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-[#5D286C] focus:bg-white rounded-2xl font-bold outline-none transition-all min-h-[100px]"
          />
        </div>

        <button
          type="submit"
          disabled={issubmitting || !!machineBlockReason}
          className="w-full bg-[#5D286C] text-white p-6 rounded-3xl font-black text-xl shadow-xl hover:bg-[#7B1470] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {issubmitting ? <Loader2 className="animate-spin" /> : <><Save size={24} /> SALVAR PRODUÇÃO</>}
        </button>
      </form>

      {/* Modal de Erro de Validação */}
      {validationError && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={handleCloseErrorModal}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <div className="text-center space-y-6">
              <AlertTriangle size={60} className="mx-auto text-red-500" />
              <div>
                <h2 className="text-2xl font-black text-[#262626] mb-4">Erro de Validação</h2>
                <div className="bg-red-50 p-4 rounded-2xl text-left">
                  <p className="text-sm font-bold text-red-600 whitespace-pre-line">
                    {validationError}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseErrorModal}
                className="w-full bg-red-600 text-white p-4 rounded-2xl font-black hover:bg-red-700 transition-all"
              >
                FECHAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}