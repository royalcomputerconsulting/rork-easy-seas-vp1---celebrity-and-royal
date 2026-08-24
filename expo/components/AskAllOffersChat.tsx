import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { Bot, Copy, FileText, Mic, MicOff, RotateCcw, Send, Share2, ThumbsDown, ThumbsUp, User } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { AskAllOffersMessage, AskAllOffersSourceCard } from '@/state/AskAllOffersProvider';

interface AskAllOffersChatProps {
  messages: AskAllOffersMessage[];
  isAnswering: boolean;
  onSend: (content: string) => Promise<void>;
  onRetry: (message: AskAllOffersMessage) => Promise<void>;
  onSourcePress: (source: AskAllOffersSourceCard) => void;
  onFeedback: (messageId: string, feedback: 'helpful' | 'not_helpful') => void;
}

const STT_ENDPOINT = 'https://toolkit.rork.com/stt/transcribe/';

function formatTimestamp(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return '';
  return timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function evidenceLabel(status: AskAllOffersSourceCard['evidenceStatus']): string {
  if (status === 'partial') return 'Partial';
  if (status === 'stale') return 'Stale';
  if (status === 'missing') return 'Missing';
  return 'Verified';
}

async function transcribeNativeAudio(uri: string): Promise<string> {
  const suffix = uri.split('.').pop() || 'm4a';
  const payload = new FormData();
  payload.append('audio', {
    uri,
    name: `ask-all-offers.${suffix}`,
    type: `audio/${suffix}`,
  } as unknown as Blob);
  const response = await fetch(STT_ENDPOINT, { method: 'POST', body: payload });
  if (!response.ok) throw new Error(`Voice transcription returned ${response.status}.`);
  const data = await response.json() as { text?: string };
  return data.text?.trim() ?? '';
}

async function transcribeWebAudio(blob: Blob): Promise<string> {
  const payload = new FormData();
  payload.append('audio', blob, 'ask-all-offers.webm');
  const response = await fetch(STT_ENDPOINT, { method: 'POST', body: payload });
  if (!response.ok) throw new Error(`Voice transcription returned ${response.status}.`);
  const data = await response.json() as { text?: string };
  return data.text?.trim() ?? '';
}

export function AskAllOffersChat({ messages, isAnswering, onSend, onRetry, onSourcePress, onFeedback }: AskAllOffersChatProps) {
  const scrollRef = useRef<ScrollView>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages.length, isAnswering]);

  const submitDraft = useCallback(async () => {
    const content = draft.trim();
    if (!content || isAnswering || isRecording || isTranscribing) return;
    setDraft('');
    await onSend(content);
  }, [draft, isAnswering, isRecording, isTranscribing, onSend]);

  const startNativeRecording = useCallback(async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone access required', 'Allow microphone access to ask a question by voice.');
      return;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync({
      android: { extension: '.m4a', outputFormat: 2, audioEncoder: 3, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000 },
      ios: { extension: '.wav', outputFormat: 1, audioQuality: 127, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
      web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
    });
    await recording.startAsync();
    recordingRef.current = recording;
    setIsRecording(true);
  }, []);

  const stopNativeRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    recordingRef.current = null;
    const uri = recording.getURI();
    if (!uri) throw new Error('No recording was available to transcribe.');
    setIsTranscribing(true);
    try {
      const content = await transcribeNativeAudio(uri);
      if (content) {
        await onSend(content);
      } else {
        Alert.alert('No speech detected', 'Try again or type your question.');
      }
    } finally {
      setIsTranscribing(false);
    }
  }, [onSend]);

  const startWebRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    audioChunksRef.current = [];
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  const stopWebRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    setIsRecording(false);
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    recorder.stream.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];
    if (blob.size === 0) throw new Error('No speech was captured.');
    setIsTranscribing(true);
    try {
      const content = await transcribeWebAudio(blob);
      if (content) {
        await onSend(content);
      } else {
        Alert.alert('No speech detected', 'Try again or type your question.');
      }
    } finally {
      setIsTranscribing(false);
    }
  }, [onSend]);

  const toggleRecording = useCallback(async () => {
    if (isAnswering || isTranscribing) return;
    try {
      if (isRecording) {
        if (Platform.OS === 'web') await stopWebRecording();
        else await stopNativeRecording();
        return;
      }
      if (Platform.OS === 'web') await startWebRecording();
      else await startNativeRecording();
    } catch (error) {
      setIsRecording(false);
      setIsTranscribing(false);
      Alert.alert('Voice input unavailable', error instanceof Error ? error.message : 'Try typing your question instead.');
    }
  }, [isAnswering, isRecording, isTranscribing, startNativeRecording, startWebRecording, stopNativeRecording, stopWebRecording]);

  const copyMessage = useCallback(async (message: AskAllOffersMessage) => {
    const browserClipboard = (globalThis as typeof globalThis & { navigator?: { clipboard?: { writeText?: (text: string) => Promise<void> } } }).navigator?.clipboard;
    if (Platform.OS === 'web' && browserClipboard?.writeText) {
      await browserClipboard.writeText(message.content);
      return;
    }
    await Share.share({ title: 'Ask All Offers', message: message.content });
  }, []);

  const shareMessage = useCallback(async (message: AskAllOffersMessage) => {
    await Share.share({ title: 'Ask All Offers', message: message.content });
  }, []);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState} testID="ask-all-offers-empty-state">
            <View style={styles.emptyIcon}><Bot size={28} color="#0F766E" /></View>
            <Text style={styles.emptyTitle}>Ask about your saved offers</Text>
            <Text style={styles.emptyBody}>Offers, booked cruises, certificates, loyalty, calendar, weather evidence, and casino history stay inside this conversation scope.</Text>
          </View>
        ) : messages.map((message, index) => {
          const isUser = message.role === 'user';
          return (
            <View key={message.id} style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
              {!isUser ? <View style={styles.assistantAvatar}><Bot size={15} color="#0F766E" /></View> : null}
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                <Text style={[styles.messageText, isUser && styles.userMessageText]}>{message.content}</Text>
                {!isUser && message.sources && message.sources.length > 0 ? (
                  <View style={styles.sourcesList} testID={`ask-all-offers-sources-${message.id}`}>
                    {message.sources.map((source) => (
                      <TouchableOpacity
                        key={source.id}
                        onPress={() => onSourcePress(source)}
                        style={styles.sourceRow}
                        activeOpacity={0.75}
                        testID={`ask-all-offers-source-${source.id}`}
                      >
                        <FileText size={14} color="#0F766E" />
                        <View style={styles.sourceCopy}>
                          <Text style={styles.sourceTitle} numberOfLines={1}>{source.title}</Text>
                          <Text style={styles.sourceSubtitle} numberOfLines={1}>{source.subtitle}</Text>
                        </View>
                        <Text style={[styles.sourceStatus, source.evidenceStatus === 'verified' ? styles.sourceStatusVerified : styles.sourceStatusWarning]}>{evidenceLabel(source.evidenceStatus)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <View style={styles.messageFooter}>
                  <Text style={[styles.timestamp, isUser && styles.userTimestamp]}>{formatTimestamp(message.createdAt)}</Text>
                  {!isUser ? (
                    <View style={styles.messageActions}>
                      <TouchableOpacity onPress={() => void onRetry(message)} style={styles.iconButton} accessibilityLabel="Retry answer" testID={`ask-all-offers-retry-${message.id}`}><RotateCcw size={14} color="#476072" /></TouchableOpacity>
                      <TouchableOpacity onPress={() => void copyMessage(message)} style={styles.iconButton} accessibilityLabel="Copy answer" testID={`ask-all-offers-copy-${message.id}`}><Copy size={14} color="#476072" /></TouchableOpacity>
                      <TouchableOpacity onPress={() => void shareMessage(message)} style={styles.iconButton} accessibilityLabel="Share answer" testID={`ask-all-offers-share-${message.id}`}><Share2 size={14} color="#476072" /></TouchableOpacity>
                      <TouchableOpacity onPress={() => onFeedback(message.id, 'helpful')} style={[styles.iconButton, message.feedback === 'helpful' && styles.feedbackSelected]} accessibilityLabel="Mark answer helpful" testID={`ask-all-offers-helpful-${message.id}`}><ThumbsUp size={14} color="#0F766E" /></TouchableOpacity>
                      <TouchableOpacity onPress={() => onFeedback(message.id, 'not_helpful')} style={[styles.iconButton, message.feedback === 'not_helpful' && styles.feedbackSelected]} accessibilityLabel="Mark answer unhelpful" testID={`ask-all-offers-unhelpful-${message.id}`}><ThumbsDown size={14} color="#A33A25" /></TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </View>
              {isUser ? <View style={styles.userAvatar}><User size={15} color="#FFFFFF" /></View> : null}
            </View>
          );
        })}
        {isAnswering ? (
          <View style={[styles.messageRow, styles.messageRowAssistant]} testID="ask-all-offers-answering">
            <View style={styles.assistantAvatar}><Bot size={15} color="#0F766E" /></View>
            <View style={[styles.bubble, styles.assistantBubble, styles.thinkingBubble]}><ActivityIndicator size="small" color="#0F766E" /><Text style={styles.thinkingText}>Checking saved evidence…</Text></View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.composer}>
        {isRecording || isTranscribing ? <Text style={styles.voiceStatus}>{isRecording ? 'Listening… tap the microphone when you are done.' : 'Transcribing your question…'}</Text> : null}
        <View style={styles.composerRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about offers, cruises, certificates, loyalty, weather, or your calendar"
            placeholderTextColor="#718096"
            multiline
            style={styles.composerInput}
            textAlignVertical="top"
            editable={!isAnswering && !isRecording && !isTranscribing}
            testID="ask-all-offers-input"
          />
          <TouchableOpacity onPress={() => void toggleRecording()} style={[styles.composerIconButton, isRecording && styles.composerIconButtonRecording]} disabled={isAnswering || isTranscribing} accessibilityLabel={isRecording ? 'Stop voice input' : 'Start voice input'} testID="ask-all-offers-voice">
            {isTranscribing ? <ActivityIndicator size="small" color="#FFFFFF" /> : isRecording ? <MicOff size={20} color="#FFFFFF" /> : <Mic size={20} color="#FFFFFF" />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void submitDraft()} style={[styles.composerIconButton, styles.sendButton, (!draft.trim() || isAnswering || isRecording || isTranscribing) && styles.composerIconButtonDisabled]} disabled={!draft.trim() || isAnswering || isRecording || isTranscribing} accessibilityLabel="Send question" testID="ask-all-offers-send">
            <Send size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F9FB' },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.lg, gap: SPACING.md },
  emptyState: { alignItems: 'center', paddingTop: 90, paddingHorizontal: SPACING.xl, gap: SPACING.sm },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D9F3EB' },
  emptyTitle: { color: '#102A43', fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: TYPOGRAPHY.fontWeightBold, textAlign: 'center' },
  emptyBody: { color: '#52667A', fontSize: TYPOGRAPHY.fontSizeSM, lineHeight: 20, textAlign: 'center', maxWidth: 420 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm, maxWidth: 760 },
  messageRowUser: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  messageRowAssistant: { alignSelf: 'flex-start' },
  assistantAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D9F3EB', marginBottom: 2 },
  userAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F766E', marginBottom: 2 },
  bubble: { maxWidth: '88%', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md },
  userBubble: { backgroundColor: '#0F766E', borderBottomRightRadius: 2 },
  assistantBubble: { backgroundColor: '#FFFFFF', borderColor: '#D7E2EA', borderWidth: 1, borderBottomLeftRadius: 2 },
  thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  thinkingText: { color: '#476072', fontSize: TYPOGRAPHY.fontSizeSM },
  messageText: { color: '#1E3447', fontSize: TYPOGRAPHY.fontSizeSM, lineHeight: 21 },
  userMessageText: { color: '#FFFFFF' },
  sourcesList: { marginTop: SPACING.sm, borderTopColor: '#E2EBF0', borderTopWidth: 1, paddingTop: SPACING.xs, gap: 2 },
  sourceRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: 5 },
  sourceCopy: { flex: 1, minWidth: 0 },
  sourceTitle: { color: '#0F4C5C', fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightSemiBold },
  sourceSubtitle: { color: '#627D98', fontSize: TYPOGRAPHY.fontSizeXS, marginTop: 1 },
  sourceStatus: { fontSize: 10, fontWeight: TYPOGRAPHY.fontWeightBold, textTransform: 'uppercase' },
  sourceStatusVerified: { color: '#0F766E' },
  sourceStatusWarning: { color: '#A15C13' },
  messageFooter: { marginTop: SPACING.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  timestamp: { color: '#829AB1', fontSize: 10 },
  userTimestamp: { color: 'rgba(255,255,255,0.72)' },
  messageActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  feedbackSelected: { backgroundColor: '#E3F4EF' },
  composer: { backgroundColor: '#FFFFFF', borderTopColor: '#D7E2EA', borderTopWidth: 1, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  voiceStatus: { color: '#0F766E', fontSize: TYPOGRAPHY.fontSizeXS, marginBottom: SPACING.xs },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.xs },
  composerInput: { flex: 1, minHeight: 46, maxHeight: 128, backgroundColor: '#F4F7F9', borderColor: '#D7E2EA', borderWidth: 1, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 11, color: '#102A43', fontSize: TYPOGRAPHY.fontSizeSM },
  composerIconButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: BORDER_RADIUS.sm, backgroundColor: '#0F766E' },
  composerIconButtonRecording: { backgroundColor: '#B42318' },
  sendButton: { backgroundColor: '#102A43' },
  composerIconButtonDisabled: { backgroundColor: '#9FB3C8' },
});
