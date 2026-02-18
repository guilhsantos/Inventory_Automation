"use client";
import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface ScannerProps {
  onSuccess: (result: string) => void;
}

export default function Scanner({ onSuccess }: ScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // Garante que o código só rode no navegador
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (result) => {
            onSuccess(result);
          },
          () => {} // Ignora falhas de foco
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
    <div id="reader" className="w-full overflow-hidden rounded-[2.5rem] border-[3px] border-purple-600 bg-gray-50 min-h-[350px] shadow-2xl shadow-purple-100" />
  );
}