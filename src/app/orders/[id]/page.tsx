"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowLeft, Package, User, Calendar, Star, X, Maximize2 } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/date-utils";
import { useStuckLoadingRecovery } from "@/lib/use-stuck-loading-recovery";

const RETURN_STATUSES = ["Pendente", "Concluído", "Entregue"] as const;

function OrderDetailsInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const returnUrl = searchParams.get("returnUrl");
  const returnStatus = searchParams.get("returnStatus");

  const safeReturnUrl = returnUrl?.startsWith("/") ? returnUrl : null;
  const listHref = safeReturnUrl
    ? safeReturnUrl
    : returnStatus && RETURN_STATUSES.includes(returnStatus as (typeof RETURN_STATUSES)[number])
    ? `/orders/list?status=${encodeURIComponent(returnStatus)}`
    : "/orders/list";

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  useStuckLoadingRecovery(loading);

  useEffect(() => {
    if (!orderId) return;
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function fetchOrder() {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(quantidade, kit_id, kits(nome_kit, codigo_unico))")
      .eq("id", orderId)
      .single();

    if (error) {
      console.error("Erro ao carregar pedido:", error);
      setOrder(null);
    } else {
      setOrder(data);
    }
    setLoading(false);
  }

  function goBack() {
    router.push(listHref);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5D286C]" size={40} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[#5D286C]"
        >
          <ArrowLeft size={18} /> Voltar
        </button>
        <p className="text-center text-gray-400 font-bold mt-10">Pedido não encontrado.</p>
      </div>
    );
  }

  const hasPhoto = !!order.photo_url;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={goBack}
          className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-[#5D286C] shadow-sm transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[#262626] flex items-center gap-2">Detalhes do Pedido</h1>
          <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">#{order.codigo_unico}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr,1.5fr]">
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black px-3 py-1 rounded-full bg-gray-100 text-gray-600 uppercase">{order.status}</span>
              {order.is_priority && (
                <span className="text-[10px] font-black px-2 py-1 rounded-full bg-red-100 text-red-600 uppercase flex items-center gap-1">
                  <Star size={12} /> Prioritário
                </span>
              )}
            </div>
            <p className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <User size={16} className="text-gray-400" /> {order.cliente}
            </p>
            <p className="flex items-center gap-2 text-sm font-bold text-gray-500">
              <Calendar size={16} className="text-gray-400" />
              {order.data_entrega ? formatDate(order.data_entrega) : "Sem data definida"}
            </p>
            {order.invoice_number && (
              <p className="text-xs font-bold text-gray-500">
                NF: <span className="text-gray-800">{order.invoice_number}</span>
              </p>
            )}
            {order.notes && (
              <div className="mt-2">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Observações</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{order.notes}</p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
            <h2 className="text-sm font-black text-[#262626] mb-4 flex items-center gap-2 uppercase tracking-widest">
              <Package size={16} className="text-[#5D286C]" /> Itens do Pedido
            </h2>
            <div className="space-y-3">
              {(order.order_items || []).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center bg-gray-50 rounded-2xl px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-gray-700">
                      {item.kits?.codigo_unico} - {item.kits?.nome_kit}
                    </span>
                  </div>
                  <span className="text-xs font-black text-[#5D286C]">{item.quantidade} un.</span>
                </div>
              ))}
              {(!order.order_items || order.order_items.length === 0) && (
                <p className="text-center text-gray-400 text-sm font-bold">Nenhum item encontrado para este pedido.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
            <h2 className="text-sm font-black text-[#262626] mb-3 uppercase tracking-widest">Foto do Pedido</h2>
            {hasPhoto ? (
              <div
                className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 group cursor-pointer"
                onClick={() => setIsPhotoModalOpen(true)}
              >
                <img
                  src={order.photo_url}
                  alt={`Foto do pedido ${order.codigo_unico}`}
                  className="w-full h-64 object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                  <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
                </div>
              </div>
            ) : (
              <div className="h-64 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400 font-bold bg-gray-50">
                Nenhuma foto disponível para este pedido.
              </div>
            )}
          </div>

          <Link href={listHref} className="block text-center text-xs font-black text-gray-500 hover:text-[#5D286C]">
            Ver todos os pedidos
          </Link>
        </div>
      </div>

      {isPhotoModalOpen && hasPhoto && (
        <div
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsPhotoModalOpen(false)}
        >
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsPhotoModalOpen(false);
              }}
              className="absolute top-4 right-4 z-10 bg-white/90 hover:bg-white text-gray-800 rounded-full p-3 shadow-lg transition-all"
            >
              <X size={24} />
            </button>
            <img
              src={order.photo_url}
              alt={`Foto completa do pedido ${order.codigo_unico}`}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-[#5D286C]" size={40} />
        </div>
      }
    >
      <OrderDetailsInner />
    </Suspense>
  );
}
