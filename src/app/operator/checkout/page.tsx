"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Camera, CheckCircle, ArrowLeft, Package, X, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function OrderCheckoutPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [orderCode, setOrderCode] = useState("");
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearchOrder = async () => {
    if (!orderCode.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(quantidade, kit_id, kits(nome_kit, codigo_unico, estoque_atual))")
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
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCheckout = async () => {
    if (!order || !photo) {
      showToast("É obrigatório tirar uma foto do pedido.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Verificar estoque de cada kit do pedido
      const missingKits: string[] = [];
      if (order.order_items && order.order_items.length > 0) {
        for (const item of order.order_items) {
          const requiredQty = item.quantidade || 0;
          const availableStock = item.kits?.estoque_atual || 0;

          if (availableStock < requiredQty) {
            const missing = requiredQty - availableStock;
            missingKits.push(`${item.kits?.nome_kit || 'Kit desconhecido'}\nFaltam: ${missing} unidade(s)`);
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
      // Upload da foto para Supabase Storage
      const fileExt = photo.name.split('.').pop();
      const fileName = `order-${order.id}-${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('order-photos')
        .upload(fileName, photo);

      if (uploadError) throw uploadError;

      // Obter URL pública da foto
      const { data: { publicUrl } } = supabase.storage
        .from('order-photos')
        .getPublicUrl(fileName);

      // Atualizar pedido: status para Concluído e salvar foto
      const { error: updateError } = await supabase
        .from("orders")
        .update({ 
          status: "Concluído", 
          photo_url: publicUrl 
        })
        .eq("id", order.id);

      if (updateError) throw updateError;

      // Descontar estoque dos kits
      for (const item of order.order_items || []) {
        const currentStock = item.kits?.estoque_atual ?? 0;
        const newStock = Math.max(0, currentStock - item.quantidade);

        const { error: kitError } = await supabase
          .from("kits")
          .update({ estoque_atual: newStock })
          .eq("id", item.kit_id);

        if (kitError) throw kitError;
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
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <Camera className="text-[#5D286C]" /> Foto do Pedido (Obrigatório)
            </h2>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
            {photoPreview ? (
              <div className="space-y-4">
                <img src={photoPreview} alt="Preview" className="w-full h-64 object-cover rounded-2xl" />
                <button
                  onClick={() => {
                    setPhoto(null);
                    setPhotoPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-red-500 text-sm font-bold"
                >
                  Remover foto
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-64 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-[#5D286C] transition-all"
              >
                <Camera size={48} className="text-gray-400" />
                <span className="text-gray-400 font-bold">Clique para tirar foto</span>
              </button>
            )}
          </div>

          <button
            onClick={handleCheckout}
            disabled={!photo || isSubmitting}
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

