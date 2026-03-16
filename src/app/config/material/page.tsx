"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, Database, Save, Calendar, Package } from "lucide-react";
import { useToast } from "@/lib/toast-context";

export default function MaterialConfigPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'entry' | 'types'>('entry');
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  
  // Estados para Novo Material
  const [newMatName, setNewMatName] = useState("");
  
  // Estados para Entrada de Estoque
  const [selectedMatId, setSelectedMatId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatId || !addQty || !arrivalDate) return;
    
    setIsSubmitting(true);
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
      setSelectedMatId("");
      setAddQty("");
      setArrivalDate(new Date().toISOString().split('T')[0]);
      fetchMaterials();
    } catch (err: any) {
      showToast("Erro ao salvar entrada: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <Loader2 className="animate-spin mx-auto mt-20" size={40} />;

  return (
    <div className="max-w-4xl mx-auto space-y-10 p-4 overflow-x-hidden">
      <h1 className="text-3xl font-black text-[#262626]">Gestão de Matéria-Prima</h1>
      
      {/* Abas */}
      <div className="inline-flex gap-2 rounded-2xl bg-gray-100 p-1 text-xs font-black uppercase">
        <button
          onClick={() => setActiveTab('entry')}
          className={`px-3 py-2 rounded-2xl transition-all ${
            activeTab === 'entry'
              ? "bg-white text-[#5D286C] shadow-sm"
              : "text-gray-400"
          }`}
        >
          REGISTRAR ENTRADA
        </button>
        <button
          onClick={() => setActiveTab('types')}
          className={`px-3 py-2 rounded-2xl transition-all ${
            activeTab === 'types'
              ? "bg-white text-[#5D286C] shadow-sm"
              : "text-gray-400"
          }`}
        >
          TIPOS DE MATERIAL
        </button>
      </div>

      {activeTab === 'entry' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 animate-in fade-in duration-500 w-full">
          {/* Formulário de Entrada */}
          <form onSubmit={handleSaveEntry} className="bg-white p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border-2 border-gray-50 shadow-sm space-y-6 h-fit overflow-hidden w-full">
            <h2 className="text-xl md:text-2xl font-black flex items-center gap-3"><Plus className="text-[#5D286C]" /> Entrada de Material</h2>
            
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase ml-2">Material</label>
              <select 
                required
                value={selectedMatId} 
                onChange={e => setSelectedMatId(e.target.value)}
                className="w-full p-3 md:p-4 bg-gray-50 rounded-xl md:rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C] appearance-none text-sm md:text-base box-border"
              >
                <option value="">Selecione o material...</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <div className="space-y-2 min-w-0 w-full">
                <label className="text-xs font-black text-gray-400 uppercase ml-2">Quantidade (KG)</label>
                <input 
                  required
                  type="number" 
                  step="0.01"
                  value={addQty} 
                  onChange={e => setAddQty(e.target.value)} 
                  className="w-full p-3 md:p-4 bg-gray-50 rounded-xl md:rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C] text-sm md:text-base box-border" 
                  placeholder="0.00" 
                />
              </div>
              <div className="space-y-2 min-w-0 w-full overflow-hidden">
                <label className="text-xs font-black text-gray-400 uppercase ml-2">Data de Chegada</label>
                <input 
                  required
                  type="date" 
                  value={arrivalDate} 
                  onChange={e => setArrivalDate(e.target.value)} 
                  className="w-full p-3 md:p-4 bg-gray-50 rounded-xl md:rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C] text-sm md:text-base box-border max-w-full" 
                  style={{ width: '100%', maxWidth: '100%' }}
                />
              </div>
            </div>

            <button 
              disabled={isSubmitting} 
              type="submit" 
              className="w-full bg-[#5D286C] text-white p-5 rounded-3xl font-black flex items-center justify-center gap-3 shadow-lg"
            >
              {isSubmitting ? <Loader2 className="animate-spin"/> : <><Save size={20} /> SALVAR ENTRADA</>}
            </button>
          </form>

          {/* Listagem de Estoque */}
          <div className="space-y-4">
            <h2 className="text-2xl font-black flex items-center gap-3"><Package className="text-[#5D286C]" /> Estoque</h2>
            <div className="space-y-3">
              {materials.map(m => (
                <div key={m.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                  <p className="font-black text-[#262626]">{m.nome}</p>
                  <p className="text-2xl font-black text-[#5D286C] mt-2">
                    {parseFloat(m.estoque_kg || 0).toFixed(2)} <span className="text-sm font-bold">KG</span>
                  </p>
                </div>
              ))}
              {materials.length === 0 && (
                <p className="text-gray-400 font-bold text-center py-10">Nenhum material cadastrado.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 animate-in fade-in duration-500">
          <form onSubmit={handleCreateMaterial} className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-50 shadow-sm space-y-6 h-fit">
            <h2 className="text-2xl font-black flex items-center gap-3"><Database className="text-[#5D286C]" /> Novo Tipo</h2>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase ml-2">Nome do Material</label>
              <input 
                required 
                value={newMatName} 
                onChange={e => setNewMatName(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C]" 
                placeholder="Ex: PP Azul Royal"
              />
            </div>
            <button type="submit" className="w-full bg-[#5D286C] text-white p-5 rounded-3xl font-black flex items-center justify-center gap-3 shadow-lg">
              <Save size={20} /> CADASTRAR
            </button>
          </form>

          <div className="space-y-4">
            <h2 className="text-2xl font-black flex items-center gap-3"><Database className="text-[#5D286C]" /> Tipos Cadastrados</h2>
            <div className="space-y-3">
              {materials.map(m => (
                <div key={m.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="font-black text-[#262626]">{m.nome}</p>
                  <p className="text-sm font-bold text-gray-400 mt-1">{parseFloat(m.estoque_kg || 0).toFixed(2)} KG em estoque</p>
                </div>
              ))}
              {materials.length === 0 && (
                <p className="text-center text-gray-400 font-bold py-10">Nenhum tipo de material cadastrado.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}