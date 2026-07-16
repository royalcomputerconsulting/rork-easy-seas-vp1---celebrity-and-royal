import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLiveCasinoAdvisorRepository } from './storage';

export const liveCasinoAdvisorRepository = createLiveCasinoAdvisorRepository(AsyncStorage);
