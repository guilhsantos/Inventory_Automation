"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, Camera, Laptop, Loader2, AlertCircle, Keyboard } from "lucide-react";
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
  const [showManualInput, setShowManualInput] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSearching, setIsSearching] = useState(false); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Funções de Feedback Sonoro ---
  const playSuccess = () => {
    const audio = new Audio('/success.mp3');
    audio.play().catch(e => console.log("Erro ao reproduzir áudio:", e));
  };

  const playError = () => {
    const audio = new Audio('/error.mp3');
    audio.play().catch(e => console.log("Erro ao reproduzir áudio:", e));
  };

  useEffect(() => {
    setIsMobile(/Android|iPhone/i.test(navigator.userAgent));
    const focusInput = () => { if (!isMobile && !scanResult) inputRef.current?.focus(); };
    focusInput();
    window.addEventListener("click", focusInput);
    return () => window.removeEventListener("click", focusInput);
  }, [isMobile, scanResult]);

  const handleIdentifyItem = async (codigo: string) => {
    if (!codigo.trim()) return;

    setError(null);
    setItemInfo(null);
    setScanResult(codigo);
    setIsSearching(true); 
    setManualCode(""); 

    const { data, error: dbError } = await supabase
      .from('kits')
      .select('id, nome_kit, estoque_atual')
      .eq('codigo_unico', codigo)
      .single();

    if (data) {
      setItemInfo({ id: data.id, nome: data.nome_kit, qtd: data.estoque_atual });
      playSuccess(); // Som de sucesso ao encontrar o kit
    } else {
      setError("Item não encontrado no sistema.");
      playError(); // Som de erro ao não encontrar
    }
    
    setIsSearching(false);
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
    } catch (err) {
      playError(); // Som de erro se falhar a gravação no banco
      alert("Erro ao processar.");
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
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Modo Leitor USB Ativo</p>
                
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

                <button 
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="mt-12 flex items-center gap-2 text-gray-400 font-bold hover:text-[#5D286C] transition-colors"
                >
                  <Keyboard size={18} /> Digitar código manualmente
                </button>

                {showManualInput && (
                  <div className="mt-6 flex gap-2 animate-in slide-in-from-top-2">
                    <input 
                      type="text" 
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-[#5D286C] font-bold uppercase shadow-sm"
                      placeholder="CÓDIGO"
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
          <div className={`p-12 rounded-[3.5rem] text-center space-y-8 animate-in zoom-in duration-300 shadow-2xl bg-white`}>
             {isSearching ? (
               <div className="py-20 flex flex-col items-center">
                  <Loader2 className="animate-spin text-[#5D286C]" size={64} />
                  <p className="mt-6 text-[#5D286C] font-black uppercase tracking-widest">Consultando Banco...</p>
               </div>
             ) : error ? (
               <div className="space-y-6">
                  <AlertCircle size={80} className="mx-auto text-red-500" />
                  <h2 className="text-3xl font-black text-gray-900 uppercase">Item não encontrado</h2>
                  <p className="text-gray-400 font-bold">{scanResult}</p>
                  <button 
                    onClick={() => { setScanResult(null); setError(null); }}
                    className="w-full bg-gray-900 text-white p-6 rounded-3xl font-black"
                  >
                    TENTAR NOVAMENTE
                  </button>
               </div>
             ) : (
               <>
                 <CheckCircle2 size={80} className="mx-auto text-green-500" />
                 <div>
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest">{scanResult}</p>
                    <h2 className="text-5xl font-black text-[#262626] mt-2">{itemInfo?.nome}</h2>
                    <p className="text-green-600 font-bold text-xl mt-2 tracking-tight">Estoque atual: {itemInfo?.qtd} unidades</p>
                 </div>
                 <div className="space-y-3 pt-4">
                    <button 
                      onClick={confirmarBaixa}
                      disabled={isProcessing}
                      className="w-full bg-[#5D286C] text-white p-6 rounded-3xl font-black text-2xl hover:bg-[#7B1470] transition-all shadow-xl shadow-purple-100"
                    >
                      {isProcessing ? <Loader2 className="animate-spin mx-auto" /> : "CONFIRMAR BAIXA"}
                    </button>
                    <button 
                      onClick={() => { setScanResult(null); setItemInfo(null); }}
                      className="w-full text-gray-400 font-bold text-sm hover:text-red-500 transition-colors"
                    >
                      CANCELAR
                    </button>
                 </div>
               </>
             )}
          </div>
        )}
      </div>
    </div>
  );
}