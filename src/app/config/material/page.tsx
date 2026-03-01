"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, Box, Save, Calendar } from "lucide-react";
import { useToast } from "@/lib/toast-context";


export default function MaterialConfigPage() {
  const [loading, setLoading] = useState(true);
  const [material, setMaterial] = useState<{id: number, nome: string, estoque_kg: number} | null>(null);
  const [addQty, setAddQty] = useState("");
  const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().split('T')[0]);
  const { showToast } = useToast();

  useEffect(() => {
    fetchMaterial();
  }, []);

  async function fetchMaterial() {
    const { data } = await supabase.from("materials").select("*").limit(1).single();
    if (data) setMaterial(data);
    setLoading(false);
  }

  const handleSaveEntry = async () => {
    if (!material || !addQty || !arrivalDate) return;
    
    const qtyNum = parseFloat(addQty);

    try {
      const { error: updateError } = await supabase
        .from("materials")
        .update({ estoque_kg: material.estoque_kg + qtyNum })
        .eq("id", material.id);

      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from("material_entries")
        .insert({
          material_id: material.id,
          quantidade_kg: qtyNum,
          data_chegada: arrivalDate
        });

      if (logError) throw logError;

      showToast("Entrada de material salva!");
      setAddQty("");
      fetchMaterial();
    } catch (err: any) {
      showToast("Erro: " + err.message);
    }
  };

  if (loading) return <Loader2 className="animate-spin mx-auto mt-20" />;

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-4">
      <h1 className="text-3xl font-black text-[#262626]">Gestão de Material</h1>
      
      <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-50 shadow-sm flex justify-between items-center">
        <div>
          <p className="text-xs font-black text-gray-400 uppercase">Material em Estoque</p>
          <h2 className="text-4xl font-black text-[#5D286C]">{material?.estoque_kg.toFixed(2)} KG</h2>
          <p className="text-sm text-gray-400 font-bold">{material?.nome}</p>
        </div>
        <Box size={60} className="text-gray-100" />
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-50 shadow-sm space-y-6">
        <h2 className="text-xl font-black flex items-center gap-2"><Plus className="text-[#5D286C]" /> Nova Entrada</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Quantidade (KG)</label>
            <input type="number" value={addQty} onChange={(e) => setAddQty(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" placeholder="Ex: 50.00" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Data de Chegada</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
              <input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} className="w-full p-4 pl-12 bg-gray-50 rounded-2xl font-bold outline-none" />
            </div>
          </div>
        </div>
        <button onClick={handleSaveEntry} className="w-full bg-[#5D286C] text-white p-5 rounded-3xl font-black shadow-lg hover:bg-[#7B1470] transition-all">SALVAR ENTRADA</button>
      </div>
    </div>
  );
}