import { Inspection, InspectionStatus, Potential, Supervisor, getTipoLancamento } from "../types";

export const FAROL_VLI_NAMES = [
  "Jose Mauricio Dos Santos Junior",
  "Murilo Henrique Goncallo Nascimento",
  "Klayton Anderson Sabino",
  "Wagner Monteiro",
  "Dener Rodrigues de Souza"
];

export const normalizeName = (value = "") => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase()
  .replace(/\s+/g, " ");

const farolNames = new Set(FAROL_VLI_NAMES.map(normalizeName));

export const isFarolVli = (supervisor: Supervisor) => farolNames.has(normalizeName(supervisor.nome));

export const getOperationalWeek = () => {
  const start = new Date("2026-07-09T00:00:00");
  const end = new Date("2026-07-16T23:59:59.999");
  return { start, end };
};

export const formatOperationalDate = (date: Date) => date.toLocaleDateString("pt-BR");

export const inspectionDate = (inspection: Inspection) => new Date(`${inspection.data}T00:00:00`);

export const getInspectionScore = (inspection: Inspection) => {
  if (getTipoLancamento(inspection.atividade, inspection.tipo) === "Presença em Campo") return 3;
  const potentialScore = inspection.potencial === Potential.CRITICO ? 5
    : inspection.potencial === Potential.GRAVE ? 3
    : inspection.potencial === Potential.MEDIO ? 2
    : inspection.potencial === Potential.LEVE ? 1
    : 0;
  return potentialScore + (inspection.status === InspectionStatus.CONCLUIDO ? 2 : 0);
};

export const getSupervisorTargets = (supervisor: Supervisor) => {
  const email = String(supervisor.email || "").trim().toLowerCase();
  const nome = String(supervisor.nome || "").toLowerCase();
  const id = String(supervisor.id || "").toLowerCase();

  if (
    email === "j.santos@grupofta.com.br" ||
    email === "jhonata.santos@grupofta.com.br" ||
    email.startsWith("jhonata") ||
    id.includes("j_santos") ||
    id.includes("jhonata") ||
    (nome.includes("jhonata") && (nome.includes("santos") || nome.includes("gonçalves") || nome.includes("goncalves")))
  ) {
    return {
      weekly: 2,
      monthly: 8
    };
  }

  return {
    weekly: supervisor.metaSemanal ?? (supervisor.unidade === "VLI" ? 7 : 4),
    monthly: supervisor.metaMensal ?? (supervisor.unidade === "VLI" ? 28 : 16)
  };
};
