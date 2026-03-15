"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Hammer, Box, Save, ArrowLeft, Cpu, AlertTriangle, X } from "lucide-react";
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

interface Material {
  id: number;
  nome: string;
  estoque_kg: number;
}

export default function ManualProductionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [moldes, setMoldes] = useState<Molde[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [issubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { showToast } = useToast();

  const [selectedMolde, setSelectedMolde] = useState<string>("");
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [bagsUsed, setBagsUsed] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      const [moldesRes, machinesRes, materialsRes] = await Promise.all([
        supabase.from("moldes").select("id, nome").order("nome"),
        supabase.from("machines").select("id, nome").order("nome"),
        supabase.from("materials").select("id, nome, estoque_kg").order("nome")
      ]);
      
      if (moldesRes.data) setMoldes(moldesRes.data);
      if (machinesRes.data) setMachines(machinesRes.data);
      if (materialsRes.data) setMaterials(materialsRes.data);
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMolde || !selectedMachine || !quantity || !selectedMaterial || !user) {
      showToast("Preencha todos os campos obrigatórios.", "error");
      return;
    }

    setIsSubmitting(true);
    const qtyInt = parseInt(quantity);
    const bagsInt = parseInt(bagsUsed || "0");
    const materialConsumed = bagsInt * 25; // 25kg por saco

    try {
      // 1. Buscar material selecionado e verificar estoque
      const { data: material, error: materialError } = await supabase
        .from("materials")
        .select("id, nome, estoque_kg")
        .eq("id", parseInt(selectedMaterial))
        .single();

      if (materialError) throw materialError;
      if (!material) throw new Error("Material não encontrado");

      const availableMaterial = material.estoque_kg || 0;

      // 2. Validar se há material suficiente
      if (availableMaterial < materialConsumed) {
        const missing = materialConsumed - availableMaterial;
        const errorMsg = `Material insuficiente.\n\n${material.nome}\nDisponível: ${availableMaterial} kg\nNecessário: ${materialConsumed} kg\nFaltam: ${missing} kg`;
        setValidationError(errorMsg);
        setIsSubmitting(false);
        return;
      }

      // 3. Se tiver material suficiente, processar produção
      await supabase.rpc('increment_molde_stock', {
        row_id: parseInt(selectedMolde),
        amount: qtyInt
      });

      // Descontar material do material selecionado
      const newMaterialStock = availableMaterial - materialConsumed;
      const { error: materialUpdateError } = await supabase
        .from("materials")
        .update({ estoque_kg: newMaterialStock })
        .eq("id", parseInt(selectedMaterial));

      if (materialUpdateError) throw materialUpdateError;

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
      showToast(`Erro ao registrar: ${err.message}`, "error");
    } finally {
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

        <button
          type="submit"
          disabled={issubmitting}
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