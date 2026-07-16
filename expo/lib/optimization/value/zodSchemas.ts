import { z } from 'zod';
import { ConfidenceBandSchema, DataAuthoritySchema, OptimizationCasinoProgramSchema } from '../history/zodSchemas';

export const CertificateFamilySchema = z.enum(['A', 'C', 'B', 'D', 'VIP', 'AVIP', 'CVIP', 'SPECIAL', 'UNKNOWN']);
export const CertificateValueComponentKindSchema = z.enum([
  'cruise-fare', 'covered-taxes-fees', 'freeplay', 'obc', 'internet', 'drinks', 'dining', 'spa', 'suite-upgrade', 'itinerary', 'other',
]);

export const ValueSourceEvidenceSchema = z.object({
  source: z.string(),
  authority: DataAuthoritySchema,
  confidence: ConfidenceBandSchema,
  documentId: z.string().optional(),
  versionId: z.string().optional(),
  pageNumber: z.number().int().positive().optional(),
  capturedAt: z.string().optional(),
  notes: z.array(z.string()).optional(),
});

export const CertificateThresholdDefinitionSchema = z.object({
  id: z.string(),
  ownerProfileId: z.string().nullable(),
  program: OptimizationCasinoProgramSchema,
  family: CertificateFamilySchema,
  certificateCode: z.string(),
  levelCode: z.string().nullable(),
  thresholdPoints: z.number().positive(),
  effectiveStart: z.string(),
  effectiveEnd: z.string().nullable(),
  minimumNights: z.number().int().nonnegative().nullable(),
  maximumNights: z.number().int().nonnegative().nullable(),
  replacesLowerCertificate: z.boolean().nullable(),
  sourceEvidence: z.array(ValueSourceEvidenceSchema),
  isFallback: z.boolean(),
  version: z.string(),
  warnings: z.array(z.string()),
});

export const CertificateValueSnapshotSchema = z.object({
  id: z.string(), ownerProfileId: z.string(), thresholdDefinitionId: z.string(), certificateCode: z.string(),
  family: CertificateFamilySchema, thresholdPoints: z.number().positive(), effectiveStart: z.string(), effectiveEnd: z.string().nullable(),
  generatedAt: z.string(), grossReplacementValue: z.unknown(), netReplacementValue: z.unknown(), redemptionProbability: z.number().min(0).max(1),
  expectedRealizedValue: z.number().nonnegative(), expectedAlternativeValue: z.number().nonnegative(), expectedUserPaidCost: z.number().nonnegative(),
  tradeInAlternativeValue: z.number().nonnegative(), eligibleSailingCount: z.number().int().nonnegative(), sourceCount: z.number().int().nonnegative(),
  completeness: z.number().min(0).max(1), confidence: ConfidenceBandSchema, assumptions: z.array(z.string()), warnings: z.array(z.string()),
  valuedSailings: z.array(z.unknown()), version: z.string(),
});
