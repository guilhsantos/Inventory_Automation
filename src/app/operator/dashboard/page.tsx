"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, Package, Clock, Volume2, TrendingUp, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/date-utils";
import { useStuckLoadingRecovery } from "@/lib/use-stuck-loading-recovery";

type OperatorOrder = {
  id: number;
  codigo_unico: string;
  cliente: string;
  data_entrega: string | null;
  is_priority: boolean;
  priority_position: number | null;
  order_items: { 
    id: number;
    quantidade: number;
    qty_reserved_total?: number;
    kit_id: number;
    order_item_reservations?: {
      id: number;
      qty_reserved: number;
      status: "active" | "reversed" | "consumed";
    }[];
    kits: {
      nome_kit: string;
      codigo_unico: string;
      estoque_atual: number;
    } | null;
  }[];
  stockPercentage?: number;
  reservedPercentage?: number;
  reservedTotal?: number;
  hasActiveReservations?: boolean;
};

function parseCodigoOrder(a: string, b: string): number {
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

export default function OperatorDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OperatorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revertingOrderId, setRevertingOrderId] = useState<number | null>(null);
  const hasInitializedRef = useRef(false);
  const fetchSeqRef = useRef(0);
  const audioNotification = useRef<HTMLAudioElement | null>(null);
  const previousOrdersRef = useRef<Set<number>>(new Set());

  useStuckLoadingRecovery(Boolean(authLoading || (user && loading)));

  // Som de novo pedido: use /public/new_order.mp3 ou /public/success.mp3 (opcional).
  useEffect(() => {
    const trySrc = (src: string) => {
      const a = new Audio(src);
      a.preload = "auto";
      a.addEventListener("error", () => {
        if (src === "/new_order.mp3") {
          trySrc("/success.mp3");
        } else {
          audioNotification.current = null;
        }
      });
      a.addEventListener("loadeddata", () => {
        audioNotification.current = a;
      });
      a.load();
    };
    trySrc("/new_order.mp3");
  }, []);

  const playNotification = useCallback(() => {
    const a = audioNotification.current;
    if (!a) return;
    try {
      a.currentTime = 0;
      void a.play().catch(() => {
        /* autoplay bloqueado ou arquivo ausente — ignorar */
      });
    } catch {
      /* ignorar */
    }
  }, []);

  const fetchOrders = useCallback(
    async (retriesLeft = 2) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const seq = ++fetchSeqRef.current;
      const isFirstAttempt = retriesLeft === 2;

      if (isFirstAttempt) {
        setLoading(true);
        setError(null);
      }

      const previousOrderIds = previousOrdersRef.current;

      try {
        const { data, error: queryError } = await supabase
          .from("orders")
          .select(
            "id, codigo_unico, cliente, data_entrega, is_priority, priority_position, order_items(id, quantidade, qty_reserved_total, qty_consumed_total, kit_id, order_item_reservations(id, qty_reserved, status), kits(nome_kit, codigo_unico, estoque_atual))"
          )
          .eq("status", "Pendente")
          .order("is_priority", { ascending: false })
          .order("priority_position", { ascending: true, nullsFirst: true })
          .order("created_at", { ascending: true });

        if (seq !== fetchSeqRef.current) return;

        if (queryError) {
          throw new Error(queryError.message);
        }

        if (data) {
          const ordersWithStock = data.map((order: any) => {
            let totalNeeded = 0;
            let totalAvailable = 0;
            let totalReserved = 0;
            let hasActiveReservations = false;

            order.order_items?.forEach((item: any) => {
              const needed = item.quantidade || 0;
              const available = item.kits?.estoque_atual || 0;
              const reservedFromLogs = (item.order_item_reservations || [])
                .filter((r: any) => r.status === "active")
                .reduce((sum: number, r: any) => sum + (r.qty_reserved || 0), 0);
              const reserved = Math.max(reservedFromLogs, Number(item.qty_reserved_total || 0));
              totalNeeded += needed;
              totalAvailable += Math.min(needed, available);
              totalReserved += reserved;
              if (reserved > 0) hasActiveReservations = true;
            });

            const progressPercentage =
              totalNeeded > 0 ? Math.round((Math.min(totalNeeded, totalAvailable + totalReserved) / totalNeeded) * 100) : 100;

            return { ...order, stockPercentage: progressPercentage, reservedPercentage: progressPercentage, reservedTotal: totalReserved, hasActiveReservations };
          });

          const sortedOrdersWithStock = [...ordersWithStock].sort((a: OperatorOrder, b: OperatorOrder) => {
            if (a.is_priority !== b.is_priority) return a.is_priority ? -1 : 1;

            if (a.is_priority && b.is_priority) {
              const aPos = typeof a.priority_position === "number" ? a.priority_position : Number.MAX_SAFE_INTEGER;
              const bPos = typeof b.priority_position === "number" ? b.priority_position : Number.MAX_SAFE_INTEGER;
              if (aPos !== bPos) return aPos - bPos;
            }

            return parseCodigoOrder(a.codigo_unico, b.codigo_unico);
          });

          const newOrderIds = new Set<number>(sortedOrdersWithStock.map((o: any) => o.id as number));
          const hasNewOrders =
            previousOrderIds.size > 0 && Array.from(newOrderIds).some((id: number) => !previousOrderIds.has(id));

          if (hasNewOrders) {
            playNotification();
          }

          previousOrdersRef.current = newOrderIds;
          setOrders(sortedOrdersWithStock as OperatorOrder[]);
        } else {
          previousOrdersRef.current = new Set();
          setOrders([]);
        }

        setError(null);
      } catch (err: any) {
        if (seq !== fetchSeqRef.current) return;

        if (retriesLeft > 0) {
          await new Promise((r) => setTimeout(r, 1200 + (2 - retriesLeft) * 600));
          if (seq !== fetchSeqRef.current) return;
          await fetchOrders(retriesLeft - 1);
          return;
        }

        setError(err?.message || "Erro ao carregar pedidos");
        setOrders([]);
      } finally {
        if (seq === fetchSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [user, playNotification]
  );

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;
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
            const newRecord = payload.new as { status?: string; is_priority?: boolean; id?: number } | null;
            const oldRecord = payload.old as { status?: string; is_priority?: boolean } | null;

            if (payload.eventType === "INSERT" && newRecord?.status === "Pendente") {
              playNotification();
              fetchOrders();
            }

            if (
              payload.eventType === "UPDATE" &&
              newRecord?.status === "Pendente" &&
              oldRecord?.status !== "Pendente"
            ) {
              playNotification();
              fetchOrders();
            }

            if (
              payload.eventType === "UPDATE" &&
              oldRecord &&
              newRecord &&
              oldRecord.is_priority !== newRecord.is_priority
            ) {
              playNotification();
              fetchOrders();
            }
          }
        )
        .subscribe(() => {});

      interval = setInterval(() => {
        fetchOrders();
      }, 30000);
    } catch {
      /* realtime opcional */
    }

    return () => {
      fetchSeqRef.current += 1;
      hasInitializedRef.current = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [user, authLoading, router, fetchOrders, playNotification]);

  // Aguardar autenticação
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-[#5D286C]" size={48} />
      </div>
    );
  }

  const currentOrder = orders.find((o) => o.is_priority) || orders[0];
  const queueOrders = orders.filter(o => o.id !== currentOrder?.id);

  const totalKits = (order: OperatorOrder) => order.order_items?.reduce((acc, i) => acc + (i.quantidade || 0), 0) || 0;
  const reservedForItem = (item: OperatorOrder["order_items"][number]) => {
    const byRows = (item.order_item_reservations || [])
      .filter((r) => r.status === "active")
      .reduce((sum, r) => sum + (r.qty_reserved || 0), 0);
    return Math.max(byRows, Number(item.qty_reserved_total || 0));
  };

  const handleRevertReservations = async (order: OperatorOrder) => {
    if (!user || !order.hasActiveReservations || revertingOrderId) return;
    setRevertingOrderId(order.id);
    try {
      const activeReservations = (order.order_items || []).flatMap((item) =>
        (item.order_item_reservations || [])
          .filter((r) => r.status === "active")
          .map((r) => ({ reservation: r, item }))
      );

      for (const { reservation, item } of activeReservations) {
        const currentStock = item.kits?.estoque_atual || 0;
        const restoreQty = reservation.qty_reserved || 0;

        const { error: kitError } = await supabase
          .from("kits")
          .update({ estoque_atual: currentStock + restoreQty })
          .eq("id", item.kit_id);
        if (kitError) throw kitError;

        const { error: reservationError } = await supabase
          .from("order_item_reservations")
          .update({
            status: "reversed",
            reversed_by: user.id,
            reversed_at: new Date().toISOString(),
            reverse_reason: "Reversão manual no dashboard",
          })
          .eq("id", reservation.id);
        if (reservationError) throw reservationError;

        const nextReservedTotal = Math.max(0, Number(item.qty_reserved_total || 0) - restoreQty);
        const { error: itemError } = await supabase
          .from("order_items")
          .update({ qty_reserved_total: nextReservedTotal })
          .eq("id", item.id);
        if (itemError) throw itemError;

        const { error: movementError } = await supabase
          .from("stock_movements")
          .insert({
            kit_id: item.kit_id,
            user_id: user.id,
            type: "IN",
            quantity: restoreQty,
            notes: `Reversão de reserva do pedido ${order.codigo_unico}`,
            movement_kind: "unreserve",
            order_id: order.id,
            order_item_id: item.id,
            reservation_id: reservation.id,
          });
        if (movementError) throw movementError;
      }

      await fetchOrders();
    } catch (err: any) {
      setError(err?.message || "Erro ao reverter reservas");
    } finally {
      setRevertingOrderId(null);
    }
  };

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
            {loading && orders.length === 0 && !error && (
              <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-yellow-200/90">
                <Loader2 className="animate-spin" size={16} /> Sincronizando fila…
              </p>
            )}
            {error && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm">
                <AlertTriangle className="text-red-400 shrink-0" size={20} />
                <span className="font-bold text-red-200">{error}</span>
                <button
                  type="button"
                  onClick={() => fetchOrders()}
                  className="ml-auto rounded-xl bg-white/10 px-3 py-1.5 text-xs font-black uppercase hover:bg-white/20"
                >
                  Tentar de novo
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => fetchOrders()}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10 disabled:opacity-50"
          >
            <Clock size={14} /> Atualizar
          </button>
        </header>

        {/* Pedido Atual (Grande) */}
        {currentOrder && (
          <div className={`relative p-4 md:p-8 lg:p-10 rounded-2xl md:rounded-[3rem] border-2 ${
            currentOrder.is_priority 
              ? "border-red-400 bg-gradient-to-br from-red-950/60 to-red-900/40" 
              : "border-white/20 bg-white/5"
          } shadow-2xl overflow-hidden`}>
            {currentOrder.is_priority && (
              <div className="absolute -top-2 md:-top-4 left-4 md:left-8 flex items-center gap-1 text-xs font-black uppercase text-red-200">
                <span className="inline-flex items-center gap-2 px-2 md:px-4 py-1 md:py-2 rounded-full bg-red-600 text-white shadow-lg text-[10px] md:text-xs">
                  <Volume2 size={12} className="md:w-auto md:h-auto w-3 h-3" /> PEDIDO PRIORITÁRIO
                </span>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mt-4 md:mt-0">
              {/* Informações Principais */}
              <div className="space-y-4 md:space-y-6">
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Pedido</p>
                  <Link href={`/orders/${currentOrder.id}?returnUrl=${encodeURIComponent('/operator/dashboard')}`}>
                    <h2 className="text-2xl md:text-4xl lg:text-5xl font-black hover:underline break-words">
                      {currentOrder.codigo_unico}
                    </h2>
                  </Link>
                </div>
                
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Cliente</p>
                  <p className="text-lg md:text-2xl font-black break-words">{currentOrder.cliente}</p>
                  {currentOrder.hasActiveReservations && (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-500/20 border border-amber-300/40 px-3 py-1">
                      <span className="text-[10px] font-black uppercase text-amber-200">Reserva ativa</span>
                      <span className="text-xs font-black text-amber-100">{currentOrder.reservedTotal || 0} kits separados</span>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-1">Entrega</p>
                    <p className="text-lg font-bold">
                      {currentOrder.data_entrega
                        ? formatDate(currentOrder.data_entrega)
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
                    <span className="text-xs font-black text-gray-400 uppercase">Progresso do Pedido</span>
                    <span className={`text-xl font-black ${
                      currentOrder.stockPercentage! >= 80 ? 'text-green-400' : 
                      currentOrder.stockPercentage! >= 50 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {currentOrder.stockPercentage || 0}%
                    </span>
                  </div>
                  {currentOrder.hasActiveReservations ? (
                    <p className="text-[11px] font-bold text-amber-200 mb-2">
                      Inclui kits já reservados para este pedido.
                    </p>
                  ) : (
                    <p className="text-[11px] font-bold text-gray-400 mb-2">
                      Considera apenas kits disponíveis em estoque.
                    </p>
                  )}
                  <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        currentOrder.stockPercentage! >= 80 ? 'bg-green-500' : 
                        currentOrder.stockPercentage! >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${currentOrder.stockPercentage || 0}%` }}
                    />
                  </div>
                  {currentOrder.hasActiveReservations && (
                    <button
                      type="button"
                      onClick={() => handleRevertReservations(currentOrder)}
                      disabled={revertingOrderId === currentOrder.id}
                      className="mt-4 rounded-xl bg-amber-500/20 border border-amber-300/40 px-3 py-2 text-xs font-black uppercase text-amber-200 hover:bg-amber-500/30 disabled:opacity-60"
                    >
                      {revertingOrderId === currentOrder.id ? "Revertendo..." : "Reverter reservas"}
                    </button>
                  )}
                </div>
              </div>
              
              {/* Detalhes dos Kits */}
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-4">Kits do Pedido</p>
                <div className="space-y-3 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-2">
                  {currentOrder.order_items && currentOrder.order_items.length > 0 ? (
                    currentOrder.order_items.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all"
                      >{(() => {
                        const required = item.quantidade || 0;
                        const stockPhysical = item.kits?.estoque_atual || 0;
                        const reserved = reservedForItem(item);
                        const availableForOrder = stockPhysical + reserved;
                        const remaining = Math.max(0, required - availableForOrder);
                        return (
                          <>
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
                          <p className="text-[10px] font-bold">
                            Estoque:{" "}
                            <span className={availableForOrder >= required ? "text-green-400" : "text-red-400"}>
                              {availableForOrder} disponíveis
                            </span>
                          </p>
                        </div>
                          </>
                        );
                      })()}</div>
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
                  onClick={() => window.location.href = `/orders/${order.id}?returnUrl=${encodeURIComponent('/operator/dashboard')}`}
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
                    {order.hasActiveReservations && (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-300/40 px-2 py-0.5">
                        <span className="text-[9px] font-black uppercase text-amber-200">Reserva</span>
                        <span className="text-[10px] font-black text-amber-100">{order.reservedTotal || 0} kits</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-300">
                      <span className="inline-flex items-center gap-1">
                        <Package size={12} /> {totalKits(order)} kits
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Progresso</span>
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
                      {order.hasActiveReservations && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRevertReservations(order);
                          }}
                          disabled={revertingOrderId === order.id}
                          className="mt-2 w-full rounded-xl bg-amber-500/20 border border-amber-300/40 px-2 py-1 text-[10px] font-black uppercase text-amber-200 hover:bg-amber-500/30 disabled:opacity-60"
                        >
                          {revertingOrderId === order.id ? "Revertendo..." : "Reverter reserva"}
                        </button>
                      )}
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


