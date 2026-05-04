import { useState, useCallback, useMemo, useEffect } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { generateText } from '@rork-ai/toolkit-sdk';
import { useCoreData } from './CoreDataProvider';
import { useLoyalty } from './LoyaltyProvider';
import type { ChatMessage } from '@/components/AgentXChat';
import type { AgentXMode, BookedCruise, CalendarEvent, Cruise, SlotMachine, PriceDropAlert, PriceHistoryRecord, Alert, CompItem, W2GRecord } from '@/types/models';
import { askMyDataSearch, formatAskMyDataResponse, type AskMyDataContextBlock } from '@/lib/askMyData';
import { buildAskMyDataOverview } from '@/lib/askMyDataOverview';
import { isKnownCasinoProfile } from '@/lib/knownProfileFallback';
import { getBookedCruiseCasinoPoints } from '@/lib/casinoPointTruth';
import { calculateOfferIntelligenceScore } from '@/lib/offerIntelligence';
import {
  AgentToolContext,
  executeCruiseSearch,
  executeBookingAnalysis,
  executePortfolioOptimizer,
  executeTierProgress,
  executeOfferAnalysis,
  executeDecodeOffer,
  executeReplacementFinder,
  executeRecommendations,
  executeMachineRecommendations,
  executeCertificateSearch,
  CruiseSearchInput,
  BookingAnalysisInput,
  PortfolioOptimizerInput,
  TierProgressInput,
  OfferAnalysisInput,
  DecodeOfferInput,
  ReplacementFinderInput,
  ReplacementGoalId,
  RecommendationInput,
  MachineRecommendationInput,
  CertificateLevelSearchInput,
} from '@/lib/agentTools';
import { useSlotMachines } from './SlotMachineProvider';
import { useSlotMachineLibrary } from './SlotMachineLibraryProvider';
import { useDeckPlan } from './DeckPlanProvider';
import { useCasinoSessions } from './CasinoSessionProvider';
import { useEntitlement } from './EntitlementProvider';
import { useAuth } from './AuthProvider';
import { useCertificates } from './CertificatesProvider';
import { useMachineConditionLogs } from './MachineConditionLogProvider';
import { useIntelligenceFilters } from './IntelligenceFiltersProvider';
import { useUser } from './UserProvider';
import { useCrewRecognition } from './CrewRecognitionProvider';
import { useSailingWeather, type SailingWeatherForecast } from './SailingWeatherProvider';
import { useFinancials } from './FinancialsProvider';
import { useSimpleAnalytics } from './SimpleAnalyticsProvider';
import { useHistoricalPerformance } from './HistoricalPerformanceProvider';
import { usePriceHistory } from './PriceHistoryProvider';
import { usePriceTracking } from './PriceTrackingProvider';
import { useAlerts } from './AlertsProvider';
import { useBankroll } from './BankrollProvider';
import { useTax } from './TaxProvider';
import { usePPHAlerts } from './PPHAlertsProvider';
import { useGamification } from './GamificationProvider';
import { useCelebrity } from './CelebrityProvider';
import type { RecognitionEntryWithCrew } from '@/types/crew-recognition';
import {
  buildIntelligenceScopeLabel,
  filterRecordsByIntelligence,
  getBrandLabel,
  getBrandProgramSystemLabel,
  getProgramLabel,
  getProfileDisplayName,
} from '@/lib/intelligenceFilters';

interface AgentXState {
  messages: ChatMessage[];
  isLoading: boolean;
  isExpanded: boolean;
  isVisible: boolean;
  error: string | null;
  mode: AgentXMode;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  toggleExpanded: () => void;
  toggleVisible: () => void;
  setVisible: (visible: boolean) => void;
  setMode: (mode: AgentXMode) => void;
  refreshAnalysis: () => Promise<void>;
}

const AGENT_MODE_LABELS: Record<AgentXMode, string> = {
  travelAgent: 'Travel Agent',
  casinoHost: 'Casino Host',
  certificateAdvisor: 'Certificate Advisor',
  loyaltyStrategist: 'Loyalty Strategist',
  apScout: 'AP Scout',
  calendarPlanner: 'Calendar Planner',
  importAuditor: 'Import Auditor',
  easySeasGuide: 'EasySeas Guide',
};

function buildSystemPrompt(context: {
  allMachines?: SlotMachine[];
  globalLibrary?: unknown[];
  myAtlasMachines?: unknown[];
  sessions?: unknown[];
  deckMappings?: unknown[];
  machineLogs?: unknown[];
  certificates?: unknown[];
  calendarEvents?: CalendarEvent[];
  crewRecognitionEntries?: RecognitionEntryWithCrew[];
  weatherReports?: SailingWeatherForecast[];
  appContextBlocks?: AskMyDataContextBlock[];
  mode: AgentXMode;
  brandProgramLabel: string;
}): string {
  return `You are the Ask My Data assistant in ${AGENT_MODE_LABELS[context.mode]} mode, an intelligent cruise and casino advisor for Easy Seas users managing Royal Caribbean / Club Royale and Celebrity / Blue Chip casino cruise data. The active casino system is: ${context.brandProgramLabel}. You help users:
- Search and filter available cruises, booked cruises, casino offers, certificates, calendar events, and travel agenda items
- Analyze bookings and calculate ROI
- Track casino program tier progress using the selected Royal/Celebrity scope
- Optimize their cruise portfolio for maximum points and value
- Understand casino offers and their values
- Identify which certificate levels match specific ships or sailing dates
- Recommend slot machines on specific ships for advantage play (AP) and optimal returns
- Analyze slot machine session data and performance
- Track machine locations and condition logs on specific ships
- Answer questions about crew recognition records, departments, roles, ships, and sail dates
- Answer questions about loaded weather/rough-seas reports, wind, waves, rain, and advisories
- Answer questions about financials, payments, price history, alerts, bankroll, tax/W-2G, comp items, analytics, achievements, and app settings context
- Provide careful educational guidance about offer math, certificates, loyalty, and responsible use
- Answer Ask My Data questions from freshly loaded saved app context

You have FULL ACCESS to:
1. **Cruise Data**: All available cruises, booked cruises, casino offers, tier information
2. **Slot Machine Data**: ${context.allMachines?.length || 0} machine records, ${context.globalLibrary?.length || 0} permanent library records, ${context.myAtlasMachines?.length || 0} personal Atlas records
3. **Casino Sessions**: ${context.sessions?.length || 0} tracked sessions
4. **Deck Plans**: ${context.deckMappings?.length || 0} machine location mappings across ships
5. **Machine Condition Logs**: ${context.machineLogs?.length || 0} Machine Atlas observations
6. **Certificates**: ${context.certificates?.length || 0} certificate records
7. **Events / Calendar**: ${context.calendarEvents?.length || 0} calendar, travel, cruise, flight, hotel, and personal event records
8. **Crew Recognition**: ${context.crewRecognitionEntries?.length || 0} crew recognition entries
9. **Weather Reports**: ${context.weatherReports?.length || 0} loaded sailing weather / rough-seas reports
10. **App-Wide Context**: ${context.appContextBlocks?.length || 0} live context blocks covering financials, analytics, price history, alerts, bankroll, taxes, achievements, profile/settings, and reference data

Mode guidance:
- Travel Agent: prioritize itinerary, cabin, dates, route, ports, weather, events, and booking practicality.
- Casino Host: prioritize offer value, casino-paid value, FreePlay/OBC, casino sessions, and responsible play guidance.
- Certificate Advisor: prioritize certificate fit, cautious stacking notes, expirations, and terms verification.
- Loyalty Strategist: prioritize tier points, progress, milestones, and realistic earning paths.
- AP Scout: prioritize slot machines, machine condition logs, persistence, meters, jackpot conditions, and play/pass/watch decisions.
- Calendar Planner: prioritize agenda dates, sailing days, expirations, weather, travel gaps, and conflicts.
- Import Auditor: prioritize source, profile ownership, reconciliation, missing rows, duplicates, review-needed records, and data-source counts.
- EasySeas Guide: prioritize app tutorials, cruise casino basics, offer math, certificates, and responsible-use education.

Key formulas:
- Points: 1 point per $5 coin-in
- Cash Result = Winnings Brought Home - Net Effective Paid
- Cruise Value Captured = Retail Value - Net Effective Paid
- Total Economic Value = Retail Value + Winnings Brought Home - Net Effective Paid
- Coin-In is gambling volume only. Never add Coin-In to Cash Result, Cruise Value Captured, Total Economic Value, ROI, or profit language.
- App-entered cruise points are authoritative when Club Royale sync differs.`;
}

function hasNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getFirstCruiseNumber(cruise: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = cruise[key];
    if (hasNumber(value)) return value;
  }
  return null;
}

function formatMoney(value: number | null): string {
  if (value === null) return 'n/a';
  return String.fromCharCode(36) + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeDateKey(value: string | undefined): string {
  if (!value) return '';
  return value.includes('T') ? value.split('T')[0] : value;
}

function buildDateAtNoon(dateKey: string): Date | null {
  const normalized = normalizeDateKey(dateKey);
  if (!normalized) return null;
  const date = new Date(`${normalized}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isCruiseWeatherEligible(cruise: BookedCruise): boolean {
  const sailDate = buildDateAtNoon(cruise.sailDate);
  const returnDate = buildDateAtNoon(cruise.returnDate);
  if (!sailDate || !returnDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const forecastLimit = addDays(today, 9);
  return returnDate >= today && sailDate <= forecastLimit;
}

function buildWeatherTargetDates(cruise: BookedCruise): Date[] {
  const sailDate = buildDateAtNoon(cruise.sailDate);
  const returnDate = buildDateAtNoon(cruise.returnDate);
  if (!sailDate || !returnDate) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const forecastEnd = addDays(today, 9);
  if (returnDate < today || sailDate > forecastEnd) return [];
  const end = returnDate < forecastEnd ? returnDate : forecastEnd;
  const dates: Date[] = [];
  let cursor = new Date(today);
  while (cursor <= end && dates.length < 10) {
    dates.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function buildBookedCruiseOfferContext(bookedCruises: BookedCruise[]): string {
  const offerBackedCruises = bookedCruises
    .filter((cruise) => Boolean(cruise.offerCode || cruise.offerName || cruise.offerCategory || cruise.freePlay || cruise.freeOBC || cruise.compValue || cruise.totalCasinoDiscount || cruise.sourcePayload))
    .sort((left, right) => (left.sailDate || '').localeCompare(right.sailDate || ''));

  if (offerBackedCruises.length === 0) {
    return 'No booked-cruise offer/value records are loaded in the active scope.';
  }

  return offerBackedCruises.slice(0, 24).map((cruise) => {
    const record = cruise as unknown as Record<string, unknown>;
    const retail = getFirstCruiseNumber(record, ['retailValue', 'totalRetailCost', 'originalPrice', 'totalValue']);
    const paid = getFirstCruiseNumber(record, ['netEffectivePaid', 'pricePaid', 'amountPaid', 'taxesFeesEstimate', 'taxes']);
    const comp = getFirstCruiseNumber(record, ['compValue', 'totalCasinoDiscount', 'cruiseValueCaptured']);
    const points = getBookedCruiseCasinoPoints(cruise);
    const offerLabel = cruise.offerCode || cruise.offerName || cruise.offerCategory || 'casino/comp booking';
    return `- ${cruise.shipName} ${cruise.sailDate} (${cruise.nights} nights): ${offerLabel}; retail ${formatMoney(retail)}; paid/net ${formatMoney(paid)}; comp/value ${formatMoney(comp)}; points ${points.toLocaleString()}; status ${cruise.status ?? cruise.completionState ?? 'booked'}`;
  }).join('\n');
}

function buildStandaloneOfferContext(offers: ReturnType<typeof useCoreData>['casinoOffers'], cruises: Cruise[], certificates: unknown[]): string {
  if (offers.length === 0) {
    return 'No standalone casino offer rows are loaded in the active scope. Use booked-cruise offer/value records above when answering offer questions.';
  }

  return offers.slice(0, 24).map((offer) => {
    const score = calculateOfferIntelligenceScore(offer, cruises, certificates as any[]).score;
    const expiry = offer.expiryDate || offer.expires || offer.offerExpiryDate || offer.validUntil || 'no expiry';
    const value = offer.totalValue ?? offer.offerValue ?? offer.value ?? offer.retailCabinValue ?? 0;
    return `- ${offer.offerName || offer.title || offer.offerCode || 'Casino offer'} (${offer.offerCode || 'no code'}): ship ${offer.shipName || 'any'}; expires ${expiry}; value ${formatMoney(value)}; FreePlay ${formatMoney(offer.freePlay ?? offer.freeplayAmount ?? null)}; OBC ${formatMoney(offer.OBC ?? offer.obcAmount ?? null)}; score ${score}/100`;
  }).join('\n');
}

function buildCalendarContext(events: CalendarEvent[]): string {
  if (events.length === 0) return 'No calendar/event records are loaded in the active scope.';
  return events
    .slice()
    .sort((left, right) => (left.startDate || left.start || '').localeCompare(right.startDate || right.start || ''))
    .slice(0, 30)
    .map((event) => `- ${event.title}: ${event.startDate || event.start || 'date missing'}${event.endDate || event.end ? ` to ${event.endDate || event.end}` : ''}; type ${event.type}; location ${event.location || 'n/a'}${event.description ? `; notes ${event.description}` : ''}`)
    .join('\n');
}

function buildCrewRecognitionContext(entries: RecognitionEntryWithCrew[]): string {
  if (entries.length === 0) return 'No crew recognition records are loaded.';
  const departmentCounts = entries.reduce<Record<string, number>>((accumulator, entry) => {
    const department = entry.department || 'Unknown';
    accumulator[department] = (accumulator[department] ?? 0) + 1;
    return accumulator;
  }, {});
  const departments = Object.entries(departmentCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([department, count]) => `${department}: ${count}`)
    .join(', ');
  const recent = entries
    .slice()
    .sort((left, right) => (right.sailStartDate || '').localeCompare(left.sailStartDate || ''))
    .slice(0, 30)
    .map((entry) => `- ${entry.fullName}: ${entry.department}${entry.roleTitle ? ` / ${entry.roleTitle}` : ''}; ${entry.shipName}; ${entry.sailStartDate}${entry.crewNotes ? `; notes ${entry.crewNotes}` : ''}`)
    .join('\n');
  return `Crew recognition totals: ${entries.length.toLocaleString()} entries. Departments: ${departments || 'n/a'}.\n${recent}`;
}

function buildMachineDataContext(machines: SlotMachine[], machineLogs: unknown[]): string {
  if (machines.length === 0 && machineLogs.length === 0) return 'No slot machine or machine condition records are loaded.';
  const apMachines = machines.filter((machine) => Boolean(machine.apMetadata?.hasMustHitBy || machine.apMetadata?.persistenceType));
  const machineLines = machines
    .slice(0, 30)
    .map((machine) => {
      const ap = machine.apMetadata ? `; AP ${machine.apMetadata.persistenceType || 'n/a'}${machine.apMetadata.hasMustHitBy ? '; must-hit-by' : ''}` : '';
      return `- ${machine.machineName}: ${machine.manufacturer}; ${machine.volatility} volatility; ${machine.cabinetType}${ap}${machine.detailedProfile?.simpleSummary ? `; ${machine.detailedProfile.simpleSummary}` : ''}`;
    })
    .join('\n');
  return `Slot machine totals: ${machines.length.toLocaleString()} machines, ${apMachines.length.toLocaleString()} with AP/must-hit/persistence metadata, ${machineLogs.length.toLocaleString()} condition log(s).\n${machineLines || 'No machine rows available.'}`;
}

function buildWeatherContext(reports: SailingWeatherForecast[]): string {
  if (reports.length === 0) return 'No sailing weather reports are loaded yet for the current 10-day cruise window.';
  return reports
    .slice()
    .sort((left, right) => `${left.dateKey}-${left.shipName}`.localeCompare(`${right.dateKey}-${right.shipName}`))
    .slice(0, 30)
    .map((forecast) => {
      const metrics = [
        forecast.metrics.conditionLabel,
        forecast.metrics.maxWindMph !== null ? `${forecast.metrics.maxWindMph.toFixed(0)} mph wind` : null,
        forecast.metrics.maxWindGustMph !== null ? `${forecast.metrics.maxWindGustMph.toFixed(0)} mph gusts` : null,
        forecast.metrics.maxWaveHeightFt !== null ? `${forecast.metrics.maxWaveHeightFt.toFixed(1)} ft waves` : null,
        forecast.metrics.precipitationChance !== null ? `${forecast.metrics.precipitationChance.toFixed(0)}% rain` : null,
      ].filter(Boolean).join(', ');
      const advisories = forecast.advisories.length > 0 ? `; advisories ${forecast.advisories.map((item) => item.title).join(', ')}` : '';
      return `- ${forecast.shipName} ${forecast.dateKey}: ${forecast.locationName}; ${metrics}; ${forecast.headline}${advisories}`;
    })
    .join('\n');
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function buildRecentPriceDropLines(priceDrops: PriceDropAlert[]): string {
  if (priceDrops.length === 0) return 'No price drop alerts loaded.';
  return priceDrops
    .slice()
    .sort((left, right) => right.priceDropPercent - left.priceDropPercent)
    .slice(0, 8)
    .map((alert) => `- ${alert.shipName} ${alert.sailDate} ${alert.cabinType}: ${formatMoney(alert.previousPrice)} -> ${formatMoney(alert.currentPrice)} (${alert.priceDropPercent.toFixed(1)}% drop)`)
    .join('\n');
}

function buildRecentPriceHistoryLines(priceHistory: PriceHistoryRecord[]): string {
  if (priceHistory.length === 0) return 'No price history records loaded.';
  return priceHistory
    .slice()
    .sort((left, right) => (right.recordedAt || '').localeCompare(left.recordedAt || ''))
    .slice(0, 8)
    .map((record) => `- ${record.shipName} ${record.sailDate} ${record.cabinType}: ${formatMoney(record.totalPrice)} recorded ${record.recordedAt}; source ${record.source}`)
    .join('\n');
}

function buildAlertLines(alerts: Alert[]): string {
  if (alerts.length === 0) return 'No active app alerts loaded.';
  return alerts
    .slice(0, 10)
    .map((alert) => `- [${alert.priority}] ${alert.title}: ${alert.message}; status ${alert.status}; created ${alert.createdAt}`)
    .join('\n');
}

function buildCompItemLines(items: CompItem[]): string {
  if (items.length === 0) return 'No comp items loaded.';
  return items
    .slice(0, 10)
    .map((item) => `- ${item.name} (${item.category}): ${formatMoney(item.value)}${item.cruiseId ? `; cruise ${item.cruiseId}` : ''}`)
    .join('\n');
}

function buildW2GLines(records: W2GRecord[]): string {
  if (records.length === 0) return 'No W-2G records loaded.';
  return records
    .slice()
    .sort((left, right) => (right.date || '').localeCompare(left.date || ''))
    .slice(0, 10)
    .map((record) => `- ${record.date}: ${formatMoney(record.amount)} W-2G winnings, ${formatMoney(record.withheld)} withheld${record.cruiseName ? `; ${record.cruiseName}` : ''}`)
    .join('\n');
}

function buildAppContextBlockText(blocks: AskMyDataContextBlock[]): string {
  if (blocks.length === 0) return 'No app-wide context blocks were assembled.';
  return blocks.map((block) => `### ${block.title}\n${block.subtitle}\n${block.detail}`).join('\n\n');
}

function buildDevAssistantSystemPrompt(): string {
  return `You are AI Dev Assistant inside Easy Seas. Help the user design and implement voice-enabled assistant features with practical, production-minded guidance.

Focus on:
- Prompt-based app development and app scaffolding
- Conversational AI architecture
- GPT-4o, Anthropic Claude, and similar LLM integrations
- Speech-to-text, text-to-speech, microphone UX, and voice pipelines
- WebSocket-based real-time audio streaming
- Backend integration points, security, and API key handling
- Persona, memory, conversation tone, and refinement workflows

When responding:
- Be specific and implementation-oriented
- Break architecture into frontend, backend, data flow, and UX
- Call out tradeoffs and recommended defaults
- Favor Expo-friendly and React Native-compatible approaches
- Keep the answer actionable and easy to build from`;
}

function isDevAssistantRequest(message: string): boolean {
  return /prompt-based development|voice-enabled assistant|conversational ai|conversational capabilities|app structure|ai dev assistant|api integration|gpt-4o|anthropic|claude|voice api|speech-to-text|text-to-speech|websocket|real-time audio|audio streaming|persona|conversational tone|system prompt|conversation memory|backend integration/i.test(message);
}

function isWeatherQuestion(message: string): boolean {
  return /weather|forecast|rough\s+seas?|marine|wind|winds|wave|waves|swell|rain|storm|squall|sea\s+state/i.test(message);
}

function parseToolCall(message: string): { tool: string; params: unknown } | null {
  const askDataMatch = message.match(/ask my data|search my data|find in my data|search everything|global search|natural language search|show me.*data|what .* do i have|which .* do i have|who .*recogniz|show .*crew|show .*weather|show .*forecast|show .*events?|show .*slot|show .*alert|show .*financial|show .*payment|show .*price|show .*tax|show .*w-?2g|show .*bankroll|show .*achievement|what .*weather|which .*slot|rough seas|weather reports?|price drops?|bankroll|financials?|payments?|tax|w-?2g|achievements?|app data|data sources?|what can you see/i);
  if (askDataMatch || isWeatherQuestion(message)) {
    return { tool: 'askMyData', params: { query: message } };
  }

  const certificateMatch = message.match(/certificate|certificates|levels?\s+of\s+certificates?|what\s+levels?|appears?\s+on.*certificate|a\s+or\s+c\s+certificate/i);
  const decodeOfferMatch = message.match(/decode\s+(?:my\s+)?offer|decode\s+(?:the\s+)?best\s+offer|explain\s+(?:my\s+)?offer|what\s+does\s+(?:this\s+)?offer\s+mean|break\s+down\s+(?:my\s+)?offer/i);
  const replacementMatch = message.match(/replacement|replace\s+(?:this|my)?\s*cruise|find\s+replacements?|compare\s+replacements?|better\s+replacement|alternate\s+sailing|alternative\s+cruise/i);
  const searchMatch = message.match(/search.*cruise|find.*cruise|available.*cruise|cruise.*search/i);
  const tierMatch = message.match(/tier.*progress|progress.*tier|points.*tier|signature|masters|pinnacle/i);
  const recommendMatch = message.match(/recommend.*for.*me|for.*you|best.*for.*me|suggest.*for.*me|what.*should.*book|which.*cruise|recommended/i);
  const optimizeMatch = message.match(/optimize|maximize.*points|maximize.*value/i);
  const analyzeMatch = message.match(/analyze|roi|value.*breakdown|portfolio.*summary/i);
  const offerMatch = message.match(/offer|expiring|freeplay|trade.*in|casino.*offer/i);
  const machineMatch = message.match(/slot.*machine|machine.*recommend|what.*machine|which.*machine|slot.*play|best.*machine|machine.*on|ap.*machine|advantage.*play/i);

  if (certificateMatch && !decodeOfferMatch) {
    const params: CertificateLevelSearchInput = { query: message };
    return { tool: 'searchCertificateLevels', params };
  }

  if (decodeOfferMatch) {
    const codeMatch = message.match(/(?:offer|code|promo)\s+([A-Z0-9-]{3,})/i) || message.match(/\b([A-Z]{2,}[A-Z0-9-]{2,})\b/);
    const params: DecodeOfferInput = { query: message, limit: 3 };
    if (codeMatch?.[1]) params.offerCode = codeMatch[1];
    return { tool: 'decodeOffer', params };
  }

  if (replacementMatch) {
    const goal: ReplacementGoalId = message.match(/lower|cheaper|out[- ]of[- ]pocket|cash|cost/i)
      ? 'lowerOutOfPocket'
      : message.match(/sea day|casino day|more days/i)
        ? 'addSeaDays'
        : message.match(/back[- ]to[- ]back|b2b|gap|consecutive/i)
          ? 'improveBackToBackFit'
          : message.match(/expir|use.*offer/i)
            ? 'useExpiringOffer'
            : message.match(/new port|fresh port|countries|itinerary novelty/i)
              ? 'addNewPorts'
              : message.match(/familiar|known ship|same ship|home ship/i)
                ? 'improveShipFamiliarity'
                : message.match(/tier|points|progress|signature|masters|prime/i)
                  ? 'improveTierProgress'
                  : 'improveOfferValue';
    const codeMatch = message.match(/(?:offer|code|promo)\s+([A-Z0-9-]{3,})/i) || message.match(/\b([A-Z]{2,}[A-Z0-9-]{2,})\b/);
    const params: ReplacementFinderInput = { query: message, goal, limit: 5 };
    if (codeMatch?.[1]) params.offerCode = codeMatch[1];
    return { tool: 'findReplacements', params };
  }

  if (searchMatch) {
    const params: CruiseSearchInput = { onlyAvailable: true, limit: 5 };
    const shipMatch = message.match(/(?:on|ship)\s+(\w+(?:\s+of\s+the\s+\w+)?)/i);
    if (shipMatch) params.shipName = shipMatch[1];
    const destMatch = message.match(/(?:to|destination|going to)\s+(\w+(?:\s+\w+)?)/i);
    if (destMatch) params.destination = destMatch[1];
    const nightsMatch = message.match(/(\d+)\s*night/i);
    if (nightsMatch) {
      params.minNights = parseInt(nightsMatch[1], 10);
      params.maxNights = parseInt(nightsMatch[1], 10) + 2;
    }
    const cabinMatch = message.match(/\b(interior|oceanview|balcony|suite)\b/i);
    if (cabinMatch) {
      const cabin = cabinMatch[1].toLowerCase();
      params.cabinType = cabin.charAt(0).toUpperCase() + cabin.slice(1) as CruiseSearchInput['cabinType'];
    }
    return { tool: 'searchCruises', params };
  }

  if (tierMatch) {
    const params: TierProgressInput = { includeProjections: true };
    if (message.match(/signature/i)) params.targetTier = 'Signature';
    else if (message.match(/masters/i)) params.targetTier = 'Masters';
    else if (message.match(/prime/i)) params.targetTier = 'Prime';
    return { tool: 'checkTierProgress', params };
  }

  if (recommendMatch) {
    const params: RecommendationInput = { limit: 10 };
    if (message.match(/points|gambling|casino/i)) params.prioritize = 'points';
    else if (message.match(/value|deal/i)) params.prioritize = 'value';
    else if (message.match(/urgent|expir|soon/i)) params.prioritize = 'urgency';
    else if (message.match(/port|west.*coast|galveston|los.*angeles/i)) params.prioritize = 'port';
    const limitMatch = message.match(/top\s*(\d+)|show\s*(\d+)|(\d+)\s*cruise/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1] || limitMatch[2] || limitMatch[3], 10);
      if (limit > 0 && limit <= 20) params.limit = limit;
    }
    return { tool: 'getRecommendations', params };
  }

  if (optimizeMatch) {
    const params: PortfolioOptimizerInput = { maxCruises: 5, prioritize: 'value' };
    if (message.match(/points|tier/i)) params.prioritize = 'points';
    else if (message.match(/roi|return/i)) params.prioritize = 'roi';
    else if (message.match(/nights/i)) params.prioritize = 'nights';
    if (message.match(/signature/i)) params.targetTier = 'Signature';
    else if (message.match(/masters/i)) params.targetTier = 'Masters';
    const budgetMatch = message.match(/budget.*\$?(\d+)/i);
    if (budgetMatch) params.budgetMax = parseInt(budgetMatch[1], 10);
    const monthsMatch = message.match(/(\d+)\s*month/i);
    if (monthsMatch) params.timeframeMonths = parseInt(monthsMatch[1], 10);
    return { tool: 'optimizePortfolio', params };
  }

  if (analyzeMatch) {
    const params: BookingAnalysisInput = {
      includeROI: true,
      includeValueBreakdown: true,
      compareWithPortfolio: message.match(/compare|portfolio/i) !== null,
    };
    return { tool: 'analyzeBooking', params };
  }

  if (offerMatch) {
    const params: OfferAnalysisInput = {
      includeExpiring: message.match(/expir/i) !== null,
      expiryDays: 14,
      sortBy: 'expiry',
    };
    if (message.match(/value/i)) params.sortBy = 'value';
    else if (message.match(/freeplay/i)) params.sortBy = 'freeplay';
    return { tool: 'analyzeOffers', params };
  }

  if (machineMatch) {
    const params: MachineRecommendationInput = { limit: 5 };
    const shipMatch = message.match(/(?:on|ship|aboard|quantum|harmony|ovation|navigator|odyssey|wonder|allure|oasis)(?:\s+of\s+the\s+seas)?\s*(\w+(?:\s+of\s+the\s+\w+)?)?/i);
    if (shipMatch) {
      const shipName = (shipMatch[0] || shipMatch[1] || '').trim();
      if (shipName) params.shipName = shipName;
    }
    if (message.match(/ap|advantage|persistence|must.*hit/i)) {
      params.onlyAPMachines = true;
      params.prioritize = 'ap-potential';
    } else if (message.match(/win|payout/i)) {
      params.prioritize = 'win-rate';
    } else if (message.match(/points|hour/i)) {
      params.prioritize = 'points-per-hour';
    } else if (message.match(/low.*volatility|stable|safe/i)) {
      params.prioritize = 'volatility';
      params.maxVolatility = 'Medium';
    }
    const limitMatch = message.match(/top\s*(\d+)|show\s*(\d+)|list\s*(\d+)/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1] || limitMatch[2] || limitMatch[3], 10);
      if (limit > 0 && limit <= 10) params.limit = limit;
    }
    return { tool: 'recommendMachines', params };
  }

  return null;
}

function buildReplacementGoalActions(userContent: string): NonNullable<ChatMessage['suggestedActions']> {
  const base = userContent.replace(/\s+/g, ' ').trim();
  return [
    { id: 'replacement-goal-value', label: 'Improve value', prompt: `Find replacement cruises for this using goal: improve offer value. Context: ${base}` },
    { id: 'replacement-goal-cost', label: 'Lower cost', prompt: `Find replacement cruises for this using goal: lower out-of-pocket cost. Context: ${base}` },
    { id: 'replacement-goal-sea-days', label: 'Add sea days', prompt: `Find replacement cruises for this using goal: add sea days. Context: ${base}` },
    { id: 'replacement-goal-b2b', label: 'B2B fit', prompt: `Find replacement cruises for this using goal: improve back-to-back fit. Context: ${base}` },
    { id: 'replacement-goal-expiring', label: 'Use expiring', prompt: `Find replacement cruises for this using goal: use expiring offer. Context: ${base}` },
    { id: 'replacement-goal-new-ports', label: 'New ports', prompt: `Find replacement cruises for this using goal: add new ports. Context: ${base}` },
    { id: 'replacement-goal-ship', label: 'Known ship', prompt: `Find replacement cruises for this using goal: improve ship familiarity. Context: ${base}` },
    { id: 'replacement-goal-tier', label: 'Tier progress', prompt: `Find replacement cruises for this using goal: improve tier progress. Context: ${base}` },
  ];
}

function buildAgentSuggestedActions(tool: string | null, userContent: string): ChatMessage['suggestedActions'] {
  if (tool === 'findReplacements') return buildReplacementGoalActions(userContent);

  if (tool === 'askMyData') {
    return [
      { id: 'ask-weather', label: 'Weather', prompt: 'Show weather and rough seas reports for my next cruise.' },
      { id: 'ask-events', label: 'Events', prompt: 'Show my upcoming events and travel agenda.' },
      { id: 'ask-crew', label: 'Crew', prompt: 'Summarize my crew recognition records by ship and department.' },
      { id: 'ask-machines', label: 'Slots', prompt: 'Show slot machines and AP notes for my upcoming ships.' },
      { id: 'ask-financials', label: 'Financials', prompt: 'Show my financial, payment, price drop, alert, bankroll, and tax data sources.' },
      { id: 'ask-sources', label: 'Data Sources', prompt: 'What app data sources can you see right now?' },
    ];
  }

  if (tool === 'analyzeOffers') {
    return [
      { id: 'decode-best-offer', label: 'Decode best offer', prompt: 'Decode my best active offer and explain what the casino is actually paying for.' },
      { id: 'compare-offer-replacements', label: 'Find replacements', prompt: 'Find replacement cruises for my strongest active offer, prioritizing better value and lower out-of-pocket cost.' },
    ];
  }

  if (tool === 'decodeOffer') {
    return [
      { id: 'compare-decoded-offer', label: 'Compare replacements', prompt: `Find replacement cruises for this decoded offer: ${userContent}` },
      { id: 'certificate-fit-decoded-offer', label: 'Check certificates', prompt: `Check certificate fit and stacking risk for this decoded offer: ${userContent}` },
    ];
  }

  if (tool === 'getRecommendations' || tool === 'optimizePortfolio') {
    return [
      { id: 'decode-recommended-offer', label: 'Decode offer behind this', prompt: 'Decode the offer connected to the top recommendation and explain the casino-paid value.' },
    ];
  }

  return undefined;
}

export const [AgentXProvider, useAgentX] = createContextHook((): AgentXState => {
  const { tier } = useEntitlement();
  const { isAdmin, authenticatedEmail } = useAuth();
  const { cruises, bookedCruises, casinoOffers, calendarEvents, filters, settings, lastSyncDate, hasLocalData, isLoading: coreDataLoading, userPoints: coreUserPoints } = useCoreData();
  const { users } = useUser();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const {
    clubRoyalePoints,
    clubRoyaleTier,
    clubRoyalePointsSource,
    clubRoyaleSyncDiscrepancy,
  } = useLoyalty();
  const { allMachines } = useSlotMachines();
  const { myAtlasMachines, globalLibrary, encyclopedia } = useSlotMachineLibrary();
  const { mappings: deckMappings } = useDeckPlan();
  const { sessions, getSessionAnalytics, getMachineAnalytics } = useCasinoSessions();
  const { certificates } = useCertificates();
  const { logs: machineLogs } = useMachineConditionLogs();
  const { entries: crewRecognitionEntries } = useCrewRecognition();
  const { isHydrated: isWeatherHydrated, getForecastForCruiseDay } = useSailingWeather();
  const financials = useFinancials();
  const simpleAnalytics = useSimpleAnalytics();
  const historicalPerformance = useHistoricalPerformance();
  const priceHistoryState = usePriceHistory();
  const priceTrackingState = usePriceTracking();
  const alertsState = useAlerts();
  const bankrollState = useBankroll();
  const taxState = useTax();
  const pphAlertsState = usePPHAlerts();
  const gamificationState = useGamification();
  const celebrityState = useCelebrity();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AgentXMode>('travelAgent');
  const [weatherReports, setWeatherReports] = useState<SailingWeatherForecast[]>([]);

  const intelligenceFilterSnapshot = useMemo(() => ({
    selectedProfileId,
    selectedBrand,
    selectedProgram,
  }), [selectedBrand, selectedProfileId, selectedProgram]);

  const selectedProfileLabel = useMemo(() => {
    if (selectedProfileId === 'all') return 'All Profiles';
    if (selectedProfileId === 'unassigned') return 'Unassigned Imports';
    const profile = users.find((item) => item.id === selectedProfileId);
    return getProfileDisplayName(profile);
  }, [selectedProfileId, users]);

  const activeScopeLabel = useMemo(() => buildIntelligenceScopeLabel(intelligenceFilterSnapshot, users), [intelligenceFilterSnapshot, users]);
  const brandProgramLabel = useMemo(() => getBrandProgramSystemLabel(selectedBrand, selectedProgram), [selectedBrand, selectedProgram]);

  const filteredCruises = useMemo(() => filterRecordsByIntelligence(cruises, intelligenceFilterSnapshot, users), [cruises, intelligenceFilterSnapshot, users]);
  const filteredBookedCruises = useMemo(() => filterRecordsByIntelligence(bookedCruises, intelligenceFilterSnapshot, users), [bookedCruises, intelligenceFilterSnapshot, users]);
  const filteredCasinoOffers = useMemo(() => filterRecordsByIntelligence(casinoOffers, intelligenceFilterSnapshot, users), [casinoOffers, intelligenceFilterSnapshot, users]);
  const filteredCalendarEvents = useMemo(() => filterRecordsByIntelligence(calendarEvents, intelligenceFilterSnapshot, users), [calendarEvents, intelligenceFilterSnapshot, users]);
  const filteredCertificates = useMemo(() => filterRecordsByIntelligence(certificates as unknown as Array<typeof certificates[number] & { ownerProfileId?: string; sourceEmail?: string; brand?: string; casinoProgram?: any }>, intelligenceFilterSnapshot, users), [certificates, intelligenceFilterSnapshot, users]);
  const archiveContextLabel = useMemo(() => {
    const archivedOrSkippedOffers = filteredCasinoOffers.filter((offer) => offer.status === 'archived' || offer.status === 'skipped' || offer.archiveStatus === 'archived' || offer.archiveStatus === 'replaced').length;
    const reviewNeededOffers = filteredCasinoOffers.filter((offer) => offer.status === 'reviewNeeded' || offer.archiveStatus === 'reviewNeeded' || offer.reconciliationStatus === 'reviewNeeded' || offer.importStatus === 'reviewNeeded' || offer.importStatus === 'unassigned').length;
    return `${archivedOrSkippedOffers} archived/skipped offer(s), ${reviewNeededOffers} review-needed offer(s)`;
  }, [filteredCasinoOffers]);

  const askMyDataOverview = useMemo(() => buildAskMyDataOverview({
    bookedCruises: filteredBookedCruises,
    casinoSessions: sessions,
    currentTier: clubRoyaleTier,
    currentPoints: clubRoyalePoints,
    pointBalanceSource: clubRoyalePointsSource,
    clubRoyaleSyncDiscrepancy,
    useKnownAnnualReportFacts: isKnownCasinoProfile(authenticatedEmail),
  }), [authenticatedEmail, clubRoyalePoints, clubRoyalePointsSource, clubRoyaleSyncDiscrepancy, clubRoyaleTier, filteredBookedCruises, sessions]);

  const appWideContextBlocks = useMemo<AskMyDataContextBlock[]>(() => {
    const sessionAnalytics = getSessionAnalytics();
    const bankrollStats = bankrollState.getBankrollStats();
    const taxYear = new Date().getFullYear();
    const taxSummary = taxState.getTaxSummary(taxYear);
    const activePriceDrops = priceHistoryState.getActivePriceDrops();
    const trackedPriceDrops = priceTrackingState.getAllPriceDrops();
    const unlockedAchievements = gamificationState.getUnlockedAchievements();
    const lockedAchievements = gamificationState.getLockedAchievements();
    const enabledAlertRules = alertsState.rules.filter((rule) => rule.enabled).length;
    const upcomingPayments = financials.summary.upcomingPayments
      .slice()
      .sort((left, right) => (left.dueDate || '').localeCompare(right.dueDate || ''))
      .slice(0, 8)
      .map((payment) => `- Cruise ${payment.cruiseId}: ${formatMoney(payment.amount)} due ${payment.dueDate}`)
      .join('\n') || 'No upcoming payment records loaded.';

    return [
      {
        id: 'data-source-coverage',
        title: 'Loaded Easy Seas data sources',
        subtitle: `${formatCount(filteredCruises.length + filteredBookedCruises.length)} cruises · ${formatCount(filteredCasinoOffers.length)} offers · ${formatCount(filteredCalendarEvents.length)} events · ${formatCount(crewRecognitionEntries.length)} crew · ${formatCount(allMachines.length)} slots`,
        keywords: ['data source', 'system', 'context', 'loaded', 'overview', 'coverage', 'what can you see'],
        detail: [
          `Core data: ${formatCount(filteredCruises.length)} available cruise(s), ${formatCount(filteredBookedCruises.length)} booked/completed cruise(s), ${formatCount(filteredCasinoOffers.length)} casino offer(s), ${formatCount(filteredCertificates.length)} certificate(s), ${formatCount(filteredCalendarEvents.length)} calendar/event record(s).`,
          `Casino/slot data: ${formatCount(sessions.length)} casino session(s), ${formatCount(allMachines.length)} slot machine record(s), ${formatCount(myAtlasMachines.length)} personal Atlas record(s), ${formatCount(globalLibrary.length)} permanent library record(s), ${formatCount(deckMappings.length)} deck mapping(s), ${formatCount(machineLogs.length)} condition log(s).`,
          `Crew/weather data: ${formatCount(crewRecognitionEntries.length)} crew recognition record(s), ${formatCount(weatherReports.length)} loaded weather report(s).`,
          `App-wide data: ${formatCount(priceHistoryState.priceHistory.length)} price history row(s), ${formatCount(activePriceDrops.length + trackedPriceDrops.length)} price drop alert row(s), ${formatCount(alertsState.alerts.length)} app alert(s), ${formatCount(taxState.compItems.length)} comp item(s), ${formatCount(taxState.w2gRecords.length)} W-2G record(s), ${formatCount(gamificationState.achievements.length)} achievement record(s).`,
          `Freshness: core data loading=${coreDataLoading ? 'yes' : 'no'}, has local data=${hasLocalData ? 'yes' : 'no'}, last sync=${lastSyncDate ?? 'not recorded'}, authenticated profile=${authenticatedEmail ?? 'guest/local'}.`,
        ].join('\n'),
        actionLabel: 'Use full app context',
      },
      {
        id: 'financials-payments',
        title: 'Financials and payments',
        subtitle: `${formatMoney(financials.summary.totalPaid)} paid · ${formatMoney(financials.summary.totalDue)} due · ${formatMoney(financials.summary.totalSavings)} savings`,
        keywords: ['financial', 'financials', 'payment', 'payments', 'deposit', 'balance due', 'paid', 'savings', 'freeplay', 'obc'],
        detail: [
          `Summary: deposits ${formatMoney(financials.summary.totalDeposits)}, paid ${formatMoney(financials.summary.totalPaid)}, due ${formatMoney(financials.summary.totalDue)}, FreePlay ${formatMoney(financials.summary.totalFreeplay)}, OBC ${formatMoney(financials.summary.totalOBC)}, savings ${formatMoney(financials.summary.totalSavings)}.`,
          `Casino/non-casino spend: casino ${formatMoney(financials.summary.totalCasinoSpend)}, non-casino ${formatMoney(financials.summary.totalNonCasinoSpend)}.`,
          `Upcoming payments:\n${upcomingPayments}`,
        ].join('\n'),
        actionLabel: 'Review financials',
      },
      {
        id: 'analytics-performance',
        title: 'Analytics and historical performance',
        subtitle: `${formatCount(simpleAnalytics.analytics.totalCruises)} cruises · ${formatCount(simpleAnalytics.analytics.totalNights)} nights · ${formatCount(simpleAnalytics.casinoAnalytics.totalPointsEarned)} casino points`,
        keywords: ['analytics', 'performance', 'portfolio', 'roi', 'historical', 'points', 'coin in', 'coin-in', 'casino metrics'],
        detail: [
          `Portfolio analytics: total spent ${formatMoney(simpleAnalytics.analytics.totalSpent)}, total saved ${formatMoney(simpleAnalytics.analytics.totalSaved)}, total port taxes ${formatMoney(simpleAnalytics.analytics.totalPortTaxes)}, average price/night ${formatMoney(simpleAnalytics.analytics.averagePricePerNight)}, portfolio ROI ${simpleAnalytics.analytics.portfolioROI.toFixed(2)}%.`,
          `Casino analytics: total points ${formatCount(simpleAnalytics.casinoAnalytics.totalPointsEarned)}, historical points ${formatCount(simpleAnalytics.casinoAnalytics.historicalPointsEarned)}, current balance ${formatCount(simpleAnalytics.casinoAnalytics.currentPointBalance)}, point-derived coin-in ${formatMoney(simpleAnalytics.casinoAnalytics.totalCoinIn)}, win/loss ${formatMoney(simpleAnalytics.casinoAnalytics.totalWinLoss)}, tier ${simpleAnalytics.casinoAnalytics.currentStatusTier}.`,
          `Session analytics: ${formatCount(sessionAnalytics.totalSessions)} sessions, ${Math.round(sessionAnalytics.totalPlayTimeMinutes / 60).toLocaleString()} play hour(s), ${formatCount(sessionAnalytics.totalPointsEarned)} points, ${formatMoney(sessionAnalytics.totalCoinIn)} coin-in, ${formatMoney(sessionAnalytics.netWinLoss)} net win/loss, ${sessionAnalytics.pointsPerHour.toFixed(1)} points/hour.`,
          `Historical performance: average ${historicalPerformance.metrics.averagePointsPerNight.toFixed(1)} points/night, ${formatMoney(historicalPerformance.metrics.averageCoinInPerNight)} coin-in/night, ${historicalPerformance.metrics.averageROI.toFixed(2)}% average ROI, ${historicalPerformance.metrics.consistencyScore.toFixed(1)} consistency score. Best cruise: ${historicalPerformance.metrics.bestCruise?.cruiseName ?? 'n/a'}.`,
        ].join('\n'),
        actionLabel: 'Use analytics',
      },
      {
        id: 'price-history-alerts',
        title: 'Price history, upgrade prices, and alerts',
        subtitle: `${formatCount(priceHistoryState.priceHistory.length + priceTrackingState.priceHistory.length)} price rows · ${formatCount(activePriceDrops.length + trackedPriceDrops.length)} price drops · ${formatCount(alertsState.activeAlerts.length)} active alerts`,
        keywords: ['price', 'price history', 'price drop', 'upgrade price', 'alert', 'alerts', 'anomaly', 'insight', 'watchlist'],
        detail: [
          `Price history provider: ${formatCount(priceHistoryState.priceHistory.length)} row(s), ${formatCount(priceHistoryState.priceDropAlerts.length)} stored price drop alert(s), ${formatCount(activePriceDrops.length)} active future price drop(s), ${formatCount(priceHistoryState.upgradePrices.size)} upgrade price record(s).`,
          `Price tracking provider: ${formatCount(priceTrackingState.priceHistory.length)} row(s), ${formatCount(priceTrackingState.priceDrops.length)} price drop(s).`,
          `Alerts: ${formatCount(alertsState.alerts.length)} stored, ${formatCount(alertsState.activeAlerts.length)} active, ${formatCount(alertsState.criticalAlerts.length)} critical, ${formatCount(alertsState.insights.length)} insight(s), ${formatCount(alertsState.anomalies.length)} anomaly/anomalies, ${enabledAlertRules} enabled rule(s), last detection ${alertsState.lastDetectionRun ?? 'not run'}.`,
          `Top price drops:\n${buildRecentPriceDropLines([...activePriceDrops, ...trackedPriceDrops])}`,
          `Recent price history:\n${buildRecentPriceHistoryLines([...priceHistoryState.priceHistory, ...priceTrackingState.priceHistory])}`,
          `Active alerts:\n${buildAlertLines(alertsState.activeAlerts)}`,
        ].join('\n'),
        actionLabel: 'Review alerts',
      },
      {
        id: 'bankroll-taxes-comps',
        title: 'Bankroll, tax, W-2G, and comp tracking',
        subtitle: `${formatMoney(bankrollStats.dailyRemaining)} daily remaining · ${formatCount(taxState.w2gRecords.length)} W-2G · ${formatMoney(taxState.getTotalCompValue())} comps`,
        keywords: ['bankroll', 'limit', 'limits', 'tax', 'w2g', 'w-2g', 'comp', 'comps', 'withheld', 'daily remaining', 'weekly remaining'],
        detail: [
          `Bankroll limits: ${formatCount(bankrollState.limits.length)} limit(s), ${formatCount(bankrollState.alerts.length)} bankroll alert(s), session bankroll ${bankrollState.sessionBankroll ? `${formatMoney(bankrollState.sessionBankroll.currentAmount)} current from ${formatMoney(bankrollState.sessionBankroll.startingAmount)} start` : 'not active'}.`,
          `Bankroll stats: daily spent ${formatMoney(bankrollStats.dailySpent)}, weekly spent ${formatMoney(bankrollStats.weeklySpent)}, monthly spent ${formatMoney(bankrollStats.monthlySpent)}, daily remaining ${formatMoney(bankrollStats.dailyRemaining)}, weekly remaining ${formatMoney(bankrollStats.weeklyRemaining)}, monthly remaining ${formatMoney(bankrollStats.monthlyRemaining)}.`,
          `Tax summary ${taxYear}: ${formatCount(taxSummary.w2gCount)} W-2G record(s), ${formatMoney(taxSummary.totalW2GWinnings)} winnings, ${formatMoney(taxSummary.totalW2GWithheld)} withheld.`,
          `Comp items: ${formatCount(taxState.compItems.length)} loaded, total comp value ${formatMoney(taxState.getTotalCompValue())}.\n${buildCompItemLines(taxState.compItems)}`,
          `W-2G records:\n${buildW2GLines(taxState.w2gRecords)}`,
        ].join('\n'),
        actionLabel: 'Use bankroll and tax context',
      },
      {
        id: 'goals-achievements-pph',
        title: 'Goals, achievements, and points-per-hour alerts',
        subtitle: `${formatCount(unlockedAchievements.length)} achievements unlocked · level ${gamificationState.stats.currentLevel} · best ${pphAlertsState.personalBestPPH.toFixed(1)} PPH`,
        keywords: ['achievement', 'achievements', 'goal', 'weekly goal', 'streak', 'level', 'xp', 'points per hour', 'pph', 'milestone'],
        detail: [
          `Gamification: ${formatCount(unlockedAchievements.length)} unlocked achievement(s), ${formatCount(lockedAchievements.length)} locked achievement(s), level ${gamificationState.stats.currentLevel}, XP ${formatCount(gamificationState.stats.experiencePoints)} / ${formatCount(gamificationState.stats.nextLevelXP)}, total sessions ${formatCount(gamificationState.stats.totalSessionsAllTime)}, total points ${formatCount(gamificationState.stats.totalPointsAllTime)}.`,
          `Streaks: daily ${gamificationState.streak.currentDailyStreak}, weekly ${gamificationState.streak.currentWeeklyStreak}, longest daily ${gamificationState.streak.longestDailyStreak}, total days played ${gamificationState.streak.totalDaysPlayed}.`,
          `Weekly goals: ${gamificationState.weeklyGoals.map((goal) => `${goal.type} ${goal.current}/${goal.target}${goal.completed ? ' complete' : ''}`).join('; ') || 'none loaded'}.`,
          `PPH alerts: ${formatCount(pphAlertsState.alerts.length)} active in-session alert(s), target ${pphAlertsState.thresholds.targetPPH}, personal best ${pphAlertsState.personalBestPPH.toFixed(1)}, last alerted PPH ${pphAlertsState.lastAlertedPPH ?? 'n/a'}.`,
        ].join('\n'),
        actionLabel: 'Use goals context',
      },
      {
        id: 'settings-reference-data',
        title: 'Settings, profile, and reference data',
        subtitle: `${formatCount(users.length)} profile(s) · ${formatCount(celebrityState.ships.length)} Celebrity ship refs · ${formatCount(celebrityState.destinations.length)} destination refs`,
        keywords: ['settings', 'profile', 'profiles', 'preferences', 'reference', 'celebrity', 'destination', 'ship class', 'app settings'],
        detail: [
          `Active intelligence scope: ${activeScopeLabel}; profile label ${selectedProfileLabel}; brand ${getBrandLabel(selectedBrand)}; program ${getProgramLabel(selectedProgram)}; casino system ${brandProgramLabel}.`,
          `Core points fallback: ${formatCount(coreUserPoints)} point(s). Loyalty points in active scope: ${formatCount(clubRoyalePoints)} point(s), tier ${clubRoyaleTier}, source ${clubRoyalePointsSource}.`,
          `Profiles loaded: ${users.map((user) => `${getProfileDisplayName(user)} (${user.id})`).join('; ') || 'none'}.`,
          `Settings snapshot: ${JSON.stringify(settings).slice(0, 1200)}.`,
          `Celebrity reference ships: ${celebrityState.ships.slice(0, 12).map((ship) => `${ship.name} (${ship.class})`).join(', ')}${celebrityState.ships.length > 12 ? ', ...' : ''}.`,
          `Destination references: ${celebrityState.destinations.map((destination) => `${destination.name}: ${destination.ports.slice(0, 4).join('/')}`).join('; ')}.`,
        ].join('\n'),
        actionLabel: 'Use profile/settings context',
      },
    ];
  }, [activeScopeLabel, alertsState.activeAlerts, alertsState.alerts.length, alertsState.anomalies.length, alertsState.criticalAlerts.length, alertsState.insights.length, alertsState.lastDetectionRun, alertsState.rules, allMachines.length, authenticatedEmail, bankrollState, brandProgramLabel, celebrityState.destinations, celebrityState.ships, clubRoyalePoints, clubRoyalePointsSource, clubRoyaleTier, coreDataLoading, coreUserPoints, crewRecognitionEntries.length, deckMappings.length, filteredBookedCruises.length, filteredCalendarEvents.length, filteredCasinoOffers.length, filteredCertificates.length, filteredCruises.length, financials.summary, gamificationState, getSessionAnalytics, globalLibrary.length, hasLocalData, lastSyncDate, machineLogs.length, myAtlasMachines.length, pphAlertsState, priceHistoryState, priceTrackingState, selectedBrand, selectedProfileLabel, selectedProgram, sessions.length, settings, taxState, users, weatherReports.length]);

  const refreshWeatherReports = useCallback(async (options?: { force?: boolean }): Promise<SailingWeatherForecast[]> => {
    if (!isWeatherHydrated) return [];
    const targets = filteredBookedCruises
      .filter(isCruiseWeatherEligible)
      .sort((left, right) => (left.sailDate || '').localeCompare(right.sailDate || ''))
      .slice(0, 2);

    if (targets.length === 0) {
      setWeatherReports([]);
      return [];
    }

    const forecasts: SailingWeatherForecast[] = [];
    for (const cruise of targets) {
      const dates = buildWeatherTargetDates(cruise);
      for (const targetDate of dates) {
        try {
          const forecast = await getForecastForCruiseDay(cruise, targetDate, { force: options?.force === true });
          if (forecast) forecasts.push(forecast);
        } catch (error) {
          console.warn('[AgentX] Failed to load weather context forecast:', {
            cruiseId: cruise.id,
            shipName: cruise.shipName,
            date: formatDateKey(targetDate),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    setWeatherReports(forecasts);
    return forecasts;
  }, [filteredBookedCruises, getForecastForCruiseDay, isWeatherHydrated]);

  useEffect(() => {
    if (!isVisible) return;
    void refreshWeatherReports();
  }, [isVisible, refreshWeatherReports]);

  const toolContext = useMemo((): AgentToolContext => {
    console.log('[AgentX] Recalculating toolContext with latest data...', {
      bookedCruises: filteredBookedCruises.length,
      clubRoyalePoints,
      clubRoyaleTier,
      slotMachines: allMachines.length,
      myAtlasMachines: myAtlasMachines.length,
      globalLibrary: globalLibrary.length,
      sessions: sessions.length,
      deckMappings: deckMappings.length,
      certificates: certificates.length,
      machineLogs: machineLogs.length,
      calendarEvents: filteredCalendarEvents.length,
      crewRecognitionEntries: crewRecognitionEntries.length,
      weatherReports: weatherReports.length,
      mode,
      filters,
      selectedProfileLabel,
      selectedBrand,
      selectedProgram,
      activeScopeLabel,
      brandProgramLabel,
      archiveContextLabel,
      askMyDataGeneratedAt: askMyDataOverview.generatedAt,
      annualCashResult: askMyDataOverview.annual.totals.totalCashResult,
      currentSeasonPoints: askMyDataOverview.currentSeason.points,
    });

    return {
      cruises: filteredCruises,
      bookedCruises: filteredBookedCruises,
      offers: filteredCasinoOffers,
      userPoints: clubRoyalePoints,
      currentTier: clubRoyaleTier,
      slotMachines: allMachines,
      myAtlasMachines,
      globalLibrary,
      encyclopedia,
      deckMappings,
      casinoSessions: sessions,
      getSessionAnalytics,
      getMachineAnalytics,
    };
  }, [filteredCruises, filteredBookedCruises, filteredCasinoOffers, clubRoyalePoints, clubRoyaleTier, allMachines, myAtlasMachines, globalLibrary, encyclopedia, deckMappings, sessions, getSessionAnalytics, getMachineAnalytics, certificates.length, machineLogs.length, filteredCalendarEvents.length, crewRecognitionEntries.length, weatherReports.length, mode, filters, selectedProfileLabel, selectedBrand, selectedProgram, activeScopeLabel, brandProgramLabel, archiveContextLabel, askMyDataOverview]);

  const executeToolCall = useCallback((tool: string, params: unknown, weatherOverride?: SailingWeatherForecast[]): string => {
    console.log('[AgentX] Executing tool:', tool, params);
    const activeWeatherReports = weatherOverride ?? weatherReports;

    switch (tool) {
      case 'searchCruises':
        return executeCruiseSearch(params as CruiseSearchInput, toolContext);
      case 'analyzeBooking':
        return executeBookingAnalysis(params as BookingAnalysisInput, toolContext);
      case 'optimizePortfolio':
        return executePortfolioOptimizer(params as PortfolioOptimizerInput, toolContext);
      case 'checkTierProgress':
        return executeTierProgress(params as TierProgressInput, toolContext);
      case 'analyzeOffers':
        return executeOfferAnalysis(params as OfferAnalysisInput, toolContext);
      case 'decodeOffer':
        return executeDecodeOffer(params as DecodeOfferInput, toolContext);
      case 'findReplacements':
        return executeReplacementFinder(params as ReplacementFinderInput, toolContext);
      case 'searchCertificateLevels':
        return executeCertificateSearch(params as CertificateLevelSearchInput, toolContext);
      case 'getRecommendations':
        return executeRecommendations(params as RecommendationInput, toolContext);
      case 'recommendMachines':
        return executeMachineRecommendations(params as MachineRecommendationInput, toolContext);
      case 'askMyData': {
        const query = typeof (params as { query?: unknown }).query === 'string' ? (params as { query: string }).query : '';
        const response = askMyDataSearch({
          query,
          offers: filteredCasinoOffers,
          cruises: [...filteredCruises, ...filteredBookedCruises],
          certificates: filteredCertificates,
          calendarEvents: filteredCalendarEvents,
          crewRecognitionEntries,
          slotMachines: allMachines,
          weatherReports: activeWeatherReports,
          additionalContextBlocks: appWideContextBlocks,
          overview: askMyDataOverview,
        });
        return formatAskMyDataResponse(response);
      }
      default:
        return `Unknown tool: ${tool}`;
    }
  }, [toolContext, filteredCasinoOffers, filteredCruises, filteredBookedCruises, filteredCertificates, filteredCalendarEvents, crewRecognitionEntries, allMachines, weatherReports, appWideContextBlocks, askMyDataOverview]);

  const sendMessage = useCallback(async (content: string) => {
    console.log('[AgentX] User message:', content, 'mode:', mode);

    const devAssistantRequest = isDevAssistantRequest(content);
    const hasAgentAccess = tier === 'pro' || isAdmin || devAssistantRequest;

    if (!hasAgentAccess) {
      console.log('[AgentX] Access denied. Tier:', tier, 'isAdmin:', isAdmin, 'devAssistantRequest:', devAssistantRequest);
      const deniedMessage: ChatMessage = {
        id: `denied-${Date.now()}`,
        role: 'assistant',
        content: 'Ask My Data assistant is a Pro-only feature. Upgrade to Pro to access AI-powered cruise analysis and recommendations.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, deniedMessage]);
      return;
    }

    setError(null);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const loadingMessage: ChatMessage = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, loadingMessage]);

    try {
      const toolCall = devAssistantRequest ? null : parseToolCall(content);
      const forceWeatherRefresh = !devAssistantRequest && isWeatherQuestion(content);
      const latestWeatherReports = devAssistantRequest ? weatherReports : await refreshWeatherReports({ force: forceWeatherRefresh });

      let toolResult = '';
      if (toolCall) {
        console.log('[AgentX] Tool detected:', toolCall.tool);
        setMessages(prev => prev.map(m =>
          m.id === loadingMessage.id
            ? { ...m, toolName: toolCall.tool }
            : m
        ));
        toolResult = executeToolCall(toolCall.tool, toolCall.params, latestWeatherReports);
      }

      const completedCruises = toolContext.bookedCruises.filter(c => {
        const isCompleted = c.completionState === 'completed' || c.status === 'completed';
        if (!isCompleted && c.returnDate) {
          const returnDate = new Date(c.returnDate);
          const today = new Date();
          return returnDate < today;
        }
        return isCompleted;
      });
      const upcomingCruises = toolContext.bookedCruises.filter(c => c.completionState === 'upcoming');
      const availableCruises = toolContext.cruises.filter(c => new Date(c.sailDate) > new Date());
      const totalEarnedPoints = completedCruises.reduce((sum, c) => sum + getBookedCruiseCasinoPoints(c), 0);
      const completedWithPoints = completedCruises
        .filter(c => getBookedCruiseCasinoPoints(c) > 0)
        .map(c => `${c.shipName} (${c.sailDate}): ${getBookedCruiseCasinoPoints(c).toLocaleString()} pts`)
        .join('\n  ');

      const contextInfo = `
User's current status (FRESH DATA - UPDATED ON EVERY REQUEST):
- Current Tier: ${toolContext.currentTier}
- Current Points: ${toolContext.userPoints.toLocaleString()}
- Total Booked Cruises: ${toolContext.bookedCruises.length}
- Completed Cruises: ${completedCruises.length}
- Total Points Earned from Completed Cruises: ${totalEarnedPoints.toLocaleString()}
- Upcoming Cruises: ${upcomingCruises.length}
- Available Cruises: ${availableCruises.length}
- Active Casino Offers: ${toolContext.offers.length}
- Calendar / Event Records: ${filteredCalendarEvents.length}
- Crew Recognition Records: ${crewRecognitionEntries.length}
- Slot Machine Records: ${allMachines.length}
- Machine Condition Logs: ${machineLogs.length}
- Loaded Weather Reports: ${latestWeatherReports.length}
- App-Wide Context Blocks: ${appWideContextBlocks.length}
- Active Profile Scope: ${selectedProfileLabel}
- Active Brand Scope: ${getBrandLabel(selectedBrand)}
- Active Program Scope: ${getProgramLabel(selectedProgram)}
- Active Casino System: ${brandProgramLabel}
- Archive / Review Context: ${archiveContextLabel}
- Ask My Data Overview Generated: ${askMyDataOverview.generatedAt}

Corrected casino / ROI overview loaded for this request:
${askMyDataOverview.text}

Completed Cruises with Points Earned:
  ${completedWithPoints || 'No points data recorded for completed cruises'}

Standalone offer rows loaded in active scope:
${buildStandaloneOfferContext(filteredCasinoOffers, filteredCruises, filteredCertificates)}

Booked-cruise casino offer/value records loaded in active scope:
${buildBookedCruiseOfferContext(filteredBookedCruises)}

Calendar and event records loaded in active scope:
${buildCalendarContext(filteredCalendarEvents)}

Crew recognition records loaded:
${buildCrewRecognitionContext(crewRecognitionEntries)}

Slot machine / Machine Atlas records loaded:
${buildMachineDataContext(allMachines, machineLogs)}

Weather / rough-seas reports loaded for the current cruise window:
${buildWeatherContext(latestWeatherReports)}

App-wide Easy Seas context loaded:
${buildAppContextBlockText(appWideContextBlocks)}

CRITICAL: The user has EXACTLY ${toolContext.userPoints.toLocaleString()} casino program points in the active Royal/Celebrity scope and is in ${toolContext.currentTier} tier. They have earned ${totalEarnedPoints.toLocaleString()} points from ${completedCruises.length} completed cruises. These numbers are from the live system. Use ONLY these values, not any cached or outdated information. Coin-In is included only as gaming volume, never as profit/value/cash result. If standalone offers are empty, booked-cruise offer/value records are still actual saved offer data and must be used for Ask My Data offer answers. Events, crew recognition, slot machines, machine logs, weather reports, financials, price history, alerts, bankroll, tax/W-2G, comp items, achievements, analytics, settings, profiles, and reference data are valid app data sources for the chat.
`;

      const systemPrompt = devAssistantRequest
        ? buildDevAssistantSystemPrompt()
        : buildSystemPrompt({
            allMachines,
            globalLibrary,
            myAtlasMachines,
            sessions,
            deckMappings,
            machineLogs,
            certificates: filteredCertificates,
            calendarEvents: filteredCalendarEvents,
            crewRecognitionEntries,
            weatherReports: latestWeatherReports,
            appContextBlocks: appWideContextBlocks,
            mode,
            brandProgramLabel,
          });

      const messagesForAI = devAssistantRequest
        ? [
            { role: 'user' as const, content: systemPrompt },
            ...messages.slice(-6).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            { role: 'user' as const, content: `Help me with this development request:\n\n${content}` },
          ]
        : [
            { role: 'user' as const, content: `${systemPrompt}\n\n${contextInfo}` },
            ...messages.slice(-6).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            {
              role: 'user' as const,
              content: toolResult
                ? `Ask My Data mode: ${AGENT_MODE_LABELS[mode]}\nActive context: ${activeScopeLabel}\nArchive/review context: ${archiveContextLabel}\nUser asked: "${content}"\n\nTool result:\n${toolResult}\n\nPlease summarize this information in a helpful, conversational way. Start by confirming the active profile, brand/program, mode, and archive/review context. Highlight the most important points and name the data sources used.`
                : `Ask My Data mode: ${AGENT_MODE_LABELS[mode]}\nActive context: ${activeScopeLabel}\nArchive/review context: ${archiveContextLabel}\nUser asked: "${content}"\n\nPlease provide a helpful response based on the user's cruise, offer, event, crew, slot machine, weather, financial, price history, alert, bankroll, tax/W-2G, comp, achievement, analytics, settings/profile, active filter context, selected mode, and archive/review context. Start by confirming the active profile, brand/program, mode, and archive/review context.`,
            },
          ];

      const contextConfirmation = `Context: ${AGENT_MODE_LABELS[mode]} • ${activeScopeLabel} • ${brandProgramLabel} • Archive/Review: ${archiveContextLabel}`;
      let aiResponse = '';
      try {
        aiResponse = await generateText({ messages: messagesForAI });
      } catch (aiErr) {
        console.warn('[AgentX] AI summarization failed; returning deterministic tool result when available:', aiErr);
        if (!toolResult) throw aiErr;
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: toolResult
          ? `${contextConfirmation}\n\n${toolResult}${aiResponse ? `\n\n---\n\n${aiResponse}` : ''}`
          : `${contextConfirmation}\n\n${aiResponse}`,
        timestamp: new Date(),
        contextSummary: contextConfirmation,
        suggestedActions: buildAgentSuggestedActions(toolCall?.tool ?? null, content),
      };

      setMessages(prev => prev.filter(m => m.id !== loadingMessage.id).concat(assistantMessage));
    } catch (err) {
      console.error('[AgentX] Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');

      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `I could not complete that request because the assistant service failed before returning an answer. Active context: ${AGENT_MODE_LABELS[mode]} • ${activeScopeLabel} • ${brandProgramLabel}. Try again, or ask a more specific Ask My Data question so I can return local data-backed results.`,
        timestamp: new Date(),
        contextSummary: `Context: ${AGENT_MODE_LABELS[mode]} • ${activeScopeLabel} • ${brandProgramLabel} • Archive/Review: ${archiveContextLabel}`,
      };

      setMessages(prev => prev.filter(m => m.id !== loadingMessage.id).concat(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [messages, tier, isAdmin, toolContext, executeToolCall, refreshWeatherReports, weatherReports, allMachines, globalLibrary, myAtlasMachines, sessions, deckMappings, machineLogs, filteredCertificates, filteredCalendarEvents, crewRecognitionEntries, filteredCasinoOffers, filteredCruises, filteredBookedCruises, appWideContextBlocks, mode, selectedProfileLabel, selectedBrand, selectedProgram, activeScopeLabel, brandProgramLabel, archiveContextLabel, askMyDataOverview]);

  const clearMessages = useCallback(() => {
    console.log('[AgentX] Clearing messages');
    setMessages([]);
    setError(null);
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const toggleVisible = useCallback(() => {
    setIsVisible(prev => !prev);
  }, []);

  const setVisibleState = useCallback((visible: boolean) => {
    setIsVisible(visible);
  }, []);

  const refreshAnalysis = useCallback(async () => {
    console.log('[AgentX] Refreshing analysis...');
    await sendMessage('Provide a comprehensive analysis of my cruise performance for the last 90 days including points earned, tier progress, events, crew recognition, slot machine notes, weather watchouts, and recommendations.');
  }, [sendMessage]);

  return useMemo(() => ({
    messages,
    isLoading,
    isExpanded,
    isVisible,
    error,
    mode,
    sendMessage,
    clearMessages,
    toggleExpanded,
    toggleVisible,
    setVisible: setVisibleState,
    setMode,
    refreshAnalysis,
  }), [
    messages,
    isLoading,
    isExpanded,
    isVisible,
    error,
    mode,
    sendMessage,
    clearMessages,
    toggleExpanded,
    toggleVisible,
    setVisibleState,
    refreshAnalysis,
  ]);
});
