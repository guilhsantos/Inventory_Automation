"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { ShoppingCart, CheckCircle, Clock, Package, Search, Loader2, Star, StarOff, Undo2, Edit, X, Eye, FileText } from "lucide-react";

export default function OrdersListPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Pendente" | "Concluído" | "Entregue">("Pendente");
  const [priorityModal, setPriorityModal] = useState<{ isOpen: boolean; order: any | null }>({ isOpen: false, order: null });
  const [backToPendingModal, setBackToPendingModal] = useState<{ isOpen: boolean; order: any | null }>({ isOpen: false, order: null });
  const [invoiceModal, setInvoiceModal] = useState<{ isOpen: boolean; order: any | null; invoice: string }>({ isOpen: false, order: null, invoice: "" });

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function fetchOrders() {
    setLoading(true);
    try {
      let query = supabase
        .from("orders")
        .select("*, order_items(quantidade, kit_id, kits(nome_kit, codigo_unico, estoque_atual))")
        .eq("status", statusFilter);

      // Ordenação com tratamento de erro
      try {
        query = query.order("is_priority", { ascending: false })
                     .order("priority_position", { ascending: true });
      } catch (e) {
        // Se campos não existirem, continua sem ordenação por prioridade
      }

      query = query.order("created_at", { ascending: statusFilter === "Pendente" });

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao carregar pedidos:", error);
        showToast("Erro ao carregar pedidos: " + error.message, "error");
        setOrders([]);
      } else {
        setOrders(data || []);
      }
    } catch (err: any) {
      console.error("Erro inesperado:", err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  const getOrderColor = (order: any) => {
    const totalKits = order.order_items?.reduce((sum: number, item: any) => sum + (item.quantidade || 0), 0) || 0;
    if (totalKits < 35) return 'border-l-4 border-l-blue-500';
    if (totalKits <= 60) return 'border-l-4 border-l-yellow-500';
    return 'border-l-4 border-l-orange-500';
  };

  const handleTogglePriority = async (order: any) => {
    if (statusFilter !== "Pendente") return;

    if (order.is_priority) {
      // Remover prioridade diretamente
      try {
        const { error } = await supabase
          .from("orders")
          .update({ is_priority: false, priority_position: 0 })
          .eq("id", order.id);
        if (error) throw error;
        showToast("Prioridade removida do pedido.");
        await fetchOrders();
      } catch (err: any) {
        showToast(err.message || "Erro ao atualizar prioridade", "error");
      }
    } else {
      // Abrir modal para escolher posição
      setPriorityModal({ isOpen: true, order });
    }
  };

  const handleConfirmPriority = async (placeBefore: boolean) => {
    if (!priorityModal.order) return;

    try {
      const { data: priorities, error: prioritiesError } = await supabase
        .from("orders")
        .select("priority_position")
        .eq("status", "Pendente")
        .eq("is_priority", true);

      if (prioritiesError) throw prioritiesError;

      let newPosition = 0;
      if (priorities && priorities.length > 0) {
        const positions = priorities.map((p: any) => p.priority_position || 0);
        const min = Math.min(...positions);
        const max = Math.max(...positions);
        newPosition = placeBefore ? min - 1 : max + 1;
      } else {
        newPosition = 1;
      }

      const { error } = await supabase
        .from("orders")
        .update({ is_priority: true, priority_position: newPosition })
        .eq("id", priorityModal.order.id);
      if (error) throw error;
      showToast("Pedido priorizado com sucesso!");
      setPriorityModal({ isOpen: false, order: null });
      await fetchOrders();
    } catch (err: any) {
      showToast(err.message || "Erro ao atualizar prioridade", "error");
    }
  };

  const handleDeliverOrder = async (order: any) => {
    if (order.status !== "Concluído") return;
    setInvoiceModal({ isOpen: true, order, invoice: order.invoice_number || "" });
  };

  const handleConfirmDeliverOrder = async () => {
    if (!invoiceModal.order) return;
    
    const invoice = invoiceModal.invoice.trim();
    if (!invoice) {
      showToast("Nota fiscal é obrigatória para entregar o pedido.", "error");
      return;
    }

    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "Entregue", invoice_number: invoice })
        .eq("id", invoiceModal.order.id);

      if (error) throw error;

      showToast("Pedido marcado como entregue!");
      setInvoiceModal({ isOpen: false, order: null, invoice: "" });
      await fetchOrders();
    } catch (err: any) {
      showToast(err.message || "Erro ao marcar pedido como entregue", "error");
    }
  };

  const handleBackToPending = async (order: any) => {
    if (order.status !== "Concluído") return;
    setBackToPendingModal({ isOpen: true, order });
  };

  const handleConfirmBackToPending = async () => {
    if (!backToPendingModal.order) return;
    const order = backToPendingModal.order;

    try {
      // Repor estoque dos kits
      for (const item of order.order_items || []) {
        const currentStock = item.kits?.estoque_atual ?? 0;
        const newStock = currentStock + item.quantidade;

        const { error: kitError } = await supabase
          .from("kits")
          .update({ estoque_atual: newStock })
          .eq("id", item.kit_id);

        if (kitError) throw kitError;
      }

      // Atualizar pedido: voltar para Pendente e limpar foto
      const { error } = await supabase
        .from("orders")
        .update({ status: "Pendente", photo_url: null })
        .eq("id", order.id);

      if (error) throw error;

      showToast("Pedido voltou para Pendente e estoque foi ajustado.");
      setBackToPendingModal({ isOpen: false, order: null });
      await fetchOrders();
    } catch (err: any) {
      showToast(err.message || "Erro ao voltar pedido para pendente", "error");
    }
  };

  const filteredOrders = orders.filter((o: any) => {
    const term = searchTerm.toLowerCase();
    return (
      o.cliente.toLowerCase().includes(term) ||
      o.codigo_unico.toLowerCase().includes(term) ||
      (o.invoice_number || "").toLowerCase().includes(term)
    );
  });

  if (loading) return <Loader2 className="animate-spin mx-auto mt-20" size={40} />;

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#262626] flex items-center gap-3">
            <ShoppingCart className="text-[#5D286C]" /> Lista de Pedidos
          </h1>
          <div className="mt-4 inline-flex gap-2 rounded-2xl bg-gray-100 p-1 text-xs font-black uppercase">
            {["Pendente", "Concluído", "Entregue"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`px-3 py-2 rounded-2xl transition-all ${
                  statusFilter === status
                    ? "bg-white text-[#5D286C] shadow-sm"
                    : "text-gray-400"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <div className="relative w-full md:w-80">
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
          <div key={order.id} className={`bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between gap-6 ${getOrderColor(order)}`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-[#5D286C] text-lg">
                  <Link href={`/orders/${order.id}`} className="hover:underline">
                    {order.codigo_unico}
                  </Link>
                </span>
                <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                  order.status === 'Entregue'
                    ? 'bg-green-100 text-green-600'
                    : order.status === 'Concluído'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-amber-100 text-amber-600'
                }`}>
                  {order.status}
                </span>
                {order.is_priority && statusFilter === "Pendente" && (
                  <span className="text-[10px] font-black px-2 py-1 rounded-lg uppercase bg-red-100 text-red-600">
                    Prioritário
                  </span>
                )}
              </div>
              <p className="font-bold text-gray-700">{order.cliente}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400 font-bold uppercase mt-2">
                <span className="flex items-center gap-1"><Clock size={14}/> Entrega: {new Date(order.data_entrega).toLocaleDateString()}</span>
                <span className="flex items-center gap-1"><Package size={14}/> {order.order_items?.length || 0} Tipos de Kits</span>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-2">
              <div className="text-right mb-2 hidden md:block">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Itens do Pedido:</p>
                {order.order_items?.map((i: any, idx: number) => (
                  <span key={idx} className="text-xs font-bold text-gray-600 block">
                    {i.quantidade}x {i.kits?.nome_kit}
                  </span>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                {statusFilter === "Pendente" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleTogglePriority(order)}
                      className="bg-red-50 text-red-600 px-6 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-red-100 transition-all"
                    >
                      {order.is_priority ? (
                        <>
                          <StarOff size={16} /> Remover Prioridade
                        </>
                      ) : (
                        <>
                          <Star size={16} /> Marcar Prioridade
                        </>
                      )}
                    </button>
                    <Link
                      href={`/orders/edit/${order.id}`}
                      className="bg-[#5D286C] text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-[#7B1470] transition-all"
                    >
                      <Edit size={16} /> Editar Pedido
                    </Link>
                  </>
                )}

                {statusFilter === "Concluído" && (
                  <>
                    <Link
                      href={`/orders/${order.id}`}
                      className="bg-[#5D286C] text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-[#7B1470] transition-all"
                    >
                      <Eye size={16} /> Ver Detalhes
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeliverOrder(order)}
                      className="bg-green-500 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-green-600 shadow-lg shadow-green-100 transition-all"
                    >
                      <CheckCircle size={18} /> Marcar Entregue
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBackToPending(order)}
                      className="bg-amber-50 text-amber-700 px-6 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-amber-100 transition-all"
                    >
                      <Undo2 size={16} /> Voltar para Pendente
                    </button>
                  </>
                )}

                {statusFilter === "Entregue" && (
                  <Link
                    href={`/orders/${order.id}`}
                    className="bg-[#5D286C] text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-[#7B1470] transition-all"
                  >
                    <Eye size={16} /> Ver Detalhes
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredOrders.length === 0 && (
          <p className="text-center text-gray-400 font-bold py-10">Nenhum pedido encontrado.</p>
        )}
      </div>

      {/* Modal de Priorização */}
      {priorityModal.isOpen && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-6 rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setPriorityModal({ isOpen: false, order: null })} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-black text-[#262626] mb-3 flex items-center gap-2">
              <Star className="text-red-600" size={20} /> Priorizar Pedido
            </h2>
            <p className="text-sm text-gray-600 font-bold mb-4">
              Como deseja posicionar o pedido <span className="text-[#5D286C] font-black">{priorityModal.order?.codigo_unico}</span> em relação às outras prioridades?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleConfirmPriority(true)}
                className="w-full bg-red-600 text-white p-3 rounded-2xl font-black text-sm shadow-lg hover:bg-red-700 transition-all"
              >
                Colocar ANTES das outras prioridades
              </button>
              <button
                onClick={() => handleConfirmPriority(false)}
                className="w-full bg-orange-600 text-white p-3 rounded-2xl font-black text-sm shadow-lg hover:bg-orange-700 transition-all"
              >
                Colocar DEPOIS das outras prioridades
              </button>
              <button
                onClick={() => setPriorityModal({ isOpen: false, order: null })}
                className="w-full bg-gray-100 text-gray-600 p-3 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Voltar para Pendente */}
      {backToPendingModal.isOpen && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-6 rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setBackToPendingModal({ isOpen: false, order: null })} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-black text-[#262626] mb-3 flex items-center gap-2">
              <Undo2 className="text-amber-600" size={20} /> Confirmar Ação
            </h2>
            <p className="text-sm text-gray-600 font-bold mb-4">
              Voltar o pedido <span className="text-[#5D286C] font-black">{backToPendingModal.order?.codigo_unico}</span> para Pendente? 
              <br /><br />
              Isso irá repor os kits no estoque e apagar a foto.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleConfirmBackToPending}
                className="w-full bg-red-600 text-white p-3 rounded-2xl font-black text-sm shadow-lg hover:bg-red-700 transition-all"
              >
                Confirmar
              </button>
              <button
                onClick={() => setBackToPendingModal({ isOpen: false, order: null })}
                className="w-full bg-gray-100 text-gray-600 p-3 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nota Fiscal */}
      {invoiceModal.isOpen && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-6 rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setInvoiceModal({ isOpen: false, order: null, invoice: "" })} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-black text-[#262626] mb-3 flex items-center gap-2">
              <FileText className="text-green-600" size={20} /> Nota Fiscal
            </h2>
            <p className="text-sm text-gray-600 font-bold mb-4">
              Informe o número da nota fiscal para o pedido <span className="text-[#5D286C] font-black">{invoiceModal.order?.codigo_unico}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase ml-2 block mb-2">
                  Número da Nota Fiscal
                </label>
                <input
                  type="text"
                  value={invoiceModal.invoice}
                  onChange={(e) => setInvoiceModal({ ...invoiceModal, invoice: e.target.value })}
                  placeholder="Ex: 123456"
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-[#5D286C] focus:bg-white rounded-2xl font-bold outline-none transition-all"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleConfirmDeliverOrder();
                    }
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleConfirmDeliverOrder}
                  className="w-full bg-green-600 text-white p-3 rounded-2xl font-black text-sm shadow-lg hover:bg-green-700 transition-all"
                >
                  Confirmar Entrega
                </button>
                <button
                  onClick={() => setInvoiceModal({ isOpen: false, order: null, invoice: "" })}
                  className="w-full bg-gray-100 text-gray-600 p-3 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}