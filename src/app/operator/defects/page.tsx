"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { AlertTriangle, Save, ArrowLeft, Loader2, Hammer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DefectsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  
  const [moldes, setMoldes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    molde_id: "",
    quantity: "",
    reason: ""
  });

  useEffect(() => {
    async function fetchMoldes() {
      const { data } = await supabase.from("moldes").select("id, nome").order("nome");
      if (data) setMoldes(data);
      setLoading(false);
    }
    fetchMoldes();
  }, []);

  const handleSaveDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.molde_id || !formData.quantity) {
      return showToast("Preencha a peça e a quantidade.", "error");
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("defects").insert({
        molde_id: formData.molde_id,
        user_id: user?.id,
        quantity: parseInt(formData.quantity),
        reason: formData.reason
      });

      if (error) throw error;

      showToast("Defeito registrado com sucesso!");
      router.push("/operator/production");
    } catch (err: any) {
      showToast("Erro ao salvar: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
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
    </div>
  );
}