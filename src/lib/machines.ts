import { supabase } from "./supabase";

export type MachineStatus = "EM_OPERACAO" | "PARADA" | "MANUTENCAO";

export interface MachineState {
  id: number;
  nome: string;
  status: MachineStatus;
  current_molde_id: number | null;
  status_observacao: string | null;
  status_updated_at: string | null;
  moldes: { id: number; nome: string } | null;
}

export const MACHINE_STATUS_LABEL: Record<MachineStatus, string> = {
  EM_OPERACAO: "Em operação",
  PARADA: "Parada",
  MANUTENCAO: "Manutenção",
};

/** Classes do badge de status (fundo + texto). */
export const MACHINE_STATUS_BADGE: Record<MachineStatus, string> = {
  EM_OPERACAO: "bg-green-100 text-green-700",
  PARADA: "bg-red-100 text-red-700",
  MANUTENCAO: "bg-amber-100 text-amber-700",
};

export async function fetchMachineStates(): Promise<MachineState[]> {
  const { data, error } = await supabase
    .from("machines")
    .select("id, nome, status, current_molde_id, status_observacao, status_updated_at, moldes:current_molde_id(id, nome)")
    .order("nome");
  if (error) throw error;
  return (data as unknown as MachineState[]) || [];
}

export async function setMachineState(
  machineId: number,
  status: MachineStatus,
  moldeId: number | null,
  observacao: string | null
): Promise<void> {
  const { error } = await supabase.rpc("set_machine_state", {
    p_machine_id: machineId,
    p_status: status,
    p_molde_id: moldeId,
    p_observacao: observacao,
  });
  if (error) throw error;
}
