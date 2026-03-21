"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShoppingCart,
  CheckCircle,
  Clock,
  Package,
  Search,
  Loader2,
  Star,
  StarOff,
  Undo2,
  Edit,
  X,
  Eye,
  FileText,
  Trash2,
  AlertTriangle,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
} from "lucide-react";
import { formatDate } from "@/lib/date-utils";

const STATUSES = ["Pendente", "Concluído", "Entregue"] as const;
type StatusFilter = (typeof STATUSES)[number];

function parseCodigoOrder(a: string, b: string): number {
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

function OrdersListContent() {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Pendente");
  const [codeSortDesc, setCodeSortDesc] = useState(false);
  const [priorityModal, setPriorityModal] = useState<{ isOpen: boolean; order: any | null }>({ isOpen: false, order: null });
  const [backToPendingModal, setBackToPendingModal] = useState<{ isOpen: boolean; order: any | null }>({ isOpen: false, order: null });
  const [invoiceModal, setInvoiceModal] = useState<{ isOpen: boolean; order: any | null; invoice: string }>({ isOpen: false, order: null, invoice: "" });
  const [revertDeliveredModal, setRevertDeliveredModal] = useState<{ isOpen: boolean; order: any | null }>({ isOpen: false, order: null });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; order: any | null }>({ isOpen: false, order: null });

  useEffect(() => {
    const q = searchParams.get("status");
    if (q && STATUSES.includes(q as StatusFilter)) {
      setStatusFilter(q as StatusFilter);
    } else if (!q) {
      router.replace("/orders/list?status=Pendente", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function setStatusTab(status: StatusFilter) {
    setStatusFilter(status);
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", status);
    router.replace(`/orders/list?${params.toString()}`, { scroll: false });
  }

  async function fetchOrders() {
    setLoading(true);
    try {
      let query = supabase
        .from("orders")
        .select("*, order_items(quantidade, kit_id, kits(nome_kit, codigo_unico, estoque_atual))")
        .eq("status", statusFilter);

      if (statusFilter === "Pendente") {
        try {
          query = query.order("is_priority", { ascending: false }).order("priority_position", { ascending: true });
        } catch {
          /* ignore */
        }
        query = query.order("created_at", { ascending: true });
      } else {
        query = query.order("created_at", { ascending: false });
      }

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
      const entregueEm = new Date().toISOString();
      const { data: updated, error } = await supabase
        .from("orders")
        .update({
          status: "Entregue",
          invoice_number: invoice,
          entregue_em: entregueEm,
        })
        .eq("id", invoiceModal.order.id)
        .select("id, entregue_em")
        .single();

      if (error) throw error;
      if (!updated?.entregue_em) {
        showToast("A entrega foi registrada, mas entregue_em não retornou do servidor. Verifique políticas RLS ou a coluna no banco.", "error");
        setInvoiceModal({ isOpen: false, order: null, invoice: "" });
        await fetchOrders();
        return;
      }

      showToast("Pedido marcado como entregue!");
      setInvoiceModal({ isOpen: false, order: null, invoice: "" });
      await fetchOrders();
    } catch (err: any) {
      showToast(err.message || "Erro ao marcar pedido como entregue", "error");
    }
  };

  const handleRevertDeliveredToConcluded = (order: any) => {
    if (order.status !== "Entregue") return;
    setRevertDeliveredModal({ isOpen: true, order });
  };

  const handleConfirmRevertDelivered = async () => {
    if (!revertDeliveredModal.order) return;
    const order = revertDeliveredModal.order;

    try {
      const { data: updated, error } = await supabase
        .from("orders")
        .update({
          status: "Concluído",
          entregue_em: null,
          invoice_number: null,
        })
        .eq("id", order.id)
        .select("id, status, entregue_em")
        .single();

      if (error) throw error;
      if (updated?.status !== "Concluído") {
        showToast("Não foi possível confirmar a reversão no servidor.", "error");
        return;
      }

      showToast("Pedido voltou para Concluído (NF e data de entrega removidas).");
      setRevertDeliveredModal({ isOpen: false, order: null });
      await fetchOrders();
    } catch (err: any) {
      showToast(err.message || "Erro ao reverter entrega", "error");
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
        .update({
          status: "Pendente",
          photo_url: null,
          concluido_em: null,
          entregue_em: null,
        })
        .eq("id", order.id);

      if (error) throw error;

      showToast("Pedido voltou para Pendente e estoque foi ajustado.");
      setBackToPendingModal({ isOpen: false, order: null });
      await fetchOrders();
    } catch (err: any) {
      showToast(err.message || "Erro ao voltar pedido para pendente", "error");
    }
  };

  const handleDeleteOrder = async (order: any) => {
    if (order.status !== "Pendente") return;
    setDeleteModal({ isOpen: true, order });
  };

  const handleConfirmDeleteOrder = async () => {
    if (!deleteModal.order) return;
    const order = deleteModal.order;

    try {
      // Deletar order_items primeiro (devido à foreign key)
      const { error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", order.id);

      if (itemsError) throw itemsError;

      // Deletar o pedido
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", order.id);

      if (error) throw error;

      showToast("Pedido excluído com sucesso!");
      setDeleteModal({ isOpen: false, order: null });
      await fetchOrders();
    } catch (err: any) {
      showToast(err.message || "Erro ao excluir pedido", "error");
    }
  };

  const filteredOrders = useMemo(() => {
    const term = searchTerm.toLowerCase();
    let list = orders.filter((o: any) => {
      return (
        o.cliente.toLowerCase().includes(term) ||
        String(o.codigo_unico).toLowerCase().includes(term) ||
        (o.invoice_number || "").toLowerCase().includes(term)
      );
    });
    if (statusFilter === "Concluído" || statusFilter === "Entregue") {
      list = [...list].sort((a, b) => {
        const cmp = parseCodigoOrder(a.codigo_unico, b.codigo_unico);
        return codeSortDesc ? -cmp : cmp;
      });
    }
    return list;
  }, [orders, searchTerm, statusFilter, codeSortDesc]);

  if (loading) return <Loader2 className="animate-spin mx-auto mt-20" size={40} />;

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#262626] flex items-center gap-3">
            <ShoppingCart className="text-[#5D286C]" /> Lista de Pedidos
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex gap-2 rounded-2xl bg-gray-100 p-1 text-xs font-black uppercase">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusTab(status)}
                  className={`px-3 py-2 rounded-2xl transition-all ${
                    statusFilter === status ? "bg-white text-[#5D286C] shadow-sm" : "text-gray-400"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
            {(statusFilter === "Concluído" || statusFilter === "Entregue") && (
              <button
                type="button"
                onClick={() => setCodeSortDesc((v) => !v)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border-2 border-gray-100 text-xs font-black text-[#5D286C] hover:border-[#5D286C]"
                title="Ordenar por código do pedido"
              >
                Código {codeSortDesc ? <ArrowDownWideNarrow size={16} /> : <ArrowUpWideNarrow size={16} />}
              </button>
            )}
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
                  <Link
                    href={`/orders/${order.id}?returnStatus=${encodeURIComponent(statusFilter)}`}
                    className="hover:underline"
                  >
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
                <span className="flex items-center gap-1"><Clock size={14}/> Entrega: {formatDate(order.data_entrega)}</span>
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
                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(order)}
                      className="bg-red-600 text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-red-700 transition-all"
                    >
                      <Trash2 size={16} /> Excluir Pedido
                    </button>
                  </>
                )}

                {statusFilter === "Concluído" && (
                  <>
                    <Link
                      href={`/orders/${order.id}?returnStatus=${encodeURIComponent(statusFilter)}`}
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
                  <>
                    <Link
                      href={`/orders/${order.id}?returnStatus=${encodeURIComponent(statusFilter)}`}
                      className="bg-[#5D286C] text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-[#7B1470] transition-all"
                    >
                      <Eye size={16} /> Ver Detalhes
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleRevertDeliveredToConcluded(order)}
                      className="bg-amber-50 text-amber-800 px-6 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-amber-100 transition-all"
                    >
                      <Undo2 size={16} /> Voltar para Concluído
                    </button>
                  </>
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

      {/* Modal: Entregue → Concluído */}
      {revertDeliveredModal.isOpen && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-6 rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setRevertDeliveredModal({ isOpen: false, order: null })}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-black text-[#262626] mb-3 flex items-center gap-2">
              <Undo2 className="text-amber-600" size={20} /> Voltar para Concluído
            </h2>
            <p className="text-sm text-gray-600 font-bold mb-4">
              O pedido <span className="text-[#5D286C] font-black">{revertDeliveredModal.order?.codigo_unico}</span> sairá de Entregue e voltará para Concluído. A nota fiscal e a data de entrega serão apagadas.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleConfirmRevertDelivered}
                className="w-full bg-amber-600 text-white p-3 rounded-2xl font-black text-sm shadow-lg hover:bg-amber-700 transition-all"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setRevertDeliveredModal({ isOpen: false, order: null })}
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

      {/* Modal de Excluir Pedido */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-6 rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setDeleteModal({ isOpen: false, order: null })} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-black text-[#262626] mb-3 flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={20} /> Confirmar Exclusão
            </h2>
            <p className="text-sm text-gray-600 font-bold mb-4">
              Tem certeza que deseja excluir o pedido <span className="text-[#5D286C] font-black">{deleteModal.order?.codigo_unico}</span>?
              <br /><br />
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleConfirmDeleteOrder}
                className="w-full bg-red-600 text-white p-3 rounded-2xl font-black text-sm shadow-lg hover:bg-red-700 transition-all"
              >
                Confirmar Exclusão
              </button>
              <button
                onClick={() => setDeleteModal({ isOpen: false, order: null })}
                className="w-full bg-gray-100 text-gray-600 p-3 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-[#5D286C]" size={40} />
        </div>
      }
    >
      <OrdersListContent />
    </Suspense>
  );
}