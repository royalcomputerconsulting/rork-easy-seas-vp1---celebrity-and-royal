import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Ship,
  TrendingUp,
  Award,
  Gift,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  toolName?: string;
  toolInput?: unknown;
}

interface AgentXChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClose?: () => void;
  showHeader?: boolean;
  placeholder?: string;
}

const QUICK_ACTIONS = [
  { id: 'search', label: 'Search Cruises', icon: Ship, prompt: 'Search for available cruises' },
  { id: 'tier', label: 'Tier Progress', icon: Award, prompt: 'Show my tier progress to Signature' },
  { id: 'optimize', label: 'Optimize', icon: TrendingUp, prompt: 'Recommend cruises to maximize my points' },
  { id: 'offers', label: 'Offers', icon: Gift, prompt: 'Show expiring offers' },
];

export function AgentXChat({
  messages,
  onSendMessage,
  isLoading = false,
  isExpanded = false,
  onToggleExpand,
  onClose,
  showHeader = true,
  placeholder = 'Ask Agent X anything about cruises...',
}: AgentXChatProps) {
  const [inputText, setInputText] = useState('');
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (trimmed && !isLoading) {
      console.log('[AgentXChat] Sending message:', trimmed);
      onSendMessage(trimmed);
      setInputText('');
    }
  }, [inputText, isLoading, onSendMessage]);

  const handleQuickAction = useCallback((prompt: string) => {
    console.log('[AgentXChat] Quick action:', prompt);
    onSendMessage(prompt);
  }, [onSendMessage]);

  const renderMessage = useCallback((message: ChatMessage, index: number) => {
    const isUser = message.role === 'user';
    

    return (
      <Animated.View
        key={message.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
          { opacity: fadeAnim },
        ]}
      >
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          {!isUser && (
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={[COLORS.goldAccent, COLORS.beigeWarm]}
                style={styles.avatarGradient}
              >
                <Bot size={16} color={COLORS.navyDeep} />
              </LinearGradient>
            </View>
          )}
          
          <View style={[styles.messageContent, isUser && styles.userMessageContent]}>
            {message.isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.navyDeep} />
                <Text style={styles.loadingText}>
                  {message.toolName ? `Running ${message.toolName}...` : 'Thinking...'}
                </Text>
              </View>
            ) : (
              <ScrollView 
                style={styles.messageScrollView}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                <Text style={[styles.messageText, isUser && styles.userMessageText]}>
                  {message.content}
                </Text>
              </ScrollView>
            )}
            
            <Text style={[styles.timestamp, isUser && styles.userTimestamp]}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          
          {isUser && (
            <View style={styles.userAvatarContainer}>
              <User size={16} color={COLORS.white} />
            </View>
          )}
        </View>
      </Animated.View>
    );
  }, [fadeAnim]);

  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeIconContainer}>
        <LinearGradient
          colors={[COLORS.goldAccent, COLORS.beigeWarm]}
          style={styles.welcomeIconGradient}
        >
          <Sparkles size={32} color={COLORS.navyDeep} />
        </LinearGradient>
      </View>
      
      <Text style={styles.welcomeTitle}>Agent X</Text>
      <Text style={styles.welcomeSubtitle}>
        Your intelligent cruise advisor. Ask me anything about cruises, offers, tier progress, or portfolio optimization.
      </Text>
      
      <View style={styles.quickActionsContainer}>
        <Text style={styles.quickActionsLabel}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.quickActionButton}
              onPress={() => handleQuickAction(action.prompt)}
              activeOpacity={0.7}
            >
              <View
                style={styles.quickActionGradient}
              >
                <action.icon size={18} color={COLORS.white} />
                <Text style={styles.quickActionText}>{action.label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, isExpanded && styles.containerExpanded]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <LinearGradient
        colors={['#E0F2FE', '#DBEAFE', '#E0F7FA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={{ paddingTop: insets.top }}>
      
      {showHeader && (
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconContainer}>
                <Bot size={20} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Agent X</Text>
                <Text style={styles.headerSubtitle}>Cruise Intelligence</Text>
              </View>
            </View>
            
            <View style={styles.headerActions}>
              {onToggleExpand && (
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={onToggleExpand}
                  activeOpacity={0.7}
                >
                  {isExpanded ? (
                    <Minimize2 size={20} color={COLORS.navyDeep} />
                  ) : (
                    <Maximize2 size={20} color={COLORS.navyDeep} />
                  )}
                </TouchableOpacity>
              )}
              {onClose && (
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <X size={20} color={COLORS.navyDeep} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? renderWelcome() : messages.map(renderMessage)}
      </ScrollView>
      
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : SPACING.md }]}>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textSecondary}
            multiline
            maxLength={1000}
            editable={!isLoading}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Send size={20} color={inputText.trim() ? COLORS.white : 'rgba(255,255,255,0.5)'} />
            )}
          </TouchableOpacity>
        </View>
        
        <Text style={styles.disclaimer}>
          Agent X uses AI to provide cruise recommendations. Verify important details.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  containerExpanded: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 31, 63, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.navyDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    opacity: 0.7,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  welcomeIconContainer: {
    marginBottom: SPACING.md,
  },
  welcomeIconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: TYPOGRAPHY.fontSizeHeader,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.sm,
  },
  welcomeSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  quickActionsContainer: {
    width: '100%',
  },
  quickActionsLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    justifyContent: 'center',
  },
  quickActionButton: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.navyDeep,
    backgroundColor: COLORS.navyDeep,
  },
  quickActionText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  messageContainer: {
    marginBottom: SPACING.md,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    flexDirection: 'row',
    maxWidth: '95%',
    gap: SPACING.xs,
  },
  userBubble: {
    flexDirection: 'row-reverse',
  },
  assistantBubble: {
    flexDirection: 'row',
  },
  avatarContainer: {
    alignSelf: 'flex-end',
  },
  avatarGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarContainer: {
    alignSelf: 'flex-end',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.navyDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
    maxWidth: '100%',
    flex: 1,
  },
  messageScrollView: {
    maxHeight: 200,
  },
  userMessageContent: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  messageText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    lineHeight: 22,
  },
  userMessageText: {
    color: COLORS.white,
  },
  timestamp: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    opacity: 0.5,
    marginTop: SPACING.xs,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontStyle: 'italic',
  },
  inputContainer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 31, 63, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.sm : 0,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
  },
  textInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    maxHeight: 100,
    paddingVertical: SPACING.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.navyDeep,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 0 : SPACING.xs,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(30, 58, 95, 0.3)',
  },
  disclaimer: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    textAlign: 'center',
    marginTop: SPACING.sm,
    opacity: 0.6,
  },
});
