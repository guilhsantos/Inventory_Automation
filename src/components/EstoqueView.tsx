"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Package, Hammer, Loader2, Activity,
  ArrowDownWideNarrow, ArrowUpWideNarrow,
  Calculator, X, CheckCircle, AlertTriangle, ChevronRight,
} from "lucide-react";

type SortMode = "nome" | "estoque_asc" | "estoque_desc";

type PendingOrder = {
  id: number;
  codigo_unico: string;
  cliente: string;
  order_items: { quantidade: number; kit_id: number; kits: { nome_kit: string } | null }[];
};

type KitSummaryItem = {
  kitId: number;
  nome: string;
  needed: number;
  inStock: number;
  toAssemble: number;
};

type MoldeSummaryItem = {
  moldeId: number;
  nome: string;
  inStock: number;
  needed: number;
  toFabricate: number;
};

type CalcResult = {
  kitSummary: KitSummaryItem[];
  moldeSummary: MoldeSummaryItem[];
  allOk: boolean;
};

export default function EstoqueView() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"kit" | "pecas">("kit");
  const [kitsStock, setKitsStock] = useState<any[]>([]);
  const [loosePartsStock, setLoosePartsStock] = useState<any[]>([]);
  const [sortKits, setSortKits] = useState<SortMode>("nome");
  const [sortPecas, setSortPecas] = useState<SortMode>("nome");

  // Calculadora
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcStep, setCalcStep] = useState<"select" | "result">("select");
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null);

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

  async function openCalculator() {
    setCalcOpen(true);
    setCalcStep("select");
    setCalcResult(null);
    setSelectedOrderIds(new Set());
    setCalcLoading(true);
    try {
      const { data } = await supabase
        .from("orders")
        .select("id, codigo_unico, cliente, order_items(quantidade, kit_id, kits(nome_kit))")
        .eq("status", "Pendente")
        .order("created_at", { ascending: true });
      setPendingOrders((data as unknown as PendingOrder[]) || []);
    } catch {
      setPendingOrders([]);
    } finally {
      setCalcLoading(false);
    }
  }

  function toggleOrder(id: number) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedOrderIds(new Set(pendingOrders.map((o) => o.id)));
  }

  async function runCalculation() {
    setCalcLoading(true);
    try {
      const selected = pendingOrders.filter((o) => selectedOrderIds.has(o.id));

      // 1. Agregar kits necessários
      const kitNeeded = new Map<number, { nome: string; needed: number }>();
      for (const order of selected) {
        for (const item of order.order_items) {
          const prev = kitNeeded.get(item.kit_id) || {
            nome: item.kits?.nome_kit || `Kit #${item.kit_id}`,
            needed: 0,
          };
          prev.needed += item.quantidade;
          kitNeeded.set(item.kit_id, prev);
        }
      }

      const kitIds = Array.from(kitNeeded.keys());
      if (kitIds.length === 0) {
        setCalcResult({ kitSummary: [], moldeSummary: [], allOk: true });
        setCalcStep("result");
        return;
      }

      // 2. Buscar estoque atual dos kits
      const { data: kitsData } = await supabase
        .from("kits")
        .select("id, estoque_atual")
        .in("id", kitIds);

      const kitStockMap = new Map<number, number>();
      (kitsData || []).forEach((k: any) => kitStockMap.set(k.id, k.estoque_atual || 0));

      // 3. Calcular toAssemble por kit
      const kitSummary: KitSummaryItem[] = [];
      const kitsToAssemble: number[] = [];

      for (const [kitId, { nome, needed }] of kitNeeded.entries()) {
        const inStock = kitStockMap.get(kitId) || 0;
        const toAssemble = Math.max(0, needed - inStock);
        kitSummary.push({ kitId, nome, needed, inStock, toAssemble });
        if (toAssemble > 0) kitsToAssemble.push(kitId);
      }

      // 4. Se todos os kits têm estoque suficiente
      if (kitsToAssemble.length === 0) {
        setCalcResult({ kitSummary, moldeSummary: [], allOk: true });
        setCalcStep("result");
        return;
      }

      // 5. Buscar kit_items para os kits que precisam ser montados
      const { data: kitItemsData } = await supabase
        .from("kit_items")
        .select("kit_id, molde_id, quantidade, moldes(id, nome, estoque_atual)")
        .in("kit_id", kitsToAssemble);

      // 6. Calcular moldes necessários
      const moldeNeeded = new Map<number, { nome: string; inStock: number; needed: number }>();

      for (const ki of (kitItemsData || []) as any[]) {
        const kitId = ki.kit_id as number;
        const moldeId = ki.molde_id as number;
        const qtdPerKit = ki.quantidade || 0;
        const kitEntry = kitSummary.find((k) => k.kitId === kitId);
        if (!kitEntry || kitEntry.toAssemble === 0) continue;

        const totalMoldeNeeded = qtdPerKit * kitEntry.toAssemble;
        const nome = ki.moldes?.nome || `Molde #${moldeId}`;
        const inStock = ki.moldes?.estoque_atual || 0;

        const prev = moldeNeeded.get(moldeId) || { nome, inStock, needed: 0 };
        prev.needed += totalMoldeNeeded;
        moldeNeeded.set(moldeId, prev);
      }

      // 7. Calcular toFabricate por molde
      const moldeSummary: MoldeSummaryItem[] = Array.from(moldeNeeded.entries()).map(
        ([moldeId, { nome, inStock, needed }]) => ({
          moldeId,
          nome,
          inStock,
          needed,
          toFabricate: Math.max(0, needed - inStock),
        })
      ).sort((a, b) => b.toFabricate - a.toFabricate);

      const allOk = moldeSummary.every((m) => m.toFabricate === 0);
      setCalcResult({ kitSummary, moldeSummary, allOk });
      setCalcStep("result");
    } catch (err) {
      console.error("Erro no cálculo:", err);
    } finally {
      setCalcLoading(false);
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
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => openCalculator()}
            className="bg-[#5D286C] text-white border-2 border-[#5D286C] p-4 rounded-2xl font-black text-xs hover:bg-[#7B1470] transition-all flex items-center gap-2"
          >
            <Calculator size={16} /> Calculadora Pedidos
          </button>
          <button
            onClick={fetchData}
            className="bg-white border-2 border-gray-100 p-4 rounded-2xl font-black text-xs hover:border-[#5D286C] transition-all flex items-center gap-2"
          >
            <Activity size={16} /> ATUALIZAR
          </button>
        </div>
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
              <><ArrowDownWideNarrow size={16} /> Mais estoque primeiro</>
            ) : sortKits === "estoque_asc" ? (
              <><ArrowUpWideNarrow size={16} /> Menos estoque primeiro</>
            ) : (
              <>Ordenação: nome</>
            )
          ) : sortPecas === "estoque_desc" ? (
            <><ArrowDownWideNarrow size={16} /> Mais estoque primeiro</>
          ) : sortPecas === "estoque_asc" ? (
            <><ArrowUpWideNarrow size={16} /> Menos estoque primeiro</>
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

      {/* Modal Calculadora */}
      {calcOpen && (
        <div
          className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setCalcOpen(false)}
        >
          <div
            className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-xl font-black text-[#262626] flex items-center gap-2">
                  <Calculator className="text-[#5D286C]" size={22} />
                  Calculadora de Produção
                </h2>
                <p className="text-xs font-bold text-gray-400 uppercase mt-1">
                  {calcStep === "select" ? "Selecione os pedidos para calcular" : "Resultado da análise de estoque"}
                </p>
              </div>
              <button onClick={() => setCalcOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {calcLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="animate-spin text-[#5D286C]" size={40} />
                </div>
              ) : calcStep === "select" ? (
                <div className="space-y-3">
                  {pendingOrders.length === 0 ? (
                    <p className="text-center text-gray-400 font-bold py-10">Nenhum pedido pendente.</p>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-black text-gray-500">
                          {selectedOrderIds.size} de {pendingOrders.length} selecionados
                        </p>
                        <button
                          type="button"
                          onClick={selectAll}
                          className="text-xs font-black text-[#5D286C] hover:underline"
                        >
                          Selecionar todos
                        </button>
                      </div>
                      {pendingOrders.map((order) => {
                        const selected = selectedOrderIds.has(order.id);
                        const totalKits = order.order_items.reduce((a, i) => a + i.quantidade, 0);
                        return (
                          <div
                            key={order.id}
                            onClick={() => toggleOrder(order.id)}
                            className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                              selected
                                ? "border-[#5D286C] bg-purple-50"
                                : "border-gray-100 bg-white hover:border-gray-200"
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-lg border-2 shrink-0 flex items-center justify-center transition-colors ${
                                selected ? "border-[#5D286C] bg-[#5D286C]" : "border-gray-300"
                              }`}
                            >
                              {selected && <CheckCircle size={12} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-[#262626] text-sm">{order.codigo_unico}</p>
                              <p className="text-xs font-bold text-gray-500 truncate">{order.cliente}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-black text-[#5D286C]">{totalKits}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">kits</p>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              ) : calcResult ? (
                <div className="space-y-6">
                  {/* Badge resultado geral */}
                  <div className={`flex items-center gap-3 p-4 rounded-2xl ${
                    calcResult.allOk ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                  }`}>
                    {calcResult.allOk ? (
                      <CheckCircle className="text-green-600 shrink-0" size={24} />
                    ) : (
                      <AlertTriangle className="text-red-600 shrink-0" size={24} />
                    )}
                    <p className={`font-black text-sm ${calcResult.allOk ? "text-green-800" : "text-red-800"}`}>
                      {calcResult.allOk
                        ? "Estoque suficiente! Todos os pedidos podem ser atendidos."
                        : "Estoque insuficiente. Veja abaixo o que precisa ser fabricado."}
                    </p>
                  </div>

                  {/* Resumo de kits */}
                  <div>
                    <h3 className="text-sm font-black text-[#262626] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Package size={16} className="text-[#5D286C]" /> Kits
                    </h3>
                    <div className="overflow-x-auto rounded-2xl border border-gray-100">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-[10px] font-black uppercase text-gray-400">
                            <th className="p-3">Kit</th>
                            <th className="p-3 text-right">Necessário</th>
                            <th className="p-3 text-right">Em estoque</th>
                            <th className="p-3 text-right">Montar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calcResult.kitSummary.map((k) => (
                            <tr
                              key={k.kitId}
                              className={`border-t border-gray-50 font-bold ${
                                k.toAssemble > 0 ? "bg-red-50/60 text-red-900" : "bg-green-50/60 text-green-900"
                              }`}
                            >
                              <td className="p-3">{k.nome}</td>
                              <td className="p-3 text-right">{k.needed}</td>
                              <td className="p-3 text-right">{k.inStock}</td>
                              <td className="p-3 text-right font-black">
                                {k.toAssemble > 0 ? (
                                  <span className="text-red-600">{k.toAssemble}</span>
                                ) : (
                                  <span className="text-green-600">OK</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Resumo de moldes */}
                  {calcResult.moldeSummary.length > 0 && (
                    <div>
                      <h3 className="text-sm font-black text-[#262626] uppercase tracking-widest mb-3 flex items-center gap-2">
                        <ChevronRight size={16} className="text-orange-500" /> Moldes a Fabricar
                      </h3>
                      <div className="overflow-x-auto rounded-2xl border border-gray-100">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr className="text-left text-[10px] font-black uppercase text-gray-400">
                              <th className="p-3">Molde</th>
                              <th className="p-3 text-right">Em estoque</th>
                              <th className="p-3 text-right">Necessário</th>
                              <th className="p-3 text-right">Fabricar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calcResult.moldeSummary.map((m) => (
                              <tr
                                key={m.moldeId}
                                className={`border-t border-gray-50 font-bold ${
                                  m.toFabricate > 0 ? "bg-red-50/60 text-red-900" : "bg-green-50/60 text-green-900"
                                }`}
                              >
                                <td className="p-3">{m.nome}</td>
                                <td className="p-3 text-right">{m.inStock}</td>
                                <td className="p-3 text-right">{m.needed}</td>
                                <td className="p-3 text-right font-black">
                                  {m.toFabricate > 0 ? (
                                    <span className="text-red-600">{m.toFabricate}</span>
                                  ) : (
                                    <span className="text-green-600">OK</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 flex gap-2 justify-end shrink-0">
              {calcStep === "select" ? (
                <>
                  <button
                    onClick={() => setCalcOpen(false)}
                    className="px-5 py-3 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={runCalculation}
                    disabled={selectedOrderIds.size === 0 || calcLoading}
                    className="px-5 py-3 bg-[#5D286C] text-white rounded-2xl font-black text-sm hover:bg-[#7B1470] transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    <Calculator size={16} /> Calcular
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setCalcStep("select"); setCalcResult(null); }}
                    className="px-5 py-3 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => setCalcOpen(false)}
                    className="px-5 py-3 bg-[#5D286C] text-white rounded-2xl font-black text-sm hover:bg-[#7B1470] transition-all"
                  >
                    Fechar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
