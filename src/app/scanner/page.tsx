"use client";

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode"; // Mudamos para a versão mais direta
import { ArrowLeft, Keyboard, CheckCircle2, Camera } from "lucide-react";
import Link from "next/link";

export default function ScannerPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const startCamera = async () => {
    try {
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      await html5QrCode.start(
        { facingMode: "environment" }, // Força a câmera traseira
        config,
        (result) => {
          setScanResult(result);
          stopCamera();
        },
        (error) => { /* ignora erros de foco */ }
      );
      setIsCameraActive(true);
    } catch (err) {
      console.error("Erro ao iniciar câmera:", err);
      alert("Erro ao acessar câmera. Verifique as permissões do navegador.");
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop();
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 font-sans">
      {/* Header */}
      <div className="flex items-center mb-6 max-w-md mx-auto pt-2">
        <Link href="/" onClick={stopCamera} className="p-3 mr-4 bg-gray-100 rounded-full text-gray-700">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Leitor</h1>
          <p className="text-xs text-purple-700 uppercase font-bold tracking-widest">SGA | Reauto Car</p>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        {!scanResult ? (
          <div className="space-y-6">
            {/* Área do Scanner */}
            <div className="relative">
              <div 
                id="reader" 
                className={`overflow-hidden rounded-3xl border-[3px] ${isCameraActive ? 'border-purple-600' : 'border-gray-200'} bg-gray-50 min-h-[300px] flex items-center justify-center`}
              >
                {!isCameraActive && (
                  <button 
                    onClick={startCamera}
                    className="flex flex-col items-center text-purple-600 font-bold"
                  >
                    <div className="bg-purple-100 p-6 rounded-full mb-3">
                      <Camera size={48} />
                    </div>
                    <span>CLIQUE PARA INICIAR CÂMERA</span>
                  </button>
                )}
              </div>
            </div>

            {/* Entrada Manual */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center mb-4 text-purple-700">
                <Keyboard size={24} className="mr-3" />
                <span className="text-sm font-bold uppercase tracking-tight">Entrada Manual</span>
              </div>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="EX: KIT-001"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="flex-1 p-4 bg-gray-50 border border-gray-300 rounded-xl focus:border-purple-600 uppercase"
                />
                <button 
                  onClick={() => setScanResult(manualCode.toUpperCase())}
                  className="bg-purple-600 text-white px-6 rounded-xl font-bold"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Sucesso */
          <div className="bg-white border-2 border-purple-500 p-8 rounded-3xl text-center space-y-6">
            <CheckCircle2 size={72} className="mx-auto text-purple-600" />
            <h2 className="text-2xl font-black italic">{scanResult}</h2>
            <button 
              onClick={() => { setScanResult(null); setIsCameraActive(false); }}
              className="w-full bg-purple-600 text-white p-4 rounded-xl font-bold"
            >
              LER OUTRO
            </button>
          </div>
        )}
      </div>
    </div>
  );
}