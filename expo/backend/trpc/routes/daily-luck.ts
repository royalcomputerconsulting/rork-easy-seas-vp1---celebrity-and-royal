import * as z from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';
import { analyzeDailyLuck } from '@/backend/daily-luck/luckEngine';

const DailyLuckInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  westernSign: z.string().min(2).optional(),
  chineseSign: z.string().min(2).optional(),
  birthDate: z.string().min(6),
  birthplace: z.string().optional(),
  displayName: z.string().optional(),
  skyTodayUrl: z.string().url().optional(),
});

export const dailyLuckRouter = createTRPCRouter({
  getLive: publicProcedure
    .input(DailyLuckInputSchema)
    .query(async ({ input }) => {
      console.log('[API] Running live daily luck analysis:', {
        date: input.date,
        westernSign: input.westernSign,
        chineseSign: input.chineseSign,
      });

      return analyzeDailyLuck({
        date: input.date,
        westernSign: input.westernSign,
        chineseSign: input.chineseSign,
        birthDate: input.birthDate,
        birthplace: input.birthplace,
        displayName: input.displayName,
        skyTodayUrl: input.skyTodayUrl,
      });
    }),
});
