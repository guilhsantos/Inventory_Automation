"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { AlertTriangle, Save, ArrowLeft, Loader2, Hammer, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DefectsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  
  const [moldes, setMoldes] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    molde_id: "",
    quantity: "",
    reason: "",
    machine_id: ""
  });

  useEffect(() => {
    async function fetchData() {
      const [moldesRes, machinesRes] = await Promise.all([
        supabase.from("moldes").select("id, nome").order("nome"),
        supabase.from("machines").select("id, nome").order("nome")
      ]);
      if (moldesRes.data) setMoldes(moldesRes.data);
      if (machinesRes.data) setMachines(machinesRes.data);
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleSaveDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.molde_id || !formData.quantity || !formData.machine_id) {
      return showToast("Preencha a peça, quantidade e máquina.", "error");
    }

    setIsSubmitting(true);
    try {
      const quantity = parseInt(formData.quantity);

      // 1. Buscar estoque atual do molde
      const { data: molde, error: moldeError } = await supabase
        .from("moldes")
        .select("id, nome, estoque_atual")
        .eq("id", formData.molde_id)
        .single();

      if (moldeError) throw moldeError;
      if (!molde) throw new Error("Peça não encontrada");

      // 2. Verificar se estoque >= quantity
      const availableStock = molde.estoque_atual || 0;
      if (availableStock < quantity) {
        const missing = quantity - availableStock;
        const errorMsg = `Estoque insuficiente.\n\n${molde.nome}\nFaltam: ${missing} unidade(s)`;
        setValidationError(errorMsg);
        setIsSubmitting(false);
        return;
      }

      // 3. Se tiver estoque, salvar defeito e decrementar estoque do molde
      const { error: defectError } = await supabase.from("defects").insert({
        molde_id: formData.molde_id,
        user_id: user?.id,
        quantity: quantity,
        reason: formData.reason,
        machine_id: parseInt(formData.machine_id)
      });

      if (defectError) throw defectError;

      // Descontar do estoque do molde
      const newStock = availableStock - quantity;
      const { error: updateError } = await supabase
        .from("moldes")
        .update({ estoque_atual: newStock })
        .eq("id", formData.molde_id);

      if (updateError) throw updateError;

      showToast("Defeito registrado com sucesso! Estoque atualizado.");
      router.push("/operator/production");
    } catch (err: any) {
      showToast("Erro ao salvar: " + err.message, "error");
    } finally {
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

        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
            Máquina (Obrigatório)
          </label>
          <select 
            required
            value={formData.machine_id}
            onChange={e => setFormData({...formData, machine_id: e.target.value})}
            className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C] appearance-none"
          >
            <option value="">Selecione a máquina...</option>
            {machines.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>

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
          disabled={isSubmitting}
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