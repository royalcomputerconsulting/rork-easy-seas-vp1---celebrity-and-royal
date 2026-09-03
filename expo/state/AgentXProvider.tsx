import { useState, useCallback, useDeferredValue, useMemo, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import { useCoreData } from './CoreDataProvider';
import { useLoyalty } from './LoyaltyProvider';
import type { ChatMessage } from '@/components/AgentXChat';
import { splitConciseFirstAgentSeaAnswer } from '@/lib/agentSea/conciseAnswer';
import type { AgentXMode, BookedCruise, CalendarEvent, CasinoOffer, Cruise, SlotMachine, PriceDropAlert, PriceHistoryRecord, Alert, CompItem, W2GRecord } from '@/types/models';
import { askMyDataSearch, buildAskMyDataConversationalQuery, buildAskMyDataSourceReferences, formatAskMyDataResponse, getAskMyDataDateWindow, isAnnualTierRewardQuestion, type AskMyDataContextBlock } from '@/lib/askMyData';
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
import { createUtcDateFromLocalCalendarDay, isDateInFuture, isDateInPast, toLocalCalendarDateOnly } from '@/lib/date';
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
import { beginPerformanceSpan, recordPerformanceCount, recordProviderRender } from '@/lib/performance/performanceDiagnostics';
import { useCruiseInventory } from '@/hooks/useCruiseInventory';
import { buildAllOffersScopeSnapshot } from '@/lib/askAllOffers/context';
import { archiveConversationThread, buildAskAllOffersOwnerKey, loadConversationThreads, renameConversationThread, upsertConversationThread } from '@/lib/askAllOffers/storage';
import type { ConversationThread } from '@/lib/askAllOffers/types';
import { buildAgentReminderEvent, parseAgentConfirmedAction, type AgentConfirmedAction } from '@/lib/agentConfirmedActions';
import { buildCasinoRelationshipSnapshot } from '@/lib/casino/casinoRelationshipIntelligence';
import { buildCasinoCruiseTruth, reconcileCasinoSeason } from '@/lib/casino/casinoTruthEngine';
import { usePersonalCertificateOptimizer } from './PersonalCertificateOptimizerProvider';
import { generateAgentSeaAIResponse } from '@/lib/agentSeaAI';
import {
  buildAgentSeaSourceManifest,
  executeCertificateSummaryTool,
  executeAgentSeaSourceManifestTool,
  planAgentSeaQuestion,
  type AgentSeaSourceManifest,
} from '@/lib/agentSea/sourceRegistry';
import { buildAgentSeaDirectAnswer } from '@/lib/agentSea/directAnswers';
import { listAllProvenanceLinks } from '@/lib/database/HealthTrustDatabase';
import type { ProvenanceLink } from '@/types/provenance';

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
  conversationThreads: ConversationThread[];
  activeConversationId: string | null;
  startNewConversation: () => void;
  openConversation: (threadId: string) => void;
  renameConversation: (threadId: string, title: string) => Promise<void>;
  archiveConversation: (threadId: string) => Promise<void>;
  confirmAgentAction: (action: AgentConfirmedAction) => Promise<{ route?: string }>;
  cancelAgentAction: (action: AgentConfirmedAction) => void;
}

const EMPTY_CRUISES: Cruise[] = [];
const EMPTY_BOOKED_CRUISES: BookedCruise[] = [];
const EMPTY_OFFERS: CasinoOffer[] = [];
const EMPTY_CALENDAR_EVENTS: CalendarEvent[] = [];

const AGENT_MODE_LABELS: Record<AgentXMode, string> = {
  travelAgent: 'Travel Agent',
  casinoHost: 'Casino Host',
  certificateAdvisor: 'Certificate Advisor',
  loyaltyStrategist: 'Loyalty Strategist',
  apScout: 'AP Scout',
  calendarPlanner: 'Calendar Planner',
  importAuditor: 'Import Auditor',
  easySeasGuide: 'Agent SEA',
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
  return `You are Agent SEA, the unified Easy Seas AI agent. You are not a narrow database lookup and you are not split into persona filters. You act as one smart cruise, casino, certificate, loyalty, weather, calendar, and crew-recognition advisor for the active Easy Seas user. The active casino system is: ${context.brandProgramLabel}. You help users:
- Search and filter available cruises, booked cruises, casino offers, certificates, calendar events, and travel agenda items
- Analyze bookings and calculate ROI
- Track casino program tier progress using the selected Royal/Celebrity scope
- Optimize their cruise portfolio for maximum points and value
- Understand casino offers and their values
- Identify which certificate levels match specific ships or sailing dates
- Answer month-based inventory questions such as whether a ship appears next month, which European sailings are available, and the certificate points/cabin/guest level for each matching row
- Recommend slot machines on specific ships for advantage play (AP) and optimal returns
- Analyze slot machine session data and performance
- Track machine locations and condition logs on specific ships
- Answer questions about crew recognition records, departments, roles, ships, and sail dates
- Answer questions about loaded weather/rough-seas reports, wind, waves, rain, and advisories
- Answer questions about financials, payments, price history, alerts, bankroll, tax/W-2G, comp items, analytics, achievements, and app settings context
- Provide careful educational guidance about offer math, certificates, loyalty, and responsible use
- Answer natural-language questions from freshly loaded saved app context

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

Agent behavior:
- Always infer the user's intent from the conversation and use the right internal data stream(s); never require the user to choose Travel Agent/Casino Host/Certificate Advisor modes.
- Prefer direct answers first, then the evidence and next action.
- Cite saved local records when you answer. If the evidence is incomplete, say exactly what is missing.
- Keep primary and secondary users' private casino/profile/crew data separated, while treating shared offer and sailing inventory as shared app inventory.
- If optional online services fail, continue with the local index and explain the local evidence you did use.

Key formulas:
- Club Royale slot estimate only: 1 point per $5 coin-in. Do not apply this conversion to Blue Chip, Carnival, table games, or unknown play.
- Net Gaming Result = Cash Out + Handpays not already included in Cash Out - Cash In. Cruise fare is never part of gaming win/loss.
- Theoretical Loss = recorded theoretical, or explicit/validly estimated Coin-In × weighted house edge.
- ADT = total theoretical loss / rated gaming days.
- Cruise Value Captured = Retail Value - Net Effective Paid
- Total Economic Benefit = Cruise Value Captured + Net Gaming Result + distinct redeemed benefits - incremental travel costs
- Coin-In is gambling volume only. Never add Coin-In to Cash Result, Cruise Value Captured, Total Economic Value, ROI, or profit language.
- Club Royale earning years reset April 1. Celebrity Blue Chip Club earning years reset August 1.
- Prefer explicit manual override, then latest provider sync, then cached profile, then reconstructed history. Never replace missing data with zero in an answer.`;
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
  return toLocalCalendarDateOnly(date) ?? '';
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
    dates.push(createUtcDateFromLocalCalendarDay(cursor));
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
  // A question about where an annual tier reward was used must search booked
  // cruise and linked-offer evidence. It is not a tier-progress calculation.
  if (isAnnualTierRewardQuestion(message)) {
    return { tool: 'askMyData', params: { query: message } };
  }

  const askDataMatch = message.match(/ask my data|search my data|find in my data|search everything|global search|natural language search|show me.*data|what .* do i have|which .* do i have|who .*recogniz|show .*crew|show .*weather|show .*forecast|show .*events?|show .*slot|show .*alert|show .*financial|show .*payment|show .*price|show .*tax|show .*w-?2g|show .*bankroll|show .*achievement|what .*weather|which .*slot|rough seas|weather reports?|price drops?|bankroll|financials?|payments?|tax|w-?2g|achievements?|app data|data sources?|what can you see/i);
  if (askDataMatch || isWeatherQuestion(message)) {
    return { tool: 'askMyData', params: { query: message } };
  }

  const certificateMatch = message.match(/certificate|certificates|levels?\s+of\s+certificates?|what\s+levels?|appears?\s+on.*certificate|a\s+or\s+c\s+certificate/i);
  const decodeOfferMatch = message.match(/decode\s+(?:my\s+)?offer|decode\s+(?:the\s+)?best\s+offer|explain\s+(?:my\s+)?offer|what\s+does\s+(?:this\s+)?offer\s+mean|break\s+down\s+(?:my\s+)?offer/i);
  const replacementMatch = message.match(/replacement|replace\s+(?:this|my)?\s*cruise|find\s+replacements?|compare\s+replacements?|better\s+replacement|alternate\s+sailing|alternative\s+cruise/i);
  const searchMatch = message.match(/search.*cruise|find.*cruise|available.*cruise|cruise.*search/i);
  const tierMatch = message.match(/tier.*progress|progress.*tier|points.*tier|tier.*points|how\s+many.*(?:signature|masters|pinnacle)|(?:reach|keep|retain|earn|next).*\b(?:signature|masters|pinnacle)\b|\b(?:signature|masters|pinnacle)\b.*(?:progress|points|target|threshold|reach|keep|retain)/i);
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
    { id: 'replacement-goal-airfare', label: 'Easy airfare', prompt: `Find replacement cruises for this using goal: easiest and lowest-risk airfare. Context: ${base}` },
    { id: 'replacement-goal-favorite-ship', label: 'Favorite ship', prompt: `Find replacement cruises for this using goal: prioritize my favorite ships based on saved history. Context: ${base}` },
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
  recordProviderRender('AgentXProvider');
  const { tier } = useEntitlement();
  const { isAdmin, authenticatedEmail } = useAuth();
  const { cruises, bookedCruises, casinoOffers, calendarEvents, filters, settings, lastSyncDate, hasLocalData, isLoading: coreDataLoading, userPoints: coreUserPoints, updateCasinoOffer, addCalendarEvent } = useCoreData();
  const { queryCruises, totalCruises, totalSourceCruises, totalOfferSailingRelationships } = useCruiseInventory();
  const { users, currentUserId } = useUser();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const {
    clubRoyalePoints,
    clubRoyaleTier,
    clubRoyalePointsSource,
    clubRoyaleSyncDiscrepancy,
    crownAnchorPoints,
    crownAnchorLevel,
    blueChip,
  } = useLoyalty();
  const { allMachines } = useSlotMachines();
  const { myAtlasMachines, globalLibrary, encyclopedia } = useSlotMachineLibrary();
  const { mappings: deckMappings } = useDeckPlan();
  const { sessions, getSessionAnalytics, getMachineAnalytics } = useCasinoSessions();
  const {
    searchableCertificates: certificates,
    certificateDocuments,
    certificateDocumentLoadState,
    loadSearchableCertificates,
    updateCertificate,
  } = useCertificates();
  const { logs: machineLogs } = useMachineConditionLogs();
  const { entries: crewRecognitionEntries } = useCrewRecognition();
  const { isHydrated: isWeatherHydrated, cachedForecasts, getForecastForCruiseDay } = useSailingWeather();
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
  const { bundle: optimizationBundle } = usePersonalCertificateOptimizer();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AgentXMode>('travelAgent');
  const [weatherReports, setWeatherReports] = useState<SailingWeatherForecast[]>([]);
  const [conversationThreads, setConversationThreads] = useState<ConversationThread[]>([]);
  const [provenanceLinks, setProvenanceLinks] = useState<ProvenanceLink[]>([]);
  const [agentSeaSourceManifest, setAgentSeaSourceManifest] = useState<AgentSeaSourceManifest | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const catalogSearchRequestRef = useRef(0);
  const activeAIRequestRef = useRef<AbortController | null>(null);
  const visibleRef = useRef(false);

  useEffect(() => {
    const hasCachedCertificateRows = certificates.some((certificate) => (certificate.parsedSailings?.length ?? 0) > 0);
    if (!isVisible || hasCachedCertificateRows || certificateDocumentLoadState !== 'idle') return;
    // Warm retained PDFs as soon as chat becomes visible. The send path below
    // still awaits the same loader, preventing a fast first question from
    // receiving a false zero while certificate hydration is in flight.
    void loadSearchableCertificates().catch((loadError) => {
      console.warn('[Agent SEA] Saved certificate inventory prewarm failed:', loadError);
    });
  }, [certificateDocumentLoadState, certificates, isVisible, loadSearchableCertificates]);

  const cancelActiveRequest = useCallback(() => {
    catalogSearchRequestRef.current += 1;
    activeAIRequestRef.current?.abort();
    activeAIRequestRef.current = null;
    setIsLoading(false);
    setMessages((current) => current.filter((message) => !message.isLoading));
  }, []);

  const activePrivateProfileId = useMemo(() => selectedProfileId === 'all' ? (currentUserId ?? 'unassigned') : selectedProfileId, [currentUserId, selectedProfileId]);
  const privateIntelligenceFilterSnapshot = useMemo(() => ({
    selectedProfileId: activePrivateProfileId,
    selectedBrand,
    selectedProgram,
  }), [activePrivateProfileId, selectedBrand, selectedProgram]);
  const sharedIntelligenceFilterSnapshot = useMemo(() => ({
    selectedProfileId: 'all' as const,
    selectedBrand,
    selectedProgram,
  }), [selectedBrand, selectedProgram]);
  const conversationOwnerScope = useMemo(() => ({ authenticatedEmail, profileId: activePrivateProfileId, brand: selectedBrand, program: selectedProgram }), [activePrivateProfileId, authenticatedEmail, selectedBrand, selectedProgram]);
  const conversationOwnerKey = useMemo(() => buildAskAllOffersOwnerKey(conversationOwnerScope), [conversationOwnerScope]);
  const provenanceOwner = useMemo(() => {
    if (activePrivateProfileId && activePrivateProfileId !== 'unassigned') return activePrivateProfileId;
    return authenticatedEmail?.toLowerCase().trim() || null;
  }, [activePrivateProfileId, authenticatedEmail]);

  useEffect(() => {
    let cancelled = false;
    if (!isVisible || !provenanceOwner || Platform.OS === 'web') {
      setProvenanceLinks([]);
      return undefined;
    }
    void listAllProvenanceLinks(provenanceOwner)
      .then((links) => { if (!cancelled) setProvenanceLinks(links); })
      .catch((loadError) => {
        console.warn('[Agent SEA] Provenance citations are not available yet:', loadError);
        if (!cancelled) setProvenanceLinks([]);
      });
    return () => { cancelled = true; };
  }, [isVisible, provenanceOwner]);

  useEffect(() => {
    let cancelled = false;
    cancelActiveRequest();
    void loadConversationThreads(conversationOwnerKey).then((threads) => {
      if (cancelled) return;
      setConversationThreads(threads);
      const first = threads.find((thread) => !thread.archivedAt) ?? null;
      setActiveConversationId(first?.id ?? null);
      setMessages(first ? first.messages.map((message) => ({ ...message, timestamp: new Date(message.timestamp) })) : []);
    }).catch((loadError) => {
      console.error('[AgentX] Failed to load conversation history:', loadError);
      if (!cancelled) { setConversationThreads([]); setActiveConversationId(null); setMessages([]); }
    });
    return () => { cancelled = true; };
  }, [cancelActiveRequest, conversationOwnerKey]);

  // The assistant remains mounted for the whole app, so eager filtering here
  // used to make every CoreData hydration block unrelated tab navigation. React
  // now prepares the large local context at deferred priority while the current
  // screen stays interactive.
  const deferredCruises = useDeferredValue(cruises, EMPTY_CRUISES);
  const deferredBookedCruises = useDeferredValue(bookedCruises, EMPTY_BOOKED_CRUISES);
  const deferredCasinoOffers = useDeferredValue(casinoOffers, EMPTY_OFFERS);
  const deferredCalendarEvents = useDeferredValue(calendarEvents, EMPTY_CALENDAR_EVENTS);

  const selectedProfileLabel = useMemo(() => {
    if (selectedProfileId === 'all') return 'All Profiles';
    if (selectedProfileId === 'unassigned') return 'Unassigned Imports';
    const profile = users.find((item) => item.id === selectedProfileId);
    return getProfileDisplayName(profile);
  }, [selectedProfileId, users]);

  const activeScopeLabel = useMemo(() => buildIntelligenceScopeLabel(privateIntelligenceFilterSnapshot, users), [privateIntelligenceFilterSnapshot, users]);
  const brandProgramLabel = useMemo(() => getBrandProgramSystemLabel(selectedBrand, selectedProgram), [selectedBrand, selectedProgram]);

  const filteredCruises = useMemo(() => isVisible ? filterRecordsByIntelligence(deferredCruises, sharedIntelligenceFilterSnapshot, users) : EMPTY_CRUISES, [deferredCruises, isVisible, sharedIntelligenceFilterSnapshot, users]);
  const filteredBookedCruises = useMemo(() => isVisible ? filterRecordsByIntelligence(deferredBookedCruises, privateIntelligenceFilterSnapshot, users) : EMPTY_BOOKED_CRUISES, [deferredBookedCruises, isVisible, privateIntelligenceFilterSnapshot, users]);
  const filteredCasinoOffers = useMemo(() => isVisible ? filterRecordsByIntelligence(deferredCasinoOffers, sharedIntelligenceFilterSnapshot, users) : EMPTY_OFFERS, [deferredCasinoOffers, isVisible, sharedIntelligenceFilterSnapshot, users]);
  const filteredCalendarEvents = useMemo(() => isVisible ? filterRecordsByIntelligence(deferredCalendarEvents, privateIntelligenceFilterSnapshot, users) : EMPTY_CALENDAR_EVENTS, [deferredCalendarEvents, isVisible, privateIntelligenceFilterSnapshot, users]);
  const filteredCertificates = useMemo(() => isVisible
    ? filterRecordsByIntelligence(certificates as unknown as Array<typeof certificates[number] & { ownerProfileId?: string; sourceEmail?: string; brand?: string; casinoProgram?: any }>, sharedIntelligenceFilterSnapshot, users)
    : [], [certificates, isVisible, sharedIntelligenceFilterSnapshot, users]);
  const scopedCrewRecognitionEntries = useMemo(() => isVisible
    ? filterRecordsByIntelligence(crewRecognitionEntries, privateIntelligenceFilterSnapshot, users)
    : [], [crewRecognitionEntries, isVisible, privateIntelligenceFilterSnapshot, users]);
  const scopedCasinoSessions = useMemo(() => {
    if (!isVisible) return [];
    if (!activePrivateProfileId || activePrivateProfileId === 'unassigned') return sessions;
    const hasProfileAssignments = sessions.some((session) => Boolean(session.pointEarningProfileId));
    if (!hasProfileAssignments) return sessions;
    return sessions.filter((session) => session.pointEarningProfileId
      ? session.pointEarningProfileId === activePrivateProfileId
      : activePrivateProfileId === currentUserId);
  }, [activePrivateProfileId, currentUserId, isVisible, sessions]);
  const getScopedSessionAnalytics = useCallback((options?: Parameters<typeof getSessionAnalytics>[0]) => getSessionAnalytics({
    ...(options ?? {}),
    profileId: activePrivateProfileId && activePrivateProfileId !== 'unassigned' ? activePrivateProfileId : undefined,
    includeUnassignedForProfile: activePrivateProfileId === currentUserId,
  }), [activePrivateProfileId, currentUserId, getSessionAnalytics]);
  const persistConversation = useCallback(async (nextMessages: ChatMessage[]) => {
    const now = new Date().toISOString();
    const firstQuestion = nextMessages.find((message) => message.role === 'user')?.content.trim() || 'Easy Seas conversation';
    const threadId = activeConversationId ?? `easy-seas-thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const existing = conversationThreads.find((thread) => thread.id === threadId);
    const scope = buildAllOffersScopeSnapshot({
      ownerScope: conversationOwnerScope,
      offers: filteredCasinoOffers,
      bookedCruises: filteredBookedCruises,
      certificates: filteredCertificates,
      cruises: filteredCruises,
    });
    const thread: ConversationThread = {
      id: threadId,
      title: existing?.title ?? firstQuestion.slice(0, 52),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      archivedAt: null,
      scope,
      messages: nextMessages.filter((message) => !message.isLoading).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
        sourceReferences: message.sourceReferences ?? [],
      })),
      lastQuestion: [...nextMessages].reverse().find((message) => message.role === 'user')?.content ?? null,
    };
    const nextThreads = await upsertConversationThread(conversationOwnerKey, thread);
    setConversationThreads(nextThreads);
    setActiveConversationId(threadId);
  }, [activeConversationId, conversationOwnerKey, conversationOwnerScope, conversationThreads, filteredBookedCruises, filteredCasinoOffers, filteredCertificates, filteredCruises]);

  const startNewConversation = useCallback(() => {
    cancelActiveRequest();
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
  }, [cancelActiveRequest]);

  const openConversation = useCallback((threadId: string) => {
    const thread = conversationThreads.find((candidate) => candidate.id === threadId);
    if (!thread || thread.archivedAt) return;
    cancelActiveRequest();
    setActiveConversationId(thread.id);
    setMessages(thread.messages.map((message) => ({ ...message, timestamp: new Date(message.timestamp) })));
    setError(null);
  }, [cancelActiveRequest, conversationThreads]);

  const renameConversation = useCallback(async (threadId: string, title: string) => {
    const next = await renameConversationThread(conversationOwnerKey, threadId, title);
    setConversationThreads(next);
  }, [conversationOwnerKey]);

  const archiveConversation = useCallback(async (threadId: string) => {
    const next = await archiveConversationThread(conversationOwnerKey, threadId, true);
    setConversationThreads(next);
    if (threadId === activeConversationId) startNewConversation();
  }, [activeConversationId, conversationOwnerKey, startNewConversation]);

  const confirmAgentAction = useCallback(async (action: AgentConfirmedAction): Promise<{ route?: string }> => {
    try {
      if (action.kind === 'shortlist-offer') updateCasinoOffer(action.payload.offerId, { isShortlisted: true, shortlistedAt: new Date().toISOString() });
      if (action.kind === 'mark-certificate-used') updateCertificate(action.payload.certificateId, { status: 'used' });
      if (action.kind === 'add-reminder') addCalendarEvent(buildAgentReminderEvent(action));
      const nextMessages = messages.map((message) => message.pendingAction?.id === action.id ? { ...message, actionStatus: 'confirmed' as const } : message);
      setMessages(nextMessages);
      await persistConversation(nextMessages);
      return action.payload.route ? { route: action.payload.route } : {};
    } catch (actionError) {
      const nextMessages = messages.map((message) => message.pendingAction?.id === action.id ? { ...message, actionStatus: 'failed' as const } : message);
      setMessages(nextMessages);
      await persistConversation(nextMessages).catch(() => undefined);
      console.error('[AgentX] Confirmed action failed:', actionError);
      return {};
    }
  }, [addCalendarEvent, messages, persistConversation, updateCasinoOffer, updateCertificate]);

  const cancelAgentAction = useCallback((action: AgentConfirmedAction) => {
    const nextMessages = messages.map((message) => message.pendingAction?.id === action.id ? { ...message, actionStatus: 'cancelled' as const } : message);
    setMessages(nextMessages);
    void persistConversation(nextMessages).catch((saveError) => console.error('[AgentX] Failed to save cancelled action:', saveError));
  }, [messages, persistConversation]);
  useEffect(() => {
    if (!isVisible) return;
    recordPerformanceCount('AgentXProvider.cruiseScopeRows', filteredCruises.length, {
      cruisesLoadedIntoJS: deferredCruises.length,
    });
  }, [deferredCruises.length, filteredCruises.length, isVisible]);
  const archiveContextLabel = useMemo(() => {
    const archivedOrSkippedOffers = filteredCasinoOffers.filter((offer) => offer.status === 'archived' || offer.status === 'skipped' || offer.archiveStatus === 'archived' || offer.archiveStatus === 'replaced').length;
    const reviewNeededOffers = filteredCasinoOffers.filter((offer) => offer.status === 'reviewNeeded' || offer.archiveStatus === 'reviewNeeded' || offer.reconciliationStatus === 'reviewNeeded' || offer.importStatus === 'reviewNeeded' || offer.importStatus === 'unassigned').length;
    return `${archivedOrSkippedOffers} archived/skipped offer(s), ${reviewNeededOffers} review-needed offer(s)`;
  }, [filteredCasinoOffers]);

  const askMyDataOverview = useMemo(() => buildAskMyDataOverview({
    bookedCruises: filteredBookedCruises,
    casinoSessions: scopedCasinoSessions,
    currentTier: clubRoyaleTier,
    currentPoints: clubRoyalePoints,
    pointBalanceSource: clubRoyalePointsSource,
    clubRoyaleSyncDiscrepancy,
    useKnownAnnualReportFacts: isKnownCasinoProfile(authenticatedEmail),
  }), [authenticatedEmail, clubRoyalePoints, clubRoyalePointsSource, clubRoyaleSyncDiscrepancy, clubRoyaleTier, filteredBookedCruises, scopedCasinoSessions]);

  const scopedWeatherReports = useMemo(() => {
    const cruiseIds = new Set(filteredBookedCruises.map((cruise) => cruise.id));
    const merged = new Map<string, SailingWeatherForecast>();
    cachedForecasts.forEach((forecast) => {
      if (cruiseIds.has(forecast.cruiseId)) merged.set(forecast.cacheKey, forecast);
    });
    weatherReports.forEach((forecast) => merged.set(forecast.cacheKey, forecast));
    return Array.from(merged.values());
  }, [cachedForecasts, filteredBookedCruises, weatherReports]);

  const agentSeaProvenanceBlock = useMemo(() => {
    if (!isVisible || provenanceLinks.length === 0) return '';
    const citations = provenanceLinks.slice(0, 16).map((link) => {
      const formula = link.formula ? `; formula ${link.formula}` : '';
      return `- ${link.entityType}/${link.field}: ${link.sourceType}; ${link.confidence}; observed ${link.observedAt}${formula}`;
    });
    return `Source evidence:\n${citations.join('\n')}`;
  }, [isVisible, provenanceLinks]);

  useEffect(() => {
    // A downloaded certificate can contain thousands of sailing rows. Building
    // that source manifest while the chat is opening blocked the iOS navigation
    // transition and made Agent SEA appear frozen. The manifest is now built
    // only when the user explicitly asks about sources or provenance.
    if (!isVisible) setAgentSeaSourceManifest(null);
  }, [isVisible]);

  const appWideContextBlocks = useMemo<AskMyDataContextBlock[]>(() => {
    // The provider is app-wide, but its multi-source narrative index is only
    // needed while an Agent surface is open. Building every financial/session/
    // weather/slot text block during CoreData hydration delayed unrelated tabs.
    if (!isVisible) return [];
    const sessionAnalytics = getScopedSessionAnalytics();
    const relationship = buildCasinoRelationshipSnapshot({
      cruises: filteredBookedCruises,
      sessions: scopedCasinoSessions,
      offers: filteredCasinoOffers,
      currentPoints: clubRoyalePoints,
      currentPointsSource: clubRoyalePointsSource === 'manual' ? 'user_entered' : clubRoyalePointsSource === 'api' ? 'provider_reported' : 'estimated',
    });
    const casinoTruthRows = filteredBookedCruises.map((cruise) => buildCasinoCruiseTruth({
      cruise,
      sessions: scopedCasinoSessions,
      certificates: filteredCertificates,
    }));
    const royalReconciliation = reconcileCasinoSeason({
      program: 'club_royale',
      syncedPoints: clubRoyalePoints,
      cruises: casinoTruthRows,
      certificates: filteredCertificates,
    });
    const blueChipReconciliation = reconcileCasinoSeason({
      program: 'blue_chip',
      syncedPoints: blueChip.points,
      cruises: casinoTruthRows,
      certificates: filteredCertificates,
    });
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

    const recordBlocks: AskMyDataContextBlock[] = [
      ...casinoTruthRows.map((trip) => ({
        id: `casino-truth-${trip.cruiseId}`,
        title: `Casino trip evidence — ${trip.shipName}`,
        subtitle: `${trip.sailDate} · ${trip.points.value ?? 'points missing'} points · ${trip.certificateCodes.length} certificate(s)`,
        keywords: ['casino trip', 'casino cruise', 'theoretical', 'theo', 'hours played', 'estimated hours', 'points', 'certificate earned', 'sea days', 'port days', trip.shipName, String(trip.points.value ?? ''), ...trip.certificateCodes],
        detail: [
          `${trip.shipName} sailing ${trip.sailDate}; program ${trip.program}; earning period ${trip.seasonLabel}.`,
          `Points: ${trip.points.value ?? 'missing'}; evidence ${trip.points.kind}; source ${trip.points.source}.`,
          `Play hours: ${trip.hours.value == null ? 'missing' : trip.hours.value.toFixed(2)}; evidence ${trip.hours.kind}; source ${trip.hours.source}; formula ${trip.hours.formula ?? 'none'}.`,
          `Itinerary casino opportunity: ${trip.seaDays} sea day(s), ${trip.portDays} port day(s), ${trip.estimatedCasinoOpportunityHours == null ? 'missing' : `${trip.estimatedCasinoOpportunityHours} maximum opportunity hour(s)`}. Opportunity hours are not claimed actual play hours.`,
          `Coin-in: ${trip.coinIn.value == null ? 'missing' : formatMoney(trip.coinIn.value)}; evidence ${trip.coinIn.kind}; source ${trip.coinIn.source}; formula ${trip.coinIn.formula ?? 'none'}.`,
          `Theoretical loss: ${trip.theoreticalLoss.value == null ? 'missing' : formatMoney(trip.theoreticalLoss.value)}; evidence ${trip.theoreticalLoss.kind}; source ${trip.theoreticalLoss.source}; formula ${trip.theoreticalLoss.formula ?? 'none'}.`,
          `Net gaming result: ${trip.netGamingResult.value == null ? 'missing' : formatMoney(trip.netGamingResult.value)}; evidence ${trip.netGamingResult.kind}; source ${trip.netGamingResult.source}. Cruise fare excluded.`,
          `Certificates earned/linked: ${trip.certificateCodes.join(', ') || 'none confidently linked'}.`,
          `Warnings: ${trip.warnings.join(' ') || 'none'}`,
        ].join('\n'),
        actionLabel: 'Open casino trip detail',
        actionRoute: '/casino/post-cruise-closeout',
      })),
      ...scopedCasinoSessions.map((session) => ({
        id: `casino-session-${session.id}`,
        title: `Casino session — ${session.machineName || session.machineType || 'gaming'}`,
        subtitle: `${session.date} · ${session.durationMinutes} minutes · ${session.pointsEarned ?? 0} points`,
        keywords: ['casino session', 'session', 'play', 'points', 'win loss', 'buy in', 'cash out', session.machineName ?? '', session.machineType ?? ''],
        detail: `Session ${session.id}; cruise ${session.cruiseId ?? 'not linked'}; start ${session.startTime}; end ${session.endTime}; buy-in ${formatMoney(session.buyIn ?? 0)}; cash-out ${formatMoney(session.cashOut ?? 0)}; win/loss ${formatMoney(session.winLoss ?? 0)}; points ${session.pointsEarned ?? 0}; free play ${formatMoney(session.freePlayUsed ?? 0)}; comps ${formatMoney(session.compsReceived ?? 0)}; jackpot ${session.jackpotHit ? formatMoney(session.jackpotAmount ?? 0) : 'no'}; notes ${session.notes ?? 'none'}.`,
        actionLabel: 'Use casino session',
        actionRoute: '/casino-sessions',
      })),
      ...machineLogs.map((log) => ({
        id: `machine-condition-${log.id}`,
        title: `Machine condition — ${log.machineName}`,
        subtitle: `${log.shipName} · ${log.timeObserved} · ${log.decision}`,
        keywords: ['machine log', 'condition log', 'atlas observation', log.shipName, log.machineName, log.casinoLocation, log.decision],
        detail: `Observed ${log.machineName} on ${log.shipName} at ${log.casinoLocation}, position ${log.seatBankPosition}; denomination ${log.denomination}; bet ${log.betLevel}; visible state ${log.visibleMachineState}; bonus meter ${log.bonusMeterCondition}; major ${log.majorAmount ?? 'n/a'}; grand ${log.grandAmount ?? 'n/a'}; decision ${log.decision}; notes ${log.notes ?? 'none'}.`,
        actionLabel: 'Open machine atlas',
        actionRoute: '/machines',
      })),
      ...deckMappings.map((mapping, index) => ({
        id: `deck-mapping-${index}`,
        title: 'Saved deck mapping',
        subtitle: `Machine/deck reference ${index + 1}`,
        keywords: ['deck mapping', 'ship deck', 'machine location', 'casino map'],
        detail: JSON.stringify(mapping),
        actionLabel: 'Use deck mapping',
        actionRoute: '/machines',
      })),
    ];

    const availableCruiseOptionCount = totalSourceCruises || totalCruises;
    return [
      {
        id: 'data-source-coverage',
        title: 'Loaded Easy Seas data sources',
        subtitle: `${formatCount(availableCruiseOptionCount + filteredBookedCruises.length)} cruises · ${formatCount(filteredCasinoOffers.length)} offers · ${formatCount(filteredCalendarEvents.length)} events · ${formatCount(scopedCrewRecognitionEntries.length)} crew · ${formatCount(allMachines.length)} slots`,
        keywords: ['data source', 'system', 'context', 'loaded', 'overview', 'coverage', 'what can you see'],
        detail: [
          `Core data: ${formatCount(availableCruiseOptionCount)} available offer-sailing cruise option(s), ${formatCount(totalOfferSailingRelationships)} offer-sailing relationship row(s), ${formatCount(filteredBookedCruises.length)} booked/completed cruise(s), ${formatCount(filteredCasinoOffers.length)} casino offer(s), ${formatCount(filteredCertificates.length)} certificate(s), ${formatCount(filteredCalendarEvents.length)} calendar/event record(s).`,
          `Casino/slot data: ${formatCount(scopedCasinoSessions.length)} casino session(s), ${formatCount(allMachines.length)} slot machine record(s), ${formatCount(myAtlasMachines.length)} personal Atlas record(s), ${formatCount(globalLibrary.length)} permanent library record(s), ${formatCount(deckMappings.length)} deck mapping(s), ${formatCount(machineLogs.length)} condition log(s).`,
          `Crew/weather data: ${formatCount(scopedCrewRecognitionEntries.length)} crew recognition record(s), ${formatCount(scopedWeatherReports.length)} loaded weather report(s).`,
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
          `Legacy portfolio analytics: total points ${formatCount(simpleAnalytics.casinoAnalytics.totalPointsEarned)}, historical points ${formatCount(simpleAnalytics.casinoAnalytics.historicalPointsEarned)}, current balance ${formatCount(simpleAnalytics.casinoAnalytics.currentPointBalance)}, Club-Royale-slot-derived coin-in estimate ${formatMoney(simpleAnalytics.casinoAnalytics.totalCoinIn)}, win/loss ${formatMoney(simpleAnalytics.casinoAnalytics.totalWinLoss)}, tier ${simpleAnalytics.casinoAnalytics.currentStatusTier}. Do not apply that point conversion to Blue Chip, Carnival, table games, or unknown play.`,
          `Actual session analytics: ${formatCount(sessionAnalytics.totalSessions)} sessions, ${Math.round(sessionAnalytics.totalPlayTimeMinutes / 60).toLocaleString()} play hour(s), ${formatCount(sessionAnalytics.totalPointsEarned)} points, ${sessionAnalytics.coinInSource === 'missing' ? 'coin-in missing' : `${formatMoney(sessionAnalytics.totalCoinIn)} explicit coin-in (${sessionAnalytics.coinInSource})`}, ${formatMoney(sessionAnalytics.netWinLoss)} net win/loss, ${sessionAnalytics.pointsPerHour.toFixed(1)} points/hour. Generated sessions excluded.`,
          `Historical performance: average ${historicalPerformance.metrics.averagePointsPerNight.toFixed(1)} points/night, ${formatMoney(historicalPerformance.metrics.averageCoinInPerNight)} coin-in/night, ${historicalPerformance.metrics.averageROI.toFixed(2)}% average ROI, ${historicalPerformance.metrics.consistencyScore.toFixed(1)} consistency score. Best cruise: ${historicalPerformance.metrics.bestCruise?.cruiseName ?? 'n/a'}.`,
        ].join('\n'),
        actionLabel: 'Use analytics',
      },
      {
        id: 'casino-relationship-intelligence',
        title: 'Casino relationship intelligence',
        subtitle: `${formatCount(relationship.playerWorth.trackedTrips)} tracked trips · ${formatMoney(relationship.playerWorth.recordedCashResult.value ?? 0)} recorded cash result · ${formatMoney(relationship.playerWorth.capturedCruiseValue.value ?? 0)} captured value`,
        keywords: ['casino intelligence', 'hourly win loss', 'trip report', 'points pace', 'tier simulator', 'certificate threshold', 'keep playing', 'actual theoretical', 'reinvestment', 'freeplay roi', 'cost per night', 'offer response', 'offer attribution', 'player worth', 'what am i worth'],
        detail: [
          `Royal reconciliation: ${royalReconciliation.seasonLabel}; synced ${royalReconciliation.syncedPoints ?? 'missing'} points; cruise-attributed ${royalReconciliation.attributedCruisePoints}; unallocated ${royalReconciliation.unallocatedPoints ?? 'unknown'}; over-attributed ${royalReconciliation.overAttributedPoints}; ${royalReconciliation.unlinkedCertificateCount} unlinked certificate(s).`,
          `Celebrity reconciliation: ${blueChipReconciliation.seasonLabel}; Blue Chip resets August 1; synced ${blueChipReconciliation.syncedPoints ?? 'missing'} points; cruise-attributed ${blueChipReconciliation.attributedCruisePoints}; unallocated ${blueChipReconciliation.unallocatedPoints ?? 'unknown'}; over-attributed ${blueChipReconciliation.overAttributedPoints}; ${blueChipReconciliation.unlinkedCertificateCount} unlinked certificate(s).`,
          `Portfolio hourly win/loss: ${formatMoney(relationship.portfolioHourlyWinLoss.value ?? 0)} (${relationship.portfolioHourlyWinLoss.source}); formula ${relationship.portfolioHourlyWinLoss.formula}.`,
          `Points pace: ${formatCount(relationship.pointsPace.currentPoints.value ?? 0)} current points; historical ${formatCount(relationship.pointsPace.historicalPointsPerCruise.value ?? 0)} points/cruise (${relationship.pointsPace.historicalPointsPerCruise.source}); projected ${formatCount(relationship.pointsPace.projectedSeasonPoints.value ?? 0)} after ${relationship.pointsPace.futureCruises} booked future cruise(s) (${relationship.pointsPace.projectedSeasonPoints.source}); ${formatCount(relationship.pointsPace.pointsToNextTier)} to ${relationship.pointsPace.nextTier ?? 'no higher saved tier'}.`,
          `Tier scenarios: ${relationship.tierSimulation.map((row) => `${row.label}: ${formatCount(row.projectedPoints)} / ${row.projectedTier} (${row.source})`).join('; ')}.`,
          `Player-worth proxy: ${formatMoney(relationship.playerWorth.relationshipValueProxy.value ?? 0)} (${relationship.playerWorth.relationshipValueProxy.source}); formula ${relationship.playerWorth.relationshipValueProxy.formula}. ${relationship.playerWorth.warning}`,
          `Offer response bands: ${relationship.offerResponse.map((band) => `${band.label}: ${band.completedCruises} trip(s), ${band.subsequentOfferInstances} later offer instance(s), average later offer ${band.averageSubsequentOfferValue == null ? 'missing' : formatMoney(band.averageSubsequentOfferValue)} (${band.source})`).join('; ')}. These are temporal correlations, not causal attribution.`,
          optimizationBundle?.currentRecommendation
            ? `Saved certificate threshold recommendation: ${optimizationBundle.currentRecommendation.actionLabel}; ${formatCount(optimizationBundle.currentRecommendation.currentPoints)} current points; target ${optimizationBundle.currentRecommendation.recommendedTargetPoints == null ? 'stop at current certificate' : formatCount(optimizationBundle.currentRecommendation.recommendedTargetPoints)}; expected additional loss ${formatMoney(optimizationBundle.currentRecommendation.expectedAdditionalLoss)} (estimated); risk-adjusted incremental value ${formatMoney(optimizationBundle.currentRecommendation.riskAdjustedIncrementalExpectedValue)}; confidence ${optimizationBundle.currentRecommendation.confidence}; safety warnings ${optimizationBundle.currentRecommendation.warnings.join('; ') || 'none'}.`
            : 'No saved profile-scoped certificate threshold recommendation is available.',
          `Trip calculations: ${relationship.trips.slice().sort((a, b) => b.sailDate.localeCompare(a.sailDate)).slice(0, 20).map((trip) => `${trip.ship} ${trip.sailDate}: cash ${trip.cashResult.value == null ? 'missing' : formatMoney(trip.cashResult.value)} (${trip.cashResult.source}), hourly ${trip.hourlyWinLoss.value == null ? 'missing' : formatMoney(trip.hourlyWinLoss.value)} (${trip.hourlyWinLoss.source}), points ${trip.points.value ?? 'missing'}, actual/theo ${trip.actualVsTheoretical.value == null ? 'missing' : `${trip.actualVsTheoretical.value.toFixed(1)}%`}, reinvestment ${trip.compReinvestmentPercent.value == null ? 'missing' : `${trip.compReinvestmentPercent.value.toFixed(1)}%`}, FreePlay outcome proxy ${trip.freePlayOutcomeProxy.value == null ? 'missing' : `${trip.freePlayOutcomeProxy.value.toFixed(1)}%`}, value ROI ${trip.trueCruiseCasinoRoi.value == null ? 'missing' : `${trip.trueCruiseCasinoRoi.value.toFixed(1)}%`}, cost/night ${trip.casinoCostPerNight.value == null ? 'missing' : formatMoney(trip.casinoCostPerNight.value)}.`).join('\n') || 'No trip reports available.'}`,
        ].join('\n'),
        actionLabel: 'Open relationship intelligence',
        actionRoute: '/casino/relationship-intelligence',
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
      ...recordBlocks,
    ];
  }, [activeScopeLabel, alertsState.activeAlerts, alertsState.alerts.length, alertsState.anomalies.length, alertsState.criticalAlerts.length, alertsState.insights.length, alertsState.lastDetectionRun, alertsState.rules, allMachines.length, authenticatedEmail, bankrollState, blueChip.points, brandProgramLabel, celebrityState.destinations, celebrityState.ships, clubRoyalePoints, clubRoyalePointsSource, clubRoyaleTier, coreDataLoading, coreUserPoints, deckMappings, filteredBookedCruises, filteredCalendarEvents.length, filteredCasinoOffers, filteredCertificates, financials.summary, gamificationState, getScopedSessionAnalytics, globalLibrary.length, hasLocalData, lastSyncDate, machineLogs, myAtlasMachines.length, optimizationBundle, pphAlertsState, priceHistoryState, priceTrackingState, scopedCasinoSessions, scopedCrewRecognitionEntries, selectedBrand, selectedProfileLabel, selectedProgram, settings, taxState, totalCruises, totalOfferSailingRelationships, totalSourceCruises, users, scopedWeatherReports.length]);

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

  const toolContext = useMemo((): AgentToolContext => {
    console.log('[AgentX] Recalculating toolContext with latest data...', {
      bookedCruises: filteredBookedCruises.length,
      clubRoyalePoints,
      clubRoyaleTier,
      slotMachines: allMachines.length,
      myAtlasMachines: myAtlasMachines.length,
      globalLibrary: globalLibrary.length,
      sessions: scopedCasinoSessions.length,
      deckMappings: deckMappings.length,
      certificates: certificates.length,
      machineLogs: machineLogs.length,
      calendarEvents: filteredCalendarEvents.length,
      crewRecognitionEntries: scopedCrewRecognitionEntries.length,
      weatherReports: scopedWeatherReports.length,
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
      casinoSessions: scopedCasinoSessions,
      getSessionAnalytics: getScopedSessionAnalytics,
      getMachineAnalytics,
    };
  }, [isVisible, filteredCruises, filteredBookedCruises, filteredCasinoOffers, clubRoyalePoints, clubRoyaleTier, allMachines, myAtlasMachines, globalLibrary, encyclopedia, deckMappings, scopedCasinoSessions, getScopedSessionAnalytics, getMachineAnalytics, certificates.length, machineLogs.length, filteredCalendarEvents.length, scopedCrewRecognitionEntries.length, scopedWeatherReports.length, mode, filters, selectedProfileLabel, selectedBrand, selectedProgram, activeScopeLabel, brandProgramLabel, archiveContextLabel, askMyDataOverview]);

  const executeToolCall = useCallback((tool: string, params: unknown, weatherOverride?: SailingWeatherForecast[], catalogOverride: Cruise[] = filteredCruises): string => {
    console.log('[AgentX] Executing tool:', tool, params);
    const activeWeatherReports = weatherOverride ?? scopedWeatherReports;
    const activeToolContext = { ...toolContext, cruises: catalogOverride };

    switch (tool) {
      case 'searchCruises':
        return executeCruiseSearch(params as CruiseSearchInput, activeToolContext);
      case 'analyzeBooking':
        return executeBookingAnalysis(params as BookingAnalysisInput, activeToolContext);
      case 'optimizePortfolio':
        return executePortfolioOptimizer(params as PortfolioOptimizerInput, activeToolContext);
      case 'checkTierProgress':
        return executeTierProgress(params as TierProgressInput, activeToolContext);
      case 'analyzeOffers':
        return executeOfferAnalysis(params as OfferAnalysisInput, activeToolContext);
      case 'decodeOffer':
        return executeDecodeOffer(params as DecodeOfferInput, activeToolContext);
      case 'findReplacements':
        return executeReplacementFinder(params as ReplacementFinderInput, activeToolContext);
      case 'searchCertificateLevels':
        return formatAskMyDataResponse(askMyDataSearch({
          query: (params as CertificateLevelSearchInput).query ?? '',
          offers: filteredCasinoOffers,
          cruises: [...catalogOverride, ...filteredBookedCruises],
          certificates: filteredCertificates,
          calendarEvents: filteredCalendarEvents,
          crewRecognitionEntries: scopedCrewRecognitionEntries,
          slotMachines: allMachines,
          weatherReports: activeWeatherReports,
          additionalContextBlocks: appWideContextBlocks,
          overview: askMyDataOverview,
        }));
      case 'getRecommendations':
        return executeRecommendations(params as RecommendationInput, activeToolContext);
      case 'recommendMachines':
        return executeMachineRecommendations(params as MachineRecommendationInput, activeToolContext);
      case 'askMyData': {
        const query = typeof (params as { query?: unknown }).query === 'string' ? (params as { query: string }).query : '';
        const response = askMyDataSearch({
          query,
          offers: filteredCasinoOffers,
          cruises: [...catalogOverride, ...filteredBookedCruises],
          certificates: filteredCertificates,
          calendarEvents: filteredCalendarEvents,
          crewRecognitionEntries: scopedCrewRecognitionEntries,
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
  }, [toolContext, filteredCasinoOffers, filteredCruises, filteredBookedCruises, filteredCertificates, filteredCalendarEvents, scopedCrewRecognitionEntries, allMachines, scopedWeatherReports, appWideContextBlocks, askMyDataOverview]);

  const sendMessage = useCallback(async (content: string) => {
    console.log('[AgentX] User message:', content, 'mode:', mode);

    const devAssistantRequest = isDevAssistantRequest(content);
    const hasAgentAccess = true; // Agent SEA is local-first and must remain usable for every signed-in profile.

    if (!hasAgentAccess) {
      console.log('[AgentX] Access denied. Tier:', tier, 'isAdmin:', isAdmin, 'devAssistantRequest:', devAssistantRequest);
      const deniedMessage: ChatMessage = {
        id: `denied-${Date.now()}`,
        role: 'assistant',
        content: 'Agent SEA is temporarily unavailable for this profile, but your saved Easy Seas data remains intact.',
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

    const pendingAction = devAssistantRequest ? null : parseAgentConfirmedAction({
      message: content,
      offers: filteredCasinoOffers,
      certificates: filteredCertificates,
      cruises: filteredBookedCruises,
    });
    if (pendingAction) {
      const confirmationMessage: ChatMessage = {
        id: `assistant-action-${Date.now()}`,
        role: 'assistant',
        content: 'I found a local action matching your request. Review the exact change below; Easy Seas will not perform it without your confirmation.',
        timestamp: new Date(),
        pendingAction,
        actionStatus: 'pending',
        contextSummary: `Confirmation gate • ${activeScopeLabel}`,
      };
      const nextMessages = [...messages.filter((message) => !message.isLoading), userMessage, confirmationMessage];
      setMessages(nextMessages);
      void persistConversation(nextMessages).catch((saveError) => console.error('[AgentX] Failed to save pending action:', saveError));
      return;
    }

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

    activeAIRequestRef.current?.abort();
    const activeRequest = new AbortController();
    activeAIRequestRef.current = activeRequest;
    let requestCertificates = filteredCertificates;

    try {
      const catalogSearchRequest = catalogSearchRequestRef.current + 1;
      catalogSearchRequestRef.current = catalogSearchRequest;
      const previousUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content;
      const resolvedQuery = buildAskMyDataConversationalQuery(content, previousUserMessage);
      const questionPlan = planAgentSeaQuestion(resolvedQuery);
      const hasCachedCertificateRows = filteredCertificates.some((certificate) => (certificate.parsedSailings?.length ?? 0) > 0);
      if (!hasCachedCertificateRows && (questionPlan.sources.includes('certificate') || questionPlan.sources.includes('certificate_sailing'))) {
        const hydratedCertificates = await loadSearchableCertificates();
        requestCertificates = filterRecordsByIntelligence(
          hydratedCertificates as unknown as Array<typeof hydratedCertificates[number] & { ownerProfileId?: string; sourceEmail?: string; brand?: string; casinoProgram?: any }>,
          sharedIntelligenceFilterSnapshot,
          users,
        );
        if (activeRequest.signal.aborted || !visibleRef.current) return;
      }
      const directAnswer = buildAgentSeaDirectAnswer({
        question: resolvedQuery,
        bookedCruises: filteredBookedCruises,
        sessions: scopedCasinoSessions,
        certificates: requestCertificates,
        selectedProgram,
        overview: askMyDataOverview,
        loyalty: {
          clubRoyalePoints,
          clubRoyaleTier,
          clubRoyalePointsSource,
          crownAnchorPoints,
          crownAnchorLevel,
          blueChipPoints: blueChip.points,
          blueChipTier: blueChip.tier,
        },
      });

      // Arithmetic-critical questions must never wait for, or be diluted by,
      // a broad catalog query. The casino truth engine is owner scoped and its
      // recorded/estimated evidence is the authoritative answer for ADT.
      if (directAnswer) {
        const directAssistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: directAnswer.text,
          timestamp: new Date(),
          contextSummary: `Verified local calculation • ${activeScopeLabel} • ${brandProgramLabel}`,
          suggestedActions: buildAgentSuggestedActions(null, content),
          sourceReferences: [{
            id: `agent-sea-${directAnswer.intent}-${Date.now()}`,
            sourceType: 'system',
            label: 'Owner-scoped casino calculation',
            detail: directAnswer.evidence,
            evidenceKind: 'calculated',
            route: directAnswer.route,
          }],
        };
        setMessages((current) => current.filter((message) => message.id !== loadingMessage.id).concat(directAssistantMessage));
        void persistConversation([...messages.filter((message) => !message.isLoading), userMessage, directAssistantMessage])
          .catch((saveError) => console.error('[AgentX] Failed to save direct answer:', saveError));
        return;
      }

      let toolResult = '';
      let certificateToolFilter: Record<string, unknown> | null = null;
      if (!devAssistantRequest && questionPlan.certificateOnly) {
        const certificateTool = executeCertificateSummaryTool(resolvedQuery, requestCertificates);
        toolResult = certificateTool.text;
        certificateToolFilter = certificateTool.filter as Record<string, unknown>;
        const certificateAnswer = splitConciseFirstAgentSeaAnswer(toolResult);
        const certificateAssistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: certificateAnswer.content,
          supportingDetails: certificateAnswer.supportingDetails,
          timestamp: new Date(),
          contextSummary: `Downloaded certificate evidence • ${activeScopeLabel} • Booked and completed cruises excluded`,
          suggestedActions: buildAgentSuggestedActions(null, content),
          sourceReferences: [{
            id: `certificate-summary-${Date.now()}`,
            sourceType: 'certificate',
            label: 'Downloaded certificate sailing evidence',
            detail: `${certificateTool.optionIds.length.toLocaleString()} exact certificate option row(s) match this question.`,
            evidenceKind: 'fact',
            route: `/certificate-summary-results?filters=${encodeURIComponent(JSON.stringify(certificateToolFilter))}&title=${encodeURIComponent('Agent SEA certificate evidence')}`,
          }],
        };
        setMessages((current) => current.filter((message) => message.id !== loadingMessage.id).concat(certificateAssistantMessage));
        void persistConversation([...messages.filter((message) => !message.isLoading), userMessage, certificateAssistantMessage])
          .catch((saveError) => console.error('[AgentX] Failed to save certificate answer:', saveError));
        return;
      }

      const sourceQuestion = !devAssistantRequest && /\b(?:source|sources|provenance|evidence|what (?:data|information) (?:can|do) you (?:see|access)|where .*come from)\b/i.test(resolvedQuery);
      if (sourceQuestion) {
        const sourceManifest = agentSeaSourceManifest ?? buildAgentSeaSourceManifest({
          ownerId: provenanceOwner,
          cruises: filteredCruises,
          offers: filteredCasinoOffers,
          certificates: requestCertificates,
          certificateDocuments,
          bookedCruises: filteredBookedCruises,
          calendarEvents: filteredCalendarEvents,
          casinoRecords: scopedCasinoSessions,
          crewRecords: scopedCrewRecognitionEntries,
          weatherRecords: scopedWeatherReports,
          loyaltyRecords: [
            { id: 'club-royale-loyalty', program: 'clubRoyale', status: clubRoyaleTier, source: clubRoyalePointsSource, points: clubRoyalePoints, updatedAt: lastSyncDate },
            { id: 'blue-chip-loyalty', program: 'blueChip', status: blueChip.tier, source: 'provider-or-user', points: blueChip.points, updatedAt: lastSyncDate },
          ],
          financialRecords: [{ id: 'financial-summary', status: 'available', source: 'owner-local-calculation', ...financials.summary }],
          provenanceRecords: provenanceLinks,
          casinoCount: scopedCasinoSessions.length,
          crewCount: scopedCrewRecognitionEntries.length,
          weatherCount: scopedWeatherReports.length,
          provenanceLinks,
        });
        setAgentSeaSourceManifest(sourceManifest);
        const sourceAnswer = splitConciseFirstAgentSeaAnswer(executeAgentSeaSourceManifestTool(resolvedQuery, sourceManifest));
        const sourceAssistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: sourceAnswer.content,
          supportingDetails: sourceAnswer.supportingDetails,
          timestamp: new Date(),
          contextSummary: `On-demand source manifest • ${activeScopeLabel}`,
          sourceReferences: [],
        };
        setMessages((current) => current.filter((message) => message.id !== loadingMessage.id).concat(sourceAssistantMessage));
        void persistConversation([...messages.filter((message) => !message.isLoading), userMessage, sourceAssistantMessage])
          .catch((saveError) => console.error('[AgentX] Failed to save source answer:', saveError));
        return;
      }

      const catalogDateWindow = getAskMyDataDateWindow(resolvedQuery);
      const catalogSearchText = resolvedQuery
        .replace(/\b(?:next|this|calendar|month|available|availability|part|points?|levels?)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const toolCall = devAssistantRequest ? null : parseToolCall(resolvedQuery);
      const catalogPage = await queryCruises({
        providers: selectedBrand && selectedBrand !== 'all' && selectedBrand !== 'unknown' ? [selectedBrand] : undefined,
        search: catalogSearchText || undefined,
        searchAnyTerm: true,
        sailDateFrom: catalogDateWindow.sailDateFrom,
        sailDateTo: catalogDateWindow.sailDateTo,
        limit: 200,
      });
      if (catalogSearchRequest !== catalogSearchRequestRef.current) return;
      const broadCatalogPage = catalogPage.rows.length === 0 && (totalSourceCruises || totalCruises || totalOfferSailingRelationships) > 0
        ? await queryCruises({
            providers: selectedBrand && selectedBrand !== 'all' && selectedBrand !== 'unknown' ? [selectedBrand] : undefined,
            sailDateFrom: catalogDateWindow.sailDateFrom,
            sailDateTo: catalogDateWindow.sailDateTo,
            limit: 200,
            sortBy: 'sailDate',
            sortDirection: 'asc',
          })
        : null;
      if (catalogSearchRequest !== catalogSearchRequestRef.current) return;
      const catalogRows = broadCatalogPage ? broadCatalogPage.rows : catalogPage.rows;
      const queriedCatalogCruises = filterRecordsByIntelligence(catalogRows, sharedIntelligenceFilterSnapshot, users);
      const forceWeatherRefresh = !devAssistantRequest && isWeatherQuestion(resolvedQuery);
      const latestWeatherReports = scopedWeatherReports;
      if (forceWeatherRefresh) {
        // The local answer must never wait for a network weather refresh. The
        // provider updates its cache in the background for the next answer.
        void refreshWeatherReports({ force: forceWeatherRefresh });
      }

      if (toolCall) {
        console.log('[AgentX] Tool detected:', toolCall.tool);
        setMessages(prev => prev.map(m =>
          m.id === loadingMessage.id
            ? { ...m, toolName: toolCall.tool }
            : m
        ));
        // A typed deterministic answer (for example the downloaded-certificate
        // summary) is already the authoritative result. Do not overwrite it
        // with the broader semantic-search tool merely because the same words
        // also matched a legacy tool route.
        if (!toolResult) {
          toolResult = executeToolCall(toolCall.tool, toolCall.params, latestWeatherReports, queriedCatalogCruises);
        }
      }

      // Easy Seas answers from the complete local index first. This path is
      // deliberately independent of the optional cloud backup/backend and
      // avoids constructing or uploading a multi-megabyte raw-data prompt.
      const finishSearchDiagnostic = beginPerformanceSpan('AgentXProvider.askMyDataSearch', {
        cruisesLoadedIntoJS: queriedCatalogCruises.length + filteredBookedCruises.length,
        cruiseInventoryTotal: Math.max(catalogPage.total, broadCatalogPage?.total ?? 0),
        offers: filteredCasinoOffers.length,
        certificates: requestCertificates.length,
      });
      const localSearchResponse = askMyDataSearch({
        query: resolvedQuery,
        offers: filteredCasinoOffers,
        cruises: [...queriedCatalogCruises, ...filteredBookedCruises],
        certificates: requestCertificates,
        calendarEvents: filteredCalendarEvents,
        crewRecognitionEntries: scopedCrewRecognitionEntries,
        slotMachines: allMachines,
        weatherReports: latestWeatherReports,
        additionalContextBlocks: appWideContextBlocks,
        overview: askMyDataOverview,
      });
      const localAnswer = toolResult || formatAskMyDataResponse(localSearchResponse);
      const aiEvidenceWithProvenance = [localAnswer, agentSeaProvenanceBlock]
        .filter(Boolean)
        .join('\n\n');
      const aiResult = await generateAgentSeaAIResponse({
        authenticatedEmail,
        question: resolvedQuery,
        systemPrompt: buildSystemPrompt({
          allMachines,
          globalLibrary,
          myAtlasMachines,
          sessions: scopedCasinoSessions,
          deckMappings,
          machineLogs,
          certificates: requestCertificates,
          calendarEvents: filteredCalendarEvents,
          crewRecognitionEntries: scopedCrewRecognitionEntries,
          weatherReports: scopedWeatherReports,
          appContextBlocks: appWideContextBlocks,
          mode,
          brandProgramLabel,
        }),
        localEvidence: aiEvidenceWithProvenance,
        conversation: messages
          .filter((message) => !message.isLoading && message.content.trim().length > 0)
          .slice(-8)
          .map((message) => ({ role: message.role, content: message.content })),
        signal: activeRequest.signal,
      });
      if (activeRequest.signal.aborted || !visibleRef.current) return;
      // Evidence belongs behind the expandable disclosure. Offline/local mode
      // must remain just as readable as AI mode and must not dump the registry,
      // provenance block, or supporting rows into the primary chat bubble.
      const finalAnswer = aiResult.text || localAnswer;
      if (aiResult.error && aiResult.error !== 'AI key not configured') {
        console.warn('[Agent SEA AI] Using local answer after AI request failed:', aiResult.error);
      }
      finishSearchDiagnostic({ resultCharacters: finalAnswer.length });
      recordPerformanceCount('AgentXProvider.askMyDataIndexRows', queriedCatalogCruises.length, {
        bounded: true,
        cruiseInventoryTotal: Math.max(catalogPage.total, broadCatalogPage?.total ?? 0),
      });
      const localContext = `${aiResult.usedAI ? `AI reasoning (${aiResult.model}) + local evidence` : 'Local evidence'} • ${activeScopeLabel} • ${brandProgramLabel} • Archive/Review: ${archiveContextLabel}`;
      const plannedSourceSummary = `Sources included: ${questionPlan.sources.join(', ')}. ${questionPlan.certificateOnly ? 'Booked/completed cruise sources excluded because this was a certificate-inventory question.' : questionPlan.comparisonRequested ? 'Cross-source comparison requested.' : ''}`;
      const conciseAnswer = splitConciseFirstAgentSeaAnswer(finalAnswer);
      const localAssistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: conciseAnswer.content,
        supportingDetails: conciseAnswer.supportingDetails,
        timestamp: new Date(),
        contextSummary: `${localContext} • ${plannedSourceSummary}`,
        suggestedActions: buildAgentSuggestedActions(toolCall?.tool ?? null, content),
        sourceReferences: buildAskMyDataSourceReferences(localSearchResponse),
      };
      setMessages(prev => prev.filter(m => m.id !== loadingMessage.id).concat(localAssistantMessage));
      void persistConversation([...messages.filter((message) => !message.isLoading), userMessage, localAssistantMessage]).catch((saveError) => console.error('[AgentX] Failed to save conversation:', saveError));

      } catch (err) {
      if (activeRequest.signal.aborted || !visibleRef.current) {
        console.log('[AgentX] Ignoring cancelled or hidden Agent SEA request');
        return;
      }
      console.error('[AgentX] Error:', err);
      try {
        // Repository paging or the in-app AI call can fail while
        // the already-hydrated local datasets remain fully usable. Always make
        // a second, dependency-free Ask My Data pass through Agent SEA before showing an error.
        // This fallback deliberately does not call queryCruises again. If that
        // repository call caused the first error, repeating it would produce a
        // second failure and hide otherwise healthy in-memory Easy Seas data.
        const previousUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content;
        const fallbackQuery = buildAskMyDataConversationalQuery(content, previousUserMessage);
        const fallbackCatalogCruises = filterRecordsByIntelligence(filteredCruises, sharedIntelligenceFilterSnapshot, users).slice(0, 500);
        const fallbackResponse = askMyDataSearch({
          query: fallbackQuery,
          offers: filteredCasinoOffers,
          cruises: [...fallbackCatalogCruises, ...filteredBookedCruises],
          certificates: requestCertificates,
          calendarEvents: filteredCalendarEvents,
          crewRecognitionEntries: scopedCrewRecognitionEntries,
          slotMachines: allMachines,
          weatherReports: scopedWeatherReports,
          additionalContextBlocks: appWideContextBlocks,
          overview: askMyDataOverview,
        });
        const fallbackAnswer = splitConciseFirstAgentSeaAnswer(formatAskMyDataResponse(fallbackResponse));
        const fallbackMessage: ChatMessage = {
          id: `assistant-local-fallback-${Date.now()}`,
          role: 'assistant',
          content: fallbackAnswer.content,
          supportingDetails: fallbackAnswer.supportingDetails,
          timestamp: new Date(),
          contextSummary: `Agent SEA local fallback evidence • ${activeScopeLabel} • ${brandProgramLabel} • Archive/Review: ${archiveContextLabel}`,
          sourceReferences: buildAskMyDataSourceReferences(fallbackResponse),
        };
        setError(null);
        setMessages(prev => prev.filter(m => m.id !== loadingMessage.id).concat(fallbackMessage));
        void persistConversation([...messages.filter((message) => !message.isLoading), userMessage, fallbackMessage]).catch((saveError) => console.error('[AgentX] Failed to save local fallback conversation:', saveError));
      } catch (fallbackError) {
        console.error('[AgentX] Local fallback also failed:', fallbackError);
        setError(fallbackError instanceof Error ? fallbackError.message : 'Local data search failed');
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Agent SEA could not read the local data index for this request. Your saved data remains intact. Active context: ${AGENT_MODE_LABELS[mode]} • ${activeScopeLabel} • ${brandProgramLabel}.`,
          timestamp: new Date(),
          contextSummary: `Context: ${AGENT_MODE_LABELS[mode]} • ${activeScopeLabel} • ${brandProgramLabel} • Archive/Review: ${archiveContextLabel}`,
        };
        setMessages(prev => prev.filter(m => m.id !== loadingMessage.id).concat(errorMessage));
        void persistConversation([...messages.filter((message) => !message.isLoading), userMessage, errorMessage]).catch((saveError) => console.error('[AgentX] Failed to save failed conversation:', saveError));
      }
    } finally {
      if (activeAIRequestRef.current === activeRequest) {
        activeAIRequestRef.current = null;
        setIsLoading(false);
      }
    }
  }, [messages, tier, isAdmin, authenticatedEmail, toolContext, executeToolCall, refreshWeatherReports, scopedWeatherReports, allMachines, globalLibrary, myAtlasMachines, scopedCasinoSessions, deckMappings, machineLogs, filteredCertificates, filteredCalendarEvents, scopedCrewRecognitionEntries, filteredCasinoOffers, filteredCruises, filteredBookedCruises, appWideContextBlocks, mode, selectedProfileLabel, selectedBrand, selectedProgram, activeScopeLabel, brandProgramLabel, archiveContextLabel, askMyDataOverview, sharedIntelligenceFilterSnapshot, persistConversation, queryCruises, totalCruises, totalOfferSailingRelationships, totalSourceCruises, users, agentSeaSourceManifest, agentSeaProvenanceBlock, loadSearchableCertificates, clubRoyalePoints, clubRoyaleTier, clubRoyalePointsSource, crownAnchorPoints, crownAnchorLevel, blueChip]);

  const clearMessages = useCallback(() => {
    console.log('[AgentX] Clearing messages');
    cancelActiveRequest();
    setMessages([]);
    setError(null);
  }, [cancelActiveRequest]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const toggleVisible = useCallback(() => {
    setIsVisible(prev => !prev);
  }, []);

  const setVisibleState = useCallback((visible: boolean) => {
    visibleRef.current = visible;
    if (!visible) {
      cancelActiveRequest();
    }
    setIsVisible(visible);
  }, [cancelActiveRequest]);

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
    conversationThreads,
    activeConversationId,
    startNewConversation,
    openConversation,
    renameConversation,
    archiveConversation,
    confirmAgentAction,
    cancelAgentAction,
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
    conversationThreads,
    activeConversationId,
    startNewConversation,
    openConversation,
    renameConversation,
    archiveConversation,
    confirmAgentAction,
    cancelAgentAction,
  ]);
});
