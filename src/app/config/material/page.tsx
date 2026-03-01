"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, Database, Save, Calendar } from "lucide-react";
import { useToast } from "@/lib/toast-context";

export default function MaterialConfigPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  
  // Estados para Novo Material
  const [newMatName, setNewMatName] = useState("");
  
  // Estados para Entrada de Estoque
  const [selectedMatId, setSelectedMatId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchMaterials();
  }, []);

  async function fetchMaterials() {
    const { data } = await supabase.from("materials").select("*").order("nome");
    if (data) setMaterials(data);
    setLoading(false);
  }

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName) return;

    const { error } = await supabase.from("materials").insert({ nome: newMatName, estoque_kg: 0 });
    if (!error) {
      showToast("Material cadastrado com sucesso!");
      setNewMatName("");
      fetchMaterials();
    } else {
      showToast("Erro ao cadastrar material", "error");
    }
  };

  const handleSaveEntry = async () => {
    if (!selectedMatId || !addQty || !arrivalDate) return;
    
    const qtyNum = parseFloat(addQty);
    const material = materials.find(m => m.id === parseInt(selectedMatId));

    try {
      const { error: updateError } = await supabase
        .from("materials")
        .update({ estoque_kg: (material?.estoque_kg || 0) + qtyNum })
        .eq("id", selectedMatId);

      if (updateError) throw updateError;

      await supabase.from("material_entries").insert({
        material_id: selectedMatId,
        quantidade_kg: qtyNum,
        data_chegada: arrivalDate
      });

      showToast("Entrada de estoque salva!");
      setAddQty("");
      fetchMaterials();
    } catch (err: any) {
      showToast("Erro ao salvar entrada: " + err.message, "error");
    }
  };

  if (loading) return <Loader2 className="animate-spin mx-auto mt-20" />;

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-2 md:p-4">
      <h1 className="text-3xl font-black text-[#262626]">Gestão de Matéria-Prima</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={handleCreateMaterial} className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border-2 border-gray-50 shadow-sm space-y-4 h-fit">
          <h2 className="text-xl font-black flex items-center gap-2 text-[#5D286C]"><Database size={20}/> Novo Tipo</h2>
          <input 
            required 
            value={newMatName} 
            onChange={e => setNewMatName(e.target.value)}
            className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C]" 
            placeholder="Ex: PP Azul Royal"
          />
          <button type="submit" className="w-full bg-[#5D286C] text-white p-4 rounded-2xl font-black shadow-lg">CADASTRAR</button>
        </form>

        <div className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border-2 border-gray-50 shadow-sm space-y-4">
          <h2 className="text-xl font-black flex items-center gap-2 text-[#5D286C]"><Plus size={20}/> Registrar Entrada</h2>
          <select 
            value={selectedMatId} 
            onChange={e => setSelectedMatId(e.target.value)}
            className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C] appearance-none"
          >
            <option value="">Selecione o material...</option>
            {materials.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={addQty} onChange={e => setAddQty(e.target.value)} className="p-4 bg-gray-50 rounded-2xl font-bold outline-none" placeholder="KG" />
            <input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} className="p-4 bg-gray-50 rounded-2xl font-bold outline-none" />
          </div>
          <button onClick={handleSaveEntry} className="w-full bg-[#262626] text-white p-4 rounded-2xl font-black shadow-lg">SALVAR ENTRADA</button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-black px-2">Estoques Atuais</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map(m => (
            <div key={m.id} className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm">
              <p className="font-black text-[#262626]">{m.nome}</p>
              <p className="text-2xl font-black text-[#5D286C] mt-2">{m.estoque_kg.toFixed(2)} <span className="text-sm">KG</span></p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}