/**
 * RiskAnalysisService — Fase 2 (no implementado).
 *
 * Queda la interfaz preparada para el análisis de riesgo a partir de la
 * actividad importada (.exam/activity.ndjson). El sistema NUNCA afirma que un
 * alumno "hizo trampa" o "usó IA": usa terminología neutral
 * ("riesgo alto", "requiere revisión", "patrón atípico").
 */
export interface RiskAnalysisResult {
  riskScore: number;
  riskLevel: "bajo" | "medio" | "alto" | "requiere_revision";
  flags: Record<string, unknown>;
  summary: string;
}

export interface RiskAnalysisService {
  analyze(enrollmentId: string): Promise<RiskAnalysisResult>;
}

export class NotImplementedRiskAnalysisService implements RiskAnalysisService {
  async analyze(_enrollmentId: string): Promise<RiskAnalysisResult> {
    throw new Error("RiskAnalysisService no implementado (Fase 2).");
  }
}

export function getRiskAnalysisService(): RiskAnalysisService {
  return new NotImplementedRiskAnalysisService();
}
