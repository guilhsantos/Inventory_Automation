import { supabase } from "./supabase";

// Tipos em inglês para padronização futura do banco

export type OrderStatus = "Pendente" | "Concluído" | "Entregue";

export type Order = {
  id: number;
  orderCode: string;
  customerName: string;
  status: OrderStatus;
  deliveryDate: string | null;
  invoiceNumber: string | null;
  notes: string | null;
  photoUrl: string | null;
  isPriority: boolean;
  priorityPosition: number | null;
  createdAt: string;
};

export async function getPendingOrdersForOperator() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, codigo_unico, cliente, status, data_entrega, invoice_number, notes, photo_url, is_priority, priority_position, created_at, order_items(quantidade)"
    )
    .eq("status", "Pendente")
    .order("is_priority", { ascending: false })
    .order("priority_position", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row: any): Order & { totalKits: number } => {
    const totalKits =
      row.order_items?.reduce((acc: number, item: any) => acc + (item.quantidade || 0), 0) || 0;

    return {
      id: row.id,
      orderCode: row.codigo_unico,
      customerName: row.cliente,
      status: row.status,
      deliveryDate: row.data_entrega,
      invoiceNumber: row.invoice_number ?? null,
      notes: row.notes ?? null,
      photoUrl: row.photo_url ?? null,
      isPriority: row.is_priority ?? false,
      priorityPosition: row.priority_position ?? null,
      createdAt: row.created_at,
      totalKits,
    };
  });
}


