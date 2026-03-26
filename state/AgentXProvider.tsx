import { useState, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { generateText } from '@rork-ai/toolkit-sdk';
import { useCoreData } from './CoreDataProvider';
import { useLoyalty } from './LoyaltyProvider';
import type { ChatMessage } from '@/components/AgentXChat';
import {
  AgentToolContext,
  executeCruiseSearch,
  executeBookingAnalysis,
  executePortfolioOptimizer,
  executeTierProgress,
  executeOfferAnalysis,
  executeRecommendations,
  executeMachineRecommendations,
  CruiseSearchInput,
  BookingAnalysisInput,
  PortfolioOptimizerInput,
  TierProgressInput,
  OfferAnalysisInput,
  RecommendationInput,
  MachineRecommendationInput,
} from '@/lib/agentTools';
import { useSlotMachines } from './SlotMachineProvider';
import { useSlotMachineLibrary } from './SlotMachineLibraryProvider';
import { useDeckPlan } from './DeckPlanProvider';
import { useCasinoSessions } from './CasinoSessionProvider';
import { useEntitlement } from './EntitlementProvider';

interface AgentXState {
  messages: ChatMessage[];
  isLoading: boolean;
  isExpanded: boolean;
  isVisible: boolean;
  error: string | null;
  
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  toggleExpanded: () => void;
  toggleVisible: () => void;
  setVisible: (visible: boolean) => void;
  refreshAnalysis: () => Promise<void>;
}

function buildSystemPrompt(context: { globalLibrary?: any[], myAtlasMachines?: any[], sessions?: any[], deckMappings?: any[] }): string {
  return `You are Agent X, an intelligent cruise and casino advisor for Royal Caribbean Club Royale casino cruisers. You help users:
- Search and filter available cruises
- Analyze bookings and calculate ROI
- Track Club Royale tier progress (Choice, Prime, Signature, Masters)
- Optimize their cruise portfolio for maximum points and value
- Understand casino offers and their values
- Recommend slot machines on specific ships for advantage play (AP) and optimal returns
- Analyze slot machine session data and performance
- Track machine locations on specific ships via deck plans
- Provide insights on machine win/loss patterns and player statistics

You have FULL ACCESS to:
1. **Cruise Data**: All available cruises, booked cruises, casino offers, tier information
2. **Slot Machine Library**: ${context.globalLibrary?.length || 0} total machines in permanent database, including:
   - ${context.myAtlasMachines?.length || 0} machines in user's personal Atlas
   - Machine details: manufacturer, volatility, cabinet type, AP potential
   - Ship-specific machine locations and notes
3. **Casino Sessions**: ${context.sessions?.length || 0} tracked sessions with:
   - Win/loss records per machine
   - Session duration and denomination tracking
   - Machine performance analytics and ROI
4. **Deck Plans**: ${context.deckMappings?.length || 0} machine location mappings across ships
   - Exact deck, zone, and slot positions
   - Ship-specific machine availability

When users ask about slot machines, you can:
- Search the entire permanent database (300+ machines)
- Recommend machines based on session history and performance
- Analyze win/loss patterns for specific machines
- Show machine locations on specific ships
- Compare machine performance across sessions
- Suggest optimal machines based on user's playing history

Key formulas to remember:
- Points: 1 point per $5 coin-in
- ROI = (Retail Value + Winnings - Out of Pocket) / Out of Pocket × 100%
- Cabin Value = Cabin Price × 2 (double occupancy) + Taxes & Fees

Current tier thresholds:
- Choice: 0-2,500 points
- Prime: 2,501-25,000 points
- Signature: 25,001-100,000 points
- Masters: 100,001+ points

Slot Machine Advantage Play:
- Look for machines with True Persistence or Must-Hit-By features
- Consider volatility, denomination, and ship-specific placement
- Check entry/exit conditions for optimal AP opportunities
- Use session data to identify hot/cold machines
- Analyze player ROI and win rates per machine`;
}

function parseToolCall(message: string): { tool: string; params: unknown } | null {
  const searchMatch = message.match(/search.*cruise|find.*cruise|available.*cruise|cruise.*search/i);
  const tierMatch = message.match(/tier.*progress|progress.*tier|points.*tier|signature|masters|pinnacle/i);
  const recommendMatch = message.match(/recommend.*for.*me|for.*you|best.*for.*me|suggest.*for.*me|what.*should.*book|which.*cruise|recommended/i);
  const optimizeMatch = message.match(/optimize|maximize.*points|maximize.*value/i);
  const analyzeMatch = message.match(/analyze|roi|value.*breakdown|portfolio.*summary/i);
  const offerMatch = message.match(/offer|expiring|freeplay|trade.*in|casino.*offer/i);
  const machineMatch = message.match(/slot.*machine|machine.*recommend|what.*machine|which.*machine|slot.*play|best.*machine|machine.*on|ap.*machine|advantage.*play/i);

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

export const [AgentXProvider, useAgentX] = createContextHook((): AgentXState => {
  const { tier } = useEntitlement();
  const { cruises, bookedCruises, casinoOffers } = useCoreData();
  const { clubRoyalePoints, clubRoyaleTier } = useLoyalty();
  const { allMachines } = useSlotMachines();
  const { myAtlasMachines, globalLibrary, encyclopedia } = useSlotMachineLibrary();
  const { mappings: deckMappings } = useDeckPlan();
  const { sessions, getSessionAnalytics, getMachineAnalytics } = useCasinoSessions();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toolContext = useMemo((): AgentToolContext => {
    console.log('[AgentX] Recalculating toolContext with latest data...');
    
    console.log('[AgentX] Current state:', {
      bookedCruises: bookedCruises.length,
      clubRoyalePoints,
      clubRoyaleTier,
      slotMachines: allMachines.length,
      myAtlasMachines: myAtlasMachines.length,
      globalLibrary: globalLibrary.length,
      sessions: sessions.length,
      deckMappings: deckMappings.length,
    });
    
    return {
      cruises,
      bookedCruises,
      offers: casinoOffers,
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
  }, [cruises, bookedCruises, casinoOffers, clubRoyalePoints, clubRoyaleTier, allMachines, myAtlasMachines, globalLibrary, encyclopedia, deckMappings, sessions, getSessionAnalytics, getMachineAnalytics]);

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
      case 'getRecommendations':
        return executeRecommendations(params as RecommendationInput, toolContext);
      case 'recommendMachines':
        return executeMachineRecommendations(params as MachineRecommendationInput, toolContext);
      default:
        return `Unknown tool: ${tool}`;
    }
  }, [toolContext]);

  const sendMessage = useCallback(async (content: string) => {
    console.log('[AgentX] User message:', content);
    
    if (tier !== 'pro') {
      console.log('[AgentX] Access denied. Tier:', tier);
      const deniedMessage: ChatMessage = {
        id: `denied-${Date.now()}`,
        role: 'assistant',
        content: 'Agent X is a Pro-only feature. Upgrade to Pro to access AI-powered cruise analysis and recommendations.',
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
      const toolCall = parseToolCall(content);
      
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

Completed Cruises with Points Earned:
  ${completedWithPoints || 'No points data recorded for completed cruises'}

CRITICAL: The user has EXACTLY ${toolContext.userPoints.toLocaleString()} Club Royale points and is in ${toolContext.currentTier} tier. They have earned ${totalEarnedPoints.toLocaleString()} points from ${completedCruises.length} completed cruises. These numbers are from the live system. Use ONLY these values, not any cached or outdated information.
`;

      const systemPrompt = buildSystemPrompt({
        globalLibrary,
        myAtlasMachines,
        sessions,
        deckMappings,
      });
      
      const messagesForAI = [
        { role: 'user' as const, content: `${systemPrompt}\n\n${contextInfo}` },
        ...messages.slice(-6).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { 
          role: 'user' as const, 
          content: toolResult 
            ? `User asked: "${content}"\n\nTool result:\n${toolResult}\n\nPlease summarize this information in a helpful, conversational way. Highlight the most important points.`
            : `User asked: "${content}"\n\nPlease provide a helpful response based on the user's cruise data and context.`
        },
      ];
      
      const aiResponse = await generateText({ messages: messagesForAI });
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: toolResult 
          ? `${toolResult}\n\n---\n\n${aiResponse}` 
          : aiResponse,
        timestamp: new Date(),
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
      };
      
      setMessages(prev => prev.filter(m => m.id !== loadingMessage.id).concat(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [messages, toolContext, executeToolCall, globalLibrary, myAtlasMachines, sessions, deckMappings]);

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

  return {
    messages,
    isLoading,
    isExpanded,
    isVisible,
    error,
    sendMessage,
    clearMessages,
    toggleExpanded,
    toggleVisible,
    setVisible: setVisibleState,
    refreshAnalysis,
  };
});
