"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, Camera, Laptop, Loader2, Keyboard } from "lucide-react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";

const Scanner = dynamic(() => import("@/components/Scanner"), { ssr: false });

export default function ScannerPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [itemInfo, setItemInfo] = useState<any>(null);
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMobile(/Android|iPhone/i.test(navigator.userAgent));
    const focusInput = () => { if (!isMobile) inputRef.current?.focus(); };
    focusInput();
    window.addEventListener("click", focusInput);
    return () => window.removeEventListener("click", focusInput);
  }, [isMobile, scanResult]);

  const handleIdentify = async (codigo: string) => {
    setScanResult(codigo);
    const { data } = await supabase.from('kits').select('*').eq('codigo_unico', codigo).single();
    if (data) setItemInfo(data);
  };

  // Se der certo, a tela fica verde
  const isSuccess = !!itemInfo;

  return (
    <div className={`min-h-screen p-8 transition-colors duration-500 ${isSuccess ? "bg-green-500" : "bg-transparent"}`}>
      <div className="max-w-2xl mx-auto">
        {!scanResult ? (
          <div className="space-y-8 text-center pt-20">
            {!isMobile ? (
              <div className="flex flex-col items-center">
                <div className="bg-purple-100 p-10 rounded-full mb-6 animate-pulse">
                  <Laptop size={80} className="text-purple-600" />
                </div>
                <h2 className="text-3xl font-black text-gray-900">Aguardando Bipe...</h2>
                <p className="text-gray-400 font-medium">Use o leitor USB agora</p>
                
                {/* Input Invisível para o Leitor USB */}
                <form onSubmit={(e) => { e.preventDefault(); handleIdentify(manualCode.toUpperCase()); }}>
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
                  className="mt-10 flex items-center gap-2 text-gray-400 font-bold hover:text-purple-600 transition-colors"
                >
                  <Keyboard size={18} /> Digitar código manualmente
                </button>

                {showManualInput && (
                  <div className="mt-4 flex gap-2 animate-in slide-in-from-top-2">
                    <input 
                      type="text" 
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="p-4 bg-white border border-gray-200 rounded-2xl outline-none focus:border-purple-600 font-bold uppercase shadow-sm"
                      placeholder="CÓDIGO"
                    />
                    <button onClick={() => handleIdentify(manualCode.toUpperCase())} className="bg-purple-600 text-white px-6 rounded-2xl font-bold">OK</button>
                  </div>
                )}
              </div>
            ) : (
              <Scanner onSuccess={handleIdentify} />
            )}
          </div>
        ) : (
          <div className={`p-12 rounded-[3.5rem] text-center space-y-8 animate-in zoom-in duration-300 ${isSuccess ? "bg-white shadow-2xl" : "bg-white border-4 border-red-500"}`}>
             {isSuccess ? (
               <>
                 <CheckCircle2 size={80} className="mx-auto text-green-500" />
                 <div>
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest">{scanResult}</p>
                    <h2 className="text-5xl font-black text-gray-900 mt-2">{itemInfo.nome_kit}</h2>
                    <p className="text-green-600 font-bold text-xl mt-2">Sincronizado com Sucesso!</p>
                 </div>
                 <div className="pt-4">
                    <button 
                      onClick={() => { setScanResult(null); setItemInfo(null); setManualCode(""); }}
                      className="w-full bg-gray-900 text-white p-6 rounded-3xl font-black text-xl hover:scale-105 transition-transform"
                    >
                      PRÓXIMO BIPE
                    </button>
                 </div>
               </>
             ) : (
               <div className="text-red-500">
                  <h2 className="text-2xl font-bold">Item não encontrado!</h2>
                  <button onClick={() => setScanResult(null)} className="mt-6 font-bold underline">Tentar novamente</button>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}