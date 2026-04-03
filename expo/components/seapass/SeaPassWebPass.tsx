import React, { memo } from 'react';
import { DimensionValue, Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Image as SvgImage, Rect, Text as SvgText } from 'react-native-svg';
import {
  SEA_PASS_APPROVED_SCREENSHOT_URL,
  SEA_PASS_PREVIEW_BACKGROUND,
  SEA_PASS_VIEWBOX,
  getSeaPassData,
  getSeaPassDynamicOverlays,
  type SeaPassDynamicOverlay,
  type SeaPassWebPassData,
} from '@/lib/seaPassWebPass';

const SVG_FONT_FAMILY = Platform.select({
  ios: 'Helvetica Neue',
  android: 'sans-serif',
  default: 'Arial, Helvetica, sans-serif',
}) ?? 'System';

function renderOverlay(overlay: SeaPassDynamicOverlay): React.ReactElement {
  return (
    <React.Fragment key={overlay.key}>
      <Rect
        x={overlay.mask.x}
        y={overlay.mask.y}
        width={overlay.mask.width}
        height={overlay.mask.height}
        rx={overlay.mask.radius}
        fill={overlay.mask.fill}
      />
      <SvgText
        x={overlay.x}
        y={overlay.y}
        textAnchor={overlay.textAnchor}
        fontFamily={SVG_FONT_FAMILY}
        fontSize={overlay.fontSize}
        fontWeight={overlay.fontWeight}
        fill={overlay.fill}
      >
        {overlay.value}
      </SvgText>
    </React.Fragment>
  );
}

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
  const overlays = getSeaPassDynamicOverlays(data);

  return (
    <View style={[styles.container, style, { width }]} testID={testID ?? 'seapass.preview'}>
      <View style={styles.aspectRatioFrame}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${SEA_PASS_VIEWBOX.width} ${SEA_PASS_VIEWBOX.height}`}>
          <Rect x={0} y={0} width={SEA_PASS_VIEWBOX.width} height={SEA_PASS_VIEWBOX.height} fill="#FFFFFF" />
          <SvgImage
            href={{ uri: SEA_PASS_APPROVED_SCREENSHOT_URL }}
            x={0}
            y={0}
            width={SEA_PASS_VIEWBOX.width}
            height={SEA_PASS_VIEWBOX.height}
            preserveAspectRatio="none"
          />
          {overlays.map(renderOverlay)}
        </Svg>
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
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 5,
  },
  aspectRatioFrame: {
    width: '100%',
    aspectRatio: SEA_PASS_VIEWBOX.width / SEA_PASS_VIEWBOX.height,
    backgroundColor: SEA_PASS_PREVIEW_BACKGROUND,
  },
});

export default SeaPassWebPass;
