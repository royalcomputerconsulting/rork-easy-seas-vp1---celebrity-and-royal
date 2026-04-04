import React, { memo } from 'react';
import { DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { SEA_PASS_PREVIEW_BACKGROUND, SEA_PASS_VIEWBOX, buildSeaPassSvgMarkup, getSeaPassData, type SeaPassWebPassData } from '@/lib/seaPassWebPass';

export interface SeaPassWebPassProps extends Partial<SeaPassWebPassData> {
  width?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SeaPassWebPass = memo(function SeaPassWebPass({
  width = '100%',
  style,
  testID,
  ...input
}: SeaPassWebPassProps) {
  const data = getSeaPassData(input);
  const svgMarkup = buildSeaPassSvgMarkup(data);

  return (
    <View style={[styles.container, style, { width }]} testID={testID ?? 'seapass.preview'}>
      <View style={styles.aspectRatioFrame}>
        <SvgXml xml={svgMarkup} width="100%" height="100%" />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: SEA_PASS_PREVIEW_BACKGROUND,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#182030',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  aspectRatioFrame: {
    width: '100%',
    aspectRatio: SEA_PASS_VIEWBOX.width / SEA_PASS_VIEWBOX.height,
    backgroundColor: SEA_PASS_PREVIEW_BACKGROUND,
  },
});

export default SeaPassWebPass;
