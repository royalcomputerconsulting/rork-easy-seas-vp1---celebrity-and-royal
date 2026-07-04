export type OfferCodeClassification = {
  code: string;
  offerType: 'instant-certificate' | 'marketing-offer' | 'annual-cruise' | 'fcc' | 'nextcruise' | 'freeplay' | 'unknown';
  bank?: 'A' | 'C';
  levelCode?: string;
  pointsRequired?: number;
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
};

const LADDER: Record<string, number> = { VIP2: 40000, '01': 25000, '02': 15000, '02A': 9000, '03': 6500, '03A': 4000, '04': 3000, '05': 2000, '06': 1500, '07': 1200, '08': 800, '09': 600, '10': 400 };

export function classifyOfferCode(rawCode?: string | null): OfferCodeClassification {
  const code = String(rawCode ?? '').trim().toUpperCase();
  const notes: string[] = [];
  if (!code) return { code, offerType: 'unknown', confidence: 'low', notes: ['No offer code available.'] };
  if (code.includes('FCC')) return { code, offerType: 'fcc', confidence: 'medium', notes };
  if (code.includes('NEXT')) return { code, offerType: 'nextcruise', confidence: 'medium', notes };
  if (code.includes('ANNUAL')) return { code, offerType: 'annual-cruise', confidence: 'medium', notes };
  if (code.includes('FP')) return { code, offerType: 'freeplay', confidence: 'medium', notes };
  const instant = code.match(/^(\d{4})(A|C)(VIP2|\d{2}A?|\d{2})/);
  if (instant) {
    const bank = instant[2] as 'A' | 'C';
    const levelCode = instant[3];
    return { code, offerType: 'instant-certificate', bank, levelCode, pointsRequired: LADDER[levelCode], confidence: LADDER[levelCode] ? 'high' : 'medium', notes };
  }
  return { code, offerType: 'marketing-offer', confidence: 'medium', notes: ['Non-instant codes default to marketing offers unless explicitly marked otherwise.'] };
}
