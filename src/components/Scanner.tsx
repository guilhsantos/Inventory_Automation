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
          fps: 25, // Equilíbrio entre performance e processamento
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            // Área de leitura retangular ideal para barras
            return { 
              width: viewfinderWidth * 0.8, 
              height: viewfinderHeight * 0.3 
            };
          },
          // Forçamos a câmera a buscar a melhor resolução possível para ver as linhas do código de barras
          videoConstraints: {
            facingMode: "environment",
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 },
          },
          aspectRatio: 1.777778, 
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.CODE_93
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