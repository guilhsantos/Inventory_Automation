"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { CheckCircle2, Laptop, Loader2, AlertCircle, Keyboard } from "lucide-react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

const Scanner = dynamic(() => import("@/components/Scanner"), { 
  ssr: false,
  loading: () => <div className="min-h-[350px] flex items-center justify-center bg-gray-50 rounded-[2.5rem] text-gray-400 font-bold">Iniciando...</div>
});

interface KitData {
  id: number;
  nome_kit: string;
  estoque_atual: number;
}

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

  // --- Refs para Áudio (Evita delay ao instanciar novo áudio) ---
  const audioSuccess = useRef<HTMLAudioElement | null>(null);
  const audioError = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioSuccess.current = new Audio('/success.mp3');
    audioError.current = new Audio('/error.mp3');
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
    setIsMobile(/Android|iPhone/i.test(navigator.userAgent));
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
      const fetchPromise = supabase
        .from('kits')
        .select('id, nome_kit, estoque_atual')
        .eq('codigo_unico', codigo)
        .single();

      const timeoutPromise = new Promise<{data: null, error: any}>((_, reject) => 
        setTimeout(() => reject({ code: 'TIMEOUT', message: "O servidor demorou muito para responder." }), 15000)
      );

      const result = await Promise.race([fetchPromise, timeoutPromise]);
      const { data, error: dbError } = result as { data: KitData | null, error: any };

      if (dbError) {
        // PGRST116 é o erro do Supabase quando .single() não encontra nada
        if (dbError.code === 'PGRST116') {
          throw new Error("CÓDIGO NÃO ENCONTRADO NO SISTEMA");
        }
        throw new Error(dbError.message || "Erro de conexão");
      }

      if (data) {
        setItemInfo({ id: data.id, nome: data.nome_kit, qtd: data.estoque_atual });
        playSuccess();
      }
    } catch (err: any) {
      playError(); // Som de erro disparado imediatamente ao detectar falha
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg.toUpperCase());
    } finally {
      setIsSearching(false);
    }
  };

  const confirmarBaixa = async () => {
    if (!itemInfo || !user) return;
    setIsProcessing(true);

    try {
      const { error: updateError } = await supabase
        .from('kits')
        .update({ estoque_atual: itemInfo.qtd - 1 })
        .eq('id', itemInfo.id);

      if (updateError) throw updateError;

      await supabase.from('movimentacoes').insert({
        kit_id: itemInfo.id,
        usuario_id: user.id,
        tipo: 'SAIDA',
        quantidade: 1
      });

      setScanResult(null);
      setItemInfo(null);
      alert("Baixa confirmada!");
    } catch (err: any) {
      playError();
      alert(`Erro: ${err.message || "Falha ao processar"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const isSuccess = !!itemInfo && !isSearching;

  return (
    <div className={`min-h-screen p-8 transition-colors duration-500 ${isSuccess ? "bg-green-500" : "bg-transparent"}`}>
      <div className="max-w-2xl mx-auto">
        {!scanResult ? (
          <div className="space-y-8 text-center pt-20">
            {!isMobile ? (
              <div className="flex flex-col items-center">
                <div className="bg-purple-50 p-10 rounded-full mb-6">
                  <Laptop size={80} className="text-[#5D286C]" />
                </div>
                <h2 className="text-3xl font-black text-[#262626]">Aguardando Bipe...</h2>
                <form onSubmit={(e) => { e.preventDefault(); handleIdentifyItem(manualCode.toUpperCase()); }}>
                  <input 
                    ref={inputRef}
                    type="text" 
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="opacity-0 absolute pointer-events-none"
                    autoFocus
                  />
                </form>
                <button onClick={() => setShowManualInput(!showManualInput)} className="mt-12 flex items-center gap-2 text-gray-400 font-bold hover:text-[#5D286C]">
                   Digitar código manualmente
                </button>
                {showManualInput && (
                  <div className="mt-6 flex gap-2">
                    <input 
                      type="text" 
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-[#5D286C] font-bold uppercase shadow-sm"
                    />
                    <button onClick={() => handleIdentifyItem(manualCode.toUpperCase())} className="bg-[#5D286C] text-white px-8 rounded-2xl font-black">OK</button>
                  </div>
                )}
              </div>
            ) : (
              <Scanner onSuccess={handleIdentifyItem} />
            )}
          </div>
        ) : (
          <div className="p-12 rounded-[3.5rem] text-center space-y-8 animate-in zoom-in duration-300 shadow-2xl bg-white">
             {isSearching ? (
               <div className="py-20 flex flex-col items-center">
                  <Loader2 className="animate-spin text-[#5D286C]" size={64} />
                  <p className="mt-6 text-[#5D286C] font-black uppercase tracking-widest">Consultando Banco...</p>
               </div>
             ) : error ? (
               <div className="space-y-6">
                  <AlertCircle size={80} className="mx-auto text-red-500" />
                  <h2 className="text-3xl font-black text-gray-900 uppercase">Aviso do Sistema</h2>
                  <div className="p-4 bg-red-50 rounded-2xl text-red-600 font-bold text-sm">
                    {error}
                  </div>
                  <button onClick={() => { setScanResult(null); setError(null); }} className="w-full bg-gray-900 text-white p-6 rounded-3xl font-black">TENTAR NOVAMENTE</button>
               </div>
             ) : (
               <>
                 <CheckCircle2 size={80} className="mx-auto text-green-500" />
                 <div>
                    <h2 className="text-5xl font-black text-[#262626] mt-2">{itemInfo?.nome}</h2>
                    <p className="text-green-600 font-bold text-xl mt-2 tracking-tight">Estoque: {itemInfo?.qtd} un</p>
                 </div>
                 <div className="space-y-3 pt-4">
                    <button onClick={confirmarBaixa} disabled={isProcessing} className="w-full bg-[#5D286C] text-white p-6 rounded-3xl font-black text-2xl shadow-xl shadow-purple-100 hover:scale-[1.02] transition-transform">
                      {isProcessing ? <Loader2 className="animate-spin mx-auto" /> : "CONFIRMAR BAIXA"}
                    </button>
                    <button onClick={() => { setScanResult(null); setItemInfo(null); }} className="w-full text-gray-400 font-bold text-sm hover:text-red-500 transition-colors">CANCELAR</button>
                 </div>
               </>
             )}
          </div>
        )}
      </div>
    </div>
  );
}