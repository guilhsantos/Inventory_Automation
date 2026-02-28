"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, Laptop, Loader2, AlertCircle, Keyboard } from "lucide-react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase"; //
import { useAuth } from "@/lib/auth-context"; //

const Scanner = dynamic(() => import("@/components/Scanner"), { 
  ssr: false,
  loading: () => <div className="min-h-[350px] flex items-center justify-center bg-gray-50 rounded-[2.5rem] text-gray-400 font-bold">Iniciando...</div>
});

export default function ScannerPage() {
  const { user } = useAuth(); //
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [itemInfo, setItemInfo] = useState<{id: number, nome: string, qtd: number} | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSearching, setIsSearching] = useState(false); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const playSuccess = () => {
    const audio = new Audio('/success.mp3');
    audio.play().catch(e => console.error("Erro ao reproduzir áudio de sucesso:", e));
  };

  const playError = () => {
    const audio = new Audio('/error.mp3');
    audio.play().catch(e => console.error("Erro ao reproduzir áudio de erro:", e));
  };

  useEffect(() => {
    setIsMobile(/Android|iPhone/i.test(navigator.userAgent));
    const focusInput = () => { if (!isMobile && !scanResult) inputRef.current?.focus(); };
    focusInput();
    window.addEventListener("click", focusInput);
    return () => window.removeEventListener("click", focusInput);
  }, [isMobile, scanResult]); //

const handleIdentifyItem = async (codigo: string) => {
    if (!codigo.trim()) return;

    // Logs iniciais para diagnóstico
    console.log(`[Scanner] 🚀 Iniciando busca para: ${codigo}`);
    console.log(`[Scanner] 🌐 URL do Supabase: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? "Configurada" : "Vazia!"}`);
    
    setError(null);
    setItemInfo(null);
    setScanResult(codigo);
    setIsSearching(true); 
    setManualCode(""); 

    try {
      // 1. Verificação de Sanidade das Variáveis
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error("As chaves do Supabase não foram encontradas no navegador. Verifique o seu arquivo .env.local e reinicie o servidor.");
      }

      console.log("[Scanner] 📡 Enviando requisição ao Supabase...");

      // 2. Chamada ao Banco com Timeout manual (caso o Supabase trave)
      const fetchPromise = supabase
        .from('kits')
        .select('id, nome_kit, estoque_atual')
        .eq('codigo_unico', codigo)
        .single();

      // Criamos um timeout de 10 segundos para não carregar infinitamente
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("O servidor demorou muito para responder (Timeout).")), 10000)
      );

      const { data, error: dbError } = (await Promise.race([fetchPromise, timeoutPromise])) as any;

      if (dbError) {
        console.error("[Scanner] ❌ Erro do Banco de Dados:", dbError);
        throw new Error(`Erro no banco: ${dbError.message} (Código: ${dbError.code})`);
      }

      if (data) {
        console.log("[Scanner] ✅ Item encontrado:", data);
        setItemInfo({ id: data.id, nome: data.nome_kit, qtd: data.estoque_atual });
        playSuccess();
      } else {
        console.warn(`[Scanner] ⚠️ Código ${codigo} não encontrado.`);
        setError("Este código não consta no sistema.");
        playError();
      }

    } catch (err: any) {
      console.error("[Scanner] 🔥 Erro fatal na busca:", err);
      setError(err.message || "Erro de conexão desconhecido.");
      playError();
    } finally {
      console.log("[Scanner] 🏁 Fim do processo de busca.");
      setIsSearching(false); // <--- Isso PARA o spinner de qualquer jeito
    }
  };

  const confirmarBaixa = async () => {
    if (!itemInfo || !user) return;
    setIsProcessing(true);
    console.log(`[Scanner] Iniciando baixa para Kit ID: ${itemInfo.id}`);

    try {
      const { error: updateError } = await supabase
        .from('kits')
        .update({ estoque_atual: itemInfo.qtd - 1 })
        .eq('id', itemInfo.id);

      if (updateError) throw updateError;

      const { error: insertError } = await supabase.from('movimentacoes').insert({
        kit_id: itemInfo.id,
        usuario_id: user.id,
        tipo: 'SAIDA',
        quantidade: 1
      });

      if (insertError) throw insertError;

      console.log("[Scanner] Baixa e movimentação registradas com sucesso.");
      setScanResult(null);
      setItemInfo(null);
      alert("Baixa confirmada!");
    } catch (err: any) {
      console.error("[Scanner] Erro ao processar baixa:", err);
      playError();
      alert(`Erro ao processar: ${err.message || "Tente novamente."}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const isSuccess = !!itemInfo && !isSearching; //

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

                <button 
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="mt-12 flex items-center gap-2 text-gray-400 font-bold hover:text-[#5D286C]"
                >
                  <Keyboard size={18} /> Digitar manualmente
                </button>

                {showManualInput && (
                  <div className="mt-6 flex gap-2">
                    <input 
                      type="text" 
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-[#5D286C] font-bold uppercase"
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
                  <h2 className="text-2xl font-black text-gray-900 uppercase">Falha na Identificação</h2>
                  <div className="p-4 bg-red-50 rounded-2xl text-red-600 font-bold text-sm">
                    {error}
                  </div>
                  <p className="text-gray-400 text-xs">Código lido: {scanResult}</p>
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
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{scanResult}</p>
                    <h2 className="text-5xl font-black text-[#262626] mt-2">{itemInfo?.nome}</h2>
                    <p className="text-green-600 font-bold text-xl mt-2">Estoque: {itemInfo?.qtd} un</p>
                 </div>
                 <div className="space-y-3 pt-4">
                    <button 
                      onClick={confirmarBaixa}
                      disabled={isProcessing}
                      className="w-full bg-[#5D286C] text-white p-6 rounded-3xl font-black text-2xl"
                    >
                      {isProcessing ? <Loader2 className="animate-spin mx-auto" /> : "CONFIRMAR BAIXA"}
                    </button>
                    <button 
                      onClick={() => { setScanResult(null); setItemInfo(null); }}
                      className="w-full text-gray-400 font-bold text-sm"
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