"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { ShoppingCart, CheckCircle, Clock, Package, Search, Loader2 } from "lucide-react";

export default function OrdersListPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(quantidade, kit_id, kits(nome_kit, estoque_atual))")
      .order("created_at", { ascending: false });

    if (!error) setOrders(data);
    setLoading(false);
  }

  const handleDeliverOrder = async (order: any) => {
    if (order.status === 'Entregue') return;
    if (!confirm(`Confirmar entrega do pedido ${order.codigo_unico}? Isso descontará o estoque.`)) return;

    try {
      // 1. Atualizar Status do Pedido
      const { error: statusErr } = await supabase
        .from("orders")
        .update({ status: 'Entregue' })
        .eq("id", order.id);

      if (statusErr) throw statusErr;

      // 2. Subtrair Estoque para cada item
      for (const item of order.order_items) {
        const novoEstoque = item.kits.estoque_atual - item.quantidade;
        
        // Atualiza Kit
        await supabase
          .from("kits")
          .update({ estoque_atual: novoEstoque })
          .eq("id", item.kit_id);

        // Gera Movimentação de Saída
        await supabase.from("movimentacoes").insert({
          kit_id: item.kit_id,
          usuario_id: user?.id,
          tipo: 'SAIDA',
          quantidade: item.quantidade,
          observacao: `Saída via pedido ${order.codigo_unico}`
        });
      }

      showToast("Pedido entregue e estoque atualizado!");
      fetchOrders();
    } catch (err: any) {
      showToast("Erro ao processar entrega: " + err.message, "error");
    }
  };

  const filteredOrders = orders.filter(o => 
    o.cliente.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.codigo_unico.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <Loader2 className="animate-spin mx-auto mt-20" size={40} />;

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-black text-[#262626] flex items-center gap-3">
          <ShoppingCart className="text-[#5D286C]" /> Lista de Pedidos
        </h1>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
          <input 
            type="text" 
            placeholder="Buscar pedido ou cliente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full p-4 pl-12 bg-white border-2 border-gray-50 rounded-2xl font-bold outline-none focus:border-[#5D286C] shadow-sm"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredOrders.map(order => (
          <div key={order.id} className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-[#5D286C] text-lg">{order.codigo_unico}</span>
                <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                  order.status === 'Entregue' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  {order.status}
                </span>
              </div>
              <p className="font-bold text-gray-700">{order.cliente}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400 font-bold uppercase mt-2">
                <span className="flex items-center gap-1"><Clock size={14}/> Entrega: {new Date(order.data_entrega).toLocaleDateString()}</span>
                <span className="flex items-center gap-1"><Package size={14}/> {order.order_items.length} Tipos de Kits</span>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-2">
              <div className="text-right mb-2 hidden md:block">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Itens do Pedido:</p>
                {order.order_items.map((i: any, idx: number) => (
                  <span key={idx} className="text-xs font-bold text-gray-600 block">
                    {i.quantidade}x {i.kits?.nome_kit}
                  </span>
                ))}
              </div>
              
              {order.status !== 'Entregue' && (
                <button 
                  onClick={() => handleDeliverOrder(order)}
                  className="bg-green-500 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-green-600 shadow-lg shadow-green-100 transition-all"
                >
                  <CheckCircle size={18} /> MARCAR ENTREGUE
                </button>
              )}
            </div>
          </div>
        ))}
        {filteredOrders.length === 0 && (
          <p className="text-center text-gray-400 font-bold py-10">Nenhum pedido encontrado.</p>
        )}
      </div>
    </div>
  );
}