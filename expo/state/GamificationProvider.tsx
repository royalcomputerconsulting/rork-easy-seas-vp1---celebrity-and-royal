import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";

export type AchievementId = 
  | 'first_session'
  | 'first_jackpot'
  | 'pinnacle_player'
  | 'roi_master'
  | 'high_roller'
  | 'streak_warrior_7'
  | 'streak_warrior_30'
  | 'points_hunter_1k'
  | 'points_hunter_10k'
  | 'points_hunter_50k'
  | 'marathon_player'
  | 'early_bird'
  | 'night_owl'
  | 'consistent_player'
  | 'cruise_veteran'
  | 'big_winner'
  | 'comeback_king';

export interface Achievement {
  id: AchievementId;
  name: string;
  description: string;
  icon: 'trophy' | 'star' | 'crown' | 'award' | 'zap' | 'target' | 'flame' | 'sun' | 'moon' | 'ship' | 'coins' | 'medal';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: string;
  progress?: number;
  target?: number;
  category: 'session' | 'streak' | 'points' | 'casino' | 'cruise';
}

export interface PlayingStreak {
  currentDailyStreak: number;
  currentWeeklyStreak: number;
  longestDailyStreak: number;
  longestWeeklyStreak: number;
  lastSessionDate: string | null;
  lastWeekPlayed: string | null;
  streakStartDate: string | null;
  totalDaysPlayed: number;
  totalWeeksPlayed: number;
}

export interface WeeklyGoal {
  id: string;
  type: 'points' | 'sessions' | 'time' | 'winnings';
  target: number;
  current: number;
  weekStart: string;
  weekEnd: string;
  completed: boolean;
  reward?: string;
}

export interface GamificationStats {
  totalPointsAllTime: number;
  totalSessionsAllTime: number;
  totalPlayTimeMinutes: number;
  totalWinnings: number;
  totalJackpots: number;
  averagePointsPerHour: number;
  bestSingleSession: {
    points: number;
    date: string;
  } | null;
  currentLevel: number;
  experiencePoints: number;
  nextLevelXP: number;
}

interface GamificationState {
  achievements: Achievement[];
  streak: PlayingStreak;
  weeklyGoals: WeeklyGoal[];
  stats: GamificationStats;
  isLoading: boolean;
  unlockAchievement: (achievementId: AchievementId) => Promise<void>;
  updateStreakFromSession: (sessionDate: string) => Promise<void>;
  updateWeeklyGoalProgress: (goalType: WeeklyGoal['type'], amount: number) => Promise<void>;
  addExperience: (xp: number) => Promise<void>;
  checkAndUnlockAchievements: (data: {
    totalSessions?: number;
    totalPoints?: number;
    totalJackpots?: number;
    totalWinnings?: number;
    sessionDuration?: number;
    sessionTime?: string;
    currentStreak?: number;
  }) => Promise<AchievementId[]>;
  resetWeeklyGoals: () => Promise<void>;
  getUnlockedAchievements: () => Achievement[];
  getLockedAchievements: () => Achievement[];
  calculatePointsPerHour: (points: number, minutes: number) => number;
}

const STORAGE_KEY = 'easyseas_gamification';

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_session',
    name: 'Set Sail',
    description: 'Complete your first casino session',
    icon: 'ship',
    rarity: 'common',
    category: 'session',
  },
  {
    id: 'first_jackpot',
    name: 'Lucky Break',
    description: 'Hit your first jackpot',
    icon: 'star',
    rarity: 'rare',
    category: 'casino',
  },
  {
    id: 'pinnacle_player',
    name: 'Pinnacle Club',
    description: 'Reach Pinnacle status in Crown & Anchor',
    icon: 'crown',
    rarity: 'legendary',
    category: 'cruise',
  },
  {
    id: 'roi_master',
    name: 'ROI Master',
    description: 'Achieve 500%+ ROI on a cruise',
    icon: 'trophy',
    rarity: 'epic',
    category: 'cruise',
  },
  {
    id: 'high_roller',
    name: 'High Roller',
    description: 'Play $10,000+ coin-in in a single session',
    icon: 'coins',
    rarity: 'epic',
    category: 'casino',
  },
  {
    id: 'streak_warrior_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day playing streak',
    icon: 'flame',
    rarity: 'rare',
    category: 'streak',
    target: 7,
  },
  {
    id: 'streak_warrior_30',
    name: 'Monthly Champion',
    description: 'Maintain a 30-day playing streak',
    icon: 'flame',
    rarity: 'epic',
    category: 'streak',
    target: 30,
  },
  {
    id: 'points_hunter_1k',
    name: 'Points Collector',
    description: 'Earn 1,000 points in a single session',
    icon: 'target',
    rarity: 'common',
    category: 'points',
    target: 1000,
  },
  {
    id: 'points_hunter_10k',
    name: 'Points Master',
    description: 'Earn 10,000 points in a single session',
    icon: 'target',
    rarity: 'rare',
    category: 'points',
    target: 10000,
  },
  {
    id: 'points_hunter_50k',
    name: 'Points Legend',
    description: 'Earn 50,000 lifetime points',
    icon: 'medal',
    rarity: 'epic',
    category: 'points',
    target: 50000,
  },
  {
    id: 'marathon_player',
    name: 'Marathon Player',
    description: 'Play for 4+ hours in a single session',
    icon: 'award',
    rarity: 'rare',
    category: 'session',
    target: 240,
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Start a session before 7 AM',
    icon: 'sun',
    rarity: 'common',
    category: 'session',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Play a session after midnight',
    icon: 'moon',
    rarity: 'common',
    category: 'session',
  },
  {
    id: 'consistent_player',
    name: 'Consistent Player',
    description: 'Complete 50 total sessions',
    icon: 'award',
    rarity: 'rare',
    category: 'session',
    target: 50,
  },
  {
    id: 'cruise_veteran',
    name: 'Cruise Veteran',
    description: 'Complete 10 cruises',
    icon: 'ship',
    rarity: 'epic',
    category: 'cruise',
    target: 10,
  },
  {
    id: 'big_winner',
    name: 'Big Winner',
    description: 'Win $1,000+ in a single session',
    icon: 'coins',
    rarity: 'rare',
    category: 'casino',
    target: 1000,
  },
  {
    id: 'comeback_king',
    name: 'Comeback King',
    description: 'Turn a losing session into a winning one',
    icon: 'zap',
    rarity: 'rare',
    category: 'casino',
  },
];

const DEFAULT_STREAK: PlayingStreak = {
  currentDailyStreak: 0,
  currentWeeklyStreak: 0,
  longestDailyStreak: 0,
  longestWeeklyStreak: 0,
  lastSessionDate: null,
  lastWeekPlayed: null,
  streakStartDate: null,
  totalDaysPlayed: 0,
  totalWeeksPlayed: 0,
};

const DEFAULT_STATS: GamificationStats = {
  totalPointsAllTime: 0,
  totalSessionsAllTime: 0,
  totalPlayTimeMinutes: 0,
  totalWinnings: 0,
  totalJackpots: 0,
  averagePointsPerHour: 0,
  bestSingleSession: null,
  currentLevel: 1,
  experiencePoints: 0,
  nextLevelXP: 100,
};

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

function calculateLevel(xp: number): { level: number; nextLevelXP: number } {
  let level = 1;
  let xpRequired = 100;
  let totalXPRequired = xpRequired;

  while (xp >= totalXPRequired) {
    level++;
    xpRequired = Math.floor(xpRequired * 1.5);
    totalXPRequired += xpRequired;
  }

  return { level, nextLevelXP: totalXPRequired };
}

export const [GamificationProvider, useGamification] = createContextHook((): GamificationState => {
  const [achievements, setAchievements] = useState<Achievement[]>(DEFAULT_ACHIEVEMENTS);
  const [streak, setStreak] = useState<PlayingStreak>(DEFAULT_STREAK);
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);
  const [stats, setStats] = useState<GamificationStats>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(true);

  const persistData = useCallback(async (
    newAchievements: Achievement[],
    newStreak: PlayingStreak,
    newGoals: WeeklyGoal[],
    newStats: GamificationStats
  ) => {
    try {
      const data = {
        achievements: newAchievements,
        streak: newStreak,
        weeklyGoals: newGoals,
        stats: newStats,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('[Gamification] Data persisted');
    } catch (error) {
      console.error('[Gamification] Failed to persist data:', error);
    }
  }, []);

  const initializeWeeklyGoals = useCallback((): WeeklyGoal[] => {
    const today = new Date();
    const weekStart = getWeekStart(today);
    const weekEnd = getWeekEnd(weekStart);

    return [
      {
        id: `points_${weekStart}`,
        type: 'points',
        target: 5000,
        current: 0,
        weekStart,
        weekEnd,
        completed: false,
        reward: '🎯 Points Master',
      },
      {
        id: `sessions_${weekStart}`,
        type: 'sessions',
        target: 5,
        current: 0,
        weekStart,
        weekEnd,
        completed: false,
        reward: '🎰 Session Pro',
      },
      {
        id: `time_${weekStart}`,
        type: 'time',
        target: 300,
        current: 0,
        weekStart,
        weekEnd,
        completed: false,
        reward: '⏱️ Time Champion',
      },
    ];
  }, []);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      
      if (stored) {
        const data = JSON.parse(stored);
        
        if (data.achievements) {
          const mergedAchievements = DEFAULT_ACHIEVEMENTS.map(defaultAch => {
            const savedAch = data.achievements.find((a: Achievement) => a.id === defaultAch.id);
            return savedAch ? { ...defaultAch, ...savedAch } : defaultAch;
          });
          setAchievements(mergedAchievements);
        }
        
        if (data.streak) {
          setStreak(data.streak);
        }
        
        if (data.stats) {
          setStats(data.stats);
        }

        const today = new Date();
        const currentWeekStart = getWeekStart(today);
        
        if (data.weeklyGoals && data.weeklyGoals.length > 0) {
          const existingWeekStart = data.weeklyGoals[0].weekStart;
          if (existingWeekStart === currentWeekStart) {
            setWeeklyGoals(data.weeklyGoals);
          } else {
            const newGoals = initializeWeeklyGoals();
            setWeeklyGoals(newGoals);
          }
        } else {
          const newGoals = initializeWeeklyGoals();
          setWeeklyGoals(newGoals);
        }
        
        console.log('[Gamification] Data loaded');
      } else {
        const newGoals = initializeWeeklyGoals();
        setWeeklyGoals(newGoals);
        console.log('[Gamification] Initialized with defaults');
      }
    } catch (error) {
      console.error('[Gamification] Failed to load data:', error);
      const newGoals = initializeWeeklyGoals();
      setWeeklyGoals(newGoals);
    } finally {
      setIsLoading(false);
    }
  }, [initializeWeeklyGoals]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unlockAchievement = useCallback(async (achievementId: AchievementId) => {
    const achievementIndex = achievements.findIndex(a => a.id === achievementId);
    if (achievementIndex === -1 || achievements[achievementIndex].unlockedAt) {
      return;
    }

    const newAchievements = [...achievements];
    newAchievements[achievementIndex] = {
      ...newAchievements[achievementIndex],
      unlockedAt: new Date().toISOString(),
    };
    
    setAchievements(newAchievements);
    
    const xpReward = {
      common: 50,
      rare: 150,
      epic: 300,
      legendary: 500,
    }[newAchievements[achievementIndex].rarity];
    
    const newXP = stats.experiencePoints + xpReward;
    const { level, nextLevelXP } = calculateLevel(newXP);
    const newStats = {
      ...stats,
      experiencePoints: newXP,
      currentLevel: level,
      nextLevelXP,
    };
    setStats(newStats);
    
    await persistData(newAchievements, streak, weeklyGoals, newStats);
    console.log('[Gamification] Achievement unlocked:', achievementId, 'XP earned:', xpReward);
  }, [achievements, stats, streak, weeklyGoals, persistData]);

  const updateStreakFromSession = useCallback(async (sessionDate: string) => {
    const today = new Date(sessionDate);
    const todayStr = today.toISOString().split('T')[0];
    const currentWeek = getWeekStart(today);
    
    let newStreak = { ...streak };
    
    if (!streak.lastSessionDate) {
      newStreak = {
        ...newStreak,
        currentDailyStreak: 1,
        longestDailyStreak: 1,
        streakStartDate: todayStr,
        lastSessionDate: todayStr,
        totalDaysPlayed: 1,
      };
    } else {
      const lastDate = new Date(streak.lastSessionDate);
      const diffTime = today.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        console.log('[Gamification] Same day session, no streak update');
      } else if (diffDays === 1) {
        const newDailyStreak = streak.currentDailyStreak + 1;
        newStreak = {
          ...newStreak,
          currentDailyStreak: newDailyStreak,
          longestDailyStreak: Math.max(streak.longestDailyStreak, newDailyStreak),
          lastSessionDate: todayStr,
          totalDaysPlayed: streak.totalDaysPlayed + 1,
        };
      } else {
        newStreak = {
          ...newStreak,
          currentDailyStreak: 1,
          streakStartDate: todayStr,
          lastSessionDate: todayStr,
          totalDaysPlayed: streak.totalDaysPlayed + 1,
        };
      }
    }

    if (!streak.lastWeekPlayed || streak.lastWeekPlayed !== currentWeek) {
      if (streak.lastWeekPlayed) {
        const lastWeekDate = new Date(streak.lastWeekPlayed);
        const diffWeeks = Math.floor((today.getTime() - lastWeekDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        
        if (diffWeeks <= 1) {
          const newWeeklyStreak = streak.currentWeeklyStreak + 1;
          newStreak = {
            ...newStreak,
            currentWeeklyStreak: newWeeklyStreak,
            longestWeeklyStreak: Math.max(streak.longestWeeklyStreak, newWeeklyStreak),
            lastWeekPlayed: currentWeek,
            totalWeeksPlayed: streak.totalWeeksPlayed + 1,
          };
        } else {
          newStreak = {
            ...newStreak,
            currentWeeklyStreak: 1,
            lastWeekPlayed: currentWeek,
            totalWeeksPlayed: streak.totalWeeksPlayed + 1,
          };
        }
      } else {
        newStreak = {
          ...newStreak,
          currentWeeklyStreak: 1,
          longestWeeklyStreak: Math.max(streak.longestWeeklyStreak, 1),
          lastWeekPlayed: currentWeek,
          totalWeeksPlayed: 1,
        };
      }
    }
    
    setStreak(newStreak);
    await persistData(achievements, newStreak, weeklyGoals, stats);
    console.log('[Gamification] Streak updated:', newStreak);
  }, [streak, achievements, weeklyGoals, stats, persistData]);

  const updateWeeklyGoalProgress = useCallback(async (goalType: WeeklyGoal['type'], amount: number) => {
    const today = new Date();
    const currentWeekStart = getWeekStart(today);
    
    let currentGoals = weeklyGoals;
    if (currentGoals.length === 0 || currentGoals[0].weekStart !== currentWeekStart) {
      currentGoals = initializeWeeklyGoals();
    }
    
    const newGoals = currentGoals.map(goal => {
      if (goal.type === goalType && !goal.completed) {
        const newCurrent = goal.current + amount;
        const completed = newCurrent >= goal.target;
        return {
          ...goal,
          current: newCurrent,
          completed,
        };
      }
      return goal;
    });
    
    setWeeklyGoals(newGoals);
    await persistData(achievements, streak, newGoals, stats);
    console.log('[Gamification] Weekly goal progress updated:', goalType, amount);
  }, [weeklyGoals, achievements, streak, stats, persistData, initializeWeeklyGoals]);

  const addExperience = useCallback(async (xp: number) => {
    const newXP = stats.experiencePoints + xp;
    const { level, nextLevelXP } = calculateLevel(newXP);
    
    const newStats = {
      ...stats,
      experiencePoints: newXP,
      currentLevel: level,
      nextLevelXP,
    };
    
    setStats(newStats);
    await persistData(achievements, streak, weeklyGoals, newStats);
    console.log('[Gamification] XP added:', xp, 'New level:', level);
  }, [stats, achievements, streak, weeklyGoals, persistData]);

  const checkAndUnlockAchievements = useCallback(async (data: {
    totalSessions?: number;
    totalPoints?: number;
    totalJackpots?: number;
    totalWinnings?: number;
    sessionDuration?: number;
    sessionTime?: string;
    currentStreak?: number;
  }): Promise<AchievementId[]> => {
    const unlockedIds: AchievementId[] = [];
    
    const isLocked = (id: AchievementId) => !achievements.find(a => a.id === id)?.unlockedAt;
    
    if (data.totalSessions && data.totalSessions >= 1 && isLocked('first_session')) {
      await unlockAchievement('first_session');
      unlockedIds.push('first_session');
    }
    
    if (data.totalSessions && data.totalSessions >= 50 && isLocked('consistent_player')) {
      await unlockAchievement('consistent_player');
      unlockedIds.push('consistent_player');
    }
    
    if (data.totalJackpots && data.totalJackpots >= 1 && isLocked('first_jackpot')) {
      await unlockAchievement('first_jackpot');
      unlockedIds.push('first_jackpot');
    }
    
    if (data.totalWinnings && data.totalWinnings >= 1000 && isLocked('big_winner')) {
      await unlockAchievement('big_winner');
      unlockedIds.push('big_winner');
    }
    
    if (data.sessionDuration && data.sessionDuration >= 240 && isLocked('marathon_player')) {
      await unlockAchievement('marathon_player');
      unlockedIds.push('marathon_player');
    }
    
    if (data.sessionTime) {
      const hour = parseInt(data.sessionTime.split(':')[0], 10);
      if (hour < 7 && isLocked('early_bird')) {
        await unlockAchievement('early_bird');
        unlockedIds.push('early_bird');
      }
      if (hour >= 0 && hour < 4 && isLocked('night_owl')) {
        await unlockAchievement('night_owl');
        unlockedIds.push('night_owl');
      }
    }
    
    if (data.currentStreak) {
      if (data.currentStreak >= 7 && isLocked('streak_warrior_7')) {
        await unlockAchievement('streak_warrior_7');
        unlockedIds.push('streak_warrior_7');
      }
      if (data.currentStreak >= 30 && isLocked('streak_warrior_30')) {
        await unlockAchievement('streak_warrior_30');
        unlockedIds.push('streak_warrior_30');
      }
    }
    
    if (data.totalPoints && data.totalPoints >= 50000 && isLocked('points_hunter_50k')) {
      await unlockAchievement('points_hunter_50k');
      unlockedIds.push('points_hunter_50k');
    }
    
    console.log('[Gamification] Achievements checked, unlocked:', unlockedIds);
    return unlockedIds;
  }, [achievements, unlockAchievement]);

  const resetWeeklyGoals = useCallback(async () => {
    const newGoals = initializeWeeklyGoals();
    setWeeklyGoals(newGoals);
    await persistData(achievements, streak, newGoals, stats);
    console.log('[Gamification] Weekly goals reset');
  }, [achievements, streak, stats, persistData, initializeWeeklyGoals]);

  const getUnlockedAchievements = useCallback((): Achievement[] => {
    return achievements.filter(a => a.unlockedAt);
  }, [achievements]);

  const getLockedAchievements = useCallback((): Achievement[] => {
    return achievements.filter(a => !a.unlockedAt);
  }, [achievements]);

  const calculatePointsPerHour = useCallback((points: number, minutes: number): number => {
    if (minutes <= 0) return 0;
    return Math.round((points / minutes) * 60);
  }, []);

  return {
    achievements,
    streak,
    weeklyGoals,
    stats,
    isLoading,
    unlockAchievement,
    updateStreakFromSession,
    updateWeeklyGoalProgress,
    addExperience,
    checkAndUnlockAchievements,
    resetWeeklyGoals,
    getUnlockedAchievements,
    getLockedAchievements,
    calculatePointsPerHour,
  };
});
