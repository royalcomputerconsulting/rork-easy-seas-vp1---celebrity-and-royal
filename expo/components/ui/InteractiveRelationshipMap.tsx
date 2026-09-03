import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { EASY_SEAS_TOKENS as T, COLOR_BLIND_SAFE_CHART_PALETTE } from '@/constants/easySeasDesignSystem';
import { useExperience } from '@/state/ExperienceProvider';

export interface MapNode { id: string; label: string; value?: number; valueLabel?: string; column: number; route?: () => void; routePath?: string; }
export interface MapEdge { id: string; from: string; to: string; value?: number; label: string; confidence: 'exact' | 'inferred' | 'estimated' | 'unresolved'; }

export function InteractiveRelationshipMap({ nodes, edges, maxNodes = 18, onReviewEdge }:{ nodes: MapNode[]; edges: MapEdge[]; maxNodes?: number; onReviewEdge?: (edge: MapEdge, decision: 'confirm' | 'reject') => void }) {
  const { colors, textScale, minimumControlSize, chartPalette } = useExperience();
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [confidence, setConfidence] = useState<'all' | MapEdge['confidence']>('all');
  const [listLimit, setListLimit] = useState(50);
  const filteredEdges = confidence === 'all' ? edges : edges.filter((edge) => edge.confidence === confidence);
  const bounded = useMemo(() => {
    const grouped = new Map<number, MapNode[]>();
    nodes.forEach((node) => grouped.set(node.column, [...(grouped.get(node.column) ?? []), node]));
    const ordered = [...grouped.entries()].sort(([left], [right]) => left - right).map(([, rows]) => rows);
    const result: MapNode[] = [];
    let row = 0;
    while (result.length < maxNodes && ordered.some((column) => row < column.length)) {
      ordered.forEach((column) => {
        if (result.length < maxNodes && column[row]) result.push(column[row]);
      });
      row += 1;
    }
    return result;
  }, [maxNodes, nodes]);
  const nodeIds = new Set(bounded.map((node) => node.id));
  const safeEdges = filteredEdges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)).slice(0, 30);
  const columns = useMemo(() => {
    const output = new Map<number, MapNode[]>();
    bounded.forEach((node) => output.set(node.column, [...(output.get(node.column) ?? []), node]));
    return [...output.entries()].sort(([a], [b]) => a - b);
  }, [bounded]);
  const selectedEdges = selected ? safeEdges.filter((edge) => edge.from === selected || edge.to === selected) : safeEdges;
  const listEdges = (selected ? filteredEdges.filter((edge) => edge.from === selected || edge.to === selected) : filteredEdges).slice(0, listLimit);
  const nodeLabel = (id: string) => nodes.find((node) => node.id === id)?.label ?? id;

  return <View accessibilityLabel="Interactive cross-record relationship map">
    <View style={styles.switcher} accessibilityRole="tablist">
      {(['map', 'list'] as const).map((mode) => <TouchableOpacity key={mode} style={[styles.switchButton, { minHeight: minimumControlSize, borderColor: colors.border, backgroundColor: view === mode ? colors.accent : colors.surface }]} onPress={() => setView(mode)} accessibilityRole="tab" accessibilityState={{ selected: view === mode }}>
        <Text style={[styles.switchText, { color: view === mode ? colors.background : colors.text, fontSize: T.type.body * textScale }]}>{mode === 'map' ? 'Relationship map' : 'List view'}</Text>
      </TouchableOpacity>)}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{(['all', 'exact', 'inferred', 'estimated', 'unresolved'] as const).map((mode) => <TouchableOpacity key={mode} style={[styles.filterButton, { minHeight: minimumControlSize, backgroundColor: confidence === mode ? colors.accent : colors.surface, borderColor: confidence === mode ? colors.accent : colors.border }]} onPress={() => { setConfidence(mode); setListLimit(50); }} accessibilityRole="button" accessibilityState={{ selected: confidence === mode }}><Text style={[styles.filterText, { color: confidence === mode ? colors.background : colors.muted, fontSize: T.type.caption * textScale }]}>{mode}</Text></TouchableOpacity>)}</ScrollView>
    {view === 'map' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.canvas}>
      <Svg width={Math.max(560, columns.length * 170)} height={Math.max(210, bounded.length * 14)} style={StyleSheet.absoluteFillObject}>
        {selectedEdges.map((edge, index) => {
          const from = bounded.find((node) => node.id === edge.from), to = bounded.find((node) => node.id === edge.to);
          if (!from || !to) return null;
          const fromRows = columns.find(([column]) => column === from.column)?.[1] ?? [], toRows = columns.find(([column]) => column === to.column)?.[1] ?? [];
          const x1 = from.column * 170 + 140, x2 = to.column * 170 + 10, y1 = fromRows.findIndex((node) => node.id === from.id) * 76 + 40, y2 = toRows.findIndex((node) => node.id === to.id) * 76 + 40;
          return <Path key={edge.id} d={`M${x1},${y1} C${x1 + 55},${y1} ${x2 - 55},${y2} ${x2},${y2}`} stroke={edge.confidence === 'unresolved' ? T.color.error : edge.confidence === 'estimated' ? T.color.estimated : chartPalette[index % chartPalette.length] ?? COLOR_BLIND_SAFE_CHART_PALETTE[index % COLOR_BLIND_SAFE_CHART_PALETTE.length]} strokeWidth={Math.max(2, Math.min(10, Math.log10(Math.max(10, edge.value ?? 10))))} fill="none" opacity={selected ? .9 : .55}/>;
        })}
      </Svg>
      {columns.map(([column, rows]) => <View key={column} style={styles.column}>{rows.map((node, index) => <TouchableOpacity key={node.id} style={[styles.node, { minHeight: Math.max(58, minimumControlSize), backgroundColor: colors.surface, borderColor: selected === node.id ? colors.accent : colors.border }, { marginTop: index === 0 ? 4 : 16 }]} onPress={() => { setSelected(selected === node.id ? null : node.id); node.route?.(); }} accessibilityLabel={`${node.label}. ${node.valueLabel ?? ''}. ${safeEdges.filter((edge) => edge.from === node.id || edge.to === node.id).length} relationships`}>
        <Text style={[styles.nodeLabel, { color: colors.text, fontSize: T.type.supporting * textScale }]} numberOfLines={2}>{node.label}</Text>{node.valueLabel ? <Text style={[styles.nodeValue, { color: colors.accent, fontSize: T.type.caption * textScale }]}>{node.valueLabel}</Text> : null}
      </TouchableOpacity>)}</View>)}
    </ScrollView> : <View style={[styles.table, { borderColor: colors.border }]} accessibilityLabel="Relationship list alternative">
      {listEdges.map((edge) => <View key={edge.id} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setSelected(edge.from)} accessibilityLabel={`${nodeLabel(edge.from)} to ${nodeLabel(edge.to)}. ${edge.label}. ${edge.confidence}`}>
        <Text style={[styles.tablePath, { color: colors.text, fontSize: T.type.body * textScale }]}>{nodeLabel(edge.from)} → {nodeLabel(edge.to)}</Text>
        <Text style={[styles.evidenceRow, { color: colors.muted, fontSize: T.type.caption * textScale }]}>{edge.label} · {edge.confidence}</Text>
        </TouchableOpacity>{onReviewEdge && edge.confidence !== 'exact' ? <View style={styles.reviewActions}><TouchableOpacity style={styles.reviewButton} onPress={() => onReviewEdge(edge, 'confirm')}><Text style={styles.reviewText}>Confirm link</Text></TouchableOpacity><TouchableOpacity style={styles.reviewButton} onPress={() => onReviewEdge(edge, 'reject')}><Text style={[styles.reviewText, { color: T.color.error }]}>Reject link</Text></TouchableOpacity></View> : null}
      </View>)}{listEdges.length < (selected ? filteredEdges.filter((edge) => edge.from === selected || edge.to === selected).length : filteredEdges.length) ? <TouchableOpacity style={styles.loadMore} onPress={() => setListLimit((value) => value + 50)}><Text style={styles.reviewText}>Load 50 more relationships</Text></TouchableOpacity> : null}
    </View>}
    <Text style={[styles.hint, { color: colors.muted, fontSize: T.type.caption * textScale }]}>{view === 'map' && nodes.length > bounded.length ? `The map is bounded to ${bounded.length} of ${nodes.length} nodes for performance; List view contains every relationship. ` : ''}{selected ? `${view === 'map' ? selectedEdges.length : listEdges.length} links touch the selected record. Tap again to show all.` : 'Tap a node to isolate its evidence links. Line color and labels never rely on color alone.'}</Text>
    <View style={[styles.evidence, { backgroundColor: colors.background }]}>{selectedEdges.slice(0, 12).map((edge) => <Text key={edge.id} style={[styles.evidenceRow, { color: colors.text, fontSize: T.type.caption * textScale }]}>• {edge.label} · {edge.confidence}</Text>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  switcher: { flexDirection: 'row', gap: T.space.sm, marginBottom: T.space.sm },
  switchButton: { minHeight: T.control.minimum, justifyContent: 'center', paddingHorizontal: T.space.md, borderRadius: T.radius.pill, borderWidth: 1, borderColor: T.color.border },
  switchButtonOn: { backgroundColor: T.color.navy }, switchText: { color: T.color.navy, fontWeight: '900' }, switchTextOn: { color: '#fff' },
  filters: { gap: 6, paddingBottom: T.space.sm }, filterButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: T.space.sm, borderRadius: T.radius.pill, backgroundColor: T.color.surfaceAlt, borderWidth: 1, borderColor: T.color.border }, filterButtonOn: { backgroundColor: T.color.teal, borderColor: T.color.teal }, filterText: { color: T.color.muted, fontSize: T.type.caption, fontWeight: '800', textTransform: 'capitalize' }, filterTextOn: { color: '#fff' },
  canvas: { minHeight: 230, paddingHorizontal: T.space.sm, gap: 30 }, column: { width: 140, zIndex: 2 },
  node: { minHeight: 58, backgroundColor: T.color.surface, borderRadius: T.radius.md, borderWidth: 2, borderColor: T.color.border, padding: T.space.sm, justifyContent: 'center', ...T.elevation.card },
  nodeSelected: { borderColor: T.color.focus, backgroundColor: '#FFF9E8' }, nodeLabel: { color: T.color.text, fontSize: T.type.supporting, fontWeight: '900' }, nodeValue: { color: T.color.navy, fontSize: T.type.caption, fontWeight: '800', marginTop: 3 },
  table: { borderWidth: 1, borderColor: T.color.border, borderRadius: T.radius.md, overflow: 'hidden' }, tableRow: { minHeight: 54, padding: T.space.md, borderBottomWidth: 1, borderBottomColor: T.color.border }, tablePath: { color: T.color.text, fontWeight: '900', marginBottom: 3 },
  reviewActions: { flexDirection: 'row', gap: T.space.sm, marginTop: T.space.sm }, reviewButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: T.space.sm, borderWidth: 1, borderColor: T.color.border, borderRadius: T.radius.sm }, reviewText: { color: T.color.navy, fontWeight: '800', fontSize: T.type.caption }, loadMore: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: T.color.surfaceAlt },
  hint: { color: T.color.muted, fontSize: T.type.caption, marginTop: T.space.sm }, evidence: { marginTop: T.space.sm, padding: T.space.md, borderRadius: T.radius.md, backgroundColor: T.color.surfaceAlt }, evidenceRow: { color: T.color.text, fontSize: T.type.caption, marginBottom: 3 },
});
