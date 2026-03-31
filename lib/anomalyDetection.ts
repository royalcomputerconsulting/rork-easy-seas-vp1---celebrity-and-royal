import type { 
  BookedCruise, 
  CasinoOffer, 
  Anomaly, 
  AnomalyType, 
  AlertPriority,
  AnomalyDetectionConfig,
  PatternInsight,
  PriceDropAlert,
} from '@/types/models';
import { DEFAULT_ANOMALY_CONFIG } from '@/types/models';

function generateId(): string {
  return `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateStdDev(values: number[], mean?: number): number {
  if (values.length < 2) return 0;
  const avg = mean ?? calculateMean(values);
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(squareDiffs.reduce((sum, val) => sum + val, 0) / values.length);
}

function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

export function detectROIAnomalies(
  cruises: BookedCruise[],
  config: AnomalyDetectionConfig = DEFAULT_ANOMALY_CONFIG
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const completedCruises = cruises.filter(c => 
    c.completionState === 'completed' || c.status === 'completed'
  );

  if (completedCruises.length < 2) {
    console.log('[AnomalyDetection] Not enough completed cruises for ROI analysis');
    return anomalies;
  }

  const roiValues = completedCruises.map(c => {
    const paid = c.totalPrice || c.price || 0;
    const retail = c.retailValue || c.originalPrice || paid;
    return paid > 0 ? ((retail - paid) / paid) * 100 : 0;
  });

  const meanROI = calculateMean(roiValues);
  const stdDevROI = calculateStdDev(roiValues, meanROI);

  completedCruises.forEach((cruise, index) => {
    const roi = roiValues[index];
    const zScore = calculateZScore(roi, meanROI, stdDevROI);

    let severity: AlertPriority = 'info';
    let isAnomaly = false;

    if (roi < config.roiThresholds.criticalLow) {
      severity = 'critical';
      isAnomaly = true;
    } else if (roi < config.roiThresholds.lowWarning) {
      severity = 'high';
      isAnomaly = true;
    } else if (roi > config.roiThresholds.criticalHigh) {
      severity = 'medium';
      isAnomaly = true;
    } else if (roi > config.roiThresholds.highWarning) {
      severity = 'low';
      isAnomaly = true;
    } else if (Math.abs(zScore) > 2.5) {
      severity = 'medium';
      isAnomaly = true;
    }

    if (isAnomaly) {
      anomalies.push({
        id: generateId(),
        type: 'roi_outlier',
        severity,
        title: roi < 0 ? 'Negative ROI Detected' : 'Unusual ROI Value',
        description: `${cruise.shipName} (${cruise.sailDate}) has an ROI of ${roi.toFixed(1)}%, which is ${zScore > 0 ? 'above' : 'below'} the average of ${meanROI.toFixed(1)}%`,
        detectedAt: new Date().toISOString(),
        dataPoints: {
          cruiseId: cruise.id,
          metric: 'ROI',
          expectedValue: meanROI,
          actualValue: roi,
          deviation: roi - meanROI,
          deviationPercent: meanROI !== 0 ? ((roi - meanROI) / Math.abs(meanROI)) * 100 : 0,
        },
        relatedEntityId: cruise.id,
        relatedEntityType: 'cruise',
      });
    }
  });

  console.log(`[AnomalyDetection] Found ${anomalies.length} ROI anomalies`);
  return anomalies;
}

export function detectPointsMismatch(
  cruises: BookedCruise[],
  config: AnomalyDetectionConfig = DEFAULT_ANOMALY_CONFIG
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const completedCruises = cruises.filter(c => 
    (c.completionState === 'completed' || c.status === 'completed') &&
    (c.earnedPoints || c.casinoPoints)
  );

  if (completedCruises.length < 3) {
    return anomalies;
  }

  const pointsPerNightValues = completedCruises.map(c => {
    const points = c.earnedPoints || c.casinoPoints || 0;
    const nights = c.nights || 1;
    return points / nights;
  });

  const meanPointsPerNight = calculateMean(pointsPerNightValues);

  completedCruises.forEach((cruise, index) => {
    const pointsPerNight = pointsPerNightValues[index];
    const deviation = Math.abs(pointsPerNight - meanPointsPerNight) / meanPointsPerNight;

    if (deviation > config.pointsMismatchTolerance) {
      const severity: AlertPriority = deviation > 0.5 ? 'high' : 'medium';
      
      anomalies.push({
        id: generateId(),
        type: 'points_mismatch',
        severity,
        title: 'Unusual Points Earning Rate',
        description: `${cruise.shipName} earned ${pointsPerNight.toFixed(0)} points/night vs average of ${meanPointsPerNight.toFixed(0)} points/night`,
        detectedAt: new Date().toISOString(),
        dataPoints: {
          cruiseId: cruise.id,
          metric: 'Points per Night',
          expectedValue: meanPointsPerNight,
          actualValue: pointsPerNight,
          deviation: pointsPerNight - meanPointsPerNight,
          deviationPercent: deviation * 100,
        },
        relatedEntityId: cruise.id,
        relatedEntityType: 'cruise',
      });
    }
  });

  console.log(`[AnomalyDetection] Found ${anomalies.length} points mismatch anomalies`);
  return anomalies;
}

export function detectExpiringOffers(
  offers: CasinoOffer[],
  config: AnomalyDetectionConfig = DEFAULT_ANOMALY_CONFIG
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const now = new Date();
  const warningThreshold = new Date();
  warningThreshold.setDate(warningThreshold.getDate() + config.offerExpiryWarningDays);

  const activeOffers = offers.filter(o => o.status === 'active' || !o.status);

  activeOffers.forEach(offer => {
    const expiryDate = offer.expires || offer.expiryDate || offer.offerExpiryDate;
    if (!expiryDate) return;

    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) return;

    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 0) {
      return;
    }

    let severity: AlertPriority = 'info';
    if (daysUntilExpiry <= 3) {
      severity = 'critical';
    } else if (daysUntilExpiry <= 7) {
      severity = 'high';
    } else if (daysUntilExpiry <= config.offerExpiryWarningDays) {
      severity = 'medium';
    } else {
      return;
    }

    anomalies.push({
      id: generateId(),
      type: 'offer_expiring',
      severity,
      title: `Offer Expiring ${daysUntilExpiry <= 3 ? 'Soon' : 'in ' + daysUntilExpiry + ' days'}`,
      description: `"${offer.offerName || offer.title}" expires on ${expiry.toLocaleDateString()}`,
      detectedAt: new Date().toISOString(),
      dataPoints: {
        offerId: offer.id,
        metric: 'Days Until Expiry',
        expectedValue: config.offerExpiryWarningDays,
        actualValue: daysUntilExpiry,
        deviation: config.offerExpiryWarningDays - daysUntilExpiry,
        deviationPercent: ((config.offerExpiryWarningDays - daysUntilExpiry) / config.offerExpiryWarningDays) * 100,
      },
      relatedEntityId: offer.id,
      relatedEntityType: 'offer',
    });
  });

  console.log(`[AnomalyDetection] Found ${anomalies.length} expiring offer alerts`);
  return anomalies;
}

export function detectTierMilestones(
  currentPoints: number,
  tierThresholds: { name: string; threshold: number }[],
  config: AnomalyDetectionConfig = DEFAULT_ANOMALY_CONFIG
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  const sortedTiers = [...tierThresholds].sort((a, b) => a.threshold - b.threshold);
  
  for (const tier of sortedTiers) {
    if (currentPoints >= tier.threshold) continue;

    const progress = (currentPoints / tier.threshold) * 100;
    const pointsNeeded = tier.threshold - currentPoints;

    if (progress >= config.tierMilestoneAlertPercent) {
      const severity: AlertPriority = progress >= 95 ? 'high' : 'medium';

      anomalies.push({
        id: generateId(),
        type: 'tier_milestone',
        severity,
        title: `Close to ${tier.name} Tier`,
        description: `You're ${progress.toFixed(1)}% of the way to ${tier.name}. Only ${pointsNeeded.toLocaleString()} points needed!`,
        detectedAt: new Date().toISOString(),
        dataPoints: {
          metric: 'Tier Progress',
          expectedValue: tier.threshold,
          actualValue: currentPoints,
          deviation: -pointsNeeded,
          deviationPercent: progress,
        },
      });
      break;
    }
  }

  console.log(`[AnomalyDetection] Found ${anomalies.length} tier milestone alerts`);
  return anomalies;
}

export function detectBookingConflicts(
  cruises: BookedCruise[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const bookedCruises = cruises.filter(c => 
    c.status === 'booked' || c.completionState === 'upcoming'
  );

  for (let i = 0; i < bookedCruises.length; i++) {
    for (let j = i + 1; j < bookedCruises.length; j++) {
      const cruiseA = bookedCruises[i];
      const cruiseB = bookedCruises[j];

      const startA = new Date(cruiseA.sailDate);
      const endA = new Date(cruiseA.returnDate || cruiseA.sailDate);
      const startB = new Date(cruiseB.sailDate);
      const endB = new Date(cruiseB.returnDate || cruiseB.sailDate);

      if (isNaN(startA.getTime()) || isNaN(endA.getTime()) || 
          isNaN(startB.getTime()) || isNaN(endB.getTime())) {
        continue;
      }

      const hasOverlap = startA <= endB && endA >= startB;

      if (hasOverlap) {
        const overlapStart = new Date(Math.max(startA.getTime(), startB.getTime()));
        const overlapEnd = new Date(Math.min(endA.getTime(), endB.getTime()));
        const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        const formatDateRange = (start: Date, end: Date) => {
          const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          return `${startStr} - ${endStr}`;
        };

        const endADate = endA.toDateString();
        const startBDate = startB.toDateString();
        const endBDate = endB.toDateString();
        const startADate = startA.toDateString();
        const isBackToBack = overlapDays === 1 && (endADate === startBDate || endBDate === startADate);
        
        const cruiseADetails = `${cruiseA.shipName} (${formatDateRange(startA, endA)})`;
        const cruiseBDetails = `${cruiseB.shipName} (${formatDateRange(startB, endB)})`;

        if (isBackToBack) {
          const turnaroundDate = endADate === startBDate
            ? endA.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : endB.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const isSameShip = (cruiseA.shipName || '').toLowerCase() === (cruiseB.shipName || '').toLowerCase();

          anomalies.push({
            id: generateId(),
            type: 'back_to_back',
            severity: 'info',
            title: 'Back to Back Cruise',
            description: isSameShip
              ? `${cruiseADetails} transitions to ${cruiseBDetails} on turnaround day ${turnaroundDate}. This is a back-to-back sailing on ${cruiseA.shipName}.`
              : `${cruiseADetails} transitions to ${cruiseBDetails} on ${turnaroundDate}. Back-to-back sailing across ships.`,
            detectedAt: new Date().toISOString(),
            dataPoints: {
              cruiseId: cruiseA.id,
              metric: 'Back to Back',
              expectedValue: 0,
              actualValue: 1,
              deviation: 0,
              deviationPercent: 0,
            },
            relatedEntityId: cruiseA.id,
            relatedEntityType: 'cruise',
          });
        } else {
          const overlapDetails = `${overlapDays} day${overlapDays !== 1 ? 's' : ''} overlap (${overlapStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${overlapEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;

          anomalies.push({
            id: generateId(),
            type: 'booking_conflict',
            severity: 'critical',
            title: 'Booking Date Conflict Detected',
            description: `${cruiseADetails} conflicts with ${cruiseBDetails}. ${overlapDetails}. You cannot be on both ships at the same time - please review and cancel one booking.`,
            detectedAt: new Date().toISOString(),
            dataPoints: {
              cruiseId: cruiseA.id,
              metric: 'Date Overlap',
              expectedValue: 0,
              actualValue: overlapDays,
              deviation: overlapDays,
              deviationPercent: 100,
            },
            relatedEntityId: cruiseA.id,
            relatedEntityType: 'cruise',
          });
        }
      }
    }
  }

  console.log(`[AnomalyDetection] Found ${anomalies.length} booking conflicts`);
  return anomalies;
}

export function detectSpendingSpikes(
  cruises: BookedCruise[],
  config: AnomalyDetectionConfig = DEFAULT_ANOMALY_CONFIG
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const completedCruises = cruises.filter(c => 
    (c.completionState === 'completed' || c.status === 'completed') &&
    (c.actualSpend || c.totalPrice)
  );

  if (completedCruises.length < 2) return anomalies;

  const dailySpends = completedCruises.map(c => {
    const spend = c.actualSpend || c.totalPrice || 0;
    const nights = c.nights || 1;
    return spend / nights;
  });

  const meanDailySpend = calculateMean(dailySpends);
  const stdDevDailySpend = calculateStdDev(dailySpends, meanDailySpend);

  completedCruises.forEach((cruise, index) => {
    const dailySpend = dailySpends[index];
    const totalSpend = cruise.actualSpend || cruise.totalPrice || 0;
    const nights = cruise.nights || 1;
    const percentAboveAvg = meanDailySpend > 0 ? ((dailySpend - meanDailySpend) / meanDailySpend) * 100 : 0;
    const sailDate = new Date(cruise.sailDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    if (dailySpend > config.spendingThresholds.dailyCritical) {
      const criticalThreshold = config.spendingThresholds.dailyCritical;
      const amountOver = dailySpend - criticalThreshold;
      
      anomalies.push({
        id: generateId(),
        type: 'spending_spike',
        severity: 'critical',
        title: 'Critical Spending Level Detected',
        description: `${cruise.shipName} (${sailDate}) - Total: ${totalSpend.toLocaleString()} over ${nights} night${nights !== 1 ? 's' : ''} = ${dailySpend.toFixed(0)}/day. This is ${amountOver.toFixed(0)}/day over the critical threshold (${criticalThreshold}/day) and ${percentAboveAvg.toFixed(0)}% above your average of ${meanDailySpend.toFixed(0)}/day. Consider reviewing your casino play and budget for future cruises.`,
        detectedAt: new Date().toISOString(),
        dataPoints: {
          cruiseId: cruise.id,
          metric: 'Daily Spend',
          expectedValue: meanDailySpend,
          actualValue: dailySpend,
          deviation: dailySpend - meanDailySpend,
          deviationPercent: percentAboveAvg,
        },
        relatedEntityId: cruise.id,
        relatedEntityType: 'cruise',
      });
    } else if (dailySpend > config.spendingThresholds.dailyWarning) {
      const zScore = calculateZScore(dailySpend, meanDailySpend, stdDevDailySpend);
      if (zScore > 2) {
        const warningThreshold = config.spendingThresholds.dailyWarning;
        const amountOver = dailySpend - warningThreshold;
        
        anomalies.push({
          id: generateId(),
          type: 'spending_spike',
          severity: 'high',
          title: 'Elevated Daily Spending',
          description: `${cruise.shipName} (${sailDate}) - Total: ${totalSpend.toLocaleString()} over ${nights} night${nights !== 1 ? 's' : ''} = ${dailySpend.toFixed(0)}/day. This is ${amountOver.toFixed(0)}/day over the warning threshold (${warningThreshold}/day) and ${percentAboveAvg.toFixed(0)}% above your typical average of ${meanDailySpend.toFixed(0)}/day. Monitor your spending patterns to maintain better budget control.`,
          detectedAt: new Date().toISOString(),
          dataPoints: {
            cruiseId: cruise.id,
            metric: 'Daily Spend',
            expectedValue: meanDailySpend,
            actualValue: dailySpend,
            deviation: dailySpend - meanDailySpend,
            deviationPercent: percentAboveAvg,
          },
          relatedEntityId: cruise.id,
          relatedEntityType: 'cruise',
        });
      }
    }
  });

  console.log(`[AnomalyDetection] Found ${anomalies.length} spending spike anomalies`);
  return anomalies;
}

export function detectPriceDrops(
  priceDropAlerts: PriceDropAlert[],
  minDropPercent: number = 5,
  bookedCruises: BookedCruise[] = []
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const now = new Date();

  const activeDrops = priceDropAlerts.filter(alert => {
    const sailDate = new Date(alert.sailDate);
    return sailDate > now && alert.priceDropPercent >= minDropPercent;
  });

  const upcomingBooked = bookedCruises.filter(c =>
    c.status === 'booked' || c.completionState === 'upcoming'
  );

  activeDrops.forEach(drop => {
    let severity: AlertPriority = 'info';
    
    if (drop.priceDropPercent >= 25) {
      severity = 'critical';
    } else if (drop.priceDropPercent >= 15) {
      severity = 'high';
    } else if (drop.priceDropPercent >= 10) {
      severity = 'medium';
    } else if (drop.priceDropPercent >= 5) {
      severity = 'low';
    }

    const formattedSailDate = new Date(drop.sailDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const isBookedCruise = upcomingBooked.some(c => {
      const shipMatch = c.shipName?.toLowerCase() === drop.shipName?.toLowerCase();
      const dateMatch = c.sailDate === drop.sailDate;
      return shipMatch && dateMatch;
    });

    const cabinLabel = drop.cabinType || 'Cabin';
    const bookedTag = isBookedCruise ? ' [BOOKED]' : '';
    const titlePrefix = isBookedCruise ? 'Price Drop on Your Booked Cruise' : 'Price Drop';

    anomalies.push({
      id: generateId(),
      type: 'price_drop',
      severity: isBookedCruise && severity === 'low' ? 'medium' : severity,
      title: `${titlePrefix}: ${drop.priceDrop.toFixed(0)} off ${cabinLabel}${bookedTag}`,
      description: `${cabinLabel} price on ${drop.shipName} (${formattedSailDate}) dropped from ${drop.previousPrice.toFixed(0)} to ${drop.currentPrice.toFixed(0)} — save ${drop.priceDropPercent.toFixed(1)}%.${isBookedCruise ? ' This is one of your booked cruises. Consider contacting Royal Caribbean to reprice or get onboard credit for the difference.' : ''}`,
      detectedAt: drop.currentRecordedAt,
      dataPoints: {
        offerId: drop.offerId,
        metric: 'Price',
        expectedValue: drop.previousPrice,
        actualValue: drop.currentPrice,
        deviation: -drop.priceDrop,
        deviationPercent: -drop.priceDropPercent,
        isBookedCruise: isBookedCruise ? 1 : 0,
      },
      relatedEntityId: drop.offerId,
      relatedEntityType: 'offer',
    });
  });

  console.log(`[AnomalyDetection] Found ${anomalies.length} price drop alerts (${anomalies.filter(a => a.dataPoints.isBookedCruise === 1).length} on booked cruises)`);
  return anomalies;
}

export function generatePatternInsights(
  cruises: BookedCruise[]
): PatternInsight[] {
  const insights: PatternInsight[] = [];
  const completedCruises = cruises.filter(c => 
    c.completionState === 'completed' || c.status === 'completed'
  );

  if (completedCruises.length < 3) return insights;

  const sortedCruises = [...completedCruises].sort(
    (a, b) => new Date(a.sailDate).getTime() - new Date(b.sailDate).getTime()
  );

  const roiValues = sortedCruises.map(c => {
    const paid = c.totalPrice || c.price || 0;
    const retail = c.retailValue || c.originalPrice || paid;
    return paid > 0 ? ((retail - paid) / paid) * 100 : 0;
  });

  if (roiValues.length >= 3) {
    const recentROIs = roiValues.slice(-3);
    const isIncreasing = recentROIs[0] < recentROIs[1] && recentROIs[1] < recentROIs[2];
    const isDecreasing = recentROIs[0] > recentROIs[1] && recentROIs[1] > recentROIs[2];
    
    if (isIncreasing || isDecreasing) {
      insights.push({
        id: `insight_roi_trend_${Date.now()}`,
        type: 'trend',
        title: `ROI ${isIncreasing ? 'Improving' : 'Declining'}`,
        description: `Your last 3 cruises show a ${isIncreasing ? 'positive' : 'negative'} ROI trend`,
        confidence: 0.7,
        data: {
          metric: 'ROI',
          trend: isIncreasing ? 'increasing' : 'decreasing',
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  const pointsValues = sortedCruises.map(c => c.earnedPoints || c.casinoPoints || 0);
  const nightsValues = sortedCruises.map(c => c.nights || 0);
  
  if (pointsValues.length >= 3 && nightsValues.every(n => n > 0)) {
    const pointsPerNight = pointsValues.map((p, i) => p / nightsValues[i]);
    const meanPPN = calculateMean(pointsPerNight);
    const stdDevPPN = calculateStdDev(pointsPerNight, meanPPN);
    const cv = stdDevPPN / meanPPN;

    if (cv < 0.2) {
      insights.push({
        id: `insight_points_consistency_${Date.now()}`,
        type: 'correlation',
        title: 'Consistent Points Earning',
        description: `Your points per night is very consistent at ~${meanPPN.toFixed(0)} pts/night`,
        confidence: 0.85,
        data: {
          metric: 'Points Consistency',
          correlation: {
            metric1: 'Points',
            metric2: 'Nights',
            coefficient: 1 - cv,
          },
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  const totalPoints = pointsValues.reduce((sum, p) => sum + p, 0);
  const totalNights = nightsValues.reduce((sum, n) => sum + n, 0);
  
  if (totalNights > 0 && completedCruises.length >= 3) {
    const avgPointsPerNight = totalPoints / totalNights;
    const projectedNightsTo25k = (25000 - totalPoints) / avgPointsPerNight;
    
    if (projectedNightsTo25k > 0 && projectedNightsTo25k < 500) {
      const avgNightsPerMonth = totalNights / (completedCruises.length / 2);
      const monthsToTarget = projectedNightsTo25k / avgNightsPerMonth;
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + Math.ceil(monthsToTarget));

      insights.push({
        id: `insight_tier_prediction_${Date.now()}`,
        type: 'prediction',
        title: 'Signature Tier Projection',
        description: `Based on your pace, you could reach Signature tier around ${targetDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
        confidence: 0.6,
        data: {
          metric: 'Tier Progress',
          prediction: {
            targetDate: targetDate.toISOString(),
            predictedValue: 25000,
            range: [totalPoints, 25000],
          },
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  const cabinTypes = sortedCruises
    .map(c => c.cabinType)
    .filter((type): type is string => !!type && type.toLowerCase() !== 'unknown' && type.trim() !== '');
  
  if (cabinTypes.length > 0) {
    const cabinCounts: Record<string, number> = {};
    cabinTypes.forEach(type => {
      const normalizedType = type.trim();
      cabinCounts[normalizedType] = (cabinCounts[normalizedType] || 0) + 1;
    });
    
    const mostCommonCabin = Object.entries(cabinCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommonCabin && mostCommonCabin[1] >= cabinTypes.length * 0.5) {
      insights.push({
        id: `insight_cabin_preference_${Date.now()}`,
        type: 'recommendation',
        title: `${mostCommonCabin[0]} Preference Detected`,
        description: `You consistently book ${mostCommonCabin[0]} cabins. Consider looking for offers that match this preference.`,
        confidence: mostCommonCabin[1] / cabinTypes.length,
        data: {
          metric: 'Cabin Preference',
          recommendation: `Focus on ${mostCommonCabin[0]} offers for better value matches`,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  const destinations = sortedCruises
    .map(c => c.destination)
    .filter((dest): dest is string => !!dest && dest.toLowerCase() !== 'unknown' && dest.trim() !== '');
  
  if (destinations.length > 0) {
    const destCounts: Record<string, number> = {};
    destinations.forEach(dest => {
      const normalizedDest = dest.trim();
      destCounts[normalizedDest] = (destCounts[normalizedDest] || 0) + 1;
    });
    
    const mostCommonDest = Object.entries(destCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommonDest && mostCommonDest[1] >= destinations.length * 0.4) {
      insights.push({
        id: `insight_destination_preference_${Date.now()}`,
        type: 'recommendation',
        title: `${mostCommonDest[0]} Favorite`,
        description: `You've sailed to ${mostCommonDest[0]} ${mostCommonDest[1]} times. This is your most visited destination.`,
        confidence: mostCommonDest[1] / destinations.length,
        data: {
          metric: 'Destination Preference',
          recommendation: `Look for ${mostCommonDest[0]} cruise deals`,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  const ships = sortedCruises
    .map(c => c.shipName)
    .filter((ship): ship is string => !!ship && ship.toLowerCase() !== 'unknown' && ship.trim() !== '');
  
  if (ships.length > 0) {
    const shipCounts: Record<string, number> = {};
    ships.forEach(ship => {
      const normalizedShip = ship.trim();
      shipCounts[normalizedShip] = (shipCounts[normalizedShip] || 0) + 1;
    });
    
    const mostCommonShip = Object.entries(shipCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommonShip && mostCommonShip[1] >= 2) {
      insights.push({
        id: `insight_ship_preference_${Date.now()}`,
        type: 'recommendation',
        title: `${mostCommonShip[0]} Loyalist`,
        description: `You've sailed on ${mostCommonShip[0]} ${mostCommonShip[1]} times. Consider looking for offers on this ship.`,
        confidence: mostCommonShip[1] / ships.length,
        data: {
          metric: 'Ship Preference',
          recommendation: `Check for ${mostCommonShip[0]} sailings`,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  console.log(`[AnomalyDetection] Generated ${insights.length} pattern insights`);
  return insights;
}

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  insights: PatternInsight[];
  summary: {
    totalAnomalies: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    byType: Record<AnomalyType, number>;
  };
}

export function runFullAnomalyDetection(
  cruises: BookedCruise[],
  offers: CasinoOffer[],
  currentPoints: number,
  config: AnomalyDetectionConfig = DEFAULT_ANOMALY_CONFIG,
  priceDropAlerts: PriceDropAlert[] = []
): AnomalyDetectionResult {
  console.log('[AnomalyDetection] Running full anomaly detection...');

  const allAnomalies: Anomaly[] = [
    ...detectROIAnomalies(cruises, config),
    ...detectExpiringOffers(offers, config),
    ...detectTierMilestones(currentPoints, [
      { name: 'Prime', threshold: 2501 },
      { name: 'Signature', threshold: 25001 },
      { name: 'Masters', threshold: 100001 },
    ], config),
    ...detectBookingConflicts(cruises),
    ...detectSpendingSpikes(cruises, config),
    ...detectPriceDrops(priceDropAlerts, 5, cruises),
  ];

  const insights = generatePatternInsights(cruises);

  const summary = {
    totalAnomalies: allAnomalies.length,
    criticalCount: allAnomalies.filter(a => a.severity === 'critical').length,
    highCount: allAnomalies.filter(a => a.severity === 'high').length,
    mediumCount: allAnomalies.filter(a => a.severity === 'medium').length,
    lowCount: allAnomalies.filter(a => a.severity === 'low').length,
    byType: {} as Record<AnomalyType, number>,
  };

  allAnomalies.forEach(a => {
    summary.byType[a.type] = (summary.byType[a.type] || 0) + 1;
  });

  console.log('[AnomalyDetection] Detection complete:', summary);

  return {
    anomalies: allAnomalies,
    insights,
    summary,
  };
}
