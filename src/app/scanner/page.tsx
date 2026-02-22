"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Keyboard, CheckCircle2, Camera, ScanLine, Laptop } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

// Import dinâmico do Scanner para evitar erro de SSR (Server Side Rendering)
const Scanner = dynamic(() => import("@/components/Scanner"), { 
  ssr: false,
  loading: () => <div className="min-h-[350px] flex items-center justify-center bg-gray-50 rounded-[2.5rem] border border-gray-100">Carregando Câmera...</div>
});

export default function ScannerPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Detecta se é celular ou computador no carregamento
  useEffect(() => {
    const checkDevice = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice);
    };
    
    checkDevice();
    // Se for Desktop, foca no input automaticamente
    if (!isMobile) {
      setTimeout(() => inputRef.current?.focus(), 500);
    }
  }, [isMobile]);

  // 2. Lógica para o leitor físico (Desktop)
  const handlePhysicalScanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      setScanResult(manualCode.toUpperCase());
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 font-sans">
      {/* Header */}
      <div className="flex items-center mb-6 max-w-md mx-auto pt-2">
        <Link href="/" className="p-3 mr-4 bg-gray-100 rounded-full text-gray-700 hover:bg-purple-50 transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Entrada de Itens</h1>
          <p className="text-xs text-purple-700 uppercase font-bold tracking-widest italic">
            {isMobile ? "Modo Mobile (Câmera)" : "Modo Desktop (Leitor USB)"}
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        {!scanResult ? (
          <div className="space-y-6">
            
            {/* --- VISÃO DESKTOP (BIPADOR) --- */}
            {!isMobile && (
              <div className="bg-white p-10 rounded-[2.5rem] border-4 border-dashed border-gray-100 flex flex-col items-center text-center space-y-6 shadow-sm">
                <div className="bg-purple-50 p-6 rounded-full text-purple-600">
                  <Laptop size={64} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Aguardando Bipagem...</h2>
                  <p className="text-sm text-gray-400">Use o leitor de mão ou digite o código</p>
                </div>
                
                <form onSubmit={handlePhysicalScanner} className="w-full">
                  <input 
                    ref={inputRef}
                    type="text" 
                    placeholder="BIPE AGORA"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="w-full p-5 bg-gray-50 border-2 border-purple-100 rounded-2xl focus:border-purple-600 text-center text-2xl font-black uppercase transition-all outline-none"
                    autoFocus
                  />
                  <button type="submit" className="hidden">Processar</button>
                </form>
              </div>
            )}

            {/* --- VISÃO MOBILE (CÂMERA) --- */}
            {isMobile && (
              <div className="space-y-6">
                {!showCamera ? (
                  <button 
                    onClick={() => setShowCamera(true)}
                    className="w-full min-h-[350px] flex flex-col items-center justify-center bg-gray-50 rounded-[2.5rem] border-[3px] border-dashed border-purple-200 text-purple-600 group"
                  >
                    <div className="bg-purple-100 p-8 rounded-full mb-4 group-hover:scale-110 transition-transform">
                      <Camera size={48} />
                    </div>
                    <span className="font-black text-sm tracking-widest uppercase">Toque para Abrir Câmera</span>
                  </button>
                ) : (
                  <Scanner onSuccess={(result) => setScanResult(result)} />
                )}
                
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      placeholder="CÓDIGO MANUAL"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="flex-1 p-4 bg-gray-50 border-transparent rounded-2xl focus:border-purple-600 text-gray-900 font-bold uppercase transition-all outline-none"
                    />
                    <button 
                      onClick={() => setScanResult(manualCode.toUpperCase())}
                      className="bg-gray-900 text-white px-6 rounded-2xl font-bold hover:bg-purple-600 transition-colors"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          /* --- TELA DE SUCESSO (COMUM AOS DOIS) --- */
          <div className="bg-white border-4 border-purple-600 p-10 rounded-[3rem] text-center space-y-8 animate-in zoom-in duration-300 shadow-2xl shadow-purple-100">
            <div className="bg-purple-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-purple-600">
              <CheckCircle2 size={56} strokeWidth={3} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Item Identificado</p>
              <h2 className="text-4xl font-black text-gray-900">{scanResult}</h2>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => { alert('Baixa enviada!'); setScanResult(null); setManualCode(""); }}
                className="w-full bg-purple-600 text-white p-5 rounded-2xl font-black text-lg shadow-xl shadow-purple-200"
              >
                CONFIRMAR BAIXA
              </button>
              <button 
                onClick={() => { setScanResult(null); setManualCode(""); setShowCamera(false); }}
                className="w-full text-gray-400 font-bold text-sm"
              >
                CANCELAR / LIMPAR
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-12 text-center pb-8">
        <p className="text-[10px] text-gray-300 font-bold uppercase tracking-[0.4em]">SGA Híbrido | Reauto Car</p>
      </div>
    </div>
  );
}