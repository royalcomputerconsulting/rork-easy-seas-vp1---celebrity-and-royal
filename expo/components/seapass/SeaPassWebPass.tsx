import React, { memo, useEffect, useState } from 'react';
import { DimensionValue, Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  SEA_PASS_APPROVED_SCREENSHOT_SOURCE_URL,
  SEA_PASS_PREVIEW_BACKGROUND,
  SEA_PASS_VIEWBOX,
  buildSeaPassSvgMarkup,
  getSeaPassData,
  loadSeaPassApprovedImageAsDataUrl,
  type SeaPassWebPassData,
} from '@/lib/seaPassWebPass';

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
  const [imageHref, setImageHref] = useState<string>(SEA_PASS_APPROVED_SCREENSHOT_SOURCE_URL);

  useEffect(() => {
    if (Platform.OS === 'web') {
      console.log('[SeaPassWebPass] Web platform - using direct URL for shell image');
      return;
    }

    let cancelled = false;
    console.log('[SeaPassWebPass] Loading approved shell image as data URL');

    loadSeaPassApprovedImageAsDataUrl()
      .then((dataUrl) => {
        if (!cancelled) {
          console.log('[SeaPassWebPass] Approved shell image loaded, length:', dataUrl.length);
          setImageHref(dataUrl);
        }
      })
      .catch((error) => {
        console.log('[SeaPassWebPass] Could not load shell as data URL, using direct URL:', error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const svgMarkup = buildSeaPassSvgMarkup(data, SEA_PASS_PREVIEW_BACKGROUND, imageHref);

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
