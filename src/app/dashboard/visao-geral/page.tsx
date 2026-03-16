"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import { 
  ShoppingCart, AlertTriangle, CheckCircle2, Clock, 
  Loader2, Activity, ArrowRight, Calendar
} from "lucide-react";
import Link from "next/link";

// Lazy load do Recharts
const LineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });

export default function VisaoGeralPage() {
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const [startDate, setStartDate] = useState(sevenDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    deliveredOrders: 0,
    completedOrders: 0,
    pendingOrders: 0
  });
  const [ordersChartData, setOrdersChartData] = useState<any[]>([]);
  const [criticalOrders, setCriticalOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  async function fetchData() {
    setLoading(true);
    
    try {
      // 1. KPIs de Pedidos
      const [allOrdersRes, deliveredRes, completedRes, pendingRes] = await Promise.all([
        supabase.from("orders").select("id"),
        supabase.from("orders").select("id").eq("status", "Entregue"),
        supabase.from("orders").select("id").eq("status", "Concluído"),
        supabase.from("orders").select(`
          id, cliente, data_entrega,
          order_items (kit_id, quantidade, kits (nome_kit, estoque_atual))
        `).eq("status", "Pendente")
      ]);

      // 2. Dados para gráfico de pedidos
      const startDateTime = new Date(startDate);
      startDateTime.setHours(0, 0, 0, 0);
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);

      const { data: ordersHistory } = await supabase
        .from("orders")
        .select("created_at, status")
        .gte("created_at", startDateTime.toISOString())
        .lte("created_at", endDateTime.toISOString())
        .order("created_at", { ascending: true });

      // Processar dados do gráfico (agrupar por dia)
      const chartDataMap = new Map<string, { total: number; entregues: number; concluidos: number; pendentes: number }>();
      
      ordersHistory?.forEach((order: any) => {
        const date = new Date(order.created_at);
        const key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        
        if (!chartDataMap.has(key)) {
          chartDataMap.set(key, { total: 0, entregues: 0, concluidos: 0, pendentes: 0 });
        }
        
        const data = chartDataMap.get(key)!;
        data.total += 1;
        if (order.status === "Entregue") data.entregues += 1;
        else if (order.status === "Concluído") data.concluidos += 1;
        else if (order.status === "Pendente") data.pendentes += 1;
      });

      const chartData = Array.from(chartDataMap.entries()).map(([name, values]) => ({
        name,
        ...values
      }));

      // 3. Pedidos em risco
      const processedOrders = pendingRes.data?.map((order: any) => {
        let totalItems = 0;
        let availableItems = 0;
        order.order_items?.forEach((item: any) => {
          totalItems += item.quantidade || 0;
          availableItems += Math.min(item.quantidade || 0, item.kits?.estoque_atual || 0);
        });
        const coverage = totalItems > 0 ? (availableItems / totalItems) * 100 : 100;
        return { ...order, coverage };
      }).sort((a: any, b: any) => a.coverage - b.coverage) || [];

      setStats({
        totalOrders: allOrdersRes.data?.length || 0,
        deliveredOrders: deliveredRes.data?.length || 0,
        completedOrders: completedRes.data?.length || 0,
        pendingOrders: pendingRes.data?.length || 0
      });

      setOrdersChartData(chartData);
      setCriticalOrders(processedOrders.slice(0, 10));
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
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
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-[#262626] tracking-tight">Visão Geral</h1>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.3em]">Operação Reauto Intelligence</p>
        </div>
        <button 
          onClick={fetchData} 
          className="bg-white border-2 border-gray-100 p-4 rounded-2xl font-black text-xs hover:border-[#5D286C] transition-all flex items-center gap-2"
        >
          <Activity size={16} /> ATUALIZAR
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Pedidos" value={stats.totalOrders} icon={<ShoppingCart />} color="text-blue-600" />
        <StatCard title="Entregues" value={stats.deliveredOrders} icon={<CheckCircle2 />} color="text-green-600" />
        <StatCard title="Concluídos" value={stats.completedOrders} icon={<CheckCircle2 />} color="text-emerald-600" />
        <StatCard title="Pendentes" value={stats.pendingOrders} icon={<Clock />} color="text-purple-600" />
      </div>

      {/* Filtro de Período e Gráfico */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-xl font-black text-[#262626]">Gráfico de Pedidos</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <label className="text-xs font-black text-gray-400 uppercase">Data Inicial</label>
              <input
                type="date"
                lang="pt-BR"
                value={startDate}
                onChange={(e) => {
                  if (e.target.value <= endDate) {
                    setStartDate(e.target.value);
                  }
                }}
                max={endDate}
                className="px-3 py-2 rounded-2xl border-2 border-gray-100 focus:border-[#5D286C] outline-none font-bold text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <label className="text-xs font-black text-gray-400 uppercase">Data Final</label>
              <input
                type="date"
                lang="pt-BR"
                value={endDate}
                onChange={(e) => {
                  if (e.target.value >= startDate) {
                    setEndDate(e.target.value);
                  }
                }}
                min={startDate}
                max={today.toISOString().split('T')[0]}
                className="px-3 py-2 rounded-2xl border-2 border-gray-100 focus:border-[#5D286C] outline-none font-bold text-sm"
              />
            </div>
          </div>
        </div>
        <div className="h-[400px] w-full">
          {ordersChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ordersChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f8f4ff'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#5D286C" strokeWidth={3} name="Total" />
                <Line type="monotone" dataKey="entregues" stroke="#10b981" strokeWidth={2} name="Entregues" />
                <Line type="monotone" dataKey="concluidos" stroke="#3b82f6" strokeWidth={2} name="Concluídos" />
                <Line type="monotone" dataKey="pendentes" stroke="#f59e0b" strokeWidth={2} name="Pendentes" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 font-bold">
              Nenhum dado disponível para o período selecionado
            </div>
          )}
        </div>
      </div>

      {/* Pedidos em Risco */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
        <h2 className="text-xl font-black text-[#262626] mb-6 flex items-center gap-2 text-red-500">
          <AlertTriangle /> Pedidos em Risco
        </h2>
        <p className="text-gray-400 text-xs font-bold uppercase mb-6">Pedidos com maior risco de atraso por falta de kit</p>
        
        <div className="space-y-4">
          {criticalOrders.map((order) => (
            <div key={order.id} className="p-5 bg-gray-50 rounded-3xl border border-gray-100 group hover:border-red-200 transition-all">
              <div className="flex justify-between items-start mb-2">
                <span className="font-black text-[#262626] text-sm uppercase">{order.cliente}</span>
                <span className={`text-[10px] font-black px-3 py-1 rounded-full ${order.coverage < 50 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                  {Math.round(order.coverage)}% COBERTO
                </span>
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${order.coverage < 50 ? 'bg-red-500' : 'bg-orange-500'}`} 
                  style={{ width: `${order.coverage}%` }}
                />
              </div>
              <div className="mt-3 flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase">
                <span>ID: #{order.id}</span>
                <Link href={`/orders/${order.id}`} className="flex items-center gap-1 text-[#5D286C] hover:underline">
                  Ver Detalhes <ArrowRight size={12} />
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

