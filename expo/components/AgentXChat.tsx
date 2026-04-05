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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
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
  Mic,
  MicOff,
  Volume2,
  VolumeX,
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
  const [inputText, setInputText] = useState('');
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
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
    setTtsEnabled(prev => !prev);
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

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (trimmed && !isLoading) {
      console.log('[AgentXChat] Sending message:', trimmed);
      if (isSpeaking) stopSpeaking();
      onSendMessage(trimmed);
      setInputText('');
    }
  }, [inputText, isLoading, onSendMessage, isSpeaking, stopSpeaking]);

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
      
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={isRecording ? 'Listening...' : placeholder}
            placeholderTextColor={COLORS.textSecondary}
            multiline
            maxLength={1000}
            editable={!isLoading && !isRecording && !isTranscribing}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />

          <TouchableOpacity
            style={[
              styles.micButton,
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
              <MicOff size={20} color={COLORS.white} />
            ) : (
              <Mic size={20} color={COLORS.white} />
            )}
          </TouchableOpacity>
          
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
          AI Analysis provides cruise recommendations. Verify important details.
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
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0097A7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 0 : SPACING.xs,
  },
  micButtonRecording: {
    backgroundColor: '#DC2626',
  },
  micButtonDisabled: {
    backgroundColor: 'rgba(0, 151, 167, 0.3)',
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
