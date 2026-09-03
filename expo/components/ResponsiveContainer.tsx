import React, { memo } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import { DEFAULT_CONTENT_MAX_WIDTH, getResponsiveHorizontalPadding } from '@/constants/layout';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: number;
  includeHorizontalPadding?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function ResponsiveContainerComponent({
  children,
  maxWidth = DEFAULT_CONTENT_MAX_WIDTH,
  includeHorizontalPadding = false,
  style,
  testID,
}: ResponsiveContainerProps) {
  const { width } = useWindowDimensions();
  const horizontalPadding = includeHorizontalPadding ? getResponsiveHorizontalPadding(width) : 0;

  return (
    <View
      style={[
        styles.outer,
        includeHorizontalPadding ? { paddingHorizontal: horizontalPadding } : null,
        style,
      ]}
      testID={testID}
    >
      <View style={[styles.inner, { maxWidth }]}>{children}</View>
    </View>
  );
}

export const ResponsiveContainer = memo(ResponsiveContainerComponent);

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    alignSelf: 'stretch',
  },
  inner: {
    width: '100%',
    alignSelf: 'center',
  },
});
