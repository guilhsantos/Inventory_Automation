"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, Camera, Laptop, Loader2, AlertCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

const Scanner = dynamic(() => import("@/components/Scanner"), { 
  ssr: false,
  loading: () => <div className="min-h-[350px] flex items-center justify-center bg-gray-50 rounded-[2.5rem] text-gray-400 font-bold">Iniciando...</div>
});

export default function ScannerPage() {
  const { user } = useAuth();
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [itemInfo, setItemInfo] = useState<{id: number, nome: string, qtd: number} | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(isMobileDevice);
    if (!isMobileDevice) setTimeout(() => inputRef.current?.focus(), 500);
  }, []);

  // BUSCA O ITEM NO BANCO ASSIM QUE BIPAR
  const handleIdentifyItem = async (codigo: string) => {
    setError(null);
    setScanResult(codigo);
    
    const { data, error } = await supabase
      .from('kits')
      .select('id, nome_kit, estoque_atual')
      .eq('codigo_unico', codigo)
      .single();

    if (data) {
      setItemInfo({ id: data.id, nome: data.nome_kit, qtd: data.estoque_atual });
    } else {
      setError("Item não encontrado no sistema.");
      setItemInfo(null);
    }
  };

  // CONFIRMA A BAIXA REAL NO BANCO
  const confirmarBaixa = async () => {
    if (!itemInfo || !user) return;
    setIsProcessing(true);

    try {
      // 1. Diminui o estoque
      const { error: updateError } = await supabase
        .from('kits')
        .update({ estoque_atual: itemInfo.qtd - 1 })
        .eq('id', itemInfo.id);

      if (updateError) throw updateError;

      // 2. Registra a movimentação (Log)
      await supabase.from('movimentacoes').insert({
        kit_id: itemInfo.id,
        usuario_id: user.id,
        tipo: 'SAIDA',
        quantidade: 1
      });

      alert("Baixa realizada com sucesso!");
      setScanResult(null);
      setItemInfo(null);
      setManualCode("");
      setShowCamera(false);
    } catch (err) {
      alert("Erro ao processar baixa.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-6 max-w-md mx-auto">
      {!scanResult ? (
        <div className="space-y-6">
          {!isMobile ? (
            <div className="bg-white p-10 rounded-[2.5rem] border-4 border-dashed border-gray-100 flex flex-col items-center text-center space-y-6 shadow-sm">
              <div className="bg-purple-50 p-6 rounded-full text-purple-600"><Laptop size={64} /></div>
              <h2 className="text-xl font-bold text-gray-800">Modo Leitor USB</h2>
              <form onSubmit={(e) => { e.preventDefault(); handleIdentifyItem(manualCode.toUpperCase()); }} className="w-full">
                <input 
                  ref={inputRef}
                  type="text" 
                  placeholder="BIPE O ITEM"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full p-5 bg-gray-50 border-2 border-purple-100 rounded-2xl focus:border-purple-600 text-center text-2xl font-black uppercase outline-none transition-all"
                  autoFocus
                />
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              {!showCamera ? (
                <button onClick={() => setShowCamera(true)} className="w-full min-h-[350px] bg-white rounded-[2.5rem] border-[3px] border-dashed border-purple-200 text-purple-600 flex flex-col items-center justify-center">
                  <div className="bg-purple-100 p-8 rounded-full mb-4"><Camera size={48} /></div>
                  <span className="font-black text-sm uppercase tracking-widest">Abrir Câmera</span>
                </button>
              ) : <Scanner onSuccess={(result) => handleIdentifyItem(result)} />}
              
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex gap-3">
                <input type="text" placeholder="CÓDIGO MANUAL" value={manualCode} onChange={(e) => setManualCode(e.target.value)} className="flex-1 p-4 bg-gray-50 border-transparent rounded-2xl focus:border-purple-600 font-bold uppercase outline-none transition-all" />
                <button onClick={() => handleIdentifyItem(manualCode.toUpperCase())} className="bg-purple-600 text-white px-6 rounded-2xl font-bold">OK</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TELA DE CONFIRMAÇÃO COM INFO DO BANCO */
        <div className="bg-white border-4 border-purple-600 p-10 rounded-[3rem] text-center space-y-8 shadow-2xl shadow-purple-100 animate-in zoom-in duration-300">
          {error ? (
            <div className="space-y-6">
              <AlertCircle size={64} className="mx-auto text-red-500" />
              <p className="text-red-600 font-bold">{error}</p>
              <button onClick={() => { setScanResult(null); setManualCode(""); }} className="w-full bg-gray-100 p-4 rounded-2xl font-bold">Voltar</button>
            </div>
          ) : (
            <>
              <div className="bg-purple-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-purple-600"><CheckCircle2 size={56} strokeWidth={3} /></div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">{scanResult}</p>
                <h2 className="text-3xl font-black text-gray-900 leading-tight">{itemInfo?.nome}</h2>
                <p className="text-purple-600 font-bold mt-2">Estoque atual: {itemInfo?.qtd} un</p>
              </div>
              <div className="space-y-3">
                <button 
                  onClick={confirmarBaixa} 
                  disabled={isProcessing || (itemInfo?.qtd || 0) <= 0}
                  className="w-full bg-purple-600 text-white p-5 rounded-2xl font-black text-lg shadow-xl shadow-purple-200 disabled:bg-gray-300"
                >
                  {isProcessing ? <Loader2 className="animate-spin mx-auto" /> : "CONFIRMAR BAIXA"}
                </button>
                <button onClick={() => { setScanResult(null); setManualCode(""); setShowCamera(false); }} className="w-full text-gray-400 font-bold text-sm">CANCELAR</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}