"use client";

import Link from "next/link";
import { Hammer, Package, AlertTriangle } from "lucide-react";

export default function OperatorProductionPage() {
  const actions = [
    {
      title: "Produção",
      description: "Registrar fabricação de peças avulsas e consumo de material",
      icon: <Hammer size={40} />,
      path: "/operator/manual-production", // Página para peças avulsas
      color: "bg-blue-600",
    },
    {
      title: "Kits",
      description: "Bipar código de barras para entrada de kits prontos",
      icon: <Package size={40} />,
      path: "/operator/scanner", // Sua tela de scanner atual
      color: "bg-[#5D286C]",
    },
    {
      title: "Defeito",
      description: "Registrar peças com defeitos técnicos",
      icon: <AlertTriangle size={40} />,
      path: "/operator/defects",
      color: "bg-red-600",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center md:text-left">
        <h1 className="text-4xl font-black text-[#262626]">Operação de Produção</h1>
        <p className="text-gray-500 font-bold mt-2">Selecione a atividade que deseja realizar agora.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {actions.map((action) => (
          <Link 
            key={action.title} 
            href={action.path}
            className="group relative bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm hover:shadow-xl hover:border-transparent transition-all overflow-hidden flex flex-col items-center text-center"
          >
            <div className={`${action.color} text-white p-6 rounded-3xl mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
              {action.icon}
            </div>
            <h3 className="text-2xl font-black text-[#262626] mb-2">{action.title}</h3>
            <p className="text-gray-400 font-medium text-sm leading-relaxed">
              {action.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}