import { z } from 'zod';
import { ConfidenceBandSchema, OptimizationCasinoBrandSchema, OptimizationCasinoProgramSchema } from '../history/zodSchemas';

export const PersonalTargetLabelSchema = z.enum(['Comfortable', 'Primary Target', 'Stretch Goal', 'Exceptional Goal', 'Normally Avoid', 'Unrealistic']);
export const PersonalOptimizerPriorsSchema = z.object({
  ownerProfileId: z.string(), dailyBankrollBudget: z.number().nonnegative(), tripBankrollBudget: z.number().nonnegative().nullable(),
  volatilityTolerance: z.enum(['conservative', 'moderate', 'aggressive']), dollarsPerPoint: z.number().positive(), theoreticalLossRate: z.number().min(0).max(1),
  minimumPromotionSamples: z.number().int().positive(), minimumStableSuccessProbability: z.number().min(0).max(1),
  defaultThresholdLabels: z.record(z.string(), PersonalTargetLabelSchema), source: z.string(), updatedAt: z.string(),
});
export const LiveTargetContextSchema = z.object({
  ownerProfileId: z.string(), program: OptimizationCasinoProgramSchema, brand: OptimizationCasinoBrandSchema, shipName: z.string().nullable().optional(),
  cruiseNights: z.number().nullable().optional(), currentPoints: z.number().nonnegative(), targetPoints: z.number().positive(), remainingCasinoHours: z.number().nonnegative().nullable(),
  remainingCasinoDays: z.number().nonnegative().nullable(), currentResult: z.number(), remainingBankroll: z.number().nonnegative().nullable(), machineFamilies: z.array(z.string()).optional(), asOf: z.string(),
});
export const ThresholdStatisticsSchema = z.object({
  thresholdDefinitionId: z.string(), thresholdPoints: z.number().positive(), certificateCode: z.string(), opportunities: z.number().int().nonnegative(), attempts: z.number().int().nonnegative(),
  successes: z.number().int().nonnegative(), failures: z.number().int().nonnegative(), rawSuccessRate: z.number().min(0).max(1).nullable(), smoothedSuccessRate: z.number().min(0).max(1),
  successRateConfidenceInterval: z.object({ low: z.number().min(0).max(1), high: z.number().min(0).max(1) }), confidence: ConfidenceBandSchema,
}).passthrough();
export const OptimizationModelSnapshotSchema = z.object({
  id: z.string(), ownerProfileId: z.string(), generatedAt: z.string(), canonicalHistorySnapshotId: z.string(), certificateValueSnapshotIds: z.array(z.string()),
  profile: z.unknown(), modelVersion: z.string(), priorSnapshotId: z.string().nullable(), deterministicFingerprint: z.string(),
});
