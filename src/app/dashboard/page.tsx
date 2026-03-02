"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend 
} from "recharts";
import { 
  Package, AlertTriangle, CheckCircle2, TrendingUp, 
  Clock, ArrowRight, Loader2, Filter, Activity
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStock: 0,
    productionToday: 0,
    defectsToday: 0,
    pendingOrders: 0
  });
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [productionHistory, setProductionHistory] = useState<any[]>([]);
  const [criticalOrders, setCriticalOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    // 1. Dados de Estoque (Kits)
    const { data: kits } = await supabase.from("kits").select("nome_kit, estoque_atual");
    
    // 2. Produção de Hoje (Baseado em movimentos de estoque 'IN')
    const { data: prodToday } = await supabase
      .from("stock_movements")
      .select("quantity")
      .eq("type", "IN")
      .gte("created_at", today);

    // 3. Defeitos de Hoje
    const { data: defToday } = await supabase
      .from("defects")
      .select("quantity")
      .gte("created_at", today);

    // 4. Pedidos e Cálculo de Risco
    // Aqui pegamos pedidos pendentes e seus itens para ver se o estoque cobre
    const { data: orders } = await supabase
      .from("orders")
      .select(`
        id, cliente, data_entrega,
        order_items (kit_id, quantity_required, kits (nome_kit, estoque_atual))
      `)
      .eq("status", "PENDENTE");

    // Lógica de Risco: Pedido com menor cobertura de estoque
    const processedOrders = orders?.map((order: any) => {
      let totalItems = 0;
      let availableItems = 0;
      order.order_items.forEach((item: any) => {
        totalItems += item.quantity_required;
        availableItems += Math.min(item.quantity_required, item.kits.estoque_atual);
      });
      const coverage = totalItems > 0 ? (availableItems / totalItems) * 100 : 100;
      return { ...order, coverage };
    }).sort((a: any, b: any) => a.coverage - b.coverage) || [];

    setStats({
      totalStock: kits?.reduce((acc, curr) => acc + curr.estoque_atual, 0) || 0,
      productionToday: prodToday?.reduce((acc, curr) => acc + curr.quantity, 0) || 0,
      defectsToday: defToday?.reduce((acc, curr) => acc + curr.quantity, 0) || 0,
      pendingOrders: orders?.length || 0
    });

    setInventoryData(kits || []);
    setCriticalOrders(processedOrders.slice(0, 5)); // Top 5 pedidos em risco
    setLoading(false);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-[#5D286C]" size={48} />
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-[#262626] tracking-tight">Visão <span className="text-[#5D286C]">Macro</span></h1>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.3em]">Operação Reauto Intelligence</p>
        </div>
        <button onClick={fetchDashboardData} className="bg-white border-2 border-gray-100 p-4 rounded-2xl font-black text-xs hover:border-[#5D286C] transition-all flex items-center gap-2">
          <Activity size={16} /> ATUALIZAR REAL-TIME
        </button>
      </div>

      {/* Cards de KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Estoque Total" value={stats.totalStock} icon={<Package />} color="text-blue-600" />
        <StatCard title="Produção Hoje" value={stats.productionToday} icon={<TrendingUp />} color="text-green-600" />
        <StatCard title="Defeitos Hoje" value={stats.defectsToday} icon={<AlertTriangle />} color="text-red-600" />
        <StatCard title="Pedidos Pendentes" value={stats.pendingOrders} icon={<Clock />} color="text-purple-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico de Estoque por Kit */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
          <h3 className="text-xl font-black text-[#262626] mb-8 flex items-center gap-2">
            <Package className="text-[#5D286C]" /> Nível de Kits em Prateleira
          </h3>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="nome_kit" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f8f4ff'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="estoque_atual" fill="#5D286C" radius={[10, 10, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ALERTA DE RISCO: Pedidos com pouco estoque */}
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
          <h3 className="text-xl font-black text-[#262626] mb-6 flex items-center gap-2 text-red-500">
            <AlertTriangle /> Prioridade de Risco
          </h3>
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