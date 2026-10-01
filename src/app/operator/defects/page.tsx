"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { AlertTriangle, Save, ArrowLeft, Loader2, Hammer, X, Cpu, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/date-utils";

type LastMachine =
  | { state: "idle" | "loading" | "none" | "error" }
  | { state: "found"; nome: string; at: string };

export default function DefectsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  
  const [moldes, setMoldes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  // Máquina do defeito = última que produziu o molde (o banco aplica a mesma regra)
  const [lastMachine, setLastMachine] = useState<LastMachine>({ state: "idle" });

  const [formData, setFormData] = useState({
    molde_id: "",
    quantity: "",
    reason: "",
  });

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase.from("moldes").select("id, nome").order("nome");
      if (data) setMoldes(data);
      setLoading(false);
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!formData.molde_id) {
      setLastMachine({ state: "idle" });
      return;
    }
    let cancelled = false;
    setLastMachine({ state: "loading" });
    supabase
      .from("daily_production")
      .select("machine_id, created_at, machines(nome)")
      .eq("molde_id", parseInt(formData.molde_id))
      .not("machine_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLastMachine({ state: "error" });
        } else if (!data) {
          setLastMachine({ state: "none" });
        } else {
          const machine = data.machines as unknown as { nome: string } | null;
          setLastMachine({ state: "found", nome: machine?.nome ?? `Máquina #${data.machine_id}`, at: data.created_at });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [formData.molde_id]);

  const handleSaveDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.molde_id || !formData.quantity) {
      return showToast("Preencha a peça e a quantidade.", "error");
    }
    if (lastMachine.state !== "found") {
      return showToast("Este molde ainda não teve produção registrada.", "error");
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      // Registro do defeito + desconto da peça numa única transação no banco
      const { error: rpcError } = await supabase.rpc("register_defect", {
        p_molde_id: parseInt(formData.molde_id),
        p_machine_id: null, // definida no banco pela última produção do molde
        p_quantidade: parseInt(formData.quantity),
        p_motivo: formData.reason || null,
      });

      if (rpcError) {
        if (rpcError.message.startsWith("Estoque insuficiente")) {
          setValidationError(rpcError.message);
          return;
        }
        throw rpcError;
      }

      showToast("Defeito registrado com sucesso! Estoque atualizado.");
      router.push("/operator/production");
    } catch (err: any) {
      showToast("Erro ao salvar: " + err.message, "error");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCloseErrorModal = () => {
    setValidationError(null);
  };

  if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-[#5D286C]" size={40} /></div>;

  return (
    <div className="max-w-xl mx-auto space-y-8 p-4">
      <div className="flex items-center gap-4">
        <Link href="/operator/production" className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-[#5D286C] shadow-sm transition-all">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-3xl font-black text-[#262626] flex items-center gap-2">
          <AlertTriangle className="text-red-500" /> Registro de Defeitos
        </h1>
      </div>

      <form onSubmit={handleSaveDefect} className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-50 shadow-sm space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase ml-2 flex items-center gap-2"><Hammer size={14}/> Peça (Molde)</label>
          <select 
            required
            value={formData.molde_id}
            onChange={e => setFormData({...formData, molde_id: e.target.value})}
            className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C] appearance-none"
          >
            <option value="">Selecione a peça...</option>
            {moldes.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>

        {lastMachine.state !== "idle" && (
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
              <Cpu size={14} /> Máquina (última que produziu este molde)
            </label>
            {lastMachine.state === "loading" ? (
              <div className="w-full p-4 bg-gray-50 rounded-2xl flex items-center gap-2 text-gray-400 font-bold">
                <Loader2 className="animate-spin" size={16} /> Buscando máquina...
              </div>
            ) : lastMachine.state === "found" ? (
              <div className="w-full p-4 bg-purple-50 border-2 border-purple-100 rounded-2xl flex items-center gap-2">
                <Lock size={14} className="text-[#5D286C] shrink-0" />
                <span className="font-black text-[#5D286C] truncate">{lastMachine.nome}</span>
                <span className="ml-auto text-[10px] font-bold text-gray-400 uppercase shrink-0">
                  {formatDateTime(lastMachine.at)}
                </span>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl text-amber-800 text-sm font-bold flex items-start gap-2">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                {lastMachine.state === "none"
                  ? "Este molde ainda não teve produção registrada. Não é possível registrar defeito."
                  : "Não foi possível buscar a máquina. Tente novamente."}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase ml-2">Quantidade com Defeito</label>
          <input 
            required
            type="number"
            value={formData.quantity}
            onChange={e => setFormData({...formData, quantity: e.target.value})}
            className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C]" 
            placeholder="Ex: 5"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase ml-2">Observação (Motivo)</label>
          <textarea 
            value={formData.reason}
            onChange={e => setFormData({...formData, reason: e.target.value})}
            className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C] min-h-[120px]" 
            placeholder="Descreva o que houve com a peça..."
          />
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting || lastMachine.state !== "found"}
          className="w-full bg-red-500 text-white p-6 rounded-3xl font-black text-xl shadow-xl hover:bg-red-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : <><Save size={24} /> SALVAR DEFEITO</>}
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