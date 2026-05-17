import { supabase } from "@/lib/supabase";

export type ReservationRow = {
  id: number;
  qty_reserved: number;
  status: string;
};

export type OrderItemWithReservations = {
  id?: number;
  kit_id: number;
  quantidade: number;
  qty_reserved_total?: number;
  order_item_reservations?: ReservationRow[];
  kits?: unknown;
};

export type RevertReservationsResult = {
  rowsReverted: number;
  ghostCountersCleared: number;
  stockRestored: number;
};

export function normalizeKit<T extends { estoque_atual?: number }>(
  kits: T | T[] | null | undefined
): (T & { estoque_atual: number }) | null {
  if (!kits) return null;
  const row = Array.isArray(kits) ? kits[0] : kits;
  if (!row) return null;
  return { ...row, estoque_atual: row.estoque_atual ?? 0 };
}

/** Reserva ativa real: somente linhas com status active. */
export function getActiveReservedQty(item: OrderItemWithReservations): number {
  return (item.order_item_reservations || [])
    .filter((r) => r.status === "active")
    .reduce((sum, r) => sum + (r.qty_reserved || 0), 0);
}

/** Contador fantasma: counter sem linhas active. */
export function getGhostReservedQty(item: OrderItemWithReservations): number {
  const active = getActiveReservedQty(item);
  const counter = Number(item.qty_reserved_total || 0);
  return active === 0 && counter > 0 ? counter : 0;
}

/** Quantidade reservada para exibir/calcular (apenas ativo). */
export function getDisplayReservedQty(item: OrderItemWithReservations): number {
  return getActiveReservedQty(item);
}

/** Alias para compatibilidade com o plano. */
export const getReservedQty = getDisplayReservedQty;

export function getRemainingQty(item: OrderItemWithReservations): number {
  const needed = Number(item.quantidade || 0);
  return Math.max(0, needed - getDisplayReservedQty(item));
}

export function orderHasActiveReservations(items: OrderItemWithReservations[]): boolean {
  return items.some((item) => getDisplayReservedQty(item) > 0);
}

export function orderHasGhostCounters(items: OrderItemWithReservations[]): boolean {
  return items.some((item) => getGhostReservedQty(item) > 0);
}

export function sumOrderReserved(items: OrderItemWithReservations[]): number {
  return items.reduce((sum, item) => sum + getDisplayReservedQty(item), 0);
}

export function sumOrderRemaining(items: OrderItemWithReservations[]): number {
  return items.reduce((sum, item) => sum + getRemainingQty(item), 0);
}

async function fetchKitStock(kitId: number): Promise<number> {
  const { data, error } = await supabase.from("kits").select("estoque_atual").eq("id", kitId).single();
  if (error) throw error;
  return data?.estoque_atual ?? 0;
}

async function restoreKitStock(kitId: number, qty: number): Promise<void> {
  if (qty <= 0) return;
  const current = await fetchKitStock(kitId);
  const { error } = await supabase.from("kits").update({ estoque_atual: current + qty }).eq("id", kitId);
  if (error) throw error;
}

export async function revertOrderReservations(
  orderId: number,
  orderCodigo: string,
  reason: string,
  userId: string
): Promise<RevertReservationsResult> {
  const result: RevertReservationsResult = {
    rowsReverted: 0,
    ghostCountersCleared: 0,
    stockRestored: 0,
  };

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, kit_id, quantidade, qty_reserved_total, order_item_reservations(id, qty_reserved, status)")
    .eq("order_id", orderId);

  if (itemsError) throw itemsError;

  const itemIds = new Set((items || []).map((i) => i.id).filter((id): id is number => typeof id === "number"));

  const { data: orphanReservations, error: orphanError } = await supabase
    .from("order_item_reservations")
    .select("id, kit_id, order_item_id, qty_reserved, status")
    .eq("order_id", orderId)
    .eq("status", "active");

  if (orphanError) throw orphanError;

  for (const reservation of orphanReservations || []) {
    if (itemIds.has(reservation.order_item_id)) continue;

    const restoreQty = reservation.qty_reserved || 0;
    if (restoreQty <= 0) continue;

    await restoreKitStock(reservation.kit_id, restoreQty);
    result.stockRestored += restoreQty;

    const { error: reservationError } = await supabase
      .from("order_item_reservations")
      .update({
        status: "reversed",
        reversed_by: userId,
        reversed_at: new Date().toISOString(),
        reverse_reason: reason,
      })
      .eq("id", reservation.id);
    if (reservationError) throw reservationError;

    const { error: movementError } = await supabase.from("stock_movements").insert({
      kit_id: reservation.kit_id,
      user_id: userId,
      type: "IN",
      quantity: restoreQty,
      notes: `Reversão de reserva órfã do pedido ${orderCodigo}: ${reason}`,
      movement_kind: "unreserve",
      order_id: orderId,
      order_item_id: reservation.order_item_id,
      reservation_id: reservation.id,
    });
    if (movementError) throw movementError;

    result.rowsReverted += 1;
  }

  for (const item of (items || []) as OrderItemWithReservations[]) {
    const activeRows = (item.order_item_reservations || []).filter((r) => r.status === "active");

    for (const reservation of activeRows) {
      const restoreQty = reservation.qty_reserved || 0;
      if (restoreQty <= 0) continue;

      await restoreKitStock(item.kit_id, restoreQty);
      result.stockRestored += restoreQty;

      const { error: reservationError } = await supabase
        .from("order_item_reservations")
        .update({
          status: "reversed",
          reversed_by: userId,
          reversed_at: new Date().toISOString(),
          reverse_reason: reason,
        })
        .eq("id", reservation.id);
      if (reservationError) throw reservationError;

      const nextReservedTotal = Math.max(0, Number(item.qty_reserved_total || 0) - restoreQty);
      const { error: itemError } = await supabase
        .from("order_items")
        .update({ qty_reserved_total: nextReservedTotal })
        .eq("id", item.id);
      if (itemError) throw itemError;

      const { error: movementError } = await supabase.from("stock_movements").insert({
        kit_id: item.kit_id,
        user_id: userId,
        type: "IN",
        quantity: restoreQty,
        notes: `Reversão de reserva do pedido ${orderCodigo}: ${reason}`,
        movement_kind: "unreserve",
        order_id: orderId,
        order_item_id: item.id,
        reservation_id: reservation.id,
      });
      if (movementError) throw movementError;

      result.rowsReverted += 1;
    }

    const ghostQty = getGhostReservedQty(item);
    if (ghostQty > 0) {
      const { error: ghostError } = await supabase
        .from("order_items")
        .update({ qty_reserved_total: 0 })
        .eq("id", item.id);
      if (ghostError) throw ghostError;
      result.ghostCountersCleared += ghostQty;
    }
  }

  return result;
}
