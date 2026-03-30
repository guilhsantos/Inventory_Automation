"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Activity, Calendar, Download, Package, ArrowDown, ArrowUp, Cpu, ShoppingCart, X, Trophy } from "lucide-react";
import { brDayRangeIso, formatDate, formatDayKeyBrFromTimestamp, todayYmdBr, ymdAddDaysBr } from "@/lib/date-utils";
import { useStuckLoadingRecovery } from "@/lib/use-stuck-loading-recovery";

const KG_POR_SACO = 25;

type TableRow = {
  sortKey: number;
  kind: "producao" | "defeito" | "kit";
  molde: string;
  maquina: string;
  material: string;
  dataRaw: string;
  qtd: number;
  kg: number;
  obs: string;
  machineId: number | null;
};

type OrderRow = {
  id: number;
  codigo_unico: string;
  cliente: string;
  status: string;
  created_at: string | null;
  concluido_em: string | null;
  entregue_em: string | null;
  totalKits: number;
  sortKey: number;
  order_items: { kit_id: number; nome: string; quantidade: number }[];
};

type KitRankItem = {
  kitId: number;
  nome: string;
  total: number;
};

type RowFilter = "todos" | "defeitos" | "prod_maquina";
type TableMode = "molde" | "kit" | "pedidos";
type OrderStatus = "Todos" | "Pendente" | "Concluído" | "Entregue";

type FetchParams = {
  rangeStart: string;
  rangeEnd: string;
  mode: TableMode;
  rowFilter: RowFilter;
  machineId: string;
  orderStatus: OrderStatus;
};

export default function PerformancePage() {
  const [loading, setLoading] = useState(false);
  const [initialDone, setInitialDone] = useState(false);
  const [draftStart, setDraftStart] = useState(() => ymdAddDaysBr(todayYmdBr(), -7));
  const [draftEnd, setDraftEnd] = useState(todayYmdBr);
  const [tableMode, setTableMode] = useState<TableMode>("molde");
  const [draftRowFilter, setDraftRowFilter] = useState<RowFilter>("todos");
  const [draftMachineId, setDraftMachineId] = useState("");
  const [draftOrderStatus, setDraftOrderStatus] = useState<OrderStatus>("Concluído");
  const [machines, setMachines] = useState<{ id: number; nome: string }[]>([]);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [orderRows, setOrderRows] = useState<OrderRow[]>([]);
  const [kitRanking, setKitRanking] = useState<KitRankItem[]>([]);
  const [kitRankOpen, setKitRankOpen] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [sortDesc, setSortDesc] = useState(true);
  const [cards, setCards] = useState({
    totalProduzido: 0,
    totalDefeito: 0,
    mediaMaterialPeca: 0,
    mediaMaterialDia: 0,
    totalKits: 0,
    mediaMaterialKit: 0,
    mediaKitsDia: 0,
    totalPedidos: 0,
    totalKitsPedidos: 0,
  });
  const [exportRange, setExportRange] = useState({ start: "", end: "" });

  useStuckLoadingRecovery(loading);

  useEffect(() => {
    supabase
      .from("machines")
      .select("id, nome")
      .order("nome")
      .then(({ data }) => setMachines(data || []));
  }, []);

  useEffect(() => {
    if (initialDone) return;
    void runFetch({
      rangeStart: draftStart,
      rangeEnd: draftEnd,
      mode: "molde",
      rowFilter: "todos",
      machineId: "",
      orderStatus: "Concluído",
    }).then(() => {
      setInitialDone(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runFetch(params: FetchParams) {
    setLoading(true);
    setExportRange({ start: params.rangeStart, end: params.rangeEnd });
    try {
      const { startIso, endIso } = brDayRangeIso(params.rangeStart, params.rangeEnd);
      const mid =
        params.rowFilter === "prod_maquina" && params.machineId
          ? parseInt(params.machineId, 10)
          : null;

      if (params.mode === "pedidos") {
        // Coluna de data conforme status
        const dateCol =
          params.orderStatus === "Concluído" ? "concluido_em" :
          params.orderStatus === "Entregue"  ? "entregue_em"  : "created_at";

        let q = supabase
          .from("orders")
          .select("id, codigo_unico, cliente, status, created_at, concluido_em, entregue_em, order_items(quantidade, kit_id, kits(nome_kit))")
          .gte(dateCol, startIso)
          .lte(dateCol, endIso);

        if (params.orderStatus !== "Todos") {
          q = q.eq("status", params.orderStatus);
        }

        const { data: ordersRaw } = await q;

        const orders = ordersRaw || [];

        // Montar linhas e agregações
        let totalKitsPedidos = 0;
        const kitMap = new Map<number, { nome: string; total: number }>();
        const rows: OrderRow[] = orders.map((o: any) => {
          const totalKits = (o.order_items || []).reduce(
            (acc: number, item: any) => acc + (item.quantidade || 0),
            0
          );
          totalKitsPedidos += totalKits;

          (o.order_items || []).forEach((item: any) => {
            const kitId = item.kit_id as number;
            const nome = item.kits?.nome_kit || `Kit #${kitId}`;
            const prev = kitMap.get(kitId) || { nome, total: 0 };
            prev.total += item.quantidade || 0;
            kitMap.set(kitId, prev);
          });

          return {
            id: o.id,
            codigo_unico: o.codigo_unico,
            cliente: o.cliente,
            status: o.status,
            created_at: o.created_at || null,
            concluido_em: o.concluido_em || null,
            entregue_em: o.entregue_em || null,
            totalKits,
            sortKey: new Date(o.created_at || 0).getTime(),
            order_items: (o.order_items || []).map((item: any) => ({
              kit_id: item.kit_id,
              nome: item.kits?.nome_kit || `Kit #${item.kit_id}`,
              quantidade: item.quantidade || 0,
            })),
          };
        });

        const ranking: KitRankItem[] = Array.from(kitMap.entries())
          .map(([kitId, { nome, total }]) => ({ kitId, nome, total }))
          .sort((a, b) => b.total - a.total);

        setOrderRows(rows);
        setKitRanking(ranking);
        setCards((prev) => ({
          ...prev,
          totalPedidos: orders.length,
          totalKitsPedidos,
        }));
        setTableRows([]);
        return;
      }

      const kitItemsRes = await supabase.from("kit_items").select("kit_id, molde_id, quantidade");
      const kitItems = kitItemsRes.data || [];

      let production: any[] = [];
      let defects: any[] = [];
      let movements: any[] = [];

      if (params.mode === "molde") {
        let prodQ = supabase
          .from("daily_production")
          .select(
            "molde_id, machine_id, material_id, quantidade_boa, sacos_usados, created_at, moldes(nome), machines(nome), materials(nome)"
          )
          .gte("created_at", startIso)
          .lte("created_at", endIso);
        if (mid != null && !Number.isNaN(mid)) prodQ = prodQ.eq("machine_id", mid);
        const [prodRes, defRes] = await Promise.all([
          prodQ,
          supabase
            .from("defects")
            .select("molde_id, machine_id, quantity, reason, created_at, moldes(nome), machines(nome)")
            .gte("created_at", startIso)
            .lte("created_at", endIso),
        ]);
        production = prodRes.data || [];
        defects = defRes.data || [];
        if (mid != null && !Number.isNaN(mid)) {
          defects = defects.filter((d: any) => d.machine_id === mid);
        }
      } else {
        const movRes = await supabase
          .from("stock_movements")
          .select("kit_id, quantity, created_at, type, kits(nome_kit)")
          .eq("type", "IN")
          .not("kit_id", "is", null)
          .gte("created_at", startIso)
          .lte("created_at", endIso);
        movements = movRes.data || [];
        const prodRes = await supabase
          .from("daily_production")
          .select("molde_id, machine_id, material_id, quantidade_boa, sacos_usados, created_at, materials(nome)")
          .gte("created_at", startIso)
          .lte("created_at", endIso);
        production = prodRes.data || [];
      }

      const byMolde = new Map<number, { kg: number; pieces: number }>();
      let sumKgProd = 0;
      let sumPiecesProd = 0;
      const prodDays = new Set<string>();

      production.forEach((row: any) => {
        const m = row.molde_id as number | null;
        const kg = (row.sacos_usados || 0) * KG_POR_SACO;
        const q = row.quantidade_boa || 0;
        sumKgProd += kg;
        sumPiecesProd += q;
        if (row.created_at) {
          const k = formatDayKeyBrFromTimestamp(row.created_at);
          if (k) prodDays.add(k);
        }
        if (m != null) {
          const cur = byMolde.get(m) || { kg: 0, pieces: 0 };
          cur.kg += kg;
          cur.pieces += q;
          byMolde.set(m, cur);
        }
      });

      const avgPerMolde = new Map<number, number>();
      byMolde.forEach((v, k) => {
        avgPerMolde.set(k, v.pieces > 0 ? v.kg / v.pieces : 0);
      });
      const globalAvgKgPerPiece = sumPiecesProd > 0 ? sumKgProd / sumPiecesProd : 0;

      function kgPorKit(kitId: number): number {
        const items = kitItems.filter((ki: any) => ki.kit_id === kitId);
        let s = 0;
        for (const it of items) {
          const moldeId = it.molde_id as number;
          const avg = avgPerMolde.get(moldeId) ?? globalAvgKgPerPiece;
          s += (it.quantidade || 0) * avg;
        }
        return s;
      }

      let totalDefeito = 0;
      defects.forEach((row: any) => {
        totalDefeito += row.quantity || 0;
      });

      let totalKits = 0;
      const kitDays = new Set<string>();
      let sumKgKits = 0;
      movements.forEach((row: any) => {
        const q = row.quantity || 0;
        totalKits += q;
        if (row.created_at) {
          const k = formatDayKeyBrFromTimestamp(row.created_at);
          if (k) kitDays.add(k);
        }
        const kid = row.kit_id as number;
        if (kid != null) sumKgKits += q * kgPorKit(kid);
      });

      const diasComProducao = prodDays.size || 1;
      const diasComKit = kitDays.size || 1;

      if (params.mode === "molde") {
        setCards((prev) => ({
          ...prev,
          totalProduzido: sumPiecesProd,
          totalDefeito,
          mediaMaterialPeca: sumPiecesProd > 0 ? sumKgProd / sumPiecesProd : 0,
          mediaMaterialDia: diasComProducao > 0 ? sumKgProd / diasComProducao : 0,
          totalKits: 0,
          mediaMaterialKit: 0,
          mediaKitsDia: 0,
        }));
      } else {
        setCards((prev) => ({
          ...prev,
          totalProduzido: 0,
          totalDefeito: 0,
          mediaMaterialPeca: 0,
          mediaMaterialDia: 0,
          totalKits,
          mediaMaterialKit: totalKits > 0 ? sumKgKits / totalKits : 0,
          mediaKitsDia: diasComKit > 0 ? totalKits / diasComKit : 0,
        }));
      }

      const rows: TableRow[] = [];

      if (params.mode === "molde") {
        const incluirProducao = params.rowFilter === "todos" || params.rowFilter === "prod_maquina";
        const incluirDefeito = params.rowFilter === "todos" || params.rowFilter === "defeitos";

        if (incluirProducao) {
          production.forEach((row: any) => {
            const kg = (row.sacos_usados || 0) * KG_POR_SACO;
            rows.push({
              sortKey: new Date(row.created_at).getTime(),
              kind: "producao",
              molde: row.moldes?.nome || "—",
              maquina: row.machines?.nome || "—",
              material: row.materials?.nome || "—",
              dataRaw: row.created_at,
              qtd: row.quantidade_boa || 0,
              kg,
              obs: "",
              machineId: row.machine_id ?? null,
            });
          });
        }
        if (incluirDefeito) {
          defects.forEach((row: any) => {
            rows.push({
              sortKey: new Date(row.created_at).getTime(),
              kind: "defeito",
              molde: row.moldes?.nome || "—",
              maquina: row.machines?.nome || "—",
              material: "—",
              dataRaw: row.created_at,
              qtd: row.quantity || 0,
              kg: 0,
              obs: row.reason || "—",
              machineId: row.machine_id ?? null,
            });
          });
        }
      } else {
        movements.forEach((row: any) => {
          const kid = row.kit_id as number;
          const q = row.quantity || 0;
          const kgKit = kid != null ? kgPorKit(kid) : 0;
          rows.push({
            sortKey: new Date(row.created_at).getTime(),
            kind: "kit",
            molde: row.kits?.nome_kit || `Kit #${kid}`,
            maquina: "—",
            material: "—",
            dataRaw: row.created_at,
            qtd: q,
            kg: q * kgKit,
            obs: "",
            machineId: null,
          });
        });
      }

      rows.sort((a, b) => b.sortKey - a.sortKey);
      setTableRows(rows);
      setOrderRows([]);
      setKitRanking([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleFiltrar() {
    void runFetch({
      rangeStart: draftStart,
      rangeEnd: draftEnd,
      mode: tableMode,
      rowFilter: draftRowFilter,
      machineId: draftMachineId,
      orderStatus: draftOrderStatus,
    });
  }

  const sortedRows = useMemo(() => {
    const copy = [...tableRows];
    copy.sort((a, b) => (sortDesc ? b.sortKey - a.sortKey : a.sortKey - b.sortKey));
    return copy;
  }, [tableRows, sortDesc]);

  const sortedOrderRows = useMemo(() => {
    return [...orderRows].sort((a, b) => sortDesc ? b.sortKey - a.sortKey : a.sortKey - b.sortKey);
  }, [orderRows, sortDesc]);

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const data = sortedRows.map((r, i) => ({
      Índice: i + 1,
      Tipo: r.kind === "producao" ? "Produção" : r.kind === "defeito" ? "Defeito" : "Kit",
      Molde: r.molde,
      Máquina: r.maquina,
      Material: r.material,
      Data: formatDate(r.dataRaw),
      "Qtd produzida": r.qtd,
      "Kg material": r.kg,
      Observação: r.obs,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produção");
    const a = exportRange.start || draftStart;
    const b = exportRange.end || draftEnd;
    XLSX.writeFile(wb, `producao_${a}_${b}.xlsx`);
  };

  const topKit = kitRanking[0] ?? null;

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 bg-gray-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-[#262626] tracking-tight">Performance</h1>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.3em]">
            Molde (peças + defeitos), Kit ou Pedidos — use Filtrar para carregar
          </p>
        </div>
        <button
          type="button"
          onClick={handleFiltrar}
          disabled={loading}
          className="bg-white border-2 border-gray-100 p-4 rounded-2xl font-black text-xs hover:border-[#5D286C] transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <Activity size={16} /> ATUALIZAR
        </button>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 rounded-2xl bg-gray-100 p-1 text-xs font-black uppercase w-fit">
          <button
            type="button"
            onClick={() => {
              setTableMode("molde");
              void runFetch({ rangeStart: draftStart, rangeEnd: draftEnd, mode: "molde", rowFilter: draftRowFilter, machineId: draftMachineId, orderStatus: draftOrderStatus });
            }}
            className={`px-4 py-2 rounded-2xl transition-all flex items-center gap-2 ${
              tableMode === "molde" ? "bg-white text-[#5D286C] shadow-sm" : "text-gray-400"
            }`}
          >
            <Cpu size={16} /> Molde
          </button>
          <button
            type="button"
            onClick={() => {
              setTableMode("kit");
              void runFetch({ rangeStart: draftStart, rangeEnd: draftEnd, mode: "kit", rowFilter: draftRowFilter, machineId: draftMachineId, orderStatus: draftOrderStatus });
            }}
            className={`px-4 py-2 rounded-2xl transition-all flex items-center gap-2 ${
              tableMode === "kit" ? "bg-white text-[#5D286C] shadow-sm" : "text-gray-400"
            }`}
          >
            <Package size={16} /> Kit
          </button>
          <button
            type="button"
            onClick={() => {
              setTableMode("pedidos");
              setDraftOrderStatus("Todos");
              void runFetch({ rangeStart: draftStart, rangeEnd: draftEnd, mode: "pedidos", rowFilter: draftRowFilter, machineId: draftMachineId, orderStatus: "Todos" });
            }}
            className={`px-4 py-2 rounded-2xl transition-all flex items-center gap-2 ${
              tableMode === "pedidos" ? "bg-white text-[#5D286C] shadow-sm" : "text-gray-400"
            }`}
          >
            <ShoppingCart size={16} /> Pedidos
          </button>
        </div>

        <label className="text-xs font-black text-gray-400 uppercase block">Período e filtros da tabela</label>
        <div className="flex flex-col xl:flex-row gap-4 flex-wrap items-start xl:items-end justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <label className="text-xs font-black text-gray-400 uppercase">Inicial</label>
              <input
                type="date"
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
                max={draftEnd}
                className="px-3 py-2 rounded-2xl border-2 border-gray-100 focus:border-[#5D286C] outline-none font-bold text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <label className="text-xs font-black text-gray-400 uppercase">Final</label>
              <input
                type="date"
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
                min={draftStart}
                max={todayYmdBr()}
                className="px-3 py-2 rounded-2xl border-2 border-gray-100 focus:border-[#5D286C] outline-none font-bold text-sm"
              />
            </div>
          </div>

          {tableMode === "molde" && (
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-start sm:items-end">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Linhas</label>
                <select
                  value={draftRowFilter}
                  onChange={(e) => setDraftRowFilter(e.target.value as RowFilter)}
                  className="px-3 py-2 rounded-2xl border-2 border-gray-100 font-bold text-sm min-w-[200px]"
                >
                  <option value="todos">Todos (produção + defeito)</option>
                  <option value="defeitos">Somente defeitos</option>
                  <option value="prod_maquina">Produção de uma máquina</option>
                </select>
              </div>
              {draftRowFilter === "prod_maquina" && (
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Máquina</label>
                  <select
                    value={draftMachineId}
                    onChange={(e) => setDraftMachineId(e.target.value)}
                    className="px-3 py-2 rounded-2xl border-2 border-gray-100 font-bold text-sm min-w-[200px]"
                  >
                    <option value="">Selecione…</option>
                    {machines.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {tableMode === "pedidos" && (
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Status</label>
              <select
                value={draftOrderStatus}
                onChange={(e) => setDraftOrderStatus(e.target.value as OrderStatus)}
                className="px-3 py-2 rounded-2xl border-2 border-gray-100 font-bold text-sm min-w-[180px]"
              >
                <option value="Todos">Todos</option>
                <option value="Pendente">Pendente</option>
                <option value="Concluído">Concluído</option>
                <option value="Entregue">Entregue</option>
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleFiltrar}
              disabled={loading || (tableMode === "molde" && draftRowFilter === "prod_maquina" && !draftMachineId)}
              className="px-4 py-2 bg-[#5D286C] text-white rounded-2xl text-xs font-black hover:bg-[#7B1470] transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin inline" size={16} /> : "FILTRAR"}
            </button>
            {tableMode !== "pedidos" && (
              <button
                type="button"
                onClick={exportExcel}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-2xl text-xs font-black hover:bg-emerald-700 transition-colors"
              >
                <Download size={16} /> Exportar Excel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards */}
      {tableMode === "molde" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MiniCard title="Total produzido (peças)" value={cards.totalProduzido} />
          <MiniCard title="Total defeito" value={cards.totalDefeito} />
          <MiniCard title="Média material / peça (kg)" value={cards.mediaMaterialPeca.toFixed(2)} />
          <MiniCard title="Média material / dia (kg)" value={cards.mediaMaterialDia.toFixed(2)} />
        </div>
      ) : tableMode === "kit" ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MiniCard title="Total kits produzidos" value={cards.totalKits} icon={<Package className="text-[#5D286C]" />} />
          <MiniCard title="Média material / kit (kg)" value={cards.mediaMaterialKit.toFixed(2)} />
          <MiniCard title="Média kits / dia" value={cards.mediaKitsDia.toFixed(2)} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MiniCard title="Total pedidos" value={cards.totalPedidos} icon={<ShoppingCart className="text-[#5D286C]" />} />
          <MiniCard title="Total kits nos pedidos" value={cards.totalKitsPedidos} icon={<Package className="text-[#5D286C]" />} />
          {/* Card do kit mais produzido — clicável */}
          <div
            className={`bg-white p-6 rounded-[2rem] shadow-sm border-2 flex items-center gap-4 transition-all ${
              topKit ? "border-[#5D286C] cursor-pointer hover:shadow-md" : "border-gray-100"
            }`}
            onClick={() => topKit && setKitRankOpen(true)}
            title={topKit ? "Clique para ver o ranking completo" : ""}
          >
            <div className="p-3 bg-amber-50 rounded-xl shrink-0">
              <Trophy className="text-amber-500" size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Kit mais pedido</p>
              {topKit ? (
                <>
                  <p className="text-base font-black text-[#262626] truncate">{topKit.nome}</p>
                  <p className="text-xs font-bold text-[#5D286C]">{topKit.total} unidades · Ver ranking →</p>
                </>
              ) : (
                <p className="text-xl font-black text-gray-300">—</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tableMode === "molde" && (
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1">
          Kg por kit (aba Kit): estimativa a partir da produção de moldes no mesmo período. Ajuste o período e clique em Filtrar.
        </p>
      )}

      {/* Tabela Molde/Kit */}
      {tableMode !== "pedidos" && (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden min-h-[200px] relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20 rounded-[2.5rem]">
              <Loader2 className="animate-spin text-[#5D286C]" size={40} />
            </div>
          )}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h2 className="text-lg font-black text-[#262626]">
              {tableMode === "molde" ? "Produção e defeito" : "Entradas de kit"}
            </h2>
            <button
              type="button"
              onClick={() => setSortDesc((v) => !v)}
              className="flex items-center gap-2 text-xs font-black text-[#5D286C] uppercase bg-purple-50 px-4 py-2 rounded-2xl hover:bg-purple-100"
            >
              Data {sortDesc ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 max-h-[min(70vh,720px)] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="text-left text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                  <th className="p-3">#</th>
                  <th className="p-3">Molde / Kit</th>
                  <th className="p-3">Máquina</th>
                  <th className="p-3">Material</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Qtd</th>
                  <th className="p-3">Kg</th>
                  <th className="p-3">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, i) => {
                  const green = row.kind === "producao" || row.kind === "kit";
                  return (
                    <tr
                      key={`${row.kind}-${row.sortKey}-${i}`}
                      className={`border-b border-gray-50 font-bold ${
                        green ? "bg-emerald-50/80 text-emerald-900" : "bg-red-50/80 text-red-900"
                      }`}
                    >
                      <td className="p-3">{i + 1}</td>
                      <td className="p-3">{row.molde}</td>
                      <td className="p-3">{row.maquina}</td>
                      <td className="p-3">{row.material}</td>
                      <td className="p-3 whitespace-nowrap">{formatDate(row.dataRaw)}</td>
                      <td className="p-3">{row.qtd}</td>
                      <td className="p-3">{row.kg > 0 ? row.kg.toFixed(2) : "—"}</td>
                      <td className="p-3 max-w-[200px]">{row.obs}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && sortedRows.length === 0 && (
              <p className="text-center text-gray-400 font-bold py-12">Nenhum registro. Ajuste filtros e clique em Filtrar.</p>
            )}
          </div>
        </div>
      )}

      {/* Tabela Pedidos */}
      {tableMode === "pedidos" && (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden min-h-[200px] relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20 rounded-[2.5rem]">
              <Loader2 className="animate-spin text-[#5D286C]" size={40} />
            </div>
          )}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h2 className="text-lg font-black text-[#262626]">Pedidos</h2>
            <button
              type="button"
              onClick={() => setSortDesc((v) => !v)}
              className="flex items-center gap-2 text-xs font-black text-[#5D286C] uppercase bg-purple-50 px-4 py-2 rounded-2xl hover:bg-purple-100"
            >
              Data {sortDesc ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 max-h-[min(70vh,720px)] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="text-left text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                  <th className="p-3">#</th>
                  <th className="p-3">Pedido</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Total Kits</th>
                  <th className="p-3">Data Criado</th>
                  <th className="p-3">Data Concluído</th>
                  <th className="p-3">Data Entregue</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrderRows.map((row, i) => {
                  const rowColor =
                    row.status === "Pendente" ? "bg-orange-50/80 text-orange-900" :
                    row.status === "Concluído" ? "bg-blue-50/80 text-blue-900" :
                    row.status === "Entregue" ? "bg-emerald-50/80 text-emerald-900" :
                    "bg-white";
                  const showConcluido = row.status === "Concluído" || row.status === "Entregue";
                  const showEntregue = row.status === "Entregue";
                  return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setExpandedOrderId(expandedOrderId === row.id ? null : row.id)}
                      className={`border-b border-gray-100 font-bold cursor-pointer transition-colors hover:brightness-95 ${rowColor}`}
                    >
                      <td className="p-3 opacity-60">{i + 1}</td>
                      <td className="p-3 font-black">{row.codigo_unico}</td>
                      <td className="p-3">{row.cliente}</td>
                      <td className="p-3">{row.totalKits}</td>
                      <td className="p-3 whitespace-nowrap">{row.created_at ? formatDate(row.created_at) : "—"}</td>
                      <td className="p-3 whitespace-nowrap">{showConcluido && row.concluido_em ? formatDate(row.concluido_em) : "—"}</td>
                      <td className="p-3 whitespace-nowrap">{showEntregue && row.entregue_em ? formatDate(row.entregue_em) : "—"}</td>
                      <td className="p-3">
                        <span className="text-[10px] font-black px-2 py-1 rounded-full bg-black/10 uppercase">{row.status}</span>
                      </td>
                    </tr>
                    {expandedOrderId === row.id && (
                      <tr key={`${row.id}-expand`}>
                        <td colSpan={8} className="px-4 pb-4 bg-white/60">
                          <div className="rounded-2xl border border-purple-100 p-4 space-y-2">
                            {row.order_items.map((item) => (
                              <div key={item.kit_id} className="flex justify-between text-sm font-bold">
                                <span className="text-[#262626]">{item.nome}</span>
                                <span className="text-[#5D286C]">{item.quantidade} un.</span>
                              </div>
                            ))}
                            {row.order_items.length === 0 && (
                              <p className="text-xs text-gray-400 font-bold">Nenhum item neste pedido.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
            {!loading && sortedOrderRows.length === 0 && (
              <p className="text-center text-gray-400 font-bold py-12">Nenhum pedido encontrado. Ajuste filtros e clique em Filtrar.</p>
            )}
          </div>
        </div>
      )}

      {/* Popup ranking de kits */}
      {kitRankOpen && (
        <div
          className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setKitRankOpen(false)}
        >
          <div
            className="bg-white w-full max-w-md p-6 rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setKitRankOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-black text-[#262626] mb-1 flex items-center gap-2">
              <Trophy className="text-amber-500" size={20} /> Ranking de Kits
            </h2>
            <p className="text-xs font-bold text-gray-400 uppercase mb-4">Total pedido no período filtrado</p>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {kitRanking.map((item, i) => (
                <div
                  key={item.kitId}
                  className={`flex items-center gap-3 p-3 rounded-2xl ${
                    i === 0 ? "bg-amber-50 border border-amber-200" : "bg-white border border-gray-100"
                  }`}
                >
                  <span className={`text-lg font-black w-8 text-center ${
                    i === 0 ? "text-amber-500" : "text-gray-300"
                  }`}>
                    {i + 1}
                  </span>
                  <span className="flex-1 font-bold text-[#262626] text-sm truncate">{item.nome}</span>
                  <span className="font-black text-[#5D286C] text-sm shrink-0">{item.total} un.</span>
                </div>
              ))}
              {kitRanking.length === 0 && (
                <p className="text-center text-gray-400 font-bold py-8">Nenhum kit no período.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniCard({ title, value, icon }: { title: string; value: string | number; icon?: ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center gap-4">
      {icon && <div className="p-3 bg-purple-50 rounded-xl shrink-0">{icon}</div>}
      <div>
        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-black text-[#262626]">{value}</p>
      </div>
    </div>
  );
}
