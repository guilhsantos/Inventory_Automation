"use client";

import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Overlay com desfoque */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      
      {/* Caixa do Modal */}
      <div className="relative bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 text-center">
        <button onClick={onClose} className="absolute right-6 top-6 text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>

        {/* Ícone de Alerta */}
        <div className="bg-amber-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="text-amber-500" size={40} />
        </div>

        <h2 className="text-2xl font-black text-[#262626] mb-2 uppercase">{title}</h2>
        <p className="text-gray-500 font-bold text-sm leading-relaxed mb-8">
          {message}
        </p>

        {/* Botões de Ação */}
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-500 p-4 rounded-2xl font-black hover:bg-gray-200 transition-all uppercase text-xs"
          >
            Cancelar
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 bg-red-500 text-white p-4 rounded-2xl font-black shadow-lg shadow-red-100 hover:bg-red-600 transition-all uppercase text-xs"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}