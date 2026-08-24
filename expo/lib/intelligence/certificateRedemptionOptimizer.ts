import type { LocalCertificateLevel, LocalCertificateSailingMatch } from '@/lib/certificates/certificateSailingIndex';
import type { RecommendationConfidence } from '@/types/intelligence';

export interface CertificateRedemptionPreference {
  certificateCode: string;
  expiryDate?: string;
  airfareBySailing?: Record<string, number>;
  taxesBySailing?: Record<string, number>;
  upgradeBySailing?: Record<string, number>;
  blackoutSailingKeys?: string[];
  preferredShips?: string[];
}

export interface CertificateRedemptionRecommendation {
  sailingKey: string;
  shipName: string;
  sailDate: string;
  certificateCode: string;
  cabinLabel: string | null;
  expectedOutOfPocket: number;
  benefitValue: number;
  opportunityScore: number;
  confidence: RecommendationConfidence;
  reasons: string[];
  missingData: string[];
}

const amount = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
const keyFor = (match: Pick<LocalCertificateSailingMatch, 'shipName' | 'sailDate'>) => `${match.shipName.trim().toLowerCase()}__${match.sailDate.slice(0, 10)}`;

function findLevel(match: LocalCertificateSailingMatch, code: string): LocalCertificateLevel | undefined {
  return match.levels.find((level) => level.certificateCode.trim().toUpperCase() === code.trim().toUpperCase());
}

export function optimizeCertificateRedemption(
  sailings: LocalCertificateSailingMatch[],
  preference: CertificateRedemptionPreference,
  now = new Date(),
): CertificateRedemptionRecommendation[] {
  const blackouts = new Set(preference.blackoutSailingKeys ?? []);
  const preferredShips = new Set((preference.preferredShips ?? []).map((ship) => ship.trim().toLowerCase()));
  const expiry = preference.expiryDate ? Date.parse(preference.expiryDate) : null;
  return sailings.flatMap((match): CertificateRedemptionRecommendation[] => {
    const level = findLevel(match, preference.certificateCode);
    if (!level) return [];
    const sailingKey = keyFor(match);
    const sailTime = Date.parse(match.sailDate);
    if (blackouts.has(sailingKey) || (expiry !== null && Number.isFinite(sailTime) && sailTime > expiry)) return [];
    const airfare = preference.airfareBySailing?.[sailingKey];
    const taxes = preference.taxesBySailing?.[sailingKey];
    const upgrade = preference.upgradeBySailing?.[sailingKey];
    const missingData = [airfare == null ? 'airfare' : '', taxes == null ? 'taxes and fees' : '', upgrade == null ? 'incremental upgrade cost' : ''].filter(Boolean);
    const expectedOutOfPocket = amount(airfare) + amount(taxes) + amount(upgrade);
    const benefitValue = amount(level.freePlay) + amount(level.onBoardCredit);
    const preferredBonus = preferredShips.has(match.shipName.trim().toLowerCase()) ? 12 : 0;
    const soonBonus = Number.isFinite(sailTime) ? Math.max(0, 12 - Math.max(0, sailTime - now.getTime()) / 86_400_000 / 30) : 0;
    const valueScore = Math.min(55, Math.max(0, (benefitValue - expectedOutOfPocket) / 25));
    const opportunityScore = Math.round(Math.max(0, Math.min(100, 30 + preferredBonus + soonBonus + valueScore - missingData.length * 6)));
    return [{
      sailingKey,
      shipName: match.shipName,
      sailDate: match.sailDate,
      certificateCode: level.certificateCode,
      cabinLabel: level.cabinLabel,
      expectedOutOfPocket,
      benefitValue,
      opportunityScore,
      confidence: missingData.length === 0 ? 'high' : missingData.length <= 1 ? 'medium' : 'low',
      reasons: [
        `${level.cabinLabel || 'Saved cabin entitlement'} on ${match.shipName}.`,
        `${benefitValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} saved free play/OBC value.`,
        preferredBonus ? 'Matches a preferred ship.' : 'No preferred-ship bonus applied.',
      ],
      missingData,
    }];
  }).sort((left, right) => right.opportunityScore - left.opportunityScore || left.sailDate.localeCompare(right.sailDate));
}
