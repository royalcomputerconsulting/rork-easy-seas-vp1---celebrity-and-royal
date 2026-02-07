import { useCoreData } from "./CoreDataProvider";
import type { ReactNode } from "react";

export const useCruiseStore = () => {
  const coreData = useCoreData();
  
  return {
    cruises: coreData.cruises,
    bookedCruises: coreData.bookedCruises,
    completedCruises: coreData.completedCruises,
    casinoOffers: coreData.casinoOffers,
    calendarEvents: coreData.calendarEvents,
    isLoading: coreData.isLoading,
    lastSyncDate: coreData.lastSyncDate,
    setCruises: coreData.setCruises,
    addCruise: coreData.addCruise,
    updateCruise: coreData.updateCruise,
    removeCruise: coreData.removeCruise,
    setBookedCruises: coreData.setBookedCruises,
    addBookedCruise: coreData.addBookedCruise,
    updateBookedCruise: coreData.updateBookedCruise,
    removeBookedCruise: coreData.removeBookedCruise,
    setCasinoOffers: coreData.setCasinoOffers,
    setOffers: coreData.setCasinoOffers,
    addCasinoOffer: coreData.addCasinoOffer,
    updateCasinoOffer: coreData.updateCasinoOffer,
    removeCasinoOffer: coreData.removeCasinoOffer,
    setCalendarEvents: coreData.setCalendarEvents,
    addCalendarEvent: coreData.addCalendarEvent,
    updateCalendarEvent: coreData.updateCalendarEvent,
    removeCalendarEvent: coreData.removeCalendarEvent,
    clearAllData: coreData.clearAllData,
    syncFromStorage: coreData.refreshData,
  };
};

interface CruiseStoreProviderProps {
  children: ReactNode;
}

export function CruiseStoreProvider({ children }: CruiseStoreProviderProps) {
  return children;
}
