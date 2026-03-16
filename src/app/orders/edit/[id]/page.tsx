"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { ShoppingCart, Plus, Trash2, Save, ArrowLeft, Calendar, User, Hash, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

export default function EditOrderPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const params = useParams();
  const orderId = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  
  // Dados do Pedido
  const [orderData, setOrderData] = useState({ code: '', client: '', deliveryDate: '', notes: '' });
  const [availableKits, setAvailableKits] = useState<any[]>([]);
  const [selectedKits, setSelectedKits] = useState<{kit_id: number, qty: number}[]>([]);
  const [currentKitSelection, setCurrentKitSelection] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
      fetchKits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function fetchKits() {
    const { data } = await supabase.from("kits").select("id, nome_kit, codigo_unico").order("nome_kit");
    if (data) setAvailableKits(data);
  }

  async function fetchOrder() {
    setLoading(true);
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .select("*, order_items(quantidade, kit_id)")
        .eq("id", orderId)
        .single();

      if (error) throw error;

      setOrderData({
        code: order.codigo_unico,
        client: order.cliente,
        deliveryDate: order.data_entrega || '',
        notes: order.notes || ''
      });

      setSelectedKits(
        order.order_items?.map((item: any) => ({
          kit_id: item.kit_id,
          qty: item.quantidade
        })) || []
      );
    } catch (err: any) {
      showToast("Erro ao carregar pedido: " + err.message, "error");
      router.push("/orders/list");
    } finally {
      setLoading(false);
    }
  }

  const handleAddKit = () => {
    if (!currentKitSelection) return;
    const id = parseInt(currentKitSelection);
    if (!selectedKits.find(k => k.kit_id === id)) {
      setSelectedKits([...selectedKits, { kit_id: id, qty: 1 }]);
    } else {
      showToast("Este kit já foi adicionado ao pedido.", "error");
    }
    setCurrentKitSelection("");
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderData.code || !orderData.client || selectedKits.length === 0) {
      return showToast("Preencha todos os campos e adicione ao menos um kit.", "error");
    }

    setIsSubmitting(true);

    try {
      // 1. Atualizar o Pedido
      const { error: orderErr } = await supabase
        .from("orders")
        .update({
          codigo_unico: orderData.code,
          cliente: orderData.client,
          data_entrega: orderData.deliveryDate,
          notes: orderData.notes || null
        })
        .eq("id", orderId);

      if (orderErr) throw orderErr;

      // 2. Deletar itens antigos
      await supabase.from("order_items").delete().eq("order_id", orderId);

      // 3. Criar novos itens
      const items = selectedKits.map(item => ({
        order_id: parseInt(orderId),
        kit_id: item.kit_id,
        quantidade: item.qty
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      showToast("Pedido atualizado com sucesso!");
      router.push("/orders/list");
    } catch (err: any) {
      showToast(err.message || "Erro ao salvar pedido", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5D286C]" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 p-4">
      <div className="flex items-center gap-4">
        <Link href="/orders/list" className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-[#5D286C] shadow-sm transition-all">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-3xl font-black text-[#262626]">Editar Pedido</h1>
      </div>

      <form onSubmit={handleSaveOrder} className="space-y-6">
        {/* Informações Básicas */}
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-50 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase ml-2 flex items-center gap-2"><Hash size={14}/> Código do Pedido</label>
              <input 
                required
                value={orderData.code}
                onChange={e => setOrderData({...orderData, code: e.target.value.toUpperCase()})}
                className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C]" 
                placeholder="EX: ORD-2024-001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase ml-2 flex items-center gap-2"><Calendar size={14}/> Data de Entrega</label>
              <input 
                required
                type="date"
                lang="pt-BR"
                value={orderData.deliveryDate}
                onChange={e => setOrderData({...orderData, deliveryDate: e.target.value})}
                className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C]" 
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase ml-2 flex items-center gap-2"><User size={14}/> Nome do Cliente</label>
            <input 
              required
              value={orderData.client}
              onChange={e => setOrderData({...orderData, client: e.target.value})}
              className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C]" 
              placeholder="Nome completo ou Razão Social"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
              Observações (Opcional)
            </label>
            <textarea 
              value={orderData.notes}
              onChange={e => setOrderData({...orderData, notes: e.target.value})}
              className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C] min-h-[100px]" 
              placeholder="Observações adicionais sobre o pedido..."
            />
          </div>
        </div>

        {/* Seleção de Kits */}
        <div className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border-2 border-gray-50 shadow-sm space-y-4">
          <h2 className="text-lg md:text-xl font-black flex items-center gap-2 text-[#5D286C]"><Plus /> Adicionar Kits ao Pedido</h2>
          
          <div className="flex gap-2">
            <select 
              value={currentKitSelection} 
              onChange={e => setCurrentKitSelection(e.target.value)} 
              className="flex-1 p-3.5 md:p-4 bg-gray-50 rounded-xl md:rounded-2xl font-bold outline-none border-2 border-transparent focus:border-[#5D286C] text-sm appearance-none"
            >
              <option value="">Selecione um Kit...</option>
              {availableKits.map(k => (
                <option key={k.id} value={k.id}>{k.codigo_unico} - {k.nome_kit}</option>
              ))}
            </select>
            <button 
              type="button"
              onClick={handleAddKit} 
              className="bg-[#5D286C] text-white p-3.5 md:p-4 rounded-xl md:rounded-2xl shadow-lg hover:scale-105 transition-transform shrink-0"
            >
              <Plus size={24}/>
            </button>
          </div>

          <div className="space-y-3 mt-4">
            {selectedKits.map(item => (
              <div key={item.kit_id} className="flex items-center justify-between bg-purple-50 p-4 rounded-2xl animate-in slide-in-from-top-1">
                <div className="flex flex-col flex-1 min-w-0 mr-2">
                  <span className="font-black text-[#5D286C] text-sm truncate">
                    {availableKits.find(k => k.id === item.kit_id)?.codigo_unico}
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 truncate">
                    {availableKits.find(k => k.id === item.kit_id)?.nome_kit}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex flex-col items-center">
                    <input 
                      type="number" 
                      min="1" 
                      value={item.qty} 
                      onChange={e => {
                        const newItems = [...selectedKits];
                        newItems.find(i => i.kit_id === item.kit_id)!.qty = parseInt(e.target.value) || 1;
                        setSelectedKits(newItems);
                      }} 
                      className="w-12 p-1.5 rounded-lg text-center font-black text-[#5D286C] text-sm" 
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => setSelectedKits(selectedKits.filter(i => i.kit_id !== item.kit_id))} 
                    className="text-red-400 p-1"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-[#5D286C] text-white p-6 rounded-3xl font-black text-xl shadow-xl hover:bg-[#7B1470] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isSubmitting ? "SALVANDO..." : <><Save size={24} /> SALVAR ALTERAÇÕES</>}
        </button>
      </form>
    </div>
  );
}

