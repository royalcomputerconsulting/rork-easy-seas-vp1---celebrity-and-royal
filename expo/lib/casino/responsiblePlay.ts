import type { ResponsiblePlayLimits } from '@/types/intelligence';

export interface ResponsiblePlayStatus {
  state: 'within_limits' | 'approaching_limit' | 'stop_and_cool_down' | 'not_configured';
  messages: string[];
  remainingBankroll: number | null;
  remainingMinutes: number | null;
  neutralReminder: string;
}

export function evaluateResponsiblePlay(input: {
  limits: ResponsiblePlayLimits;
  tripNetResult: number;
  todayNetResult: number;
  sessionMinutes: number;
}): ResponsiblePlayStatus {
  const { limits } = input;
  const configured = [limits.tripBankroll, limits.dailyStopLoss, limits.dailyWinGoal, limits.sessionMinutes].some((value) => typeof value === 'number' && value > 0);
  if (!configured) return { state: 'not_configured', messages: ['No private play limits are set.'], remainingBankroll: null, remainingMinutes: null, neutralReminder: 'Set limits before play if that supports your plans.' };
  const tripLoss = Math.max(0, -input.tripNetResult);
  const dayLoss = Math.max(0, -input.todayNetResult);
  const remainingBankroll = limits.tripBankroll == null ? null : Math.max(0, limits.tripBankroll - tripLoss);
  const remainingMinutes = limits.sessionMinutes == null ? null : Math.max(0, limits.sessionMinutes - input.sessionMinutes);
  const stop = (limits.tripBankroll != null && tripLoss >= limits.tripBankroll)
    || (limits.dailyStopLoss != null && dayLoss >= limits.dailyStopLoss)
    || (limits.dailyWinGoal != null && input.todayNetResult >= limits.dailyWinGoal)
    || (limits.sessionMinutes != null && input.sessionMinutes >= limits.sessionMinutes);
  const approaching = (remainingBankroll != null && limits.tripBankroll != null && remainingBankroll <= limits.tripBankroll * 0.2)
    || (remainingMinutes != null && limits.sessionMinutes != null && remainingMinutes <= limits.sessionMinutes * 0.2);
  const messages: string[] = [];
  if (limits.dailyStopLoss != null) messages.push(`Daily stop-loss: $${limits.dailyStopLoss.toLocaleString()}.`);
  if (limits.dailyWinGoal != null) messages.push(`Daily win goal: $${limits.dailyWinGoal.toLocaleString()}.`);
  if (limits.sessionMinutes != null) messages.push(`Session time limit: ${limits.sessionMinutes} minutes.`);
  return {
    state: stop ? 'stop_and_cool_down' : approaching ? 'approaching_limit' : 'within_limits',
    messages,
    remainingBankroll,
    remainingMinutes,
    neutralReminder: stop ? `Your private limit was reached. End the session and take at least ${limits.cooldownMinutes ?? 30} minutes away.` : 'Limits are personal guardrails, not play targets.',
  };
}
