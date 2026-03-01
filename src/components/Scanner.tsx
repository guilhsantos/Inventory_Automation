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

        // Configuração para suportar múltiplos formatos
        const config = {
          fps: 20, // Mais frames por segundo para leitura rápida
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            // Cria um retângulo de leitura proporcional ao tamanho da tela
            const width = viewfinderWidth * 0.8;
            const height = width * 0.6; // Mais largo para códigos de barra
            return { width, height };
          },
          // Formatos que o scanner deve reconhecer
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_39
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
    // Removida borda e arredondamento excessivo para preencher melhor a tela
    <div id="reader" className="w-full h-full bg-black" />
  );
}