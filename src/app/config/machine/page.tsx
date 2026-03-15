"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Cpu, Save, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/lib/toast-context";

export default function MachineConfigPage() {
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchMachines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchMachines() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("machines").select("*").order("nome");
      if (error) {
        console.error("Erro ao carregar máquinas:", error);
        showToast("Erro ao carregar máquinas: " + error.message, "error");
        setMachines([]);
      } else {
        setMachines(data || []);
      }
    } catch (err: any) {
      console.error("Erro inesperado:", err);
      setMachines([]);
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    
    setIsSubmitting(true);
    const { error } = await supabase.from("machines").insert({ nome: newName, status: "Ativa" });
    
    if (!error) {
      setNewName("");
      fetchMachines();
    } else {
      showToast(error.message);
    }
    setIsSubmitting(false);
  };

  const handleStartEdit = (machine: any) => {
    setEditingId(machine.id);
    setEditingName(machine.nome);
  };

  const handleSaveEdit = async (machineId: number) => {
    if (!editingName) return;
    const { error } = await supabase
      .from("machines")
      .update({ nome: editingName })
      .eq("id", machineId);

    if (error) {
      showToast("Erro ao atualizar máquina");
    } else {
      setEditingId(null);
      setEditingName("");
      fetchMachines();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir esta máquina?")) return;
    const { error } = await supabase.from("machines").delete().eq("id", id);
    if (error) showToast("Erro: Esta máquina pode estar vinculada a registros de produção.");
    else fetchMachines();
  };

  if (loading) return <Loader2 className="animate-spin mx-auto mt-20" size={40} />;

  return (
    <div className="max-w-4xl mx-auto space-y-10 p-4">
      <h1 className="text-3xl font-black text-[#262626]">Configuração de Máquinas</h1>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Formulário */}
        <form onSubmit={handleCreate} className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-50 shadow-sm space-y-6 h-fit">
          <h2 className="text-2xl font-black flex items-center gap-3"><Plus className="text-[#5D286C]" /> Nova Máquina</h2>
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase ml-2">Identificação / Nome</label>
            <input 
              required 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C]" 
              placeholder="Ex: Injetora 01 - 120T" 
            />
          </div>
          <button disabled={isSubmitting} type="submit" className="w-full bg-[#5D286C] text-white p-5 rounded-3xl font-black flex items-center justify-center gap-3 shadow-lg">
            {isSubmitting ? <Loader2 className="animate-spin"/> : <><Save size={20} /> CADASTRAR MÁQUINA</>}
          </button>
        </form>

        {/* Listagem */}
        <div className="space-y-4">
          <h2 className="text-2xl font-black flex items-center gap-3"><Cpu className="text-[#5D286C]" /> Parque de Máquinas</h2>
          <div className="space-y-3">
            {machines.map(m => (
              <div key={m.id} className="bg-white p-5 rounded-3xl border border-gray-100 flex justify-between items-center shadow-sm group">
                <div className="flex-1 mr-4">
                  {editingId === m.id ? (
                    <input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      className="w-full p-2 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C]"
                    />
                  ) : (
                    <p className="font-black text-[#262626]">{m.nome}</p>
                  )}
                  <span className="text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-full font-black uppercase mt-1 inline-block">
                    {m.status || "Ativa"}
                  </span>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  {editingId === m.id ? (
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(m.id)}
                      className="text-[#5D286C] font-black text-xs"
                    >
                      SALVAR
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(m)}
                      className="text-gray-400 text-xs font-black"
                    >
                      EDITAR
                    </button>
                  )}
                  <button onClick={() => handleDelete(m.id)} className="p-2 text-gray-300 hover:text-red-500">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
            {machines.length === 0 && <p className="text-gray-400 font-bold text-center py-10">Nenhuma máquina cadastrada.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}