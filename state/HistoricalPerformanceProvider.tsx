import { useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import type { BookedCruise } from '@/types/models';
import { useCoreData } from './CoreDataProvider';
import {
  calculateHistoricalPerformance,
  projectROIForUpcomingCruise,
  calculateCostPerPoint,
  type HistoricalPerformanceMetrics,
  type ROIProjection,
} from '@/lib/historicalPerformance';

interface HistoricalPerformanceState {
  metrics: HistoricalPerformanceMetrics;
  costPerPoint: {
    average: number;
    best: number;
    worst: number;
    median: number;
  };
  
  projectROIForCruise: (cruise: BookedCruise) => ROIProjection;
  getCompletedCruises: () => BookedCruise[];
  hasHistoricalData: boolean;
}

export const [HistoricalPerformanceProvider, useHistoricalPerformance] = createContextHook(
  (): HistoricalPerformanceState => {
    const { completedCruises } = useCoreData();

    const metrics = useMemo(() => {
      console.log('[HistoricalPerformanceProvider] Calculating historical metrics');
      return calculateHistoricalPerformance(completedCruises);
    }, [completedCruises]);

    const costPerPoint = useMemo(() => {
      console.log('[HistoricalPerformanceProvider] Calculating cost per point');
      return calculateCostPerPoint(completedCruises);
    }, [completedCruises]);

    const projectROIForCruise = (cruise: BookedCruise): ROIProjection => {
      console.log('[HistoricalPerformanceProvider] Projecting ROI for cruise:', cruise.id);
      return projectROIForUpcomingCruise(cruise, metrics);
    };

    const getCompletedCruises = () => completedCruises;

    const hasHistoricalData = completedCruises.length > 0;

    console.log('[HistoricalPerformanceProvider] State initialized:', {
      completedCruisesCount: completedCruises.length,
      hasHistoricalData,
      avgPointsPerNight: metrics.averagePointsPerNight.toFixed(0),
      avgROI: metrics.averageROI.toFixed(1),
    });

    return {
      metrics,
      costPerPoint,
      projectROIForCruise,
      getCompletedCruises,
      hasHistoricalData,
    };
  }
);
