import { useCoreData } from "./CoreDataProvider";
import { recordProviderRender } from '@/lib/performance/performanceDiagnostics';

const EMPTY_TRIPIT: never[] = [];

export const useAppState = () => {
  recordProviderRender('AppStateAdapter');
  const coreData = useCoreData();
  
  return {
    settings: coreData.settings,
    lastImportDate: coreData.lastSyncDate,
    localData: {
      cruises: coreData.cruises,
      booked: coreData.bookedCruises,
      offers: coreData.casinoOffers,
      calendar: coreData.calendarEvents,
      tripit: EMPTY_TRIPIT,
      lastImport: coreData.lastSyncDate,
      clubRoyaleProfile: coreData.clubRoyaleProfile,
    },
    hasLocalData: coreData.hasLocalData,
    isLoading: coreData.isLoading,
    userPoints: coreData.userPoints,
    clubRoyaleProfile: coreData.clubRoyaleProfile,
    updateSettings: coreData.updateSettings,
    setLocalData: async (data: any) => {
      if (data.booked) await coreData.setBookedCruises(data.booked);
      if (data.cruises) await coreData.setCruises(data.cruises);
      if (data.offers) await coreData.setCasinoOffers(data.offers);
      if (data.calendar) await coreData.setCalendarEvents(data.calendar);
    },
    clearLocalData: coreData.clearAllData,
    setUserPoints: coreData.setUserPoints,
    setClubRoyaleProfile: coreData.setClubRoyaleProfile,
    refreshData: coreData.refreshData,
  };
};
