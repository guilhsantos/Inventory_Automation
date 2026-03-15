"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, Package, Clock, Volume2, TrendingUp, ChevronRight } from "lucide-react";
import Link from "next/link";

type OperatorOrder = {
  id: number;
  codigo_unico: string;
  cliente: string;
  data_entrega: string | null;
  is_priority: boolean;
  priority_position: number | null;
  order_items: { 
    quantidade: number;
    kit_id: number;
    kits: {
      nome_kit: string;
      codigo_unico: string;
      estoque_atual: number;
    } | null;
  }[];
  stockPercentage?: number;
};

export default function OperatorDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OperatorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Aguardar autenticação antes de buscar dados
    if (authLoading) return;
    
    if (!user) {
      router.push("/login");
      return;
    }

    fetchOrders();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let interval: NodeJS.Timeout | null = null;

    try {
      channel = supabase
        .channel("operator-orders")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          (payload) => {
            const newRecord = payload.new as { status?: string; is_priority?: boolean } | null;
            const oldRecord = payload.old as { is_priority?: boolean } | null;
            
            if (newRecord?.status === "Pendente") {
              playNotification();
              fetchOrders();
            }
            if (oldRecord && newRecord && oldRecord.is_priority !== newRecord.is_priority) {
              playNotification();
              fetchOrders();
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("Realtime subscribed");
          } else if (status === "CHANNEL_ERROR") {
            console.error("Realtime channel error");
          }
        });

      interval = setInterval(fetchOrders, 30000);
    } catch (err) {
      console.error("Error setting up realtime:", err);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [user, authLoading, router]);

  const playNotification = () => {
    try {
      const audio = new Audio("/success.mp3");
      audio.play().catch(() => {
        // Ignorar erros de áudio
      });
    } catch {
      // Ignorar erros
    }
  };

  async function fetchOrders() {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: queryError } = await supabase
        .from("orders")
        .select("id, codigo_unico, cliente, data_entrega, is_priority, priority_position, order_items(quantidade, kit_id, kits(nome_kit, codigo_unico, estoque_atual))")
        .eq("status", "Pendente")
        .order("is_priority", { ascending: false })
        .order("priority_position", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true });

      if (queryError) {
        console.error("Error fetching orders:", queryError);
        setError(queryError.message);
        setOrders([]);
        setLoading(false);
        return;
      }

      if (data) {
        // Calcular porcentagem de estoque para cada pedido
        const ordersWithStock = data.map((order: any) => {
          let totalNeeded = 0;
          let totalAvailable = 0;
          
          order.order_items?.forEach((item: any) => {
            const needed = item.quantidade || 0;
            const available = item.kits?.estoque_atual || 0;
            totalNeeded += needed;
            totalAvailable += Math.min(needed, available);
          });
          
          const stockPercentage = totalNeeded > 0 ? Math.round((totalAvailable / totalNeeded) * 100) : 100;
          
          return { ...order, stockPercentage };
        });
        
        setOrders(ordersWithStock as OperatorOrder[]);
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      console.error("Unexpected error:", err);
      setError(err?.message || "Erro ao carregar pedidos");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  // Aguardar autenticação
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-[#5D286C]" size={48} />
      </div>
    );
  }

  // Mostrar loading enquanto busca dados
  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-[#5D286C]" size={48} />
      </div>
    );
  }

  // Mostrar erro se houver
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <AlertTriangle className="mx-auto text-red-500" size={48} />
          <p className="text-lg font-bold text-red-600">{error}</p>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-[#5D286C] text-white rounded-lg font-bold"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const currentOrder = orders.find(o => o.is_priority) || orders[0];
  const queueOrders = orders.filter(o => o.id !== currentOrder?.id);

  const totalKits = (order: OperatorOrder) => order.order_items?.reduce((acc, i) => acc + (i.quantidade || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
              <AlertTriangle className="text-yellow-300" /> Fila de Produção
            </h1>
            <p className="text-xs md:text-sm text-gray-400 font-bold uppercase tracking-[0.3em] mt-1">
              Pedidos pendentes organizados por prioridade
            </p>
          </div>
          <button
            onClick={fetchOrders}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10"
          >
            <Clock size={14} /> Atualizar
          </button>
        </header>

        {/* Pedido Atual (Grande) */}
        {currentOrder && (
          <div className={`relative p-8 md:p-10 rounded-[3rem] border-2 ${
            currentOrder.is_priority 
              ? "border-red-400 bg-gradient-to-br from-red-950/60 to-red-900/40" 
              : "border-white/20 bg-white/5"
          } shadow-2xl`}>
            {currentOrder.is_priority && (
              <div className="absolute -top-4 left-8 flex items-center gap-1 text-xs font-black uppercase text-red-200">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white shadow-lg">
                  <Volume2 size={14} /> PEDIDO PRIORITÁRIO
                </span>
              </div>
            )}
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Informações Principais */}
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Pedido</p>
                  <Link href={`/orders/${currentOrder.id}`}>
                    <h2 className="text-4xl md:text-5xl font-black hover:underline">
                      {currentOrder.codigo_unico}
                    </h2>
                  </Link>
                </div>
                
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Cliente</p>
                  <p className="text-2xl font-black">{currentOrder.cliente}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-1">Entrega</p>
                    <p className="text-lg font-bold">
                      {currentOrder.data_entrega
                        ? new Date(currentOrder.data_entrega).toLocaleDateString('pt-BR')
                        : "Sem data"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-1">Total Kits</p>
                    <p className="text-lg font-black text-yellow-300">{totalKits(currentOrder)} kits</p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-gray-400 uppercase">Estoque Disponível</span>
                    <span className={`text-xl font-black ${
                      currentOrder.stockPercentage! >= 80 ? 'text-green-400' : 
                      currentOrder.stockPercentage! >= 50 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {currentOrder.stockPercentage || 0}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        currentOrder.stockPercentage! >= 80 ? 'bg-green-500' : 
                        currentOrder.stockPercentage! >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${currentOrder.stockPercentage || 0}%` }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Detalhes dos Kits */}
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-4">Kits do Pedido</p>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {currentOrder.order_items && currentOrder.order_items.length > 0 ? (
                    currentOrder.order_items.map((item, idx) => (
                      <div 
                        key={idx}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-gray-300 truncate">
                              {item.kits?.nome_kit || `Kit #${item.kit_id}`}
                            </p>
                            <p className="text-xs font-bold text-gray-500 uppercase">
                              {item.kits?.codigo_unico || 'N/A'}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-lg font-black text-yellow-300">{item.quantidade || 0}</p>
                            <p className="text-[10px] font-bold text-gray-500 uppercase">unidades</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-white/5">
                          <p className="text-[10px] font-bold text-gray-500">
                            Estoque: <span className={item.kits && item.kits.estoque_atual >= item.quantidade ? 'text-green-400' : 'text-red-400'}>
                              {item.kits?.estoque_atual || 0} disponíveis
                            </span>
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm font-bold text-gray-500 text-center py-4">
                      Nenhum kit cadastrado neste pedido
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fila de Pedidos (Horizontal) */}
        {queueOrders.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-gray-400 uppercase tracking-[0.3em]">
              Próximos Pedidos
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {queueOrders.map((order) => (
                <div
                  key={order.id}
                  className={`relative flex-shrink-0 w-80 p-5 rounded-3xl border ${
                    order.is_priority 
                      ? "border-red-400 bg-red-950/40" 
                      : "border-white/10 bg-white/5"
                  } shadow-lg hover:scale-105 transition-transform cursor-pointer`}
                  onClick={() => window.location.href = `/orders/${order.id}`}
                >
                  {order.is_priority && (
                    <div className="absolute -top-2 left-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase">
                        <Volume2 size={10} /> Prioridade
                      </span>
                    </div>
                  )}
                  
                  <div className="mb-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mb-1">
                      Pedido
                    </p>
                    <p className="text-xl font-black truncate">{order.codigo_unico}</p>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Cliente</p>
                    <p className="text-sm font-bold truncate">{order.cliente}</p>
                  </div>
                  
                  <div className="space-y-2 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-300">
                      <span className="inline-flex items-center gap-1">
                        <Package size={12} /> {totalKits(order)} kits
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Estoque</span>
                        <span className={`text-xs font-black ${
                          order.stockPercentage! >= 80 ? 'text-green-400' : 
                          order.stockPercentage! >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {order.stockPercentage || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            order.stockPercentage! >= 80 ? 'bg-green-500' : 
                            order.stockPercentage! >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${order.stockPercentage || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {orders.length === 0 && (
          <div className="text-center py-20">
            <p className="text-lg font-bold text-gray-400">
              Nenhum pedido pendente na fila.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


