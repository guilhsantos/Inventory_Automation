"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Archive, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type OrderItemReservation = {
  id: number;
  qty_reserved: number;
  status: "active" | "reversed" | "consumed";
};

type ReserveOrderItem = {
  id: number;
  quantidade: number;
  qty_reserved_total?: number;
  kit_id: number;
  kits: {
    id: number;
    nome_kit: string;
    codigo_unico: string;
    estoque_atual: number;
  } | null;
  order_item_reservations?: OrderItemReservation[];
};

type ReserveOrderItemRaw = Omit<ReserveOrderItem, "kits"> & {
  kits:
    | {
        id: number;
        nome_kit: string;
        codigo_unico: string;
        estoque_atual: number;
      }[]
    | {
        id: number;
        nome_kit: string;
        codigo_unico: string;
        estoque_atual: number;
      }
    | null;
};

type PendingOrder = {
  id: number;
  codigo_unico: string;
  cliente: string;
  status: string;
  order_items: ReserveOrderItem[];
};

type PendingOrderRaw = Omit<PendingOrder, "order_items"> & {
  order_items: ReserveOrderItemRaw[];
};

export default function ReserveOrderPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [orderCode, setOrderCode] = useState("");
  const [order, setOrder] = useState<PendingOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [observation, setObservation] = useState("");
  const [qtyByItemId, setQtyByItemId] = useState<Record<number, string>>({});

  const itemProgress = useMemo(() => {
    if (!order) return [];
    return (order.order_items || []).map((item) => {
      const activeReservedFromLogs = (item.order_item_reservations || [])
        .filter((r) => r.status === "active")
        .reduce((sum, r) => sum + (r.qty_reserved || 0), 0);
      const persistedReserved = Number(item.qty_reserved_total || 0);
      const reserved = Math.max(activeReservedFromLogs, persistedReserved);
      const remaining = Math.max(0, (item.quantidade || 0) - reserved);
      return { item, reserved, remaining };
    });
  }, [order]);

  async function handleSearchOrder() {
    if (!orderCode.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, codigo_unico, cliente, status, order_items(id, quantidade, qty_reserved_total, kit_id, kits(id, nome_kit, codigo_unico, estoque_atual), order_item_reservations(id, qty_reserved, status))"
        )
        .eq("codigo_unico", orderCode.toUpperCase())
        .eq("status", "Pendente")
        .single();

      if (error || !data) {
        setOrder(null);
        showToast("Pedido pendente não encontrado.", "error");
        return;
      }

      const byItem: Record<number, string> = {};
      ((data as PendingOrderRaw).order_items || []).forEach((item) => {
        byItem[item.id] = "";
      });

      const normalizedOrder: PendingOrder = {
        ...(data as PendingOrderRaw),
        order_items: ((data as PendingOrderRaw).order_items || []).map((item) => ({
          ...item,
          kits: Array.isArray(item.kits) ? item.kits[0] || null : item.kits,
        })),
      };

      setQtyByItemId(byItem);
      setObservation("");
      setOrder(normalizedOrder);
    } catch (err: any) {
      setOrder(null);
      showToast(err?.message || "Erro ao buscar pedido.", "error");
    } finally {
      setLoading(false);
    }
  }

  function setReserveQty(itemId: number, value: string) {
    const raw = Math.floor(Number(value) || 0);
    const maxForItem =
      itemProgress.find((entry) => entry.item.id === itemId)?.remaining ??
      Number.MAX_SAFE_INTEGER;
    const safe = Math.min(Math.max(0, raw), maxForItem);
    setQtyByItemId((prev) => ({ ...prev, [itemId]: value === "" ? "" : String(safe) }));
  }

  async function handleReserve() {
    if (!order || !user) return;
    const obs = observation.trim();
    if (!obs) {
      showToast("Observação é obrigatória para reservar.", "error");
      return;
    }

    const payload = itemProgress
      .map(({ item, remaining }) => {
        const qty = Math.max(0, Math.floor(Number(qtyByItemId[item.id] || 0) || 0));
        return { item, qty, remaining };
      })
      .filter((p) => p.qty > 0);

    if (payload.length === 0) {
      showToast("Informe pelo menos uma quantidade para reservar.", "error");
      return;
    }

    for (const p of payload) {
      if (p.qty > p.remaining) {
        showToast(`Reserva acima do restante permitido para ${p.item.kits?.nome_kit || "kit"}.`, "error");
        return;
      }
      const currentStock = p.item.kits?.estoque_atual || 0;
      if (p.qty > currentStock) {
        showToast(`Estoque insuficiente para ${p.item.kits?.nome_kit || "kit"}.`, "error");
        return;
      }
    }

    setSaving(true);
    try {
      for (const p of payload) {
        const item = p.item;
        const currentStock = item.kits?.estoque_atual || 0;
        const qty = p.qty;

        const { error: kitError } = await supabase
          .from("kits")
          .update({ estoque_atual: Math.max(0, currentStock - qty) })
          .eq("id", item.kit_id);
        if (kitError) throw kitError;

        const { data: reservationRow, error: reservationError } = await supabase
          .from("order_item_reservations")
          .insert({
            order_id: order.id,
            order_item_id: item.id,
            kit_id: item.kit_id,
            qty_reserved: qty,
            status: "active",
            observation: obs,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (reservationError) throw reservationError;

        const { error: movementError } = await supabase.from("stock_movements").insert({
          kit_id: item.kit_id,
          user_id: user.id,
          type: "OUT",
          quantity: qty,
          notes: `Reserva do pedido ${order.codigo_unico}: ${obs}`,
          movement_kind: "reserve",
          order_id: order.id,
          order_item_id: item.id,
          reservation_id: reservationRow?.id ?? null,
        });
        if (movementError) throw movementError;

        const nextReserved = Number(item.qty_reserved_total || 0) + qty;
        const { error: itemError } = await supabase
          .from("order_items")
          .update({ qty_reserved_total: nextReserved })
          .eq("id", item.id);
        if (itemError) throw itemError;
      }

      showToast("Reserva registrada com sucesso.");
      router.push("/operator/dashboard");
    } catch (err: any) {
      showToast(err?.message || "Erro ao reservar itens.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      <div className="flex items-center gap-4">
        <Link href="/operator/production" className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-[#5D286C] shadow-sm">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-3xl font-black text-[#262626]">Reservar Kits do Pedido</h1>
      </div>

      {!order ? (
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-50 shadow-sm space-y-4">
          <input
            type="text"
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchOrder()}
            placeholder="Digite o código do pedido..."
            className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C]"
          />
          <button
            type="button"
            onClick={handleSearchOrder}
            disabled={loading}
            className="w-full bg-[#5D286C] text-white p-5 rounded-2xl font-black flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Buscar Pedido"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
            <h2 className="text-xl font-black mb-4">Resumo do Pedido</h2>
            <p><strong>Código:</strong> {order.codigo_unico}</p>
            <p><strong>Cliente:</strong> {order.cliente}</p>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-xl font-black mb-1 flex items-center gap-2">
              <Archive className="text-amber-600" /> Quantidade para Reservar
            </h2>
            <p className="text-xs text-gray-500 font-bold">
              Informe apenas o que deseja separar agora. O pedido continua pendente.
            </p>

            {itemProgress.map(({ item, reserved, remaining }) => (
              <div key={item.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-black text-[#262626]">{item.kits?.nome_kit || `Kit #${item.kit_id}`}</p>
                    <p className="text-xs text-gray-500 font-bold uppercase">{item.kits?.codigo_unico || "sem código"}</p>
                  </div>
                  <div className="text-xs font-bold text-gray-600">
                    Pedido: {item.quantidade} | Reservado: {reserved} | Restante: {remaining} | Estoque: {item.kits?.estoque_atual || 0}
                  </div>
                </div>
                <input
                  type="number"
                  min={0}
                  max={remaining}
                  value={qtyByItemId[item.id] ?? ""}
                  onChange={(e) => setReserveQty(item.id, e.target.value)}
                  className="w-full p-3 bg-white rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C]"
                  placeholder="Quantidade para reservar"
                />
              </div>
            ))}
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
            <label className="text-xs font-black text-gray-400 uppercase ml-2">Observação (obrigatória)</label>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex: Separado para entrega parcial de amanhã."
              className="mt-2 w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C] min-h-[120px]"
            />
          </div>

          <button
            type="button"
            onClick={handleReserve}
            disabled={saving}
            className="w-full bg-amber-600 text-white p-6 rounded-3xl font-black text-xl flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" /> : <><Save size={24} /> Confirmar Reserva</>}
          </button>
        </div>
      )}
    </div>
  );
}
