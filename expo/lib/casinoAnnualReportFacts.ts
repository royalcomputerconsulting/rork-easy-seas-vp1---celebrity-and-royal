export type AnnualCasinoReportConfidence = 'actual' | 'estimated' | 'mixed';

export interface AnnualCasinoHistoricalFact {
  ship: string;
  sailDate: string;
  returnDate: string;
  nights: number;
  retailValue: number;
  amountPaid: number;
  winningsBroughtHome: number;
  pointsEarned: number;
  calculationConfidence: AnnualCasinoReportConfidence;
  notes?: string;
}

/** User-confirmed Royal Caribbean annual report: 2025-04-01 through 2026-04-01. */
export const ANNUAL_CASINO_REPORT_FACTS: AnnualCasinoHistoricalFact[] = [
  { ship: 'Harmony of the Seas', sailDate: '2025-04-20', returnDate: '2025-04-27', nights: 7, retailValue: 4650, amountPaid: 175.25, winningsBroughtHome: 8000, pointsEarned: 2030, calculationConfidence: 'actual' },
  { ship: 'Ovation of the Seas', sailDate: '2025-07-29', returnDate: '2025-08-01', nights: 3, retailValue: 1588, amountPaid: 149.10, winningsBroughtHome: 0, pointsEarned: 317, calculationConfidence: 'actual' },
  { ship: 'Navigator of the Seas', sailDate: '2025-08-01', returnDate: '2025-08-04', nights: 3, retailValue: 1326, amountPaid: 133, winningsBroughtHome: 300, pointsEarned: 650, calculationConfidence: 'mixed', notes: 'Estimated winnings baseline.' },
  { ship: 'Navigator of the Seas', sailDate: '2025-08-22', returnDate: '2025-08-25', nights: 3, retailValue: 1326, amountPaid: 133, winningsBroughtHome: 300, pointsEarned: 650, calculationConfidence: 'mixed', notes: 'Estimated winnings baseline.' },
  { ship: 'Star of the Seas', sailDate: '2025-08-27', returnDate: '2025-08-31', nights: 4, retailValue: 6500, amountPaid: 162.37, winningsBroughtHome: 700, pointsEarned: 4581, calculationConfidence: 'actual' },
  { ship: 'Navigator of the Seas', sailDate: '2025-09-08', returnDate: '2025-09-12', nights: 4, retailValue: 999, amountPaid: 136.58, winningsBroughtHome: 189, pointsEarned: 976, calculationConfidence: 'actual' },
  { ship: 'Navigator of the Seas', sailDate: '2025-09-15', returnDate: '2025-09-19', nights: 4, retailValue: 1050, amountPaid: 132.50, winningsBroughtHome: 100, pointsEarned: 817, calculationConfidence: 'actual' },
  { ship: 'Radiance of the Seas', sailDate: '2025-09-26', returnDate: '2025-10-04', nights: 8, retailValue: 2400, amountPaid: 600, winningsBroughtHome: 780, pointsEarned: 1009, calculationConfidence: 'actual' },
  { ship: 'Liberty of the Seas', sailDate: '2025-10-16', returnDate: '2025-10-25', nights: 9, retailValue: 3500, amountPaid: 800, winningsBroughtHome: 1488, pointsEarned: 7482, calculationConfidence: 'actual' },
  { ship: 'Quantum of the Seas', sailDate: '2025-11-10', returnDate: '2025-11-14', nights: 4, retailValue: 1528, amountPaid: 137, winningsBroughtHome: 700, pointsEarned: 925, calculationConfidence: 'mixed', notes: 'Estimated winnings baseline.' },
  { ship: 'Quantum of the Seas', sailDate: '2025-11-17', returnDate: '2025-11-21', nights: 4, retailValue: 1528, amountPaid: 137, winningsBroughtHome: 700, pointsEarned: 925, calculationConfidence: 'mixed', notes: 'Estimated winnings baseline.' },
  { ship: 'Quantum of the Seas', sailDate: '2025-12-01', returnDate: '2025-12-05', nights: 4, retailValue: 1528, amountPaid: 137, winningsBroughtHome: 700, pointsEarned: 925, calculationConfidence: 'mixed', notes: 'Estimated winnings baseline.' },
  { ship: 'Quantum of the Seas', sailDate: '2025-12-05', returnDate: '2025-12-10', nights: 5, retailValue: 1446, amountPaid: 221, winningsBroughtHome: 700, pointsEarned: 1250, calculationConfidence: 'mixed', notes: 'Estimated winnings baseline.' },
  { ship: 'Quantum of the Seas', sailDate: '2025-12-10', returnDate: '2025-12-15', nights: 5, retailValue: 1446, amountPaid: 221, winningsBroughtHome: 700, pointsEarned: 1250, calculationConfidence: 'mixed', notes: 'Estimated winnings baseline.' },
  { ship: 'Quantum of the Seas', sailDate: '2026-01-07', returnDate: '2026-01-13', nights: 6, retailValue: 1206, amountPaid: 25.97, winningsBroughtHome: 700, pointsEarned: 1500, calculationConfidence: 'mixed', notes: 'Estimated winnings baseline.' },
  { ship: 'Quantum of the Seas', sailDate: '2026-01-13', returnDate: '2026-01-16', nights: 3, retailValue: 740, amountPaid: 127, winningsBroughtHome: 300, pointsEarned: 700, calculationConfidence: 'mixed', notes: 'Estimated winnings baseline.' },
  { ship: 'Quantum of the Seas', sailDate: '2026-01-16', returnDate: '2026-01-21', nights: 5, retailValue: 1446, amountPaid: 220.95, winningsBroughtHome: 700, pointsEarned: 1250, calculationConfidence: 'mixed', notes: 'Estimated winnings baseline.' },
  { ship: 'Harmony of the Seas', sailDate: '2026-02-22', returnDate: '2026-03-01', nights: 7, retailValue: 4650, amountPaid: 151, winningsBroughtHome: 700, pointsEarned: 1800, calculationConfidence: 'mixed', notes: 'Estimated winnings baseline.' },
  { ship: 'Harmony of the Seas', sailDate: '2026-03-01', returnDate: '2026-03-08', nights: 7, retailValue: 4650, amountPaid: 151, winningsBroughtHome: 700, pointsEarned: 1800, calculationConfidence: 'mixed', notes: 'Estimated winnings baseline.' },
  { ship: 'Navigator of the Seas', sailDate: '2026-03-09', returnDate: '2026-03-16', nights: 7, retailValue: 3242, amountPaid: 154.69, winningsBroughtHome: 700, pointsEarned: 1700, calculationConfidence: 'mixed', notes: 'Estimated winnings baseline.' },
  // The supplied source line says $7,800 winnings but its stated +$167 cash result and the confirmed $19,457 annual winnings total both reconcile to the $300 fallback.
  { ship: 'Navigator of the Seas', sailDate: '2026-03-16', returnDate: '2026-03-20', nights: 4, retailValue: 1025, amountPaid: 133, winningsBroughtHome: 300, pointsEarned: 2000, calculationConfidence: 'mixed', notes: 'Winnings use the annual-total-consistent $300 value; source-line $7,800 conflicts with both its +$167 cash result and confirmed annual total.' },
];

