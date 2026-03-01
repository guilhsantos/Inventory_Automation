"use client";
import { useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface ScannerProps {
  onSuccess: (result: string) => void;
}

export default function Scanner({ onSuccess }: ScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = {
          fps: 30, // Aumentado para maior fluidez
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            // Retângulo retangular otimizado para códigos de barra em pé ou deitado
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.floor(minEdge * 0.8);
            return { 
              width: viewfinderWidth * 0.85, 
              height: viewfinderHeight * 0.35 // Mais baixo e largo para barras
            };
          },
          aspectRatio: 1.777778, // Força 16:9 para capturar mais detalhes laterais (barras)
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF
          ]
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (result) => {
            onSuccess(result);
          },
          () => {} 
        );
      } catch (err) {
        console.error("Erro ao iniciar scanner:", err);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(e => console.error(e));
      }
    };
  }, [onSuccess]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* CSS Injetado para garantir que o vídeo preencha tudo sem faixas pretas */}
      <style dangerouslySetInnerHTML={{ __html: `
        #reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}} />
      <div id="reader" className="w-full h-full bg-black" />
    </div>
  );
}