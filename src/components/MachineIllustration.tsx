import { MachineStatus } from "@/lib/machines";

interface MachineIllustrationProps {
  status: MachineStatus;
  /** Máquina com molde definido e em operação: anima o fechamento do molde. */
  running: boolean;
  className?: string;
}

const STATUS_COLOR: Record<MachineStatus, string> = {
  EM_OPERACAO: "#2563eb",
  PARADA: "#dc2626",
  MANUTENCAO: "#d97706",
};

/**
 * Desenho de contorno de uma injetora (vista lateral): unidade de fechamento
 * à esquerda, molde no meio, canhão de injeção com funil à direita.
 * Em operação a placa móvel abre/fecha e o sinaleiro pisca.
 */
export default function MachineIllustration({ status, running, className }: MachineIllustrationProps) {
  const color = running ? STATUS_COLOR[status] : status === "EM_OPERACAO" ? "#9ca3af" : STATUS_COLOR[status];

  return (
    <svg
      viewBox="0 0 120 84"
      className={className}
      role="img"
      aria-label="Injetora"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <style>{`
        @keyframes mi-clamp { 0%, 35% { transform: translateX(0); } 50%, 85% { transform: translateX(7px); } 100% { transform: translateX(0); } }
        @keyframes mi-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes mi-feed { 0% { transform: translateY(-3px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(9px); opacity: 0; } }
        .mi-run .mi-platen { animation: mi-clamp 2.4s ease-in-out infinite; }
        .mi-run .mi-light { animation: mi-blink 1.2s ease-in-out infinite; }
        .mi-run .mi-pellet { animation: mi-feed 1.6s linear infinite; }
        .mi-run .mi-pellet-2 { animation-delay: 0.8s; }
        @media (prefers-reduced-motion: reduce) {
          .mi-run .mi-platen, .mi-run .mi-light, .mi-run .mi-pellet { animation: none; }
        }
      `}</style>

      <g className={running ? "mi-run" : undefined}>
        {/* Base e pés */}
        <rect x="6" y="62" width="108" height="10" rx="2" />
        <line x1="14" y1="72" x2="14" y2="78" />
        <line x1="106" y1="72" x2="106" y2="78" />

        {/* Unidade de fechamento */}
        <rect x="10" y="28" width="16" height="34" rx="2" />
        <line x1="26" y1="34" x2="56" y2="34" />
        <line x1="26" y1="56" x2="56" y2="56" />
        <g className="mi-platen">
          <rect x="30" y="30" width="6" height="30" rx="1" fill={color} fillOpacity={0.12} />
        </g>

        {/* Placa fixa + molde */}
        <rect x="44" y="30" width="6" height="30" rx="1" />
        <rect x="50" y="36" width="8" height="18" rx="1" fill={color} fillOpacity={0.12} />

        {/* Canhão de injeção */}
        <rect x="58" y="41" width="34" height="8" rx="2" />
        <line x1="66" y1="41" x2="66" y2="49" />
        <line x1="74" y1="41" x2="74" y2="49" />
        <rect x="92" y="34" width="18" height="22" rx="2" />
        <line x1="96" y1="56" x2="96" y2="62" />
        <line x1="106" y1="56" x2="106" y2="62" />

        {/* Funil de material */}
        <path d="M74 14 H90 L85 28 H79 Z" />
        <line x1="82" y1="28" x2="82" y2="41" />
        <circle className="mi-pellet" cx="82" cy="20" r="1.2" fill={color} stroke="none" opacity={running ? 1 : 0} />
        <circle className="mi-pellet mi-pellet-2" cx="80" cy="20" r="1.2" fill={color} stroke="none" opacity={running ? 1 : 0} />

        {/* Painel e sinaleiro */}
        <rect x="11" y="12" width="14" height="10" rx="1.5" />
        <line x1="18" y1="22" x2="18" y2="28" />
        <circle className="mi-light" cx="18" cy="6" r="3" fill={color} stroke="none" />
      </g>
    </svg>
  );
}
