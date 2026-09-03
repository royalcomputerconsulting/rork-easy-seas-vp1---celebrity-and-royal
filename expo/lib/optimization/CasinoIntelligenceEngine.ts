import { buildPersonalGamblingProfile } from './models/buildPersonalGamblingProfile';
import type { BuildPersonalGamblingProfileInput, OptimizationModelSnapshot } from './models/types';
import { buildLiveCasinoAdvisorSnapshot, type BuildLiveCasinoAdvisorInput } from './live/buildLiveCasinoAdvisorSnapshot';
import type { LiveCasinoAdvisorSnapshot, LiveCasinoStateRecord } from './live/types';
import type { CertificateCandidateEvaluation } from './engine/types';
import { estimatePersonalPlayRates, type PersonalPlayRateEstimate } from './models/estimatePersonalPlayRates';

export const CASINO_INTELLIGENCE_ENGINE_VERSION = 'casino-intelligence-v1.0.0';

export interface CasinoIntelligenceCurvePoint {
  thresholdDefinitionId: string;
  certificateCode: string;
  targetPoints: number;
  successProbability: number;
  bankrollSurvivalProbability: number | null;
  expectedNetVacationValue: number;
  marginalEv: number;
  expectedAdditionalLoss: number;
  confidence: CertificateCandidateEvaluation['confidence'];
}

export interface CasinoIntelligenceDecision {
  engineVersion: string;
  generatedAt: string;
  liveAdvisor: LiveCasinoAdvisorSnapshot;
  nextBestAction: LiveCasinoAdvisorSnapshot['recommendation'];
  targetComparison: CertificateCandidateEvaluation[];
  probabilityCurve: CasinoIntelligenceCurvePoint[];
  expectedNetVacationValueCurve: CasinoIntelligenceCurvePoint[];
  alternatives: CertificateCandidateEvaluation[];
  personalPlayRates: PersonalPlayRateEstimate;
  explanation: {
    recommendation: string;
    currentState: { points: number; result: number; remainingBankroll: number | null };
    primaryReasons: string[];
    assumptions: string[];
    warnings: string[];
    formula: string;
  };
}

function curves(candidates: CertificateCandidateEvaluation[]): CasinoIntelligenceCurvePoint[] {
  return [...candidates].sort((a, b) => a.targetPoints - b.targetPoints).map(candidate => ({
    thresholdDefinitionId: candidate.thresholdDefinitionId,
    certificateCode: candidate.targetCertificateCode,
    targetPoints: candidate.targetPoints,
    successProbability: candidate.probabilityOfSuccess,
    bankrollSurvivalProbability: candidate.bankrollSurvivalProbability,
    expectedNetVacationValue: candidate.expectedNetVacationValue,
    marginalEv: candidate.riskAdjustedIncrementalExpectedValue,
    expectedAdditionalLoss: candidate.expectedAdditionalLoss,
    confidence: candidate.confidence,
  }));
}

/**
 * The single supported calculation boundary for Casino UI and AgentX.
 * Low-level modules remain pure and testable; consumers receive one complete,
 * explainable decision object and never recreate formulas in a screen.
 */
export class CasinoIntelligenceEngine {
  static buildPersonalModel(input: BuildPersonalGamblingProfileInput): OptimizationModelSnapshot {
    return buildPersonalGamblingProfile(input);
  }

  static evaluate(input: BuildLiveCasinoAdvisorInput): CasinoIntelligenceDecision {
    const liveAdvisor = buildLiveCasinoAdvisorSnapshot(input);
    const recommendation = liveAdvisor.recommendation;
    const personalPlayRates = estimatePersonalPlayRates({
      history: input.history,
      program: input.state.program,
      shipName: input.state.shipName,
      machineId: input.state.currentMachineId,
      machineFamily: input.state.currentMachineFamily,
      dayType: input.state.currentDayType,
      asOf: input.state.asOf,
      genericDollarsPerPoint: input.model.profile.priors.dollarsPerPoint,
      genericLossRate: input.model.profile.priors.theoreticalLossRate,
    });
    const curve = curves(recommendation.candidateEvaluations);
    const alternatives = [...recommendation.candidateEvaluations]
      .filter(candidate => candidate.thresholdDefinitionId !== recommendation.drillDown.selectedCandidateId)
      .sort((a, b) => b.expectedNetVacationValue - a.expectedNetVacationValue);
    return {
      engineVersion: CASINO_INTELLIGENCE_ENGINE_VERSION,
      generatedAt: liveAdvisor.generatedAt,
      liveAdvisor,
      nextBestAction: recommendation,
      targetComparison: [...recommendation.candidateEvaluations].sort((a, b) => {
        const selected = recommendation.drillDown.selectedCandidateId;
        if (a.thresholdDefinitionId === selected) return -1;
        if (b.thresholdDefinitionId === selected) return 1;
        return b.expectedNetVacationValue - a.expectedNetVacationValue || a.targetPoints - b.targetPoints;
      }),
      probabilityCurve: curve,
      expectedNetVacationValueCurve: curve,
      alternatives,
      personalPlayRates,
      explanation: {
        recommendation: recommendation.actionLabel,
        currentState: { points: input.state.currentPoints, result: input.state.currentResult, remainingBankroll: input.state.remainingBankroll },
        primaryReasons: recommendation.topReasons,
        assumptions: recommendation.assumptions,
        warnings: recommendation.warnings,
        formula: 'Expected Net Vacation Value = realized certificate value + future offer value + tier value + ancillary value - expected gambling loss - travel cost - cruise cost - unredeemed value loss - risk penalty',
      },
    };
  }

  static whatIf(input: BuildLiveCasinoAdvisorInput, changes: Partial<LiveCasinoStateRecord>): CasinoIntelligenceDecision {
    const state: LiveCasinoStateRecord = {
      ...input.state,
      ...changes,
      id: input.state.id,
      ownerProfileId: input.state.ownerProfileId,
      cruiseId: input.state.cruiseId,
      updatedAt: changes.updatedAt ?? new Date().toISOString(),
    };
    return this.evaluate({ ...input, state, now: state.updatedAt });
  }
}

export function evaluateCasinoIntelligence(input: BuildLiveCasinoAdvisorInput): CasinoIntelligenceDecision {
  return CasinoIntelligenceEngine.evaluate(input);
}
