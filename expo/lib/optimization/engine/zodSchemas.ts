import { z } from 'zod';
import { ConfidenceBandSchema, OptimizationCasinoBrandSchema, OptimizationCasinoProgramSchema } from '../history/zodSchemas';
import { CertificateFamilySchema } from '../value/zodSchemas';

export const CertificateRecommendationActionSchema = z.enum([
  'DATA_UNAVAILABLE','HARD_STOP','STOP_NOW','BANK_YOUR_WIN','DO_NOT_CHASE','PLAY_ONE_MORE_SESSION','CONTINUE_UNTIL_TARGET','PROFIT_PROTECTED_PUSH','EXCELLENT_OPPORTUNITY',
]);
export const LiveOptimizationStateSchema = z.object({
  ownerProfileId: z.string(), program: OptimizationCasinoProgramSchema, brand: OptimizationCasinoBrandSchema, certificateFamily: CertificateFamilySchema,
  shipName: z.string().nullable().optional(), cruiseNights: z.number().nullable().optional(), currentPoints: z.number().nonnegative(), currentResult: z.number(),
  currentCoinIn: z.number().nonnegative().nullable().optional(), remainingCasinoHours: z.number().nonnegative().nullable(), remainingCasinoDays: z.number().nonnegative().nullable(),
  remainingBankroll: z.number().nonnegative().nullable(), dailyBankrollBudget: z.number().nonnegative(), tripBankrollBudget: z.number().nonnegative().nullable(),
  currentDailyLoss: z.number().nonnegative(), currentTripLoss: z.number().nonnegative(), hardDailyLossLimit: z.number().nonnegative(), hardTripLossLimit: z.number().nonnegative().nullable(),
  lockedProfitFloor: z.number().nonnegative().nullable(), sourceFreshness: z.string().nullable(), asOf: z.string(),
}).passthrough();
export const CertificateRecommendationSnapshotSchema = z.object({
  id: z.string(), ownerProfileId: z.string(), generatedAt: z.string(), action: CertificateRecommendationActionSchema, actionLabel: z.string(),
  recommendedTargetPoints: z.number().nullable(), currentLockedThresholdPoints: z.number().nullable(), currentPoints: z.number().nonnegative(), currentResult: z.number(),
  expectedEndOfCruisePoints: z.number(), probabilityOfSuccess: z.number().min(0).max(1).nullable(), expectedAdditionalCoinIn: z.number().nonnegative(), expectedAdditionalLoss: z.number().nonnegative(),
  confidence: ConfidenceBandSchema, warnings: z.array(z.string()), assumptions: z.array(z.string()), engineVersion: z.string(), modelVersion: z.string(), candidateEvaluations: z.array(z.unknown()),
}).passthrough();
