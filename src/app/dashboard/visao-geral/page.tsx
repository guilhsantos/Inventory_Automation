"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import {
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Activity,
  ArrowRight,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { brDayRangeIso, formatDayKeyBrFromTimestamp, todayYmdBr, ymdAddDaysBr } from "@/lib/date-utils";
import { useStuckLoadingRecovery } from "@/lib/use-stuck-loading-recovery";

const BarChart = dynamic(() => import("recharts").then((mod) => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), {
  ssr: false,
});
const Legend = dynamic(() => import("recharts").then((mod) => mod.Legend), { ssr: false });
const LabelList = dynamic(() => import("recharts").then((mod) => mod.LabelList), { ssr: false });

type DayAgg = { criados: number; concluidos: number; entregues: number };

function bump(map: Map<string, DayAgg>, dayKey: string, key: keyof DayAgg) {
  if (!dayKey) return;
  if (!map.has(dayKey)) map.set(dayKey, { criados: 0, concluidos: 0, entregues: 0 });
  map.get(dayKey)![key] += 1;
}

function sortChartDays(rows: { name: string }[]) {
  rows.sort((a, b) => {
    const parse = (s: string) => {
      const [day, month] = s.split("/").map(Number);
      return month * 100 + day;
    };
    return parse(a.name) - parse(b.name);
  });
}

export default function VisaoGeralPage() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => ymdAddDaysBr(todayYmdBr(), -7));
  const [endDate, setEndDate] = useState(todayYmdBr);
  const [stats, setStats] = useState({
    totalOrders: 0,
    deliveredOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
  });
  const [ordersChartData, setOrdersChartData] = useState<any[]>([]);
  const [criticalOrders, setCriticalOrders] = useState<any[]>([]);
  const [seriesVisible, setSeriesVisible] = useState({
    criados: true,
    concluidos: true,
    entregues: true,
  });

  useStuckLoadingRecovery(loading);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    setLoading(true);

    try {
      const [allOrdersRes, deliveredRes, completedRes, pendingRes] = await Promise.all([
        supabase.from("orders").select("id"),
        supabase.from("orders").select("id").eq("status", "Entregue"),
        supabase.from("orders").select("id").eq("status", "Concluído"),
        supabase
          .from("orders")
          .select(
            `
          id, cliente, data_entrega, is_priority, priority_position,
          order_items (kit_id, quantidade, kits (nome_kit, estoque_atual))
        `
          )
          .eq("status", "Pendente"),
      ]);

      const { startIso, endIso } = brDayRangeIso(startDate, endDate);

      const [criadosRes, conclRes, entRes] = await Promise.all([
        supabase.from("orders").select("created_at").gte("created_at", startIso).lte("created_at", endIso),
        supabase
          .from("orders")
          .select("concluido_em")
          .not("concluido_em", "is", null)
          .gte("concluido_em", startIso)
          .lte("concluido_em", endIso),
        supabase
          .from("orders")
          .select("entregue_em")
          .not("entregue_em", "is", null)
          .gte("entregue_em", startIso)
          .lte("entregue_em", endIso),
      ]);

      const byDay = new Map<string, DayAgg>();

      criadosRes.data?.forEach((row: any) => {
        const k = formatDayKeyBrFromTimestamp(row.created_at);
        bump(byDay, k, "criados");
      });
      conclRes.data?.forEach((row: any) => {
        const k = formatDayKeyBrFromTimestamp(row.concluido_em);
        bump(byDay, k, "concluidos");
      });
      entRes.data?.forEach((row: any) => {
        const k = formatDayKeyBrFromTimestamp(row.entregue_em);
        bump(byDay, k, "entregues");
      });

      const chartData = Array.from(byDay.entries()).map(([name, v]) => ({
        name,
        criados: v.criados,
        concluidos: v.concluidos,
        entregues: v.entregues,
      }));
      sortChartDays(chartData);

      const processedOrders =
        pendingRes.data
          ?.map((order: any) => {
            let totalItems = 0;
            let availableItems = 0;
            order.order_items?.forEach((item: any) => {
              totalItems += item.quantidade || 0;
              availableItems += Math.min(item.quantidade || 0, item.kits?.estoque_atual || 0);
            });
            const coverage = totalItems > 0 ? (availableItems / totalItems) * 100 : 100;
            return { ...order, coverage };
          })
          .sort((a: any, b: any) => {
            if (a.is_priority && !b.is_priority) return -1;
            if (!a.is_priority && b.is_priority) return 1;
            if (a.is_priority && b.is_priority) {
              const posA = a.priority_position ?? 9999;
              const posB = b.priority_position ?? 9999;
              if (posA !== posB) return posA - posB;
            }
            return a.coverage - b.coverage;
          }) || [];

      setStats({
        totalOrders: allOrdersRes.data?.length || 0,
        deliveredOrders: deliveredRes.data?.length || 0,
        completedOrders: completedRes.data?.length || 0,
        pendingOrders: pendingRes.data?.length || 0,
      });

      setOrdersChartData(chartData);
      setCriticalOrders(processedOrders);

      if (criadosRes.error || conclRes.error || entRes.error) {
        console.warn("Gráfico: verifique colunas concluido_em / entregue_em e migration SQL.", {
          criadosRes,
          conclRes,
          entRes,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  function toggleSeries(key: keyof typeof seriesVisible) {
    setSeriesVisible((s) => ({ ...s, [key]: !s[key] }));
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
          <h1 className="text-4xl font-black text-[#262626] tracking-tight">Visão Geral</h1>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.3em]">
            Operação ReautoCar Intelligence
          </p>
        </div>
        <button
          onClick={fetchData}
          className="bg-white border-2 border-gray-100 p-4 rounded-2xl font-black text-xs hover:border-[#5D286C] transition-all flex items-center gap-2"
        >
          <Activity size={16} /> ATUALIZAR
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Pedidos" value={stats.totalOrders} icon={<ShoppingCart />} color="text-blue-600" />
        <StatCard title="Entregues" value={stats.deliveredOrders} icon={<CheckCircle2 />} color="text-green-600" />
        <StatCard title="Concluídos" value={stats.completedOrders} icon={<CheckCircle2 />} color="text-emerald-600" />
        <StatCard title="Pendentes" value={stats.pendingOrders} icon={<Clock />} color="text-purple-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] gap-6 items-start">
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 min-w-0">
          <div className="flex flex-col gap-4 mb-6">
            <h2 className="text-xl font-black text-[#262626]">Pedidos por dia</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase">
              Criados = novos pedidos no dia · Concluídos / Entregues = quando foram marcados (concluido_em / entregue_em)
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-gray-400" />
                  <label className="text-xs font-black text-gray-400 uppercase whitespace-nowrap">Inicial</label>
                  <input
                    type="date"
                    lang="pt-BR"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    max={endDate}
                    className="px-3 py-2 rounded-2xl border-2 border-gray-100 focus:border-[#5D286C] outline-none font-bold text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-gray-400" />
                  <label className="text-xs font-black text-gray-400 uppercase whitespace-nowrap">Final</label>
                  <input
                    type="date"
                    lang="pt-BR"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    max={todayYmdBr()}
                    className="px-3 py-2 rounded-2xl border-2 border-gray-100 focus:border-[#5D286C] outline-none font-bold text-sm"
                  />
                </div>
              </div>
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-[#5D286C] text-white rounded-2xl text-xs font-black hover:bg-[#7B1470] transition-colors"
              >
                FILTRAR
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "criados" as const, label: "Criados", color: "bg-amber-100 text-amber-800 border-amber-200" },
                  { key: "concluidos" as const, label: "Concluídos", color: "bg-blue-100 text-blue-800 border-blue-200" },
                  { key: "entregues" as const, label: "Entregues", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
                ] as const
              ).map(({ key, label, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleSeries(key)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border-2 transition-opacity ${
                    color
                  } ${seriesVisible[key] ? "opacity-100" : "opacity-40 grayscale"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[400px] w-full min-h-[320px] min-w-0 overflow-hidden">
            {ordersChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={ordersChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: "bold" }}
                  />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "#f8f4ff" }}
                    contentStyle={{
                      borderRadius: "20px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend />
                  {seriesVisible.criados && (
                    <Bar dataKey="criados" stackId="a" fill="#f59e0b" name="Criados">
                      <LabelList
                        dataKey="criados"
                        position="center"
                        fill="#fff"
                        fontSize={10}
                        fontWeight={800}
                        formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")}
                      />
                    </Bar>
                  )}
                  {seriesVisible.concluidos && (
                    <Bar dataKey="concluidos" stackId="a" fill="#3b82f6" name="Concluídos">
                      <LabelList
                        dataKey="concluidos"
                        position="center"
                        fill="#fff"
                        fontSize={10}
                        fontWeight={800}
                        formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")}
                      />
                    </Bar>
                  )}
                  {seriesVisible.entregues && (
                    <Bar dataKey="entregues" stackId="a" fill="#10b981" name="Entregues" radius={[6, 6, 0, 0]}>
                      <LabelList
                        dataKey="entregues"
                        position="center"
                        fill="#fff"
                        fontSize={10}
                        fontWeight={800}
                        formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")}
                      />
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 font-bold text-center px-4">
                Nenhum dado no período. Rode a migration SQL (concluido_em / entregue_em) se o gráfico falhar.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col max-h-[min(640px,calc(100vh-8rem))] lg:sticky lg:top-24 w-full">
          <h2 className="text-lg font-black text-[#262626] mb-2 flex items-center gap-2 text-red-500 shrink-0">
            <AlertTriangle /> Pedidos em Risco
          </h2>
          <p className="text-gray-400 text-[10px] font-bold uppercase mb-4 shrink-0">
            Pedidos com maior risco de atraso por falta de kit
          </p>
          <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-0">
            {criticalOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-red-200 transition-all shrink-0"
              >
                <div className="flex justify-between items-start mb-2 gap-2">
                  <span className="font-black text-[#262626] text-xs uppercase truncate">{order.cliente}</span>
                  <span
                    className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${
                      order.coverage < 50 ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                    }`}
                  >
                    {Math.round(order.coverage)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      order.coverage < 50 ? "bg-red-500" : "bg-orange-500"
                    }`}
                    style={{ width: `${order.coverage}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase">
                  <span>#{order.id}</span>
                  <Link
                    href={`/orders/${order.id}?returnStatus=Pendente`}
                    className="flex items-center gap-1 text-[#5D286C] hover:underline"
                  >
                    Detalhes <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
            {criticalOrders.length === 0 && (
              <p className="text-center text-gray-400 font-bold py-10">Nenhum pedido em risco no momento.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center gap-6">
      <div className={`p-4 rounded-2xl bg-gray-50 ${color}`}>{icon}</div>
      <div>
        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{title}</p>
        <p className="text-3xl font-black text-[#262626]">{value}</p>
      </div>
    </div>
  );
}
