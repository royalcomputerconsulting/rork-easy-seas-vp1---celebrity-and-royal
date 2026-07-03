import type { CompletedCruiseCasinoValueRecord } from '@/lib/cruise/completedCruiseHistory';

export type ShipCasinoHistorySummary = {
  shipName: string;
  totalCompletedCruises: number;
  totalCasinoPointsEarned: number;
  averagePointsPerCruise: number;
  averagePointsPerCasinoDay: number;
  totalCasinoWinLoss: number;
  averageWinLossPerCruise: number;
  totalFreePlayReceived: number;
  totalTradeInValue: number;
  totalObcValue: number;
  totalCasinoCompValue: number;
  totalCruiseValueReceived: number;
  bestCertificateEarned?: string;
  highestPointCruise?: CompletedCruiseCasinoValueRecord;
  bestWinLossCruise?: CompletedCruiseCasinoValueRecord;
  worstWinLossCruise?: CompletedCruiseCasinoValueRecord;
  shipFamiliarityScore: number;
  casinoStrengthSignal: 'elite' | 'strong' | 'developing' | 'limited' | 'unknown';
  warnings: string[];
};

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function certificateRank(code?: string): number {
  const text = String(code ?? '').toUpperCase();
  if (text.includes('VIP2')) return 0;
  const match = text.match(/(01|02A|02|03A|03|04|05|06|07|08|09|10)$/);
  const order = ['VIP2', '01', '02', '02A', '03', '03A', '04', '05', '06', '07', '08', '09', '10'];
  return match ? order.indexOf(match[1]) : Number.MAX_SAFE_INTEGER;
}

function bestCertificate(records: CompletedCruiseCasinoValueRecord[]): string | undefined {
  return records
    .map((record) => record.certificateCodeEarned || record.certificateLevelEarned)
    .filter(Boolean)
    .sort((a, b) => certificateRank(a) - certificateRank(b))[0];
}

export function buildShipCasinoHistory(records: CompletedCruiseCasinoValueRecord[]): ShipCasinoHistorySummary[] {
  const byShip = new Map<string, CompletedCruiseCasinoValueRecord[]>();
  records.forEach((record) => {
    const ship = record.shipName || 'Unknown Ship';
    byShip.set(ship, [...(byShip.get(ship) ?? []), record]);
  });

  return [...byShip.entries()].map(([shipName, shipRecords]) => {
    const totalCompletedCruises = shipRecords.length;
    const totalCasinoPointsEarned = shipRecords.reduce((sum, record) => sum + num(record.pointsEarned), 0);
    const totalCasinoWinLoss = shipRecords.reduce((sum, record) => sum + num(record.casinoWinLoss), 0);
    const totalFreePlayReceived = shipRecords.reduce((sum, record) => sum + num(record.freeplayValue), 0);
    const totalTradeInValue = shipRecords.reduce((sum, record) => sum + num(record.tradeInValue), 0);
    const totalObcValue = shipRecords.reduce((sum, record) => sum + num(record.obcValue) + num(record.signatureObcValue), 0);
    const totalCasinoCompValue = shipRecords.reduce((sum, record) => sum + num(record.casinoCompValue), 0);
    const totalCruiseValueReceived = shipRecords.reduce((sum, record) => sum + num(record.totalValueReceived, num(record.totalGrossValue, num(record.casinoCompValue))), 0);
    const totalCasinoDays = shipRecords.reduce((sum, record) => sum + Math.max(1, num(record.nights, 1)), 0);
    const highestPointCruise = [...shipRecords].sort((a, b) => num(b.pointsEarned) - num(a.pointsEarned))[0];
    const bestWinLossCruise = [...shipRecords].sort((a, b) => num(b.casinoWinLoss) - num(a.casinoWinLoss))[0];
    const worstWinLossCruise = [...shipRecords].sort((a, b) => num(a.casinoWinLoss) - num(b.casinoWinLoss))[0];
    const averagePointsPerCruise = totalCompletedCruises ? totalCasinoPointsEarned / totalCompletedCruises : 0;
    const averagePointsPerCasinoDay = totalCasinoDays ? totalCasinoPointsEarned / totalCasinoDays : 0;
    const averageWinLossPerCruise = totalCompletedCruises ? totalCasinoWinLoss / totalCompletedCruises : 0;
    const shipFamiliarityScore = Math.min(100, Math.round((totalCompletedCruises * 14) + Math.min(45, averagePointsPerCruise / 75)));
    const casinoStrengthSignal: ShipCasinoHistorySummary['casinoStrengthSignal'] = totalCasinoPointsEarned >= 25000 || averagePointsPerCruise >= 4000
      ? 'elite'
      : totalCasinoPointsEarned >= 10000 || averagePointsPerCruise >= 1500
        ? 'strong'
        : totalCasinoPointsEarned >= 1000 || totalCompletedCruises >= 2
          ? 'developing'
          : totalCompletedCruises > 0
            ? 'limited'
            : 'unknown';

    return {
      shipName,
      totalCompletedCruises,
      totalCasinoPointsEarned: Math.round(totalCasinoPointsEarned),
      averagePointsPerCruise: Math.round(averagePointsPerCruise),
      averagePointsPerCasinoDay: Math.round(averagePointsPerCasinoDay),
      totalCasinoWinLoss: Math.round(totalCasinoWinLoss),
      averageWinLossPerCruise: Math.round(averageWinLossPerCruise),
      totalFreePlayReceived,
      totalTradeInValue,
      totalObcValue,
      totalCasinoCompValue,
      totalCruiseValueReceived,
      bestCertificateEarned: bestCertificate(shipRecords),
      highestPointCruise,
      bestWinLossCruise,
      worstWinLossCruise,
      shipFamiliarityScore,
      casinoStrengthSignal,
      warnings: shipRecords.flatMap((record) => record.warnings).slice(0, 8),
    };
  }).sort((a, b) => b.totalCasinoPointsEarned - a.totalCasinoPointsEarned || b.totalCompletedCruises - a.totalCompletedCruises);
}
