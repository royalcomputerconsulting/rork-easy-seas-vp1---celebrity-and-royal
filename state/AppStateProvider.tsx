import { useCoreData } from "./CoreDataProvider";
import React from "react";

export const useAppState = () => {
  const coreData = useCoreData();
  
  return {
    settings: coreData.settings,
    lastImportDate: coreData.lastSyncDate,
    localData: {
      cruises: coreData.cruises,
      booked: coreData.bookedCruises,
      offers: coreData.casinoOffers,
      calendar: coreData.calendarEvents,
      tripit: [],
      lastImport: coreData.lastSyncDate,
      clubRoyaleProfile: coreData.clubRoyaleProfile,
    },
    hasLocalData: coreData.hasLocalData,
    isLoading: coreData.isLoading,
    userPoints: coreData.userPoints,
    clubRoyaleProfile: coreData.clubRoyaleProfile,
    updateSettings: coreData.updateSettings,
    setLocalData: (data: any) => {
      if (data.booked) coreData.setBookedCruises(data.booked);
      if (data.cruises) coreData.setCruises(data.cruises);
      if (data.offers) coreData.setCasinoOffers(data.offers);
      if (data.calendar) coreData.setCalendarEvents(data.calendar);
    },
    clearLocalData: coreData.clearAllData,
    setUserPoints: coreData.setUserPoints,
    setClubRoyaleProfile: coreData.setClubRoyaleProfile,
    refreshData: coreData.refreshData,
  };
};

export const AppStateProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};
