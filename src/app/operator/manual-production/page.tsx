"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Hammer, Box, Save, ArrowLeft, Cpu } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast-context";

interface Molde {
  id: number;
  nome: string;
}

interface Machine {
  id: number;
  nome: string;
}

export default function ManualProductionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [moldes, setMoldes] = useState<Molde[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [issubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const [selectedMolde, setSelectedMolde] = useState<string>("");
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [bagsUsed, setBagsUsed] = useState<string>("");

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

  const handleProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMolde || !selectedMachine || !quantity || !user) return;

    setIsSubmitting(true);
    const qtyInt = parseInt(quantity);
    const bagsInt = parseInt(bagsUsed || "0");
    const materialConsumed = bagsInt * 25;

    try {
      await supabase.rpc('increment_molde_stock', {
        row_id: parseInt(selectedMolde),
        amount: qtyInt
      });

      await supabase.rpc('decrement_material_stock', {
        amount_kg: materialConsumed
      });

      const { error: logError } = await supabase.from("daily_production").insert({
        molde_id: parseInt(selectedMolde),
        machine_id: parseInt(selectedMachine),
        usuario_id: user.id,
        quantidade_boa: qtyInt,
        sacos_usados: bagsInt
      });

      if (logError) throw logError;

      showToast("Produção registrada com sucesso!");
      router.push("/operator/production");
    } catch (err: any) {
      showToast(`Erro ao registrar: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
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

        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase ml-2">Molde (Peça)</label>
          <select
            required
            value={selectedMolde}
            onChange={(e) => setSelectedMolde(e.target.value)}
            className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-[#5D286C] focus:bg-white rounded-2xl font-bold outline-none transition-all appearance-none"
          >
            <option value="">Escolha uma peça...</option>
            {moldes.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
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
              placeholder="Ex: 2"
              value={bagsUsed}
              onChange={(e) => setBagsUsed(e.target.value)}
              className="w-full p-4 pl-12 bg-gray-50 border-2 border-transparent focus:border-[#5D286C] focus:bg-white rounded-2xl font-bold outline-none transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={issubmitting}
          className="w-full bg-[#5D286C] text-white p-6 rounded-3xl font-black text-xl shadow-xl hover:bg-[#7B1470] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {issubmitting ? <Loader2 className="animate-spin" /> : <><Save size={24} /> SALVAR PRODUÇÃO</>}
        </button>
      </form>
    </div>
  );
}