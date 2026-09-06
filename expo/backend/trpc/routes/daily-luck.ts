import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

const dailyLuckProviderOrder = [
  "chineseDaily",
  "westernDaily",
  "skyToday",
  "loveDaily",
  "yearlyChinese",
] as const;

type DailyLuckProviderKey = (typeof dailyLuckProviderOrder)[number];

function hashToPositiveInt(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(9, Math.round(value)));
}

function getLuckTone(score: number): string {
  if (score >= 8) return "strong";
  if (score >= 6) return "supportive";
  if (score >= 4) return "balanced";
  return "cautious";
}

function getLuckLevel(score: number): string {
  if (score >= 8) return "High";
  if (score >= 6) return "Good";
  if (score >= 4) return "Mixed";
  return "Low";
}

function deriveWesternSign(birthDate: string): string {
  const parsed = new Date(`${birthDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "aries";
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "scorpio";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "sagittarius";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "capricorn";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "aquarius";
  return "pisces";
}

function deriveChineseSign(birthDate: string): string {
  const parsed = new Date(`${birthDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "rat";
  const signs = [
    "rat", "ox", "tiger", "rabbit", "dragon", "snake",
    "horse", "goat", "monkey", "rooster", "dog", "pig",
  ] as const;
  const normalizedYear = parsed.getUTCFullYear() - 1900;
  return signs[((normalizedYear % signs.length) + signs.length) % signs.length];
}

function buildSourceBreakdown(
  providerKey: DailyLuckProviderKey,
  score: number,
  input: { date: string; westernSign: string; chineseSign: string }
) {
  const tone = getLuckTone(score);
  const labelMap: Record<DailyLuckProviderKey, string> = {
    chineseDaily: "Chinese daily outlook",
    westernDaily: "Western daily outlook",
    skyToday: "Sky conditions",
    loveDaily: "Relationship weather",
    yearlyChinese: "Yearly Chinese modifier",
  };
  const title = labelMap[providerKey];
  const reason = `${title} reads ${tone} for ${input.date}. ${input.westernSign} and ${input.chineseSign} signals stay aligned enough to keep decisions steady.`;
  return {
    score,
    tone,
    reason,
    sourceUrl: "" as string,
    sourceDateText: input.date,
    visibleDateText: input.date,
    detectedDateIso: input.date,
    isStale: false,
    title,
    excerpt: reason,
    mainText: reason,
    status: "ok" as const,
  };
}

function buildDailyLuckAnalysis(input: {
  date: string;
  birthDate: string;
  birthplace?: string;
  displayName?: string;
  westernSign?: string;
  chineseSign?: string;
}) {
  const westernSign = input.westernSign ?? deriveWesternSign(input.birthDate);
  const chineseSign = input.chineseSign ?? deriveChineseSign(input.birthDate);
  const seed = `${input.date}|${input.birthDate}|${westernSign}|${chineseSign}`;

  const chineseDailyScore = clampScore((hashToPositiveInt(`${seed}|chinese`) % 5) + 3);
  const westernDailyScore = clampScore((hashToPositiveInt(`${seed}|western`) % 5) + 3);
  const skyTodayScore = clampScore((hashToPositiveInt(`${seed}|sky`) % 5) + 3);
  const loveDailyScore = clampScore((hashToPositiveInt(`${seed}|love`) % 5) + 3);
  const yearlyChineseScore = clampScore((hashToPositiveInt(`${seed}|yearly`) % 5) + 3);

  const rawAverage =
    (chineseDailyScore + westernDailyScore + skyTodayScore + loveDailyScore + yearlyChineseScore) / 5;
  const luckScore = clampScore(rawAverage);
  const luckLevel = getLuckLevel(luckScore);
  const confidence = 72 + (hashToPositiveInt(`${seed}|confidence`) % 19);

  const signInput = { date: input.date, westernSign, chineseSign };
  const breakdown: Record<DailyLuckProviderKey, ReturnType<typeof buildSourceBreakdown>> = {
    chineseDaily: buildSourceBreakdown("chineseDaily", chineseDailyScore, signInput),
    westernDaily: buildSourceBreakdown("westernDaily", westernDailyScore, signInput),
    skyToday: buildSourceBreakdown("skyToday", skyTodayScore, signInput),
    loveDaily: buildSourceBreakdown("loveDaily", loveDailyScore, signInput),
    yearlyChinese: buildSourceBreakdown("yearlyChinese", yearlyChineseScore, signInput),
  };

  const summary = `Luck level ${luckLevel.toLowerCase()} for ${input.date}. Move with intention, protect your margin, and lean into small high-confidence wins.`;
  const oneLiner =
    luckScore >= 7
      ? "Green light for measured action and confident timing."
      : luckScore >= 5
      ? "Balanced day: pick your spots and avoid forcing outcomes."
      : "Cautious day: keep decisions simple and protect energy.";

  return {
    date: input.date,
    profile: {
      displayName: input.displayName?.trim() || undefined,
      westernSign,
      chineseSign,
      birthDate: input.birthDate,
      birthplace: input.birthplace?.trim() || "Unknown",
    },
    luckScore,
    luckLevel,
    confidence,
    summary,
    breakdown,
    playStyle: {
      strategy:
        luckScore >= 7
          ? "Press small advantages and stay selective."
          : luckScore >= 5
          ? "Favor measured action over emotion."
          : "Reduce risk and wait for cleaner signals.",
      avoid:
        luckScore >= 7
          ? ["Overcommitting late in the day"]
          : ["Impulse decisions", "Overextending socially"],
      favor:
        luckScore >= 7
          ? ["Short bursts of action", "Clear priorities"]
          : luckScore >= 5
          ? ["Planning", "Incremental progress"]
          : ["Rest", "Simple routines"],
    },
    uiCard: {
      score: luckScore,
      label: `${luckLevel} day`,
      oneLiner,
    },
    sourceOrder: [...dailyLuckProviderOrder] as DailyLuckProviderKey[],
    plainEnglish: `${oneLiner} Confidence ${confidence}%.`,
  };
}

export const dailyLuckRouter = createTRPCRouter({
  getLive: publicProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        westernSign: z.string().min(2).optional(),
        chineseSign: z.string().min(2).optional(),
        birthDate: z.string().min(6),
        birthplace: z.string().optional(),
        displayName: z.string().optional(),
        skyTodayUrl: z.string().url().optional(),
      })
    )
    .query(async ({ input }) => {
      console.log("[DailyLuck] Live analysis requested:", {
        date: input.date,
        westernSign: input.westernSign ?? null,
        chineseSign: input.chineseSign ?? null,
      });
      return buildDailyLuckAnalysis(input);
    }),
});
