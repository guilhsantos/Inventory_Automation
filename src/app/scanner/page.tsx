"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, Camera, Laptop, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth-context";

const Scanner = dynamic(() => import("@/components/Scanner"), { 
  ssr: false,
  loading: () => <div className="min-h-[350px] flex items-center justify-center bg-gray-50 rounded-[2.5rem] border border-gray-100 text-gray-400 font-bold">Iniciando Câmera...</div>
});

export default function ScannerPage() {
  const { loading: authLoading } = useAuth();
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(isMobileDevice);
    if (!isMobileDevice) {
      setTimeout(() => inputRef.current?.focus(), 500);
    }
  }, []);

  const handlePhysicalScanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      setScanResult(manualCode.toUpperCase());
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen p-6 max-w-md mx-auto">
      <div className="mt-4">
        {!scanResult ? (
          <div className="space-y-6">
            {!isMobile ? (
              <div className="bg-white p-10 rounded-[2.5rem] border-4 border-dashed border-gray-100 flex flex-col items-center text-center space-y-6 shadow-sm">
                <div className="bg-purple-50 p-6 rounded-full text-purple-600">
                  <Laptop size={64} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Modo Leitor USB</h2>
                  <p className="text-sm text-gray-400">Aguardando sinal do bipador...</p>
                </div>
                <form onSubmit={handlePhysicalScanner} className="w-full">
                  <input 
                    ref={inputRef}
                    type="text" 
                    placeholder="BIPE O ITEM"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="w-full p-5 bg-gray-50 border-2 border-purple-100 rounded-2xl focus:border-purple-600 text-center text-2xl font-black uppercase transition-all outline-none"
                    autoFocus
                  />
                </form>
              </div>
            ) : (
              <div className="space-y-6">
                {!showCamera ? (
                  <button 
                    onClick={() => setShowCamera(true)}
                    className="w-full min-h-[350px] flex flex-col items-center justify-center bg-white rounded-[2.5rem] border-[3px] border-dashed border-purple-200 text-purple-600 shadow-sm"
                  >
                    <div className="bg-purple-100 p-8 rounded-full mb-4">
                      <Camera size={48} />
                    </div>
                    <span className="font-black text-sm tracking-widest uppercase">Acionar Câmera</span>
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
                      className="bg-purple-600 text-white px-6 rounded-2xl font-bold"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border-4 border-purple-600 p-10 rounded-[3rem] text-center space-y-8 animate-in zoom-in duration-300 shadow-2xl shadow-purple-100">
            <div className="bg-purple-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-purple-600">
              <CheckCircle2 size={56} strokeWidth={3} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Item Identificado</p>
              <h2 className="text-4xl font-black text-gray-900 break-all">{scanResult}</h2>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => { setIsProcessing(true); setTimeout(() => { alert('Baixa confirmada!'); setScanResult(null); setIsProcessing(false); }, 1000); }}
                disabled={isProcessing}
                className="w-full bg-purple-600 text-white p-5 rounded-2xl font-black text-lg shadow-xl shadow-purple-200 flex items-center justify-center"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : "CONFIRMAR BAIXA"}
              </button>
              <button 
                onClick={() => { setScanResult(null); setManualCode(""); setShowCamera(false); }}
                className="w-full text-gray-400 font-bold text-sm"
              >
                LIMPAR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}