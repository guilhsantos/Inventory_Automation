"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Keyboard, CheckCircle2, Camera, Loader2 } from "lucide-react";
import Link from "next/link";

export default function ScannerPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLibLoaded, setIsLibLoaded] = useState(false);
  const scannerRef = useRef<any>(null);

  // Carrega a biblioteca apenas no lado do cliente
  useEffect(() => {
    import("html5-qrcode").then((lib) => {
      scannerRef.current = lib;
      setIsLibLoaded(true);
    });
  }, []);

  const startCamera = async () => {
    if (!scannerRef.current) return;

    try {
      const { Html5Qrcode } = scannerRef.current;
      const html5QrCode = new Html5Qrcode("reader");
      
      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0 
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (result: string) => {
          setScanResult(result);
          html5QrCode.stop();
          setIsCameraActive(false);
        },
        () => { /* ignora erros de foco */ }
      );
      
      setIsCameraActive(true);
    } catch (err) {
      console.error(err);
      alert("Câmera não disponível ou permissão negada.");
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 font-sans">
      {/* Header */}
      <div className="flex items-center mb-6 max-w-md mx-auto pt-2">
        <Link href="/" className="p-3 mr-4 bg-gray-100 rounded-full text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-all">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Leitor</h1>
          <p className="text-xs text-purple-700 uppercase font-bold tracking-widest text-left">SGA | Reauto Car</p>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        {!scanResult ? (
          <div className="space-y-6">
            {/* Área do Scanner */}
            <div className="relative">
              <div 
                id="reader" 
                className={`overflow-hidden rounded-[2.5rem] border-[3px] ${isCameraActive ? 'border-purple-600 shadow-2xl shadow-purple-100' : 'border-gray-200'} bg-gray-50 min-h-[350px] flex items-center justify-center transition-all duration-500`}
              >
                {!isCameraActive && (
                  <button 
                    onClick={startCamera}
                    disabled={!isLibLoaded}
                    className="flex flex-col items-center text-purple-600 group"
                  >
                    <div className="bg-purple-100 p-8 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300">
                      {isLibLoaded ? <Camera size={48} /> : <Loader2 size={48} className="animate-spin text-gray-400" />}
                    </div>
                    <span className="font-black text-sm tracking-widest uppercase">
                      {isLibLoaded ? "Iniciar Câmera" : "Carregando Módulo..."}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Divisor */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-100"></div>
              <span className="flex-shrink mx-4 text-gray-300 text-[10px] font-bold uppercase tracking-widest">Ou digite o código</span>
              <div className="flex-grow border-t border-gray-100"></div>
            </div>

            {/* Entrada Manual */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="DIGITE O CÓDIGO"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="flex-1 p-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-50 text-gray-900 font-bold uppercase transition-all"
                />
                <button 
                  onClick={() => setScanResult(manualCode.toUpperCase())}
                  className="bg-gray-900 text-white px-6 rounded-2xl font-bold hover:bg-purple-600 transition-colors shadow-lg shadow-gray-200"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Tela de Sucesso */
          <div className="bg-white border-4 border-purple-600 p-10 rounded-[3rem] text-center space-y-8 animate-in zoom-in duration-300 shadow-2xl shadow-purple-100">
            <div className="bg-purple-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-purple-600">
                <CheckCircle2 size={56} strokeWidth={3} />
            </div>
            <div>
                <h2 className="text-gray-400 font-bold uppercase text-xs tracking-[0.2em] mb-2">Item Identificado</h2>
                <p className="text-4xl font-black text-gray-900 break-all">{scanResult}</p>
            </div>
            <div className="space-y-3">
                <button 
                  onClick={() => alert('Salvando no Supabase...')}
                  className="w-full bg-purple-600 text-white p-5 rounded-2xl font-black text-lg shadow-xl shadow-purple-200 active:scale-95 transition-transform"
                >
                  CONFIRMAR BAIXA
                </button>
                <button 
                  onClick={() => { setScanResult(null); setIsCameraActive(false); }}
                  className="w-full bg-white text-gray-400 p-3 rounded-2xl font-bold text-sm hover:text-purple-600 transition-colors"
                >
                  CANCELAR
                </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-12 text-center pb-8">
        <p className="text-[10px] text-gray-300 font-bold uppercase tracking-[0.4em]">SGA Enterprise v1.0</p>
      </div>
    </div>
  );
}