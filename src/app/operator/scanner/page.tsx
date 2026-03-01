"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { CheckCircle2, Laptop, Loader2, AlertCircle, Keyboard, ArrowLeft, X } from "lucide-react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useToast } from "@/lib/toast-context";

const Scanner = dynamic(() => import("@/components/Scanner"), { 
  ssr: false,
  loading: () => <div className="fixed inset-0 flex items-center justify-center bg-black text-white font-bold uppercase tracking-widest text-xs">Iniciando Câmera...</div>
});

export default function ScannerPage() {
  const { user } = useAuth();
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [itemInfo, setItemInfo] = useState<{id: number, nome: string, qtd: number} | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSearching, setIsSearching] = useState(false); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const audioSuccess = useRef<HTMLAudioElement | null>(null);
  const audioError = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioSuccess.current = new Audio('/success.mp3');
    audioError.current = new Audio('/error.mp3');
    setIsMobile(/Android|iPhone/i.test(navigator.userAgent));
  }, []);

  const playSuccess = useCallback(() => {
    if (audioSuccess.current) {
      audioSuccess.current.currentTime = 0;
      audioSuccess.current.play().catch(() => {});
    }
  }, []);

  const playError = useCallback(() => {
    if (audioError.current) {
      audioError.current.currentTime = 0;
      audioError.current.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const focusInput = () => { if (!isMobile && !scanResult) inputRef.current?.focus(); };
    focusInput();
    window.addEventListener("click", focusInput);
    return () => window.removeEventListener("click", focusInput);
  }, [isMobile, scanResult]);

  const handleIdentifyItem = async (codigo: string) => {
    if (!codigo.trim() || isSearching) return;

    setError(null);
    setItemInfo(null);
    setScanResult(codigo);
    setIsSearching(true); 
    setManualCode(""); 

    try {
      const { data, error: dbError } = await supabase
        .from('kits')
        .select('id, nome_kit, estoque_atual')
        .eq('codigo_unico', codigo)
        .single();

      if (dbError) {
        if (dbError.code === 'PGRST116') throw new Error("CÓDIGO NÃO ENCONTRADO NO SISTEMA");
        throw new Error(dbError.message);
      }

      if (data) {
        setItemInfo({ id: data.id, nome: data.nome_kit, qtd: data.estoque_atual });
        playSuccess();
      }
    } catch (err: any) {
      playError();
      setError(err.message.toUpperCase());
    } finally {
      setIsSearching(false);
    }
  };

  const confirmarProducao = async () => {
    if (!itemInfo || !user) return;
    setIsProcessing(true);

    try {
      const { error: updateError } = await supabase
        .from('kits')
        .update({ estoque_atual: itemInfo.qtd + 1 }) 
        .eq('id', itemInfo.id);

      if (updateError) throw updateError;

      await supabase.from('stock_movements').insert({
        kit_id: itemInfo.id,
        user_id: user.id,
        type: 'IN', 
        quantity: 1,
        notes: 'Entrada via bip de scanner'
      });

      setScanResult(null);
      setItemInfo(null);
      showToast("Produção registrada com sucesso!");
    } catch (err: any) {
      playError();
      showToast(`Erro: ${err.message || "Falha ao processar"}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const isSuccess = !!itemInfo && !isSearching;

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isSuccess ? "bg-green-500" : "bg-transparent"}`}>
      
      {/* SCANNER TELA CHEIA PARA MOBILE */}
      {isMobile && !scanResult ? (
        <div className="fixed inset-0 z-[100] bg-black">
          <Scanner onSuccess={handleIdentifyItem} />
          
          {/* Overlay de Interface sobre o Scanner */}
          <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
            <div className="flex justify-between items-center pointer-events-auto">
              <Link href="/operator/production" className="p-4 bg-black/40 backdrop-blur-md rounded-2xl text-white border border-white/10">
                <ArrowLeft size={24} />
              </Link>
              <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <p className="text-white text-[10px] font-black uppercase tracking-widest text-center">Modo Leitura Ativo</p>
              </div>
            </div>

            {/* Guia Visual do Scanner */}
            <div className="flex-1 flex items-center justify-center">
              <div className="w-[85%] h-[30%] border-2 border-white/40 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] animate-pulse" />
                
                {/* Cantos do Foco */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
              </div>
            </div>

            <div className="text-center pb-10">
              <p className="text-white font-bold text-xs uppercase tracking-wider bg-black/20 backdrop-blur-sm inline-block px-4 py-2 rounded-full">
                Alinhe o código de barras no centro
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* UI PARA DESKTOP OU RESULTADO DO SCAN */
        <div className="max-w-2xl mx-auto p-4 space-y-6">
          {!scanResult && (
            <div className="flex items-center gap-4 mb-4">
              <Link href="/operator/production" className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-[#5D286C] shadow-sm">
                <ArrowLeft size={20} />
              </Link>
              <h1 className="text-2xl font-black text-[#262626]">Leitura de Kits</h1>
            </div>
          )}

          {!scanResult ? (
            <div className="space-y-8 text-center pt-10 md:pt-20">
               <div className="flex flex-col items-center px-4">
                  <div className="bg-purple-50 p-10 rounded-full mb-6 text-[#5D286C]">
                    <Laptop size={64} />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-[#262626]">Aguardando Bipe...</h2>
                  
                  <form onSubmit={(e) => { e.preventDefault(); handleIdentifyItem(manualCode.toUpperCase()); }}>
                    <input ref={inputRef} type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value)} className="opacity-0 absolute pointer-events-none" autoFocus />
                  </form>

                  <button onClick={() => setShowManualInput(!showManualInput)} className="mt-8 flex items-center gap-2 text-gray-400 font-bold hover:text-[#5D286C] uppercase text-xs tracking-widest">
                    <Keyboard size={18} /> {showManualInput ? "Ocultar teclado" : "Digitar Manualmente"}
                  </button>

                  {showManualInput && (
                    <div className="mt-6 flex w-full max-w-xs gap-2 animate-in slide-in-from-top-2">
                      <input 
                        type="text" 
                        value={manualCode} 
                        onChange={(e) => setManualCode(e.target.value)} 
                        className="flex-1 p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-[#5D286C] font-black"
                        placeholder="CÓDIGO"
                      />
                      <button onClick={() => handleIdentifyItem(manualCode.toUpperCase())} className="bg-[#5D286C] text-white px-6 rounded-2xl font-black">OK</button>
                    </div>
                  )}
                </div>
            </div>
          ) : (
            /* TELA DE RESULTADO PÓS-BIPE */
            <div className="p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] text-center space-y-8 animate-in zoom-in duration-300 shadow-2xl bg-white mt-4 md:mt-10 mx-2">
               {isSearching ? (
                 <div className="py-10 flex flex-col items-center">
                    <Loader2 className="animate-spin text-[#5D286C]" size={40} />
                    <p className="mt-4 text-[#5D286C] font-black uppercase tracking-widest text-xs">Consultando...</p>
                 </div>
               ) : error ? (
                 <div className="space-y-6">
                    <AlertCircle size={60} className="mx-auto text-red-500" />
                    <h2 className="text-2xl font-black text-gray-900 uppercase">Não Encontrado</h2>
                    <div className="p-4 bg-red-50 rounded-2xl text-red-600 font-bold text-sm uppercase tracking-tight">{error}</div>
                    <button onClick={() => { setScanResult(null); setError(null); }} className="w-full bg-gray-900 text-white p-5 rounded-3xl font-black uppercase tracking-widest">Tentar Novamente</button>
                 </div>
               ) : (
                 <>
                   <CheckCircle2 size={60} className="mx-auto text-green-500" />
                   <div>
                      <p className="text-[#5D286C] font-black text-xs uppercase tracking-widest mb-2">Item Identificado</p>
                      <h2 className="text-3xl md:text-5xl font-black text-[#262626] leading-tight">{itemInfo?.nome}</h2>
                      <p className="text-green-600 font-bold text-lg mt-4 tracking-tight uppercase">Estoque: {itemInfo?.qtd} un</p>
                   </div>
                   <div className="space-y-3 pt-6 border-t border-gray-50">
                      <button onClick={confirmarProducao} disabled={isProcessing} className="w-full bg-[#5D286C] text-white p-5 rounded-3xl font-black text-xl shadow-xl shadow-purple-100 hover:scale-[1.02] active:scale-95 transition-all">
                        {isProcessing ? <Loader2 className="animate-spin mx-auto" /> : "CONFIRMAR ENTRADA"}
                      </button>
                      <button onClick={() => { setScanResult(null); setItemInfo(null); }} className="w-full text-gray-400 font-bold text-sm uppercase tracking-widest p-2">Cancelar</button>
                   </div>
                 </>
               )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}