"use client";

import { useState } from "react";
import { ArrowLeft, Keyboard, CheckCircle2, Camera } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

// IMPORTANTE: Isso evita o erro de Client-side exception
const Scanner = dynamic(() => import("@/components/Scanner"), { 
  ssr: false,
  loading: () => <div className="min-h-[350px] flex items-center justify-center bg-gray-50 rounded-[2.5rem]">Carregando Câmera...</div>
});

export default function ScannerPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 font-sans">
      {/* Header */}
      <div className="flex items-center mb-6 max-w-md mx-auto pt-2">
        <Link href="/" className="p-3 mr-4 bg-gray-100 rounded-full text-gray-700">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Leitor</h1>
          <p className="text-xs text-purple-700 uppercase font-bold tracking-widest">SGA | Reauto Car</p>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        {!scanResult ? (
          <div className="space-y-6">
            {!showScanner ? (
              <button 
                onClick={() => setShowScanner(true)}
                className="w-full min-h-[350px] flex flex-col items-center justify-center bg-gray-50 rounded-[2.5rem] border-[3px] border-dashed border-purple-200 text-purple-600 group hover:border-purple-600 transition-all"
              >
                <div className="bg-purple-100 p-8 rounded-full mb-4 group-hover:scale-110 transition-transform">
                  <Camera size={48} />
                </div>
                <span className="font-black text-sm tracking-widest uppercase">Toque para Iniciar</span>
              </button>
            ) : (
              <Scanner onSuccess={(result) => setScanResult(result)} />
            )}

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="DIGITE O CÓDIGO"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="flex-1 p-4 bg-gray-50 border-transparent rounded-2xl focus:border-purple-600 text-gray-900 font-bold uppercase transition-all"
                />
                <button 
                  onClick={() => setScanResult(manualCode.toUpperCase())}
                  className="bg-gray-900 text-white px-6 rounded-2xl font-bold"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border-4 border-purple-600 p-10 rounded-[3rem] text-center space-y-8 animate-in zoom-in duration-300 shadow-2xl shadow-purple-100">
            <CheckCircle2 size={72} className="mx-auto text-purple-600" />
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Item Identificado</p>
              <h2 className="text-4xl font-black text-gray-900">{scanResult}</h2>
            </div>
            <button 
              onClick={() => alert('Salvando...')}
              className="w-full bg-purple-600 text-white p-5 rounded-2xl font-black text-lg shadow-xl shadow-purple-200"
            >
              CONFIRMAR BAIXA
            </button>
            <button 
              onClick={() => { setScanResult(null); setShowScanner(false); }}
              className="w-full text-gray-400 font-bold text-sm"
            >
              CANCELAR
            </button>
          </div>
        )}
      </div>
    </div>
  );
}