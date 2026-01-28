import AsyncStorage from '@react-native-async-storage/async-storage';
import type { 
  Cruise, 
  CasinoOffer, 
  BookedCruise, 
  CalendarEvent, 
  ClubRoyaleProfile,
  MachineEncyclopediaEntry,
} from '@/types/models';
import type { UserProfile } from '@/state/UserProvider';
import type { Certificate } from '@/components/CertificateManagerModal';
import type { CasinoSession } from '@/state/CasinoSessionProvider';
import { ALL_STORAGE_KEYS, type AppSettings } from '../storage/storageKeys';
import { applyKnownRetailValuesToBooked } from '../dataEnrichment/retailValueEnrichment';

export interface FullAppDataBundle {
  version: string;
  exportDate: string;
  cruises: Cruise[];
  bookedCruises: BookedCruise[];
  casinoOffers: CasinoOffer[];
  calendarEvents: CalendarEvent[];
  casinoSessions: CasinoSession[];
  certificates: Certificate[];
  clubRoyaleProfile: ClubRoyaleProfile | null;
  settings: AppSettings | null;
  loyaltyData: {
    manualClubRoyalePoints: number | null;
    manualCrownAnchorPoints: number | null;
    userPoints: number | null;
  };
  userProfile: {
    name: string;
    email?: string;
    crownAnchorNumber: string;
    clubRoyalePoints: number;
    loyaltyPoints: number;
    celebrityEmail?: string;
    celebrityCaptainsClubNumber?: string;
    celebrityCaptainsClubPoints?: number;
    celebrityBlueChipPoints?: number;
    preferredBrand?: 'royal' | 'celebrity' | 'silversea';
  } | null;
  users: UserProfile[];
  playingHours?: import('@/state/UserProvider').PlayingHours;
  machines: {
    encyclopedia: MachineEncyclopediaEntry[];
    atlasIds: string[];
  };
  metadata: {
    totalCruises: number;
    totalBooked: number;
    totalOffers: number;
    totalEvents: number;
    totalCertificates: number;
    totalSessions: number;
    totalMachines: number;
  };
}

export async function getAllStoredData(): Promise<FullAppDataBundle> {
  console.log('[DataBundle] Getting all stored data...');
  
  try {
    const [
      cruisesData,
      bookedData,
      offersData,
      eventsData,
      sessionsData,
      certificatesData,
      profileData,
      settingsData,
      manualClubRoyale,
      manualCrownAnchor,
      userPoints,
      usersData,
      machineEncyclopediaData,
      myAtlasData,
    ] = await Promise.all([
      AsyncStorage.getItem(ALL_STORAGE_KEYS.CRUISES),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.BOOKED_CRUISES),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.CASINO_OFFERS),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.CALENDAR_EVENTS),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.CASINO_SESSIONS),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.CERTIFICATES),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.CLUB_PROFILE),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.SETTINGS),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.USER_POINTS),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.USERS),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.MACHINE_ENCYCLOPEDIA),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.MY_SLOT_ATLAS),
    ]);

    let cruises: Cruise[] = [];
    let bookedCruises: BookedCruise[] = [];
    let casinoOffers: CasinoOffer[] = [];
    let calendarEvents: CalendarEvent[] = [];
    let casinoSessions: CasinoSession[] = [];
    let certificates: Certificate[] = [];
    let clubRoyaleProfile: ClubRoyaleProfile | null = null;
    let settings: AppSettings | null = null;
    let users: UserProfile[] = [];
    let machineEncyclopedia: MachineEncyclopediaEntry[] = [];
    let myAtlasIds: string[] = [];

    try {
      cruises = cruisesData ? JSON.parse(cruisesData) : [];
      if (!Array.isArray(cruises)) cruises = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing cruises:', e);
      cruises = [];
    }

    try {
      bookedCruises = bookedData ? JSON.parse(bookedData) : [];
      if (!Array.isArray(bookedCruises)) bookedCruises = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing booked cruises:', e);
      bookedCruises = [];
    }

    try {
      casinoOffers = offersData ? JSON.parse(offersData) : [];
      if (!Array.isArray(casinoOffers)) casinoOffers = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing casino offers:', e);
      casinoOffers = [];
    }

    try {
      calendarEvents = eventsData ? JSON.parse(eventsData) : [];
      if (!Array.isArray(calendarEvents)) calendarEvents = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing calendar events:', e);
      calendarEvents = [];
    }

    try {
      casinoSessions = sessionsData ? JSON.parse(sessionsData) : [];
      if (!Array.isArray(casinoSessions)) casinoSessions = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing casino sessions:', e);
      casinoSessions = [];
    }

    try {
      certificates = certificatesData ? JSON.parse(certificatesData) : [];
      if (!Array.isArray(certificates)) certificates = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing certificates:', e);
      certificates = [];
    }

    try {
      clubRoyaleProfile = profileData ? JSON.parse(profileData) : null;
    } catch (e) {
      console.error('[DataBundle] Error parsing club profile:', e);
      clubRoyaleProfile = null;
    }

    try {
      settings = settingsData ? JSON.parse(settingsData) : null;
    } catch (e) {
      console.error('[DataBundle] Error parsing settings:', e);
      settings = null;
    }

    try {
      users = usersData ? JSON.parse(usersData) : [];
      if (!Array.isArray(users)) users = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing users:', e);
      users = [];
    }

    try {
      machineEncyclopedia = machineEncyclopediaData ? JSON.parse(machineEncyclopediaData) : [];
      if (!Array.isArray(machineEncyclopedia)) machineEncyclopedia = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing machine encyclopedia:', e);
      machineEncyclopedia = [];
    }

    try {
      myAtlasIds = myAtlasData ? JSON.parse(myAtlasData) : [];
      if (!Array.isArray(myAtlasIds)) myAtlasIds = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing atlas IDs:', e);
      myAtlasIds = [];
    }

    const ownerUser = users.find(u => u.isOwner);
    const clubRoyalePoints = manualClubRoyale ? parseInt(manualClubRoyale, 10) : 0;
    const loyaltyPoints = manualCrownAnchor ? parseInt(manualCrownAnchor, 10) : 0;
    
    const userProfile = ownerUser ? {
      name: ownerUser.name || '',
      email: ownerUser.email || '',
      crownAnchorNumber: ownerUser.crownAnchorNumber || '',
      clubRoyalePoints,
      loyaltyPoints,
      celebrityEmail: ownerUser.celebrityEmail || '',
      celebrityCaptainsClubNumber: ownerUser.celebrityCaptainsClubNumber || '',
      celebrityCaptainsClubPoints: ownerUser.celebrityCaptainsClubPoints || 0,
      celebrityBlueChipPoints: ownerUser.celebrityBlueChipPoints || 0,
      preferredBrand: ownerUser.preferredBrand || 'royal',
    } : null;
    
    const playingHours = ownerUser?.playingHours;

    const bundle: FullAppDataBundle = {
      version: '2.1.0',
      exportDate: new Date().toISOString(),
      cruises,
      bookedCruises,
      casinoOffers,
      calendarEvents,
      casinoSessions,
      certificates,
      clubRoyaleProfile,
      settings,
      loyaltyData: {
        manualClubRoyalePoints: manualClubRoyale ? parseInt(manualClubRoyale, 10) : null,
        manualCrownAnchorPoints: manualCrownAnchor ? parseInt(manualCrownAnchor, 10) : null,
        userPoints: userPoints ? parseInt(userPoints, 10) : null,
      },
      userProfile,
      users,
      playingHours,
      machines: {
        encyclopedia: machineEncyclopedia,
        atlasIds: myAtlasIds,
      },
      metadata: {
        totalCruises: cruises.length,
        totalBooked: bookedCruises.length,
        totalOffers: casinoOffers.length,
        totalEvents: calendarEvents.length,
        totalCertificates: certificates.length,
        totalSessions: casinoSessions.length,
        totalMachines: myAtlasIds.length,
      },
    };

    console.log('[DataBundle] Retrieved data:', bundle.metadata);
    console.log('[DataBundle] User profile:', userProfile);
    return bundle;
  } catch (error) {
    console.error('[DataBundle] Error getting all data:', error);
    throw error;
  }
}

export async function importAllData(bundle: FullAppDataBundle): Promise<{
  success: boolean;
  imported: {
    cruises: number;
    bookedCruises: number;
    casinoOffers: number;
    calendarEvents: number;
    casinoSessions: number;
    certificates: number;
    machines: number;
  };
  errors: string[];
}> {
  console.log('[DataBundle] Importing all data...');
  const errors: string[] = [];
  const imported = {
    cruises: 0,
    bookedCruises: 0,
    casinoOffers: 0,
    calendarEvents: 0,
    casinoSessions: 0,
    certificates: 0,
    machines: 0,
  };

  try {
    if (bundle.cruises && Array.isArray(bundle.cruises)) {
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.CRUISES, JSON.stringify(bundle.cruises));
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.HAS_IMPORTED_DATA, 'true');
      imported.cruises = bundle.cruises.length;
      console.log('[DataBundle] Imported cruises:', imported.cruises);
    }
  } catch (error) {
    errors.push(`Failed to import cruises: ${error}`);
  }

  try {
    if (bundle.bookedCruises && Array.isArray(bundle.bookedCruises)) {
      const enrichedBooked = applyKnownRetailValuesToBooked(bundle.bookedCruises);
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.BOOKED_CRUISES, JSON.stringify(enrichedBooked));
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.HAS_IMPORTED_DATA, 'true');
      imported.bookedCruises = enrichedBooked.length;
      console.log('[DataBundle] Imported booked cruises:', imported.bookedCruises);
    }
  } catch (error) {
    errors.push(`Failed to import booked cruises: ${error}`);
  }

  try {
    if (bundle.casinoOffers && Array.isArray(bundle.casinoOffers)) {
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.CASINO_OFFERS, JSON.stringify(bundle.casinoOffers));
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.HAS_IMPORTED_DATA, 'true');
      imported.casinoOffers = bundle.casinoOffers.length;
      console.log('[DataBundle] Imported casino offers:', imported.casinoOffers);
    }
  } catch (error) {
    errors.push(`Failed to import casino offers: ${error}`);
  }

  try {
    if (bundle.calendarEvents && Array.isArray(bundle.calendarEvents)) {
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(bundle.calendarEvents));
      imported.calendarEvents = bundle.calendarEvents.length;
      console.log('[DataBundle] Imported calendar events:', imported.calendarEvents);
    }
  } catch (error) {
    errors.push(`Failed to import calendar events: ${error}`);
  }

  try {
    if (bundle.casinoSessions && Array.isArray(bundle.casinoSessions)) {
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.CASINO_SESSIONS, JSON.stringify(bundle.casinoSessions));
      imported.casinoSessions = bundle.casinoSessions.length;
      console.log('[DataBundle] Imported casino sessions:', imported.casinoSessions);
    }
  } catch (error) {
    errors.push(`Failed to import casino sessions: ${error}`);
  }

  try {
    if (bundle.certificates && Array.isArray(bundle.certificates)) {
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.CERTIFICATES, JSON.stringify(bundle.certificates));
      imported.certificates = bundle.certificates.length;
      console.log('[DataBundle] Imported certificates:', imported.certificates);
    }
  } catch (error) {
    errors.push(`Failed to import certificates: ${error}`);
  }

  try {
    if (bundle.clubRoyaleProfile) {
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.CLUB_PROFILE, JSON.stringify(bundle.clubRoyaleProfile));
      console.log('[DataBundle] Imported club profile');
    }
  } catch (error) {
    errors.push(`Failed to import club profile: ${error}`);
  }

  try {
    if (bundle.settings) {
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.SETTINGS, JSON.stringify(bundle.settings));
      console.log('[DataBundle] Imported settings');
    }
  } catch (error) {
    errors.push(`Failed to import settings: ${error}`);
  }

  try {
    if (bundle.loyaltyData) {
      if (bundle.loyaltyData.manualClubRoyalePoints !== null) {
        await AsyncStorage.setItem(
          ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS, 
          bundle.loyaltyData.manualClubRoyalePoints.toString()
        );
      }
      if (bundle.loyaltyData.manualCrownAnchorPoints !== null) {
        await AsyncStorage.setItem(
          ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS, 
          bundle.loyaltyData.manualCrownAnchorPoints.toString()
        );
      }
      if (bundle.loyaltyData.userPoints !== null) {
        await AsyncStorage.setItem(
          ALL_STORAGE_KEYS.USER_POINTS, 
          bundle.loyaltyData.userPoints.toString()
        );
      }
      console.log('[DataBundle] Imported loyalty data');
    }
  } catch (error) {
    errors.push(`Failed to import loyalty data: ${error}`);
  }

  try {
    let usersToImport: UserProfile[] | null = null;
    
    if (bundle.users && Array.isArray(bundle.users) && bundle.users.length > 0) {
      console.log('[DataBundle] Found users array with', bundle.users.length, 'users');
      console.log('[DataBundle] Users data:', JSON.stringify(bundle.users.map(u => ({ id: u.id, name: u.name, crownAnchorNumber: u.crownAnchorNumber, playingHours: u.playingHours }))));
      usersToImport = bundle.users;
    } else if (bundle.userProfile && (bundle.userProfile.name || bundle.userProfile.crownAnchorNumber)) {
      console.log('[DataBundle] No users array, creating from userProfile:', JSON.stringify(bundle.userProfile));
      const now = new Date().toISOString();
      const newUser: UserProfile = {
        id: `user_${Date.now()}`,
        name: bundle.userProfile.name || '',
        email: bundle.userProfile.email || '',
        isOwner: true,
        crownAnchorNumber: bundle.userProfile.crownAnchorNumber || '',
        celebrityEmail: bundle.userProfile.celebrityEmail,
        celebrityCaptainsClubNumber: bundle.userProfile.celebrityCaptainsClubNumber,
        celebrityCaptainsClubPoints: bundle.userProfile.celebrityCaptainsClubPoints,
        celebrityBlueChipPoints: bundle.userProfile.celebrityBlueChipPoints,
        preferredBrand: bundle.userProfile.preferredBrand,
        playingHours: bundle.playingHours,
        createdAt: now,
        updatedAt: now,
      };
      usersToImport = [newUser];
      console.log('[DataBundle] Created user from userProfile:', newUser.name, 'C&A:', newUser.crownAnchorNumber, 'with playing hours');
    } else {
      console.log('[DataBundle] No user data to import - neither users array nor userProfile with data');
    }
    
    if (usersToImport && usersToImport.length > 0) {
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.USERS, JSON.stringify(usersToImport));
      console.log('[DataBundle] Successfully imported', usersToImport.length, 'users to storage');
      console.log('[DataBundle] Imported users:', JSON.stringify(usersToImport.map(u => ({ id: u.id, name: u.name, crownAnchorNumber: u.crownAnchorNumber, hasPlayingHours: !!u.playingHours }))));
      
      const ownerUser = usersToImport.find(u => u.isOwner) || usersToImport[0];
      if (ownerUser) {
        await AsyncStorage.setItem(ALL_STORAGE_KEYS.CURRENT_USER, ownerUser.id);
        console.log('[DataBundle] Set current user to:', ownerUser.id, ownerUser.name);
      }
    }
  } catch (error) {
    console.error('[DataBundle] Error importing users:', error);
    errors.push(`Failed to import users: ${error}`);
  }

  try {
    if (bundle.machines) {
      if (bundle.machines.encyclopedia && Array.isArray(bundle.machines.encyclopedia)) {
        await AsyncStorage.setItem(ALL_STORAGE_KEYS.MACHINE_ENCYCLOPEDIA, JSON.stringify(bundle.machines.encyclopedia));
        console.log('[DataBundle] Imported machine encyclopedia:', bundle.machines.encyclopedia.length);
      }
      if (bundle.machines.atlasIds && Array.isArray(bundle.machines.atlasIds)) {
        await AsyncStorage.setItem(ALL_STORAGE_KEYS.MY_SLOT_ATLAS, JSON.stringify(bundle.machines.atlasIds));
        imported.machines = bundle.machines.atlasIds.length;
        console.log('[DataBundle] Imported slot atlas:', imported.machines, 'machines');
      }
    }
  } catch (error) {
    console.error('[DataBundle] Error importing machines:', error);
    errors.push(`Failed to import machines: ${error}`);
  }

  const success = errors.length === 0;
  console.log('[DataBundle] Import complete:', { success, imported, errorCount: errors.length });
  
  return { success, imported, errors };
}

export async function getDataSummary(): Promise<{
  cruises: number;
  bookedCruises: number;
  offers: number;
  events: number;
  casinoSessions: number;
  certificates: number;
  hasProfile: boolean;
  hasSettings: boolean;
  hasLoyaltyData: boolean;
  machines: number;
}> {
  try {
    const bundle = await getAllStoredData();
    return {
      cruises: bundle.metadata.totalCruises,
      bookedCruises: bundle.metadata.totalBooked,
      offers: bundle.metadata.totalOffers,
      events: bundle.metadata.totalEvents,
      casinoSessions: bundle.metadata.totalSessions,
      certificates: bundle.metadata.totalCertificates,
      hasProfile: bundle.clubRoyaleProfile !== null,
      hasSettings: bundle.settings !== null,
      hasLoyaltyData: bundle.loyaltyData.manualClubRoyalePoints !== null || 
                      bundle.loyaltyData.manualCrownAnchorPoints !== null,
      machines: bundle.metadata.totalMachines,
    };
  } catch (error) {
    console.error('[DataBundle] Error getting data summary:', error);
    return {
      cruises: 0,
      bookedCruises: 0,
      offers: 0,
      events: 0,
      casinoSessions: 0,
      certificates: 0,
      hasProfile: false,
      hasSettings: false,
      hasLoyaltyData: false,
      machines: 0,
    };
  }
}
