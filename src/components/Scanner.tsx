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
          fps: 20,
          // Remova o qrbox ou aumente-o consideravelmente para códigos longos
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            return { 
              width: viewfinderWidth * 0.95, 
              height: viewfinderHeight * 0.4 
            };
          },
          aspectRatio: 1.777778,
          // Configurações experimentais que ajudam muito em barcodes de baixa densidade
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true 
          },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_39, // Padrão
            Html5QrcodeSupportedFormats.CODE_93, // Versão densa
            Html5QrcodeSupportedFormats.CODE_128, // Versão logística
            Html5QrcodeSupportedFormats.QR_CODE
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