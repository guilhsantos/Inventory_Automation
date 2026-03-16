"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import { 
  TrendingUp, Loader2, Activity, Calendar, AlertTriangle, Package
} from "lucide-react";

// Lazy load do Recharts
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });

// Cores para as barras
const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

export default function PerformancePage() {
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const [startDate, setStartDate] = useState(sevenDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [typeFilter, setTypeFilter] = useState<"molde" | "maquina">("maquina");
  const [productionData, setProductionData] = useState<any[]>([]);
  const [uniqueItems, setUniqueItems] = useState<string[]>([]);
  const [defectsMachineData, setDefectsMachineData] = useState<any[]>([]);
  const [materialMachineData, setMaterialMachineData] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, typeFilter]);

  async function fetchData() {
    setLoading(true);
    
    try {
      const startDateTime = new Date(startDate);
      startDateTime.setHours(0, 0, 0, 0);
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);

      // Buscar dados de produção
      const { data: productionData } = await supabase
        .from("daily_production")
        .select("machine_id, molde_id, quantidade_boa, sacos_usados, created_at, machines(nome), moldes(nome)")
        .gte("created_at", startDateTime.toISOString())
        .lte("created_at", endDateTime.toISOString());

      // Buscar dados de defeitos
      const { data: defectsData } = await supabase
        .from("defects")
        .select("machine_id, quantity, created_at, machines(nome)")
        .gte("created_at", startDateTime.toISOString())
        .lte("created_at", endDateTime.toISOString());

      // Processar dados de produção agrupados por dia e por máquina/molde
      const dailyMap = new Map<string, Map<string, number>>();
      const itemsSet = new Set<string>();

      productionData?.forEach((item: any) => {
        const date = new Date(item.created_at);
        const dateKey = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const itemName = typeFilter === "molde" 
          ? (item.moldes?.nome || 'Sem molde')
          : (item.machines?.nome || 'Sem máquina');
        
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, new Map());
        }
        
        const dayMap = dailyMap.get(dateKey)!;
        dayMap.set(itemName, (dayMap.get(itemName) || 0) + (item.quantidade_boa || 0));
        itemsSet.add(itemName);
      });

      // Criar array de itens únicos ordenados
      const sortedItems = Array.from(itemsSet).sort();
      setUniqueItems(sortedItems);

      // Criar estrutura de dados para o gráfico de produção
      const chartData = Array.from(dailyMap.entries())
        .map(([data, itemsMap]) => {
          const entry: any = { data };
          sortedItems.forEach(item => {
            entry[item] = itemsMap.get(item) || 0;
          });
          return entry;
        })
        .sort((a, b) => {
          const [dayA, monthA] = a.data.split('/').map(Number);
          const [dayB, monthB] = b.data.split('/').map(Number);
          if (monthA !== monthB) return monthA - monthB;
          return dayA - dayB;
        });

      setProductionData(chartData);

      // Processar Defeito por Máquina
      const machineDefMap = new Map();
      defectsData?.forEach((item: any) => {
        if (item.machine_id && item.machines?.nome) {
          const nome = item.machines.nome;
          machineDefMap.set(nome, (machineDefMap.get(nome) || 0) + (item.quantity || 0));
        }
      });
      setDefectsMachineData(
        Array.from(machineDefMap.entries()).map(([nome, defeitos]) => ({ nome, defeitos }))
      );

      // Processar Gasto de Material por Máquina
      const machineMatMap = new Map();
      productionData?.forEach((item: any) => {
        if (item.machine_id && item.machines?.nome) {
          const nome = item.machines.nome;
          machineMatMap.set(nome, (machineMatMap.get(nome) || 0) + (item.sacos_usados || 0));
        }
      });
      setMaterialMachineData(
        Array.from(machineMatMap.entries()).map(([nome, gasto]) => ({ nome, gasto }))
      );
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
          <h1 className="text-4xl font-black text-[#262626] tracking-tight">Performance</h1>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.3em]">Métricas de Produção, Defeitos e Material</p>
        </div>
        <button 
          onClick={fetchData} 
          className="bg-white border-2 border-gray-100 p-4 rounded-2xl font-black text-xs hover:border-[#5D286C] transition-all flex items-center gap-2"
        >
          <Activity size={16} /> ATUALIZAR
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Período</label>
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
                  className="px-3 py-2 rounded-2xl border-2 border-gray-100 focus:border-[#5D286C] outline-none font-bold text-sm flex-1"
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
                  className="px-3 py-2 rounded-2xl border-2 border-gray-100 focus:border-[#5D286C] outline-none font-bold text-sm flex-1"
                />
              </div>
            </div>
          </div>
          <div className="flex-1">
            <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Agrupar por</label>
            <div className="flex gap-2 rounded-2xl bg-gray-100 p-1 text-xs font-black uppercase">
              {["molde", "maquina"].map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type as any)}
                  className={`px-3 py-2 rounded-2xl transition-all flex-1 ${
                    typeFilter === type
                      ? "bg-white text-[#5D286C] shadow-sm"
                      : "text-gray-400"
                  }`}
                >
                  {type === "molde" ? "Molde" : "Máquina"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Produção por Dia */}
        <div className="lg:col-span-3 bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-[#262626] mb-4 flex items-center gap-2">
            <TrendingUp className="text-green-600" size={20} /> 
            Produção por Dia {typeFilter === "molde" ? "(por Molde)" : "(por Máquina)"}
          </h3>
          <div className="h-[500px] w-full">
            {productionData.length > 0 && uniqueItems.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f8f4ff'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                  <Legend />
                  {uniqueItems.map((item, index) => (
                    <Bar 
                      key={item} 
                      dataKey={item} 
                      stackId="production"
                      fill={COLORS[index % COLORS.length]} 
                      radius={index === uniqueItems.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 font-bold">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>

        {/* Defeito por Máquina */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-[#262626] mb-4 flex items-center gap-2">
            <AlertTriangle className="text-red-600" size={20} /> Defeito por Máquina
          </h3>
          <div className="h-[300px] w-full">
            {defectsMachineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={defectsMachineData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} angle={-45} textAnchor="end" height={80} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f8f4ff'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="defeitos" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 font-bold text-sm">
                Nenhum dado
              </div>
            )}
          </div>
        </div>

        {/* Gasto de Material por Máquina */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-[#262626] mb-4 flex items-center gap-2">
            <Package className="text-orange-600" size={20} /> Gasto de Material por Máquina
          </h3>
          <div className="h-[300px] w-full">
            {materialMachineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={materialMachineData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} angle={-45} textAnchor="end" height={80} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f8f4ff'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="gasto" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 font-bold text-sm">
                Nenhum dado
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
