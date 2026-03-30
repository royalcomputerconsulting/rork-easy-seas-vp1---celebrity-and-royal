import type { BookedCruise } from '@/types/models';
import type { CasinoSession } from '@/state/CasinoSessionProvider';
import { DOLLARS_PER_POINT } from '@/types/models';

export interface HistoricalSessionEstimate {
  cruiseId: string;
  estimatedHoursPlayed: number;
  estimatedSessions: SessionEstimate[];
  assumptions: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface SessionEstimate {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  pointsEarned: number;
  winLoss?: number;
  notes: string;
}

const TYPICAL_PPH = 400;

export function estimatePlayingHoursFromPoints(
  pointsEarned: number,
  pphRate: number = TYPICAL_PPH
): number {
  if (pointsEarned <= 0) return 0;
  return pointsEarned / pphRate;
}

export function calculateHistoricalSessions(
  cruise: BookedCruise,
  preferredPlayingHoursPerDay: number = 3,
  avgPPH: number = TYPICAL_PPH
): HistoricalSessionEstimate | null {
  console.log('[HistoricalSessionCalculator] Calculating sessions for cruise:', cruise.id);

  if (!cruise.earnedPoints && !cruise.casinoPoints) {
    console.log('[HistoricalSessionCalculator] No points data available for cruise:', cruise.id);
    return null;
  }

  const pointsEarned = cruise.earnedPoints || cruise.casinoPoints || 0;
  const totalHoursPlayed = estimatePlayingHoursFromPoints(pointsEarned, avgPPH);
  const coinIn = pointsEarned * DOLLARS_PER_POINT;
  
  const casinoOpenDays = cruise.casinoOpenDays || cruise.seaDays || Math.ceil(cruise.nights * 0.4);
  const avgHoursPerDay = totalHoursPlayed / casinoOpenDays;
  
  const assumptions = [
    `Estimated ${totalHoursPlayed.toFixed(1)} total hours of play`,
    `Based on ${avgPPH} points per hour average`,
    `${casinoOpenDays} casino-open days on this cruise`,
    `Approximately ${avgHoursPerDay.toFixed(1)} hours per casino day`,
    `Total coin-in: $${coinIn.toLocaleString()}`,
  ];

  let confidence: 'low' | 'medium' | 'high' = 'medium';
  if (cruise.actualSpend && cruise.winnings !== undefined) {
    confidence = 'high';
    assumptions.push('Win/loss data available for accurate calculations');
  } else if (casinoOpenDays >= 3) {
    confidence = 'medium';
  } else {
    confidence = 'low';
    assumptions.push('Limited casino days may affect accuracy');
  }

  const sessions = generateSessionEstimates(
    cruise,
    pointsEarned,
    totalHoursPlayed,
    casinoOpenDays,
    avgHoursPerDay,
    cruise.actualSpend,
    cruise.winnings
  );

  console.log('[HistoricalSessionCalculator] Generated', sessions.length, 'sessions for cruise:', cruise.id);

  return {
    cruiseId: cruise.id,
    estimatedHoursPlayed: totalHoursPlayed,
    estimatedSessions: sessions,
    assumptions,
    confidence,
  };
}

function generateSessionEstimates(
  cruise: BookedCruise,
  totalPoints: number,
  totalHours: number,
  casinoOpenDays: number,
  avgHoursPerDay: number,
  actualSpend?: number,
  winnings?: number
): SessionEstimate[] {
  const sessions: SessionEstimate[] = [];
  
  if (!cruise.itinerary || cruise.itinerary.length === 0) {
    return generateSimpleSessionEstimates(
      cruise,
      totalPoints,
      totalHours,
      casinoOpenDays,
      actualSpend,
      winnings
    );
  }

  const casinoDays = cruise.itinerary.filter(day => day.casinoOpen);
  
  if (casinoDays.length === 0) {
    return generateSimpleSessionEstimates(
      cruise,
      totalPoints,
      totalHours,
      casinoOpenDays,
      actualSpend,
      winnings
    );
  }

  const pointsPerDay = totalPoints / casinoDays.length;
  const totalWinLoss = winnings !== undefined && actualSpend !== undefined 
    ? winnings - actualSpend 
    : 0;
  
  const winLossPerDay = totalWinLoss / casinoDays.length;

  casinoDays.forEach((day, index) => {
    const cruiseDateObj = new Date(cruise.sailDate);
    cruiseDateObj.setDate(cruiseDateObj.getDate() + (day.day - 1));
    const sessionDate = cruiseDateObj.toISOString().split('T')[0];

    const isSeaDay = day.isSeaDay;
    const isLastDay = day.day === cruise.itinerary!.length;
    let sessionsForDay = 3;
    
    if (isSeaDay) {
      sessionsForDay = 4;
    } else if (isLastDay) {
      sessionsForDay = 2;
    }
    
    const hoursNeededForDay = (totalHours / casinoDays.length);
    if (hoursNeededForDay > 4) {
      sessionsForDay = Math.min(6, sessionsForDay + 1);
    }

    const startTimes = [
      { start: 10, duration: 85 },
      { start: 13, duration: 95 },
      { start: 16, duration: 100 },
      { start: 19, duration: 90 },
      { start: 22, duration: 110 },
      { start: 1, duration: 75 },
    ];

    for (let i = 0; i < sessionsForDay && i < startTimes.length; i++) {
      const timeSlot = startTimes[i];
      const startHour = timeSlot.start;
      const durationMinutes = timeSlot.duration;
      const endMinutes = (startHour * 60) + durationMinutes;
      const endHour = Math.floor(endMinutes / 60);
      const endMin = endMinutes % 60;
      
      const startTime = `${startHour.toString().padStart(2, '0')}:00`;
      const endTime = endHour >= 24 
        ? `${(endHour - 24).toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`
        : `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

      const sessionPoints = Math.round(pointsPerDay / sessionsForDay);
      const sessionWinLoss = Math.round(winLossPerDay / sessionsForDay);

      sessions.push({
        date: sessionDate,
        startTime,
        endTime,
        durationMinutes,
        pointsEarned: sessionPoints,
        winLoss: sessionWinLoss,
        notes: `Calculated from ${cruise.shipName} - ${day.port}`,
      });
    }
  });

  return sessions;
}

function generateSimpleSessionEstimates(
  cruise: BookedCruise,
  totalPoints: number,
  totalHours: number,
  casinoOpenDays: number,
  actualSpend?: number,
  winnings?: number
): SessionEstimate[] {
  const sessions: SessionEstimate[] = [];
  
  const avgHoursPerDay = totalHours / casinoOpenDays;
  let sessionsPerDay = 3;
  
  if (avgHoursPerDay >= 5) {
    sessionsPerDay = 5;
  } else if (avgHoursPerDay >= 4) {
    sessionsPerDay = 4;
  }
  
  const totalSessions = casinoOpenDays * sessionsPerDay;
  const pointsPerSession = totalPoints / totalSessions;
  
  const totalWinLoss = winnings !== undefined && actualSpend !== undefined 
    ? winnings - actualSpend 
    : 0;
  const winLossPerSession = totalWinLoss / totalSessions;

  const startTimes = [
    { start: 10, duration: 85 },
    { start: 13, duration: 95 },
    { start: 16, duration: 100 },
    { start: 19, duration: 90 },
    { start: 22, duration: 110 },
    { start: 1, duration: 75 },
  ];

  for (let dayIndex = 0; dayIndex < casinoOpenDays; dayIndex++) {
    const cruiseDateObj = new Date(cruise.sailDate);
    cruiseDateObj.setDate(cruiseDateObj.getDate() + dayIndex + 1);
    const sessionDate = cruiseDateObj.toISOString().split('T')[0];

    for (let sessionIdx = 0; sessionIdx < sessionsPerDay && sessionIdx < startTimes.length; sessionIdx++) {
      const timeSlot = startTimes[sessionIdx];
      const startHour = timeSlot.start;
      const durationMinutes = timeSlot.duration;
      const endMinutes = (startHour * 60) + durationMinutes;
      const endHour = Math.floor(endMinutes / 60);
      const endMin = endMinutes % 60;
      
      const startTime = `${startHour.toString().padStart(2, '0')}:00`;
      const endTime = endHour >= 24 
        ? `${(endHour - 24).toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`
        : `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

      sessions.push({
        date: sessionDate,
        startTime,
        endTime,
        durationMinutes,
        pointsEarned: Math.round(pointsPerSession),
        winLoss: Math.round(winLossPerSession),
        notes: `Calculated from ${cruise.shipName} - Day ${dayIndex + 2}`,
      });
    }
  }

  return sessions;
}

export function convertEstimateToSession(
  estimate: SessionEstimate,
  cruiseId: string
): Omit<CasinoSession, 'id' | 'createdAt'> {
  return {
    date: estimate.date,
    cruiseId,
    startTime: estimate.startTime,
    endTime: estimate.endTime,
    durationMinutes: estimate.durationMinutes,
    pointsEarned: estimate.pointsEarned,
    winLoss: estimate.winLoss,
    notes: `${estimate.notes} (Auto-calculated)`,
    machineType: 'penny-slots',
    denomination: 0.01,
  };
}

export function generateSessionsFromCruise(
  cruise: BookedCruise,
  avgPPH: number = TYPICAL_PPH
): Omit<CasinoSession, 'id' | 'createdAt'>[] {
  console.log('[GenerateSessionsFromCruise] Processing cruise:', {
    id: cruise.id,
    ship: cruise.shipName,
    sailDate: cruise.sailDate,
    earnedPoints: cruise.earnedPoints || cruise.casinoPoints,
    winnings: cruise.winnings,
    actualSpend: cruise.actualSpend,
  });
  
  const estimate = calculateHistoricalSessions(cruise, 3, avgPPH);
  
  if (!estimate) {
    console.log('[GenerateSessionsFromCruise] No estimate generated for cruise:', cruise.id);
    return [];
  }

  const sessions = estimate.estimatedSessions.map(sessionEstimate =>
    convertEstimateToSession(sessionEstimate, cruise.id)
  );
  
  console.log('[GenerateSessionsFromCruise] Generated', sessions.length, 'sessions for cruise:', cruise.id);
  return sessions;
}
