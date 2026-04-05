import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import {
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
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Cpu,
  Workflow,
  Radio,
  SlidersHorizontal,
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

const STT_ENDPOINT = 'https://toolkit.rork.com/stt/transcribe/';

const QUICK_ACTIONS = [
  { id: 'search', label: 'Search Cruises', icon: Ship, prompt: 'Search for available cruises' },
  { id: 'tier', label: 'Tier Progress', icon: Award, prompt: 'Show my tier progress to Signature' },
  { id: 'optimize', label: 'Optimize', icon: TrendingUp, prompt: 'Recommend cruises to maximize my points' },
  { id: 'offers', label: 'Offers', icon: Gift, prompt: 'Show expiring offers' },
];

const DEV_ASSISTANT_CAPABILITIES = [
  {
    id: 'prompt-dev',
    icon: Cpu,
    label: 'App Structure',
    desc: 'Generate initial app scaffolding',
    prompt: 'I want to build a voice-enabled assistant app. Help me design the initial app structure with conversational AI capabilities. Include the recommended file structure, key components needed (voice input, chat interface, response display), navigation flow, and state management approach. Outline the architecture for both the frontend UI and the backend integration points.',
  },
  {
    id: 'api-integration',
    icon: Workflow,
    label: 'API Integration',
    desc: 'Connect LLMs & voice APIs',
    prompt: 'Help me integrate external AI APIs into my app for conversational logic. I need guidance on: 1) Connecting to LLMs like GPT-4o or Anthropic Claude for natural language understanding, 2) Setting up voice-to-text and text-to-speech pipelines, 3) Managing API keys securely, 4) Structuring the request/response flow between the app and AI services, and 5) Handling streaming responses for real-time conversational feel.',
  },
  {
    id: 'websocket',
    icon: Radio,
    label: 'Real-Time Audio',
    desc: 'WebSocket streaming setup',
    prompt: 'I need to set up WebSocket communication for real-time audio streaming between my app and a backend service. Walk me through: 1) Establishing a persistent WebSocket connection for bidirectional audio data, 2) Capturing and encoding audio from the device microphone in real-time, 3) Streaming audio chunks to the server for processing, 4) Receiving and playing back AI-generated audio responses, and 5) Handling connection lifecycle, reconnection logic, and error states gracefully.',
  },
  {
    id: 'refinement',
    icon: SlidersHorizontal,
    label: 'Persona & Tone',
    desc: 'Customize AI behavior',
    prompt: 'Help me refine my AI assistant\'s persona, features, and conversational tone. I want to: 1) Define a custom system prompt that shapes the AI\'s personality and expertise, 2) Configure response style (formal vs casual, verbose vs concise), 3) Add domain-specific knowledge and constraints, 4) Set up conversation memory and context management, and 5) Create customizable settings so users can adjust the AI\'s behavior. Provide specific examples of system prompts and configuration patterns.',
  },
];

async function transcribeAudioNative(uri: string): Promise<string> {
  console.log('[AgentXChat] Transcribing audio from URI:', uri);
  const uriParts = uri.split('.');
  const fileType = uriParts[uriParts.length - 1];

  const audioFile = {
    uri,
    name: 'recording.' + fileType,
    type: 'audio/' + fileType,
  };

  const formData = new FormData();
  formData.append('audio', audioFile as unknown as Blob);

  const response = await fetch(STT_ENDPOINT, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`STT request failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('[AgentXChat] STT result:', data);
  return data.text || '';
}

async function transcribeAudioWeb(blob: Blob): Promise<string> {
  console.log('[AgentXChat] Transcribing audio blob for web');
  const formData = new FormData();
  formData.append('audio', blob, 'recording.webm');

  const response = await fetch(STT_ENDPOINT, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`STT request failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('[AgentXChat] STT result:', data);
  return data.text || '';
}

export const AgentXChat = React.memo(function AgentXChat({
  messages,
  onSendMessage,
  isLoading = false,
  isExpanded = false,
  onToggleExpand,
  onClose,
  showHeader = true,
  placeholder = 'Ask about cruises, tier progress, offers...',
}: AgentXChatProps) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lastSpokenMessageRef = useRef<string | null>(null);

  const speakText = useCallback((text: string) => {
    const cleanText = text
      .replace(/---/g, '')
      .replace(/\*\*/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/[•-]\s/g, '')
      .replace(/#+\s/g, '')
      .slice(0, 3000);

    console.log('[AgentXChat] Speaking text, length:', cleanText.length);
    void Speech.stop();
    setIsSpeaking(true);
    Speech.speak(cleanText, {
      language: 'en-US',
      rate: 1.0,
      pitch: 1.0,
      onDone: () => {
        console.log('[AgentXChat] TTS finished');
        setIsSpeaking(false);
      },
      onError: (err) => {
        console.error('[AgentXChat] TTS error:', err);
        setIsSpeaking(false);
      },
      onStopped: () => {
        setIsSpeaking(false);
      },
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    void Speech.stop();
    setIsSpeaking(false);
  }, []);

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

  useEffect(() => {
    if (!ttsEnabled) return;
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage &&
      lastMessage.role === 'assistant' &&
      !lastMessage.isLoading &&
      lastMessage.content &&
      lastMessage.id !== lastSpokenMessageRef.current
    ) {
      lastSpokenMessageRef.current = lastMessage.id;
      speakText(lastMessage.content);
    }
  }, [messages, ttsEnabled, speakText]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const toggleTts = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
    }
    setTtsEnabled((prev: boolean) => !prev);
  }, [isSpeaking, stopSpeaking]);

  const startRecordingNative = useCallback(async () => {
    try {
      console.log('[AgentXChat] Requesting audio permissions...');
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Microphone access is needed for voice input.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: 1,
          audioQuality: 127,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      console.log('[AgentXChat] Recording started (native)');
    } catch (err) {
      console.error('[AgentXChat] Failed to start recording:', err);
      Alert.alert('Recording Error', 'Could not start voice recording. Please try again.');
    }
  }, []);

  const stopRecordingNative = useCallback(async () => {
    try {
      const recording = recordingRef.current;
      if (!recording) return;

      console.log('[AgentXChat] Stopping recording (native)...');
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) {
        console.error('[AgentXChat] No recording URI');
        return;
      }

      setIsTranscribing(true);
      const text = await transcribeAudioNative(uri);
      setIsTranscribing(false);

      if (text.trim()) {
        console.log('[AgentXChat] Transcribed text:', text);
        onSendMessage(text.trim());
      } else {
        Alert.alert('No Speech Detected', 'Could not understand the audio. Please try again.');
      }
    } catch (err) {
      console.error('[AgentXChat] Error stopping recording:', err);
      setIsRecording(false);
      setIsTranscribing(false);
      Alert.alert('Transcription Error', 'Failed to process your voice. Please try again.');
    }
  }, [onSendMessage]);

  const startRecordingWeb = useCallback(async () => {
    try {
      console.log('[AgentXChat] Starting web recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      console.log('[AgentXChat] Recording started (web)');
    } catch (err) {
      console.error('[AgentXChat] Web recording error:', err);
      Alert.alert('Microphone Error', 'Could not access your microphone. Check browser permissions.');
    }
  }, []);

  const stopRecordingWeb = useCallback(async () => {
    try {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder) return;

      console.log('[AgentXChat] Stopping web recording...');
      setIsRecording(false);

      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.stop();
      });

      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;

      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioChunksRef.current = [];

      if (blob.size === 0) {
        console.error('[AgentXChat] Empty recording blob');
        return;
      }

      setIsTranscribing(true);
      const text = await transcribeAudioWeb(blob);
      setIsTranscribing(false);

      if (text.trim()) {
        console.log('[AgentXChat] Transcribed text:', text);
        onSendMessage(text.trim());
      } else {
        Alert.alert('No Speech Detected', 'Could not understand the audio. Please try again.');
      }
    } catch (err) {
      console.error('[AgentXChat] Web stop recording error:', err);
      setIsRecording(false);
      setIsTranscribing(false);
      Alert.alert('Transcription Error', 'Failed to process your voice. Please try again.');
    }
  }, [onSendMessage]);

  const handleMicPress = useCallback(async () => {
    if (isLoading || isTranscribing) return;

    if (isSpeaking) {
      stopSpeaking();
    }

    if (isRecording) {
      if (Platform.OS === 'web') {
        await stopRecordingWeb();
      } else {
        await stopRecordingNative();
      }
    } else {
      if (Platform.OS === 'web') {
        await startRecordingWeb();
      } else {
        await startRecordingNative();
      }
    }
  }, [isLoading, isTranscribing, isRecording, isSpeaking, stopSpeaking, stopRecordingWeb, stopRecordingNative, startRecordingWeb, startRecordingNative]);

  const handleQuickAction = useCallback((prompt: string) => {
    console.log('[AgentXChat] Quick action:', prompt);
    if (isSpeaking) stopSpeaking();
    onSendMessage(prompt);
  }, [onSendMessage, isSpeaking, stopSpeaking]);

  const renderMessage = useCallback((message: ChatMessage, _index: number) => {
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
            
            <View style={styles.messageFooter}>
              <Text style={[styles.timestamp, isUser && styles.userTimestamp]}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {!isUser && !message.isLoading && message.content && (
                <TouchableOpacity
                  onPress={() => speakText(message.content)}
                  style={styles.speakButton}
                  activeOpacity={0.7}
                  testID={`speak-message-${message.id}`}
                >
                  <Volume2 size={14} color={isUser ? 'rgba(255,255,255,0.6)' : COLORS.navyDeep} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {isUser && (
            <View style={styles.userAvatarContainer}>
              <User size={16} color={COLORS.white} />
            </View>
          )}
        </View>
      </Animated.View>
    );
  }, [fadeAnim, speakText]);

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
      
      <Text style={styles.welcomeTitle}>AI Analysis</Text>
      <Text style={styles.welcomeSubtitle}>
        Your intelligent cruise advisor. Ask me anything about cruises, offers, tier progress, or portfolio optimization.
      </Text>

      <View style={styles.voiceHintContainer}>
        <Mic size={16} color={COLORS.navyDeep} />
        <Text style={styles.voiceHintText}>Tap the mic to talk — I'll listen and respond with voice</Text>
      </View>

      <View style={styles.devAssistantSection}>
        <LinearGradient
          colors={['#0F2439', '#1E3A5F', '#0097A7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.devAssistantCard}
        >
          <View style={styles.devAssistantHeader}>
            <View style={styles.devAssistantIconWrap}>
              <Cpu size={20} color="#00E5FF" />
            </View>
            <View style={styles.devAssistantHeaderText}>
              <Text style={styles.devAssistantTitle}>AI Dev Assistant</Text>
              <Text style={styles.devAssistantDesc}>Build voice-enabled AI features</Text>
            </View>
          </View>

          <View style={styles.devCapabilitiesGrid}>
            {DEV_ASSISTANT_CAPABILITIES.map((cap) => (
              <TouchableOpacity
                key={cap.id}
                style={styles.devCapabilityItem}
                onPress={() => handleQuickAction(cap.prompt)}
                activeOpacity={0.7}
                testID={`dev-cap-${cap.id}`}
              >
                <View style={styles.devCapabilityIconWrap}>
                  <cap.icon size={16} color="#00E5FF" />
                </View>
                <Text style={styles.devCapabilityLabel}>{cap.label}</Text>
                <Text style={styles.devCapabilityDesc}>{cap.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>
      </View>
      
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
                <Text style={styles.headerTitle}>AI Analysis</Text>
                <Text style={styles.headerSubtitle}>Cruise Intelligence</Text>
              </View>
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerButton, ttsEnabled && styles.headerButtonActive]}
                onPress={toggleTts}
                activeOpacity={0.7}
                testID="toggle-tts"
              >
                {ttsEnabled ? (
                  <Volume2 size={18} color={ttsEnabled ? COLORS.white : COLORS.navyDeep} />
                ) : (
                  <VolumeX size={18} color={COLORS.navyDeep} />
                )}
              </TouchableOpacity>
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

      {isRecording && (
        <View style={styles.recordingBanner}>
          <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.recordingText}>Listening... Tap mic to stop</Text>
        </View>
      )}

      {isTranscribing && (
        <View style={styles.transcribingBanner}>
          <ActivityIndicator size="small" color={COLORS.white} />
          <Text style={styles.transcribingText}>Processing your voice...</Text>
        </View>
      )}

      {isSpeaking && (
        <TouchableOpacity style={styles.speakingBanner} onPress={stopSpeaking} activeOpacity={0.7}>
          <Volume2 size={16} color={COLORS.white} />
          <Text style={styles.speakingText}>Speaking... Tap to stop</Text>
        </TouchableOpacity>
      )}
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? renderWelcome() : messages.map(renderMessage)}
      </ScrollView>

      {messages.length > 0 && (
        <View style={styles.devAssistantInlineBanner}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.devAssistantInlineScroll}>
            {DEV_ASSISTANT_CAPABILITIES.map((cap) => (
              <TouchableOpacity
                key={cap.id}
                style={styles.devAssistantInlineChip}
                onPress={() => handleQuickAction(cap.prompt)}
                activeOpacity={0.7}
              >
                <cap.icon size={13} color="#00ACC1" />
                <Text style={styles.devAssistantInlineChipText}>{cap.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper} testID="voice-only-composer">
          <View style={styles.voiceOnlyCard}>
            <Text style={styles.voiceOnlyTitle}>
              {isRecording ? 'Listening now' : isTranscribing ? 'Processing your voice' : 'Voice-only agent'}
            </Text>
            <Text style={styles.voiceOnlySubtitle}>
              {isRecording
                ? 'Speak naturally, then tap the mic again to send.'
                : isTranscribing
                  ? 'Please wait while your message is converted to text.'
                  : `Manual typing is off. Say something like: ${placeholder}`}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.micButton,
              styles.micButtonLarge,
              isRecording && styles.micButtonRecording,
              (isLoading || isTranscribing) && styles.micButtonDisabled,
            ]}
            onPress={handleMicPress}
            disabled={isLoading || isTranscribing}
            activeOpacity={0.7}
            testID="mic-button"
          >
            {isTranscribing ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : isRecording ? (
              <MicOff size={24} color={COLORS.white} />
            ) : (
              <Mic size={24} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          AI Analysis is now voice-first. Use the mic or tap a suggested action.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
});

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
  headerButtonActive: {
    backgroundColor: COLORS.navyDeep,
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
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  voiceHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(30, 58, 95, 0.08)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.round,
    marginBottom: SPACING.xxl,
  },
  voiceHintText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    opacity: 0.7,
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
  devAssistantSection: {
    width: '100%',
    marginBottom: SPACING.lg,
  },
  devAssistantCard: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    overflow: 'hidden',
  },
  devAssistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  devAssistantIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  devAssistantHeaderText: {
    flex: 1,
  },
  devAssistantTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  devAssistantDesc: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  devCapabilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  devCapabilityItem: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.12)',
  },
  devCapabilityIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  devCapabilityLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  devCapabilityDesc: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 13,
  },
  devAssistantInlineBanner: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 31, 63, 0.08)',
    backgroundColor: 'rgba(0, 172, 193, 0.04)',
  },
  devAssistantInlineScroll: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  devAssistantInlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 172, 193, 0.1)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 172, 193, 0.15)',
    marginRight: SPACING.xs,
  },
  devAssistantInlineChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#0097A7',
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
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#DC2626',
    paddingVertical: SPACING.sm,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.white,
  },
  recordingText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  transcribingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.navyDeep,
    paddingVertical: SPACING.sm,
  },
  transcribingText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  speakingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#0097A7',
    paddingVertical: SPACING.sm,
  },
  speakingText: {
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
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  timestamp: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    opacity: 0.5,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  speakButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 31, 63, 0.06)',
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
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    marginBottom: 80,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 31, 63, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
  },
  voiceOnlyCard: {
    flex: 1,
    paddingVertical: 2,
  },
  voiceOnlyTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginBottom: 2,
  },
  voiceOnlySubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    opacity: 0.7,
    lineHeight: 18,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0097A7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 0 : SPACING.xs,
  },
  micButtonLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 0,
  },
  micButtonRecording: {
    backgroundColor: '#DC2626',
  },
  micButtonDisabled: {
    backgroundColor: 'rgba(0, 151, 167, 0.3)',
  },
  disclaimer: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    textAlign: 'center',
    marginTop: SPACING.sm,
    opacity: 0.6,
  },
});
