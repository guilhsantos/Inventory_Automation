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
  loading: () => <div className="fixed inset-0 flex items-center justify-center bg-black text-white font-black uppercase tracking-widest text-xs">Iniciando...</div>
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

  // Mantém foco no input oculto para leitores externos
  useEffect(() => {
    const focusInput = () => { if (!scanResult) inputRef.current?.focus(); };
    focusInput();
    const interval = setInterval(focusInput, 2000); // Re-foca a cada 2s caso perca
    window.addEventListener("click", focusInput);
    return () => {
      window.removeEventListener("click", focusInput);
      clearInterval(interval);
    };
  }, [scanResult]);

  const handleIdentifyItem = async (codigo: string) => {
    if (!codigo.trim() || isSearching) return;
    setError(null);
    setItemInfo(null);
    setScanResult(codigo);
    setIsSearching(true); 
    setManualCode(""); 
    setShowManualInput(false);

    try {
      const { data, error: dbError } = await supabase
        .from('kits')
        .select('id, nome_kit, estoque_atual')
        .eq('codigo_unico', codigo)
        .single();

      if (dbError) {
        if (dbError.code === 'PGRST116') throw new Error("CÓDIGO NÃO ENCONTRADO");
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
        notes: 'Entrada via scanner'
      });
      setScanResult(null);
      setItemInfo(null);
      showToast("Produção registrada!");
    } catch (err: any) {
      playError();
      showToast(`Erro: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${itemInfo ? "bg-green-500" : "bg-transparent"}`}>
      
      {/* Input oculto para capturar bipes (Hardware) */}
      <form onSubmit={(e) => { e.preventDefault(); handleIdentifyItem(manualCode.toUpperCase()); }}>
        <input ref={inputRef} type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value)} className="opacity-0 absolute top-[-100px]" autoFocus />
      </form>

      {isMobile && !scanResult ? (
        <div className="fixed inset-0 z-[100] bg-black">
          <Scanner onSuccess={handleIdentifyItem} />
          
          <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
            <div className="flex justify-between items-start pointer-events-auto">
              <Link href="/operator/production" className="p-4 bg-black/20 backdrop-blur-md rounded-2xl text-white/70">
                <ArrowLeft size={24} />
              </Link>
              
              {/* BOTÃO MANUAL MEIO INVISÍVEL (Opacidade baixa) */}
              <button 
                onClick={() => setShowManualInput(true)}
                className="p-4 bg-white/5 backdrop-blur-sm rounded-2xl text-white/20 hover:text-white/60 transition-all border border-white/5"
              >
                <Keyboard size={24} />
              </button>
            </div>

            {/* Foco Visual */}
            <div className="flex-1 flex items-center justify-center">
              <div className="w-[85%] h-[25%] border-2 border-white/20 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
              </div>
            </div>
            
            <div className="pb-10 text-center">
              <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em]">Scanner Ativo</p>
            </div>
          </div>

          {/* Modal de Input Manual (Abre ao clicar no botão 'invisível') */}
          {showManualInput && (
            <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className="bg-white w-full max-w-xs p-8 rounded-[2.5rem] space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-black text-[#262626] uppercase text-sm">Digitar Código</h3>
                  <button onClick={() => setShowManualInput(false)} className="text-gray-400">X</button>
                </div>
                <input 
                  type="text" 
                  value={manualCode} 
                  onChange={(e) => setManualCode(e.target.value)} 
                  className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none border-2 border-transparent focus:border-[#5D286C]"
                  placeholder="CÓDIGO"
                  autoFocus
                />
                <button onClick={() => handleIdentifyItem(manualCode.toUpperCase())} className="w-full bg-[#5D286C] text-white p-4 rounded-2xl font-black">CONFIRMAR</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* UI DESKTOP E RESULTADOS */
        <div className="max-w-2xl mx-auto p-4 md:pt-20">
           {scanResult ? (
             <div className="p-8 md:p-12 rounded-[2.5rem] text-center space-y-8 animate-in zoom-in bg-white shadow-2xl">
                {isSearching ? (
                  <div className="py-10 flex flex-col items-center"><Loader2 className="animate-spin text-[#5D286C]" size={40} /></div>
                ) : error ? (
                  <div className="space-y-6">
                    <AlertCircle size={60} className="mx-auto text-red-500" />
                    <div className="p-4 bg-red-50 rounded-2xl text-red-600 font-bold uppercase text-xs">{error}</div>
                    <button onClick={() => { setScanResult(null); setError(null); }} className="w-full bg-gray-900 text-white p-5 rounded-3xl font-black">TENTAR NOVAMENTE</button>
                  </div>
                ) : (
                  <>
                    <CheckCircle2 size={60} className="mx-auto text-green-500" />
                    <div>
                       <p className="text-[#5D286C] font-black text-[10px] uppercase tracking-widest mb-2">Item Identificado</p>
                       <h2 className="text-3xl md:text-5xl font-black text-[#262626]">{itemInfo?.nome}</h2>
                       <p className="text-green-600 font-bold text-lg mt-4 uppercase">Estoque: {itemInfo?.qtd} un</p>
                    </div>
                    <div className="space-y-3 pt-6 border-t">
                       <button onClick={confirmarProducao} disabled={isProcessing} className="w-full bg-[#5D286C] text-white p-5 rounded-3xl font-black text-xl shadow-xl shadow-purple-100 transition-all active:scale-95">
                         {isProcessing ? <Loader2 className="animate-spin mx-auto" /> : "CONFIRMAR ENTRADA"}
                       </button>
                       <button onClick={() => { setScanResult(null); setItemInfo(null); }} className="w-full text-gray-400 font-bold text-xs uppercase tracking-widest">Cancelar</button>
                    </div>
                  </>
                )}
             </div>
           ) : (
             /* MODO DESKTOP (Sem câmera) */
             <div className="text-center space-y-8">
                <div className="bg-purple-50 p-10 rounded-full inline-block text-[#5D286C] mb-4"><Laptop size={64} /></div>
                <h2 className="text-3xl font-black text-[#262626]">Aguardando Bipe...</h2>
                <button onClick={() => setShowManualInput(true)} className="flex items-center gap-2 mx-auto text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:text-[#5D286C]">
                  <Keyboard size={18} /> Digitar Manualmente
                </button>
             </div>
           )}
        </div>
      )}
    </div>
  );
}