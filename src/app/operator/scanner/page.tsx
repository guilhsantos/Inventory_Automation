"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { CheckCircle2, Laptop, Loader2, AlertCircle, Keyboard, ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useToast } from "@/lib/toast-context";

const Scanner = dynamic(() => import("@/components/Scanner"), { 
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center bg-black text-white font-bold">Iniciando Câmera...</div>
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
    <div className={`min-h-screen transition-colors duration-500 ${isSuccess ? "bg-green-500 p-4" : scanResult ? "bg-transparent p-4" : "bg-transparent"}`}>
      {/* Quando o scanner está aberto no Mobile, ele vira tela cheia */}
      {isMobile && !scanResult ? (
        <div className="fixed inset-0 z-50 bg-black animate-in fade-in duration-300">
          <div className="relative w-full h-full">
            <Scanner onSuccess={handleIdentifyItem} />
            
            {/* Overlay Superior (Botão Voltar) */}
            <div className="absolute top-6 left-6 z-[60]">
               <Link href="/operator/production" className="p-4 bg-white/10 backdrop-blur-md rounded-2xl text-white">
                  <ArrowLeft size={24} />
               </Link>
            </div>

            {/* Guia visual fixa no centro */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-[85%] aspect-[3/2] border-2 border-white/30 rounded-3xl relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse" />
              </div>
              <p className="text-white font-black text-xs uppercase mt-8 tracking-widest bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">
                Aponte para Código de Barras ou QR
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-6">
          {!scanResult && (
            <div className="flex items-center gap-4 mb-4">
              <Link href="/operator/production" className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-[#5D286C] shadow-sm">
                <ArrowLeft size={20} />
              </Link>
              <h1 className="text-2xl font-black text-[#262626]">Leitura de Kits</h1>
            </div>
          )}

          {!scanResult ? (
            <div className="space-y-8 text-center pt-10 md:pt-20 px-4">
               <div className="flex flex-col items-center">
                  <div className="bg-purple-50 p-6 md:p-10 rounded-full mb-6">
                    <Laptop size={80} className="text-[#5D286C]" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-[#262626]">Aguardando Bipe de Kit...</h2>
                  
                  {/* Campo oculto para leitura com leitor USB/Bluetooth no PC */}
                  <form onSubmit={(e) => { e.preventDefault(); handleIdentifyItem(manualCode.toUpperCase()); }}>
                    <input ref={inputRef} type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value)} className="opacity-0 absolute pointer-events-none" autoFocus />
                  </form>

                  <button onClick={() => setShowManualInput(!showManualInput)} className="mt-8 flex items-center gap-2 text-gray-400 font-bold hover:text-[#5D286C]">
                    <Keyboard size={18} /> {showManualInput ? "Ocultar teclado" : "Digitar código manualmente"}
                  </button>

                  {showManualInput && (
                    <div className="mt-6 flex w-full max-w-xs gap-2 animate-in slide-in-from-top-2">
                      <input 
                        type="text" 
                        value={manualCode} 
                        onChange={(e) => setManualCode(e.target.value)} 
                        className="flex-1 p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-[#5D286C] font-bold uppercase"
                        placeholder="CÓDIGO"
                      />
                      <button onClick={() => handleIdentifyItem(manualCode.toUpperCase())} className="bg-[#5D286C] text-white px-6 rounded-2xl font-black">OK</button>
                    </div>
                  )}
                </div>
            </div>
          ) : (
            /* Tela de Resultado (Igual ao anterior) */
            <div className="p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] text-center space-y-8 animate-in zoom-in duration-300 shadow-2xl bg-white mt-10">
               {isSearching ? (
                 <div className="py-10 flex flex-col items-center">
                    <Loader2 className="animate-spin text-[#5D286C]" size={40} />
                    <p className="mt-4 text-[#5D286C] font-black uppercase tracking-widest text-sm">Consultando...</p>
                 </div>
               ) : error ? (
                 <div className="space-y-6">
                    <AlertCircle size={60} className="mx-auto text-red-500" />
                    <h2 className="text-2xl font-black text-gray-900 uppercase">Aviso</h2>
                    <div className="p-4 bg-red-50 rounded-2xl text-red-600 font-bold text-sm">{error}</div>
                    <button onClick={() => { setScanResult(null); setError(null); }} className="w-full bg-gray-900 text-white p-5 rounded-3xl font-black">TENTAR NOVAMENTE</button>
                 </div>
               ) : (
                 <>
                   <CheckCircle2 size={60} className="mx-auto text-green-500" />
                   <div>
                      <h2 className="text-3xl md:text-5xl font-black text-[#262626] mt-2">{itemInfo?.nome}</h2>
                      <p className="text-green-600 font-bold text-lg mt-2 tracking-tight">Estoque Atual: {itemInfo?.qtd} un</p>
                   </div>
                   <div className="space-y-3 pt-4">
                      <button onClick={confirmarProducao} disabled={isProcessing} className="w-full bg-[#5D286C] text-white p-5 rounded-3xl font-black text-xl shadow-xl shadow-purple-100">
                        {isProcessing ? <Loader2 className="animate-spin mx-auto" /> : "CONFIRMAR ENTRADA"}
                      </button>
                      <button onClick={() => { setScanResult(null); setItemInfo(null); }} className="w-full text-gray-400 font-bold text-sm uppercase">Cancelar</button>
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