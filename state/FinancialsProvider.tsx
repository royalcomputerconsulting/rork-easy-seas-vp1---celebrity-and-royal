import { useState, useCallback, useMemo } from "react";
import createContextHook from "@nkzw/create-context-hook";
import type { FinancialSummary, BookedCruise } from "@/types/models";
import { useCoreData } from "./CoreDataProvider";

interface FinancialsState {
  summary: FinancialSummary;
  isCalculating: boolean;
  
  calculateSummary: (cruises: BookedCruise[]) => FinancialSummary;
  getTotalSpent: () => number;
  getTotalDue: () => number;
  getUpcomingPayments: () => { cruiseId: string; amount: number; dueDate: string }[];
}

const DEFAULT_SUMMARY: FinancialSummary = {
  totalDeposits: 0,
  totalPaid: 0,
  totalDue: 0,
  upcomingPayments: [],
  totalFreeplay: 0,
  totalOBC: 0,
  totalSavings: 0,
  totalCasinoSpend: 0,
  totalNonCasinoSpend: 0,
  categoryBreakdown: [],
};

export const [FinancialsProvider, useFinancials] = createContextHook((): FinancialsState => {
  const { bookedCruises } = useCoreData();
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateSummary = useCallback((cruises: BookedCruise[]): FinancialSummary => {
    setIsCalculating(true);
    
    try {
      let totalDeposits = 0;
      let totalPaid = 0;
      let totalDue = 0;
      let totalFreeplay = 0;
      let totalOBC = 0;
      let totalSavings = 0;
      const upcomingPayments: { cruiseId: string; amount: number; dueDate: string }[] = [];

      cruises.forEach(cruise => {
        if (cruise.depositPaid) {
          totalDeposits += cruise.depositPaid;
          totalPaid += cruise.depositPaid;
        }
        
        if (cruise.balanceDue) {
          totalDue += cruise.balanceDue;
          
          if (cruise.balanceDueDate) {
            upcomingPayments.push({
              cruiseId: cruise.id,
              amount: cruise.balanceDue,
              dueDate: cruise.balanceDueDate,
            });
          }
        }

        if (cruise.freeOBC) {
          totalOBC += cruise.freeOBC;
          totalSavings += cruise.freeOBC;
        }

        if (cruise.casinoPoints) {
          totalFreeplay += cruise.casinoPoints;
        }

        if (cruise.originalPrice && cruise.price) {
          const savings = cruise.originalPrice - cruise.price;
          if (savings > 0) {
            totalSavings += savings;
          }
        }
      });

      upcomingPayments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      console.log('[Financials] Calculated summary:', {
        totalDeposits,
        totalPaid,
        totalDue,
        totalFreeplay,
        totalOBC,
        totalSavings,
        upcomingPaymentsCount: upcomingPayments.length,
      });

      return {
        totalDeposits,
        totalPaid,
        totalDue,
        upcomingPayments,
        totalFreeplay,
        totalOBC,
        totalSavings,
        totalCasinoSpend: 0,
        totalNonCasinoSpend: totalPaid,
        categoryBreakdown: [],
      };
    } finally {
      setIsCalculating(false);
    }
  }, []);

  const summary = useMemo(() => {
    return calculateSummary(bookedCruises);
  }, [bookedCruises, calculateSummary]);

  const getTotalSpent = useCallback(() => {
    return summary.totalPaid;
  }, [summary]);

  const getTotalDue = useCallback(() => {
    return summary.totalDue;
  }, [summary]);

  const getUpcomingPayments = useCallback(() => {
    return summary.upcomingPayments;
  }, [summary]);

  return {
    summary,
    isCalculating,
    calculateSummary,
    getTotalSpent,
    getTotalDue,
    getUpcomingPayments,
  };
});
