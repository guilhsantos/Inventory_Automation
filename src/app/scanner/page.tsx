"use client";

import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { ArrowLeft, Keyboard, CheckCircle2, ScanLine } from "lucide-react";
import Link from "next/link";

export default function ScannerPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Evita recriar o scanner se já existir
    if (scannerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true
      },
      /* verbose= */ false
    );
    
    scannerRef.current = scanner;

    const onScanSuccess = (result: string) => {
      setScanResult(result);
      // Tenta limpar, se der erro de Promise, apenas loga
      scanner.clear().catch(err => console.warn("Erro ao limpar após sucesso (ignorar):", err));
      scannerRef.current = null; // Reseta a ref
    };

    const onScanFailure = (error: any) => {
      // Ignora falhas de leitura enquanto foca
    };

    scanner.render(onScanSuccess, onScanFailure);

    // Cleanup function corrigida para TypeScript
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => {
           console.warn("Erro no cleanup do scanner (ignorar):", err);
        });
        scannerRef.current = null;
      }
    };
  }, []);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      setScanResult(manualCode.toUpperCase()); // Normaliza para maiúsculo
    }
  };

  // Função para resetar a tela e tentar de novo
  const resetScanner = () => {
    setScanResult(null);
    setManualCode("");
    // Um reload suave da página para garantir que a câmera reinicie limpa
    window.location.reload(); 
  };

  return (
    // MUDANÇA 1: Fundo branco e texto escuro (Preto/Cinza)
    <div className="min-h-screen bg-white text-gray-900 p-4 font-sans">
      {/* Header */}
      <div className="flex items-center mb-6 max-w-md mx-auto pt-2">
        <Link href="/" className="p-3 mr-4 bg-gray-100 rounded-full text-gray-700 hover:bg-gray-200 hover:text-purple-700 transition-all">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Leitor de Código</h1>
          {/* MUDANÇA 2: Subtítulo em Roxo */}
          <p className="text-xs text-purple-700 uppercase tracking-widest font-bold">SGA | Reauto Car</p>
        </div>
      </div>

      <div className="max-w-md mx-auto mt-8">
        {!scanResult ? (
          <div className="space-y-8">
            {/* Área do Scanner */}
            <div className="relative group">
              {/* MUDANÇA 3: Borda Roxa e Sombra Roxa */}
              <div 
                id="reader" 
                className="overflow-hidden rounded-3xl border-[3px] border-purple-600 bg-gray-50 shadow-2xl shadow-purple-200/50"
              ></div>
              
              {/* Ícone decorativo sobre a câmera */}
              <div className="absolute top-4 right-4 bg-white/80 p-2 rounded-full text-purple-600 animate-pulse">
                <ScanLine size={24} />
              </div>
            </div>
            
            <div className="text-center bg-purple-50 p-3 rounded-lg">
              <p className="text-purple-900 text-sm font-medium">
                Aponte a câmera para o QR Code do Kit ou Peça
              </p>
            </div>

            {/* Divisor */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase font-bold tracking-wider">Opção Manual</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* Entrada Manual (O Seguro do Analista Sênior) */}
            {/* MUDANÇA 4: Card Branco com borda suave */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4 text-purple-700">
                <Keyboard size={24} className="mr-3" />
                <span className="text-sm font-bold uppercase tracking-tight">Digitar Código</span>
              </div>
              <div className="flex gap-3">
                {/* MUDANÇA 5: Input claro com foco roxo */}
                <input 
                  type="text" 
                  placeholder="Ex: KIT-001"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="flex-1 p-4 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 text-gray-900 font-medium placeholder:text-gray-400 uppercase transition-all"
                />
                {/* MUDANÇA 6: Botão Roxo */}
                <button 
                  onClick={handleManualSubmit}
                  disabled={!manualCode.trim()}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 rounded-xl font-bold transition-colors shadow-md hover:shadow-purple-200"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Tela de Sucesso após Bipar */
          // MUDANÇA 7: Card Branco com destaque Roxo intenso
          <div className="bg-white border-2 border-purple-500 p-8 rounded-3xl text-center space-y-6 shadow-2xl shadow-purple-100 animate-in fade-in zoom-in duration-300 mt-12">
            <div className="flex justify-center">
              <div className="bg-purple-100 p-5 rounded-full text-purple-600 ring-4 ring-purple-50">
                <CheckCircle2 size={72} strokeWidth={3} />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-900 mb-2 leading-tight">Código<br/>Identificado!</h2>
              <div className="bg-gray-100 inline-block px-6 py-2 rounded-full mt-2">
                 <p className="text-xl font-bold text-purple-900 tracking-wider uppercase">{scanResult}</p>
              </div>
            </div>
            
            <div className="space-y-4 pt-6">
              {/* MUDANÇA 8: Botões de Ação Roxos */}
              <button 
                onClick={() => { alert('Fase 2: Isso salvará no banco de dados!') }}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-xl font-bold text-lg shadow-lg shadow-purple-200 transition-transform hover:scale-[1.02] active:scale-95"
              >
                Confirmar Baixa
              </button>
              <button 
                onClick={resetScanner} 
                className="w-full bg-white text-purple-700 border-2 border-purple-100 hover:border-purple-300 hover:bg-purple-50 p-4 rounded-xl font-bold text-lg transition-colors"
              >
                Ler Outro Item
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Informativo */}
      <div className="mt-16 text-center pb-6">
        <p className="text-[10px] text-gray-400 uppercase tracking-[0.3em] font-medium">
          Powered by Reauto Car Tech Division
        </p>
      </div>
    </div>
  );
}