import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPersonalDashboardRepository } from './storage';
export const personalDashboardRepository = createPersonalDashboardRepository(AsyncStorage);
