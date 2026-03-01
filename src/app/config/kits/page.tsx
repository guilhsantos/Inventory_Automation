"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Package, Hammer, Save, Trash2, Edit2, X } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import ConfirmModal from "@/components/ConfirmModal";

export default function KitsConfigPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'kits' | 'moldes'>('kits');
  
  // Estados de Dados
  const [moldes, setMoldes] = useState<any[]>([]);
  const [kits, setKits] = useState<any[]>([]);

  // Estados de Molde
  const [nomeMolde, setNomeMolde] = useState("");
  const [editingMoldeId, setEditingMoldeId] = useState<number | null>(null);

  // Estados de Kit
  const [newKit, setNewKit] = useState({ code: '', name: '' });
  const [selectedMoldes, setSelectedMoldes] = useState<{id: number, qty: number}[]>([]);
  const [currentMoldeSelection, setCurrentMoldeSelection] = useState("");
  const [editingKitId, setEditingKitId] = useState<number | null>(null);

  // Estado do Modal de Confirmação
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    type: 'molde' | 'kit';
    id: number | null;
  }>({ isOpen: false, type: 'molde', id: null });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [mRes, kRes] = await Promise.all([
      supabase.from("moldes").select("*").order("nome"),
      supabase.from("kits").select("*, kit_items(molde_id, quantidade, moldes(nome))")
    ]);
    if (mRes.data) setMoldes(mRes.data);
    if (kRes.data) setKits(kRes.data);
  }

  // --- LÓGICA DE MOLDES ---
  const handleSaveMolde = async (e: React.FormEvent) => {
    e.preventDefault();
    if (moldes.some(m => m.nome.toLowerCase() === nomeMolde.toLowerCase() && m.id !== editingMoldeId)) {
      return showToast("Já existe um molde com este nome.", "error");
    }

    try {
      if (editingMoldeId) {
        const { error } = await supabase.from("moldes").update({ nome: nomeMolde }).eq("id", editingMoldeId);
        if (error) throw error;
        showToast("Molde atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("moldes").insert({ nome: nomeMolde, estoque_atual: 0 });
        if (error) throw error;
        showToast("Molde cadastrado com sucesso!");
      }
      setNomeMolde("");
      setEditingMoldeId(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // --- LÓGICA DE KITS ---
  const handleAddMoldeToKit = () => {
    if (!currentMoldeSelection) return;
    const id = parseInt(currentMoldeSelection);
    if (!selectedMoldes.find(m => m.id === id)) {
      setSelectedMoldes([...selectedMoldes, { id, qty: 1 }]);
    } else {
      showToast("Esta peça já foi adicionada ao kit.", "error");
    }
    setCurrentMoldeSelection("");
  };

  const handleSaveKit = async () => {
    if (!newKit.code || !newKit.name || selectedMoldes.length === 0) {
      return showToast("Preencha todos os campos.", "error");
    }

    const duplicate = kits.find(k => (k.codigo_unico === newKit.code || k.nome_kit === newKit.name) && k.id !== editingKitId);
    if (duplicate) return showToast("Código ou Nome já existe.", "error");

    try {
      let kitId = editingKitId;
      if (editingKitId) {
        await supabase.from("kits").update({ codigo_unico: newKit.code, nome_kit: newKit.name }).eq("id", editingKitId);
        await supabase.from("kit_items").delete().eq("kit_id", editingKitId);
      } else {
        const { data, error } = await supabase.from("kits").insert({ codigo_unico: newKit.code, nome_kit: newKit.name, estoque_atual: 0 }).select().single();
        if (error) throw error;
        kitId = data.id;
      }

      const items = selectedMoldes.map(m => ({ kit_id: kitId, molde_id: m.id, quantidade: m.qty }));
      await supabase.from("kit_items").insert(items);

      showToast(editingKitId ? "Kit atualizado!" : "Kit cadastrado!");
      cancelEditKit();
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const cancelEditKit = () => {
    setEditingKitId(null);
    setNewKit({ code: '', name: '' });
    setSelectedMoldes([]);
  };

  const executeDelete = async () => {
    if (!confirmDelete.id) return;
    const table = confirmDelete.type === 'molde' ? 'moldes' : 'kits';
    const { error } = await supabase.from(table).delete().eq("id", confirmDelete.id);

    if (error) showToast("Erro ao excluir: Item em uso.", "error");
    else {
      showToast("Excluído!");
      fetchData();
    }
    setConfirmDelete({ isOpen: false, type: 'molde', id: null });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-2 md:p-4">
      {/* Abas - Ajustadas para ocupar 100% no mobile */}
      <div className="flex bg-white p-1.5 rounded-2xl md:rounded-3xl border-2 border-gray-50 shadow-sm w-full md:w-fit">
        <button onClick={() => setActiveTab('kits')} className={`flex-1 md:flex-none px-4 md:px-8 py-2.5 rounded-xl md:rounded-2xl font-black text-xs md:text-sm transition-all ${activeTab === 'kits' ? 'bg-[#5D286C] text-white shadow-lg shadow-purple-100' : 'text-gray-400'}`}>KITS</button>
        <button onClick={() => setActiveTab('moldes')} className={`flex-1 md:flex-none px-4 md:px-8 py-2.5 rounded-xl md:rounded-2xl font-black text-xs md:text-sm transition-all ${activeTab === 'moldes' ? 'bg-[#5D286C] text-white shadow-lg shadow-purple-100' : 'text-gray-400'}`}>MOLDES (PEÇAS)</button>
      </div>

      {activeTab === 'moldes' ? (
        <div className="grid md:grid-cols-2 gap-6 md:gap-10 animate-in fade-in duration-500">
          <form onSubmit={handleSaveMolde} className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border-2 border-gray-50 shadow-sm space-y-5 h-fit">
            <div className="flex justify-between items-center">
              <h2 className="text-xl md:text-2xl font-black flex items-center gap-2">
                {editingMoldeId ? <><Edit2 className="text-blue-500" size={20} /> Editar</> : <><Plus className="text-[#5D286C]" size={20} /> Novo Molde</>}
              </h2>
              {editingMoldeId && <button type="button" onClick={() => {setEditingMoldeId(null); setNomeMolde("");}} className="text-gray-400"><X size={20}/></button>}
            </div>
            <input required value={nomeMolde} onChange={(e) => setNomeMolde(e.target.value)} className="w-full p-4 bg-gray-50 rounded-xl md:rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C]" placeholder="Nome da Peça" />
            <button type="submit" className={`w-full text-white p-4 md:p-5 rounded-2xl md:rounded-3xl font-black flex items-center justify-center gap-3 shadow-lg transition-all ${editingMoldeId ? 'bg-blue-600' : 'bg-[#5D286C]'}`}>
              <Save size={18} /> {editingMoldeId ? "ATUALIZAR" : "SALVAR MOLDE"}
            </button>
          </form>

          <div className="space-y-4">
            <h2 className="text-lg md:text-xl font-black flex items-center gap-2 px-2 text-[#262626]"><Hammer className="text-[#5D286C]" size={20} /> Moldes Ativos</h2>
            <div className="space-y-3">
              {moldes.map(m => (
                <div key={m.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm group">
                  <p className="font-black text-sm md:text-base text-[#262626]">{m.nome}</p>
                  <div className="flex gap-1 md:opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => { setEditingMoldeId(m.id); setNomeMolde(m.nome); }} className="p-2 text-blue-400 hover:bg-blue-50 rounded-xl transition-all"><Edit2 size={18} /></button>
                    <button onClick={() => setConfirmDelete({ isOpen: true, type: 'molde', id: m.id })} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 animate-in fade-in duration-500">
          <div className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border-2 border-gray-50 shadow-sm space-y-4 h-fit">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black flex items-center gap-2">
                {editingKitId ? <Edit2 className="text-blue-500" size={20}/> : <Plus className="text-[#5D286C]" size={20} />} 
                {editingKitId ? "Editar Kit" : "Montar Kit"}
              </h2>
              {editingKitId && <button onClick={cancelEditKit} className="text-gray-400"><X size={20}/></button>}
            </div>
            
            <input placeholder="Código (Ex: KIT-01)" value={newKit.code} onChange={e => setNewKit({...newKit, code: e.target.value})} className="w-full p-4 bg-gray-50 rounded-xl md:rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C]" />
            <input placeholder="Nome do Kit" value={newKit.name} onChange={e => setNewKit({...newKit, name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-xl md:rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C]" />
            
            <div className="border-t border-gray-50 pt-4 space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Composição do Kit</label>
              <div className="flex gap-2">
                <select value={currentMoldeSelection} onChange={e => setCurrentMoldeSelection(e.target.value)} className="flex-1 p-3.5 md:p-4 bg-gray-50 rounded-xl md:rounded-2xl font-bold outline-none text-xs md:text-sm border-2 border-transparent focus:border-[#5D286C] appearance-none">
                  <option value="">Selecione a Peça...</option>
                  {moldes.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
                <button onClick={handleAddMoldeToKit} className="bg-[#5D286C] text-white p-3.5 md:p-4 rounded-xl md:rounded-2xl shadow-lg hover:scale-105 transition-transform shrink-0"><Plus size={24}/></button>
              </div>

              <div className="space-y-2 mt-2">
                {selectedMoldes.map(sm => (
                  <div key={sm.id} className="flex items-center justify-between bg-purple-50 p-3 rounded-xl">
                    <span className="font-bold text-[11px] md:text-sm text-[#5D286C] truncate mr-2">{moldes.find(m => m.id === sm.id)?.nome}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <input type="number" min="1" value={sm.qty} onChange={e => {
                        const newItems = [...selectedMoldes];
                        newItems.find(i => i.id === sm.id)!.qty = parseInt(e.target.value) || 1;
                        setSelectedMoldes(newItems);
                      }} className="w-10 md:w-16 p-1.5 rounded-lg text-center font-bold text-xs" />
                      <button onClick={() => setSelectedMoldes(selectedMoldes.filter(i => i.id !== sm.id))} className="text-red-400 p-1"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleSaveKit} className={`w-full text-white p-4 md:p-5 rounded-2xl md:rounded-3xl font-black text-sm md:text-base shadow-lg transition-all ${editingKitId ? 'bg-blue-600' : 'bg-[#5D286C]'}`}>
              {editingKitId ? "ATUALIZAR KIT" : "SALVAR NOVO KIT"}
            </button>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg md:text-xl font-black flex items-center gap-2 px-2 text-[#262626]"><Package className="text-[#5D286C]" size={20}/> Kits Ativos</h2>
            <div className="space-y-3">
              {kits.map(k => (
                <div key={k.id} className="bg-white p-4 md:p-5 rounded-2xl md:rounded-[2rem] border border-gray-100 shadow-sm group">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <p className="font-black text-[#5D286C] text-xs md:text-sm tracking-tight">{k.codigo_unico}</p>
                        <p className="font-bold text-[#262626] text-sm md:text-base leading-tight mt-0.5">{k.nome_kit}</p>
                    </div>
                    <div className="flex gap-1 md:opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button onClick={() => { 
                            setEditingKitId(k.id); 
                            setNewKit({ code: k.codigo_unico, name: k.nome_kit });
                            setSelectedMoldes(k.kit_items.map((i:any) => ({ id: i.molde_id, qty: i.quantidade })));
                            setActiveTab('kits');
                        }} className="p-2 text-blue-400 hover:bg-blue-50 rounded-xl"><Edit2 size={16}/></button>
                        <button onClick={() => setConfirmDelete({ isOpen: true, type: 'kit', id: k.id })} className="p-2 text-red-400 hover:bg-red-50 rounded-xl"><Trash2 size={16}/></button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {k.kit_items?.map((i: any) => (
                      <span key={i.molde_id} className="text-[9px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md font-bold uppercase border border-gray-100">
                        {i.quantidade}x {i.moldes?.nome}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ ...confirmDelete, isOpen: false })}
        onConfirm={executeDelete}
        title="Confirmar Exclusão"
        message={confirmDelete.type === 'molde' ? "Isso pode afetar os kits que usam esta peça." : "Deseja excluir este kit permanentemente?"}
      />
    </div>
  );
}