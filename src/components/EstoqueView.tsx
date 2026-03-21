"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Package, Hammer, Loader2, Activity, ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-react";

type SortMode = "nome" | "estoque_asc" | "estoque_desc";

export default function EstoqueView() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"kit" | "pecas">("kit");
  const [kitsStock, setKitsStock] = useState<any[]>([]);
  const [loosePartsStock, setLoosePartsStock] = useState<any[]>([]);
  const [sortKits, setSortKits] = useState<SortMode>("nome");
  const [sortPecas, setSortPecas] = useState<SortMode>("nome");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [kitsRes, moldesRes] = await Promise.all([
        supabase.from("kits").select("id, nome_kit, codigo_unico, estoque_atual").order("nome_kit"),
        supabase.from("moldes").select("id, nome, estoque_atual").order("nome"),
      ]);
      setKitsStock(kitsRes.data || []);
      setLoosePartsStock(moldesRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  const sortedKits = useMemo(() => {
    const list = [...kitsStock];
    if (sortKits === "estoque_asc") list.sort((a, b) => (a.estoque_atual || 0) - (b.estoque_atual || 0));
    else if (sortKits === "estoque_desc") list.sort((a, b) => (b.estoque_atual || 0) - (a.estoque_atual || 0));
    else list.sort((a, b) => (a.nome_kit || "").localeCompare(b.nome_kit || "", "pt-BR"));
    return list;
  }, [kitsStock, sortKits]);

  const sortedPecas = useMemo(() => {
    const list = [...loosePartsStock];
    if (sortPecas === "estoque_asc") list.sort((a, b) => (a.estoque_atual || 0) - (b.estoque_atual || 0));
    else if (sortPecas === "estoque_desc") list.sort((a, b) => (b.estoque_atual || 0) - (a.estoque_atual || 0));
    else list.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    return list;
  }, [loosePartsStock, sortPecas]);

  function cycleSort(current: SortMode): SortMode {
    if (current === "nome") return "estoque_asc";
    if (current === "estoque_asc") return "estoque_desc";
    return "nome";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-[#5D286C]" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 bg-gray-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-[#262626] tracking-tight">Estoque</h1>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.3em]">Kits e Peças Avulsas</p>
        </div>
        <button
          onClick={fetchData}
          className="bg-white border-2 border-gray-100 p-4 rounded-2xl font-black text-xs hover:border-[#5D286C] transition-all flex items-center gap-2"
        >
          <Activity size={16} /> ATUALIZAR
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="inline-flex gap-2 rounded-2xl bg-gray-100 p-1 text-xs font-black uppercase">
          <button
            onClick={() => setActiveTab("kit")}
            className={`px-3 py-2 rounded-2xl transition-all ${
              activeTab === "kit" ? "bg-white text-[#5D286C] shadow-sm" : "text-gray-400"
            }`}
          >
            Kit
          </button>
          <button
            onClick={() => setActiveTab("pecas")}
            className={`px-3 py-2 rounded-2xl transition-all ${
              activeTab === "pecas" ? "bg-white text-[#5D286C] shadow-sm" : "text-gray-400"
            }`}
          >
            Peças
          </button>
        </div>
        <button
          type="button"
          onClick={() =>
            activeTab === "kit" ? setSortKits((s) => cycleSort(s)) : setSortPecas((s) => cycleSort(s))
          }
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-100 rounded-2xl text-xs font-black text-[#5D286C] hover:border-[#5D286C] transition-all"
          title="Ordenar por estoque"
        >
          {activeTab === "kit" ? (
            sortKits === "estoque_desc" ? (
              <>
                <ArrowDownWideNarrow size={16} /> Mais estoque primeiro
              </>
            ) : sortKits === "estoque_asc" ? (
              <>
                <ArrowUpWideNarrow size={16} /> Menos estoque primeiro
              </>
            ) : (
              <>Ordenação: nome</>
            )
          ) : sortPecas === "estoque_desc" ? (
            <>
              <ArrowDownWideNarrow size={16} /> Mais estoque primeiro
            </>
          ) : sortPecas === "estoque_asc" ? (
            <>
              <ArrowUpWideNarrow size={16} /> Menos estoque primeiro
            </>
          ) : (
            <>Ordenação: nome</>
          )}
        </button>
      </div>

      {activeTab === "kit" ? (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sortedKits.map((kit) => (
              <div
                key={kit.id}
                className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-purple-50 rounded-xl">
                    <Package className="text-[#5D286C]" size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-gray-400 uppercase truncate">{kit.codigo_unico}</p>
                    <p className="text-sm font-black text-[#262626] truncate">{kit.nome_kit}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-2xl font-black text-[#5D286C]">{kit.estoque_atual || 0}</p>
                  <p className="text-xs font-bold text-gray-400 uppercase">unidades</p>
                </div>
              </div>
            ))}
            {sortedKits.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400 font-bold">Nenhum kit cadastrado</div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sortedPecas.map((molde) => (
              <div
                key={molde.id}
                className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-orange-50 rounded-xl">
                    <Hammer className="text-orange-600" size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-[#262626] truncate">{molde.nome}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-2xl font-black text-orange-600">{molde.estoque_atual || 0}</p>
                  <p className="text-xs font-bold text-gray-400 uppercase">unidades</p>
                </div>
              </div>
            ))}
            {sortedPecas.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400 font-bold">
                Nenhuma peça avulsa cadastrada
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
