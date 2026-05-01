import { useState, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { generateText } from '@rork-ai/toolkit-sdk';
import { useCoreData } from './CoreDataProvider';
import { useLoyalty } from './LoyaltyProvider';
import type { ChatMessage } from '@/components/AgentXChat';
import type { AgentXMode } from '@/types/models';
import { askMyDataSearch, formatAskMyDataResponse } from '@/lib/askMyData';
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

function buildSystemPrompt(context: { globalLibrary?: any[], myAtlasMachines?: any[], sessions?: any[], deckMappings?: any[], machineLogs?: any[], certificates?: any[], mode: AgentXMode; brandProgramLabel: string }): string {
  return `You are the Ask My Data assistant in ${AGENT_MODE_LABELS[context.mode]} mode, an intelligent cruise and casino advisor for Easy Seas users managing Royal Caribbean / Club Royale and Celebrity / Blue Chip casino cruise data. The active casino system is: ${context.brandProgramLabel}. You help users:
- Search and filter available cruises
- Analyze bookings and calculate ROI
- Track casino program tier progress using the selected Royal/Celebrity scope
- Optimize their cruise portfolio for maximum points and value
- Understand casino offers and their values
- Identify which certificate levels match specific ships or sailing dates
- Recommend slot machines on specific ships for advantage play (AP) and optimal returns
- Analyze slot machine session data and performance
- Track machine locations and condition logs on specific ships
- Provide careful educational guidance about offer math, certificates, loyalty, and responsible use

You have FULL ACCESS to:
1. **Cruise Data**: All available cruises, booked cruises, casino offers, tier information
2. **Slot Machine Library**: ${context.globalLibrary?.length || 0} total machines in permanent database, including ${context.myAtlasMachines?.length || 0} machines in user's personal Atlas
3. **Casino Sessions**: ${context.sessions?.length || 0} tracked sessions
4. **Deck Plans**: ${context.deckMappings?.length || 0} machine location mappings across ships
5. **Machine Condition Logs**: ${context.machineLogs?.length || 0} Machine Atlas observations
6. **Certificates**: ${context.certificates?.length || 0} certificate records

Mode guidance:
- Travel Agent: prioritize itinerary, cabin, dates, route, ports, and booking practicality.
- Casino Host: prioritize offer value, casino-paid value, FreePlay/OBC, and responsible play guidance.
- Certificate Advisor: prioritize certificate fit, cautious stacking notes, expirations, and terms verification.
- Loyalty Strategist: prioritize tier points, progress, milestones, and realistic earning paths.
- AP Scout: prioritize machine condition logs, persistence, meters, jackpot conditions, and play/pass/watch decisions.
- Calendar Planner: prioritize agenda dates, sailing days, expirations, travel gaps, and conflicts.
- Import Auditor: prioritize source, profile ownership, reconciliation, missing rows, duplicates, and review-needed records.
- EasySeas Guide: prioritize app tutorials, cruise casino basics, offer math, certificates, and responsible-use education.

Key formulas:
- Points: 1 point per $5 coin-in
- ROI = (Retail Value + Winnings - Out of Pocket) / Out of Pocket × 100%
- Cabin Value = Cabin Price × 2 (double occupancy) + Taxes & Fees`;
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

function parseToolCall(message: string): { tool: string; params: unknown } | null {
  const askDataMatch = message.match(/ask my data|search my data|find in my data|search everything|global search|natural language search|show me.*data|what .* do i have|which .* do i have/i);
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

  if (askDataMatch) {
    return { tool: 'askMyData', params: { query: message } };
  }

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
  const { isAdmin } = useAuth();
  const { cruises, bookedCruises, casinoOffers, calendarEvents, filters } = useCoreData();
  const { users } = useUser();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const { clubRoyalePoints, clubRoyaleTier } = useLoyalty();
  const { allMachines } = useSlotMachines();
  const { myAtlasMachines, globalLibrary, encyclopedia } = useSlotMachineLibrary();
  const { mappings: deckMappings } = useDeckPlan();
  const { sessions, getSessionAnalytics, getMachineAnalytics } = useCasinoSessions();
  const { certificates } = useCertificates();
  const { logs: machineLogs } = useMachineConditionLogs();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AgentXMode>('travelAgent');

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
  const filteredCertificates = useMemo(() => filterRecordsByIntelligence(certificates, intelligenceFilterSnapshot, users), [certificates, intelligenceFilterSnapshot, users]);
  const archiveContextLabel = useMemo(() => {
    const archivedOrSkippedOffers = filteredCasinoOffers.filter((offer) => offer.status === 'archived' || offer.status === 'skipped' || offer.archiveStatus === 'archived' || offer.archiveStatus === 'replaced').length;
    const reviewNeededOffers = filteredCasinoOffers.filter((offer) => offer.status === 'reviewNeeded' || offer.archiveStatus === 'reviewNeeded' || offer.reconciliationStatus === 'reviewNeeded' || offer.importStatus === 'reviewNeeded' || offer.importStatus === 'unassigned').length;
    return `${archivedOrSkippedOffers} archived/skipped offer(s), ${reviewNeededOffers} review-needed offer(s)`;
  }, [filteredCasinoOffers]);

  const toolContext = useMemo((): AgentToolContext => {
    console.log('[AgentX] Recalculating toolContext with latest data...');
    
    console.log('[AgentX] Current state:', {
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
      mode,
      filters,
      selectedProfileLabel,
      selectedBrand,
      selectedProgram,
      activeScopeLabel,
      brandProgramLabel,
      archiveContextLabel,
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
  }, [filteredCruises, filteredBookedCruises, filteredCasinoOffers, clubRoyalePoints, clubRoyaleTier, allMachines, myAtlasMachines, globalLibrary, encyclopedia, deckMappings, sessions, getSessionAnalytics, getMachineAnalytics, certificates.length, machineLogs.length, mode, filters, selectedProfileLabel, selectedBrand, selectedProgram, activeScopeLabel, brandProgramLabel, archiveContextLabel]);

  const executeToolCall = useCallback((tool: string, params: unknown): string => {
    console.log('[AgentX] Executing tool:', tool, params);
    
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
        const response = askMyDataSearch({ query, offers: filteredCasinoOffers, cruises: [...filteredCruises, ...filteredBookedCruises], certificates: filteredCertificates, calendarEvents: filteredCalendarEvents });
        return formatAskMyDataResponse(response);
      }
      default:
        return `Unknown tool: ${tool}`;
    }
  }, [toolContext, filteredCasinoOffers, filteredCruises, filteredBookedCruises, filteredCertificates, filteredCalendarEvents]);

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
      
      let toolResult = '';
      if (toolCall) {
        console.log('[AgentX] Tool detected:', toolCall.tool);
        
        setMessages(prev => prev.map(m => 
          m.id === loadingMessage.id 
            ? { ...m, toolName: toolCall.tool }
            : m
        ));
        
        toolResult = executeToolCall(toolCall.tool, toolCall.params);
      }
      
      // Get all completed cruises (by state OR by return date being in the past)
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
      
      // Calculate total earned points from completed cruises
      const totalEarnedPoints = completedCruises.reduce((sum, c) => 
        sum + (c.earnedPoints || c.casinoPoints || 0), 0
      );
      
      // Build a summary of completed cruises with points
      const completedWithPoints = completedCruises
        .filter(c => c.earnedPoints || c.casinoPoints)
        .map(c => `${c.shipName} (${c.sailDate}): ${(c.earnedPoints || c.casinoPoints || 0).toLocaleString()} pts`)
        .join('\n  ');
      
      console.log('[AgentX] Building context for AI with:', {
        tier: toolContext.currentTier,
        points: toolContext.userPoints,
        completedCruises: completedCruises.length,
        upcomingCruises: upcomingCruises.length,
        totalEarnedPoints,
      });
      
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
- Active Profile Scope: ${selectedProfileLabel}
- Active Brand Scope: ${getBrandLabel(selectedBrand)}
- Active Program Scope: ${getProgramLabel(selectedProgram)}
- Active Casino System: ${brandProgramLabel}
- Archive / Review Context: ${archiveContextLabel}

Completed Cruises with Points Earned:
  ${completedWithPoints || 'No points data recorded for completed cruises'}

CRITICAL: The user has EXACTLY ${toolContext.userPoints.toLocaleString()} casino program points in the active Royal/Celebrity scope and is in ${toolContext.currentTier} tier. They have earned ${totalEarnedPoints.toLocaleString()} points from ${completedCruises.length} completed cruises. These numbers are from the live system. Use ONLY these values, not any cached or outdated information.
`;

      const systemPrompt = devAssistantRequest
        ? buildDevAssistantSystemPrompt()
        : buildSystemPrompt({
            globalLibrary,
            myAtlasMachines,
            sessions,
            deckMappings,
            machineLogs,
            certificates: filteredCertificates,
            mode,
            brandProgramLabel,
          });
      
      const messagesForAI = devAssistantRequest
        ? [
            { role: 'user' as const, content: systemPrompt },
            ...messages.slice(-6).map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
            {
              role: 'user' as const,
              content: `Help me with this development request:\n\n${content}`,
            },
          ]
        : [
            { role: 'user' as const, content: `${systemPrompt}\n\n${contextInfo}` },
            ...messages.slice(-6).map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
            { 
              role: 'user' as const, 
              content: toolResult 
                ? `Ask My Data mode: ${AGENT_MODE_LABELS[mode]}\nActive context: ${activeScopeLabel}\nArchive/review context: ${archiveContextLabel}\nUser asked: "${content}"\n\nTool result:\n${toolResult}\n\nPlease summarize this information in a helpful, conversational way. Start by confirming the active profile, brand/program, mode, and archive/review context. Highlight the most important points and name the data source used.`
                : `Ask My Data mode: ${AGENT_MODE_LABELS[mode]}\nActive context: ${activeScopeLabel}\nArchive/review context: ${archiveContextLabel}\nUser asked: "${content}"\n\nPlease provide a helpful response based on the user's cruise data, active profile/filter context, selected mode, and archive/review context. Start by confirming the active profile, brand/program, mode, and archive/review context.`
            },
          ];
      
      const aiResponse = await generateText({ messages: messagesForAI });
      
      const contextConfirmation = `Context: ${AGENT_MODE_LABELS[mode]} • ${activeScopeLabel} • ${brandProgramLabel} • Archive/Review: ${archiveContextLabel}`;
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: toolResult 
          ? `${contextConfirmation}\n\n${toolResult}\n\n---\n\n${aiResponse}` 
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
        content: 'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.',
        timestamp: new Date(),
        contextSummary: `Context: ${AGENT_MODE_LABELS[mode]} • ${activeScopeLabel} • ${brandProgramLabel} • Archive/Review: ${archiveContextLabel}`,
      };
      
      setMessages(prev => prev.filter(m => m.id !== loadingMessage.id).concat(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [messages, tier, isAdmin, toolContext, executeToolCall, globalLibrary, myAtlasMachines, sessions, deckMappings, machineLogs, filteredCertificates, mode, selectedProfileLabel, selectedBrand, selectedProgram, activeScopeLabel, brandProgramLabel, archiveContextLabel]);

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
    await sendMessage('Provide a comprehensive analysis of my cruise performance for the last 90 days including points earned, tier progress, and recommendations.');
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
