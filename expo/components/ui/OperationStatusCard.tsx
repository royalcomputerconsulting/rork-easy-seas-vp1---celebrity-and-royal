import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertCircle, AlertTriangle, CheckCircle2, RotateCcw, Undo2, WifiOff, X, XCircle } from 'lucide-react-native';

import { EASY_SEAS_TOKENS as T } from '@/constants/easySeasDesignSystem';
import { AccessibleProgress, PurposefulSuccess } from '@/components/ui/PurposefulMotion';
import { useExperience } from '@/state/ExperienceProvider';

export type OperationStatus = 'running' | 'success' | 'partial-success' | 'offline' | 'error' | 'cancelled';
export interface OperationFeedback {
  id: string;
  title: string;
  status: OperationStatus;
  message: string;
  current?: number;
  total?: number;
  currentItem?: string;
  committed: boolean;
  startedAt: string;
  completedAt?: string;
}

export function OperationStatusCard({ operation, onCancel, onRetry, onUndo, onDismiss }: {
  operation: OperationFeedback;
  onCancel?: () => void;
  onRetry?: () => void;
  onUndo?: () => void;
  onDismiss?: () => void;
}) {
  const { colors, minimumControlSize } = useExperience();
  const progress = operation.total && operation.total > 0 ? Math.max(0, Math.min(1, (operation.current ?? 0) / operation.total)) : null;
  const Icon = operation.status === 'success' ? CheckCircle2 : operation.status === 'error' ? XCircle : operation.status === 'offline' ? WifiOff : operation.status === 'partial-success' ? AlertTriangle : operation.status === 'cancelled' ? AlertCircle : null;
  const tone = operation.status === 'success' ? T.color.success : operation.status === 'error' ? T.color.error : operation.status === 'cancelled' || operation.status === 'partial-success' || operation.status === 'offline' ? T.color.warning : T.color.teal;
  return <View style={[styles.card, { borderColor: tone, backgroundColor: colors.surface }]} accessibilityLiveRegion="polite" accessibilityRole="summary" accessibilityLabel={`${operation.title}. ${operation.message}`} testID={`operation-status-${operation.id}`}>
    <View style={styles.header}>{Icon ? <Icon size={21} color={tone}/> : <ActivityIndicator color={tone}/>}<View style={styles.copy}><Text style={[styles.title, { color: colors.text }]}>{operation.title}</Text><Text style={[styles.message, { color: colors.muted }]}>{operation.message}</Text></View>{onDismiss && operation.status !== 'running' ? <TouchableOpacity style={[styles.iconButton, { minWidth: minimumControlSize, minHeight: minimumControlSize }]} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss operation status"><X size={17} color={colors.muted}/></TouchableOpacity> : null}</View>
    {operation.status === 'running' && progress != null ? <AccessibleProgress progress={progress} label={`${operation.current?.toLocaleString() ?? 0} of ${operation.total?.toLocaleString() ?? 0}${operation.currentItem ? ` · ${operation.currentItem}` : ''}`} /> : null}
    {operation.status === 'success' ? <PurposefulSuccess label={operation.committed ? 'Completed and saved' : 'Completed'} /> : null}
    {operation.currentItem && (operation.status !== 'running' || progress == null) ? <Text style={[styles.currentItem, { color: colors.muted }]}>Current item: {operation.currentItem}</Text> : null}
    <Text style={[styles.commit, { color: operation.committed ? T.color.success : T.color.muted }]}>{operation.committed ? 'Final output or durable data commit verified.' : operation.status === 'running' ? 'No final output or data commit has been reported yet.' : 'Existing app data was preserved; no final commit was reported.'}</Text>
    <View style={styles.actions}>{operation.status === 'running' && onCancel ? <TouchableOpacity style={[styles.action, { minHeight: minimumControlSize, borderColor: colors.border }]} onPress={onCancel} accessibilityRole="button" accessibilityLabel={`Cancel ${operation.title} safely`}><XCircle size={15} color={T.color.error}/><Text style={[styles.actionText, { color: colors.text }]}>Cancel safely</Text></TouchableOpacity> : null}{(['error', 'partial-success', 'offline'] as OperationStatus[]).includes(operation.status) && onRetry ? <TouchableOpacity style={[styles.action, { minHeight: minimumControlSize, borderColor: colors.border }]} onPress={onRetry} accessibilityRole="button" accessibilityLabel={`Retry ${operation.title}`}><RotateCcw size={15} color={colors.accent}/><Text style={[styles.actionText, { color: colors.text }]}>Retry {operation.title.toLowerCase()}</Text></TouchableOpacity> : null}{operation.status === 'success' && onUndo ? <TouchableOpacity style={[styles.action, { minHeight: minimumControlSize, borderColor: colors.border }]} onPress={onUndo} accessibilityRole="button" accessibilityLabel={`Undo ${operation.title}`}><Undo2 size={15} color={colors.accent}/><Text style={[styles.actionText, { color: colors.text }]}>Undo</Text></TouchableOpacity> : null}</View>
  </View>;
}

const styles = StyleSheet.create({
  card:{backgroundColor:T.color.surface,borderWidth:1,borderRadius:T.radius.lg,padding:T.space.md,marginVertical:T.space.md,...T.elevation.card},
  header:{flexDirection:'row',alignItems:'flex-start',gap:T.space.sm},copy:{flex:1},title:{color:T.color.text,fontWeight:'900',fontSize:T.type.body},message:{color:T.color.muted,fontSize:T.type.supporting,lineHeight:18,marginTop:3},iconButton:{minWidth:T.control.minimum,minHeight:T.control.minimum,alignItems:'center',justifyContent:'center'},currentItem:{fontSize:T.type.supporting,fontWeight:'700',marginTop:T.space.sm},commit:{fontSize:T.type.caption,fontWeight:'800',marginTop:T.space.sm},actions:{flexDirection:'row',flexWrap:'wrap',gap:T.space.sm,marginTop:T.space.sm},action:{minHeight:T.control.minimum,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderWidth:1,borderColor:T.color.border,borderRadius:T.radius.md,paddingHorizontal:T.space.md},actionText:{color:T.color.navy,fontWeight:'800',fontSize:T.type.caption},
});
