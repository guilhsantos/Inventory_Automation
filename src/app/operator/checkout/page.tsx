"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Camera, CheckCircle, ArrowLeft, Package, X, AlertTriangle, Images } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adjustKitStock, getDisplayReservedQty } from "@/lib/order-reservations";
import { compressImage, imageExtension } from "@/lib/image";

const MAX_FOTOS = 10;

export default function OrderCheckoutPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [orderCode, setOrderCode] = useState("");
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<{ id: string; file: File; preview: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleSearchOrder = async () => {
    if (!orderCode.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, order_items(id, quantidade, qty_reserved_total, qty_consumed_total, kit_id, kits(nome_kit, codigo_unico, estoque_atual), order_item_reservations(id, qty_reserved, status, created_by, created_at))"
        )
        .eq("codigo_unico", orderCode.toUpperCase())
        .eq("status", "Pendente")
        .single();

      if (error || !data) {
        showToast("Pedido não encontrado ou já foi concluído.", "error");
        setOrder(null);
      } else {
        setOrder(data);
      }
    } catch (err: any) {
      showToast("Erro ao buscar pedido: " + err.message, "error");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    e.target.value = ""; // permite escolher a mesma foto de novo depois de remover
    if (files.length === 0) return;

    const livres = MAX_FOTOS - photos.length;
    if (files.length > livres) {
      showToast(`Máximo de ${MAX_FOTOS} fotos por pedido.`, "error");
    }
    const novas = files.slice(0, Math.max(0, livres)).map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...novas]);
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const alvo = prev.find((p) => p.id === id);
      if (alvo) URL.revokeObjectURL(alvo.preview);
      return prev.filter((p) => p.id !== id);
    });
  };

  // Comprime e envia todas as fotos; devolve as URLs públicas na ordem escolhida
  const uploadPhotos = async (orderId: number) => {
    const stamp = Date.now();
    return Promise.all(
      photos.map(async (p, i) => {
        const blob = await compressImage(p.file);
        const path = `order-${orderId}-${stamp}-${i + 1}.${imageExtension(blob)}`;
        const { error } = await supabase.storage
          .from("order-photos")
          .upload(path, blob, { contentType: blob.type || "image/jpeg" });
        if (error) throw error;
        const { data } = supabase.storage.from("order-photos").getPublicUrl(path);
        return { path, url: data.publicUrl, position: i };
      })
    );
  };

  const handleCheckout = async () => {
    if (!order || photos.length === 0) {
      showToast("É obrigatório anexar pelo menos uma foto do pedido.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Verificar estoque considerando reservas já feitas para esse pedido
      const missingKits: string[] = [];
      if (order.order_items && order.order_items.length > 0) {
        for (const item of order.order_items) {
          const alreadyReserved = getDisplayReservedQty(item);
          const pendingToConsume = Math.max(0, (item.quantidade || 0) - alreadyReserved);
          const requiredQty = item.quantidade || 0;
          const availableStock = item.kits?.estoque_atual || 0;

          if (availableStock < pendingToConsume) {
            const missing = pendingToConsume - availableStock;
            missingKits.push(
              `${item.kits?.nome_kit || "Kit desconhecido"}\nReservado: ${alreadyReserved}/${requiredQty}\nFaltam: ${missing} unidade(s)`
            );
          }
        }
      }

      // 2. Se faltar algum kit, mostrar modal de erro
      if (missingKits.length > 0) {
        const errorMsg = `Kits insuficientes no estoque.\n\nFaltam:\n${missingKits.join('\n')}`;
        setValidationError(errorMsg);
        setIsSubmitting(false);
        return;
      }

      // 3. Se tiver todos os kits, processar baixa normalmente
      // Upload das fotos (antes de mexer no pedido: se falhar, nada muda)
      const uploaded = await uploadPhotos(order.id);

      // Atualizar pedido: status para Concluído; a primeira foto é a capa
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          status: "Concluído",
          photo_url: uploaded[0].url,
          concluido_em: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (updateError) throw updateError;

      const { error: photosError } = await supabase.from("order_photos").insert(
        uploaded.map((u) => ({
          order_id: order.id,
          url: u.url,
          storage_path: u.path,
          position: u.position,
          created_by: user?.id,
        }))
      );
      if (photosError) throw photosError;

      // Consumir reservas ativas e descontar apenas saldo restante de cada item
      for (const item of order.order_items || []) {
        const activeReservations = (item.order_item_reservations || []).filter((r: any) => r.status === "active");
        const reservedQty = activeReservations.reduce((sum: number, r: any) => sum + (r.qty_reserved || 0), 0);
        const qtyNeeded = Number(item.quantidade || 0);
        const pendingToConsume = Math.max(0, qtyNeeded - reservedQty);
        if (pendingToConsume > 0) {
          await adjustKitStock(item.kit_id, -pendingToConsume);
        }

        for (const reservation of activeReservations) {
          const { error: reservationError } = await supabase
            .from("order_item_reservations")
            .update({
              status: "consumed",
              consumed_by: user?.id || null,
              consumed_at: new Date().toISOString(),
            })
            .eq("id", reservation.id);
          if (reservationError) throw reservationError;

          const { error: reservationMovementError } = await supabase
            .from("stock_movements")
            .insert({
              kit_id: item.kit_id,
              user_id: user?.id || null,
              type: "OUT",
              quantity: reservation.qty_reserved || 0,
              notes: `Reserva consumida na baixa completa do pedido ${order.codigo_unico}`,
              movement_kind: "consume",
              order_id: order.id,
              order_item_id: item.id,
              reservation_id: reservation.id,
            });
          if (reservationMovementError) throw reservationMovementError;
        }

        if (pendingToConsume > 0) {
          const { error: pendingMovementError } = await supabase
            .from("stock_movements")
            .insert({
              kit_id: item.kit_id,
              user_id: user?.id || null,
              type: "OUT",
              quantity: pendingToConsume,
              notes: `Baixa direta na conclusão do pedido ${order.codigo_unico}`,
              movement_kind: "consume",
              order_id: order.id,
              order_item_id: item.id,
            });
          if (pendingMovementError) throw pendingMovementError;
        }

        const currentConsumed = Number(item.qty_consumed_total || 0);
        const { error: itemUpdateError } = await supabase
          .from("order_items")
          .update({
            qty_reserved_total: 0,
            qty_consumed_total: currentConsumed + qtyNeeded,
          })
          .eq("id", item.id);
        if (itemUpdateError) throw itemUpdateError;
      }

      showToast("Pedido concluído com sucesso! Estoque atualizado.");
      router.push("/operator/dashboard");
    } catch (err: any) {
      showToast("Erro ao processar baixa: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseErrorModal = () => {
    setValidationError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      <div className="flex items-center gap-4">
        <Link href="/operator/production" className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-[#5D286C] shadow-sm">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-3xl font-black text-[#262626]">Baixa de Pedido</h1>
      </div>

      {!order ? (
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-50 shadow-sm space-y-4">
          <input
            type="text"
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearchOrder()}
            placeholder="Digite o código do pedido..."
            className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C]"
          />
          <button
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
            <div className="mt-4 space-y-2">
              {order.order_items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between">
                  <span>{item.kits?.nome_kit}</span>
                  <span>{item.quantidade}x</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-xl font-black flex items-center gap-2">
                <Camera className="text-[#5D286C]" /> Fotos do Pedido
              </h2>
              <span className="text-xs font-black text-gray-400 uppercase shrink-0">
                {photos.length}/{MAX_FOTOS}
              </span>
            </div>
            <p className="text-xs font-bold text-gray-400 mb-4">Obrigatório pelo menos 1 foto.</p>

            {/* Câmera: abre direto a câmera traseira; Galeria: escolhe várias fotos já tiradas */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              className="hidden"
            />

            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                {photos.map((p, i) => (
                  <div key={p.id} className="relative aspect-square rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
                    <img src={p.preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md">
                        Capa
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(p.id)}
                      disabled={isSubmitting}
                      aria-label={`Remover foto ${i + 1}`}
                      className="absolute top-1 right-1 bg-white/90 text-red-600 rounded-full p-1 shadow"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < MAX_FOTOS && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isSubmitting}
                  className={`border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-[#5D286C] active:scale-95 transition-all ${
                    photos.length === 0 ? "h-40" : "h-24"
                  }`}
                >
                  <Camera size={photos.length === 0 ? 36 : 24} className="text-gray-400" />
                  <span className="text-gray-500 font-bold text-sm">Tirar foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isSubmitting}
                  className={`border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-[#5D286C] active:scale-95 transition-all ${
                    photos.length === 0 ? "h-40" : "h-24"
                  }`}
                >
                  <Images size={photos.length === 0 ? 36 : 24} className="text-gray-400" />
                  <span className="text-gray-500 font-bold text-sm">Galeria</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleCheckout}
            disabled={photos.length === 0 || isSubmitting}
            className="w-full bg-green-500 text-white p-6 rounded-3xl font-black text-xl flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <><CheckCircle size={24} /> Confirmar Baixa</>}
          </button>
        </div>
      )}

      {/* Modal de Erro de Validação */}
      {validationError && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={handleCloseErrorModal}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <div className="text-center space-y-6">
              <AlertTriangle size={60} className="mx-auto text-red-500" />
              <div>
                <h2 className="text-2xl font-black text-[#262626] mb-4">Erro de Validação</h2>
                <div className="bg-red-50 p-4 rounded-2xl text-left">
                  <p className="text-sm font-bold text-red-600 whitespace-pre-line">
                    {validationError}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseErrorModal}
                className="w-full bg-red-600 text-white p-4 rounded-2xl font-black hover:bg-red-700 transition-all"
              >
                FECHAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

