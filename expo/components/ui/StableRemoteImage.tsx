import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleProp, ImageStyle } from 'react-native';
import { Image } from 'expo-image';

type ExpoImageProps = React.ComponentProps<typeof Image>;
type StableImageCachePolicy = NonNullable<ExpoImageProps['cachePolicy']>;
type StableImageContentFit = NonNullable<ExpoImageProps['contentFit']>;

interface StableRemoteImageProps {
  source?: ExpoImageProps['source'];
  uri?: string | null;
  fallbackUri?: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: StableImageContentFit;
  cachePolicy?: StableImageCachePolicy;
  transition?: number;
  recyclingKey?: string;
  testID?: string;
  onError?: () => void;
}

function normalizeUri(uri?: string | null): string | undefined {
  if (typeof uri !== 'string') {
    return undefined;
  }

  const trimmedUri = uri.trim();
  return trimmedUri.length > 0 ? trimmedUri : undefined;
}

export const StableRemoteImage = React.memo(function StableRemoteImage({
  source,
  uri,
  fallbackUri,
  style,
  contentFit = 'cover',
  cachePolicy = 'memory-disk',
  transition = 0,
  recyclingKey,
  testID,
  onError,
}: StableRemoteImageProps) {
  const normalizedUri = useMemo(() => normalizeUri(uri), [uri]);
  const normalizedFallbackUri = useMemo(() => normalizeUri(fallbackUri), [fallbackUri]);
  const [failedPrimaryUri, setFailedPrimaryUri] = useState<string | null>(null);

  const resolvedUri = failedPrimaryUri === normalizedUri
    ? (normalizedFallbackUri && normalizedFallbackUri !== normalizedUri ? normalizedFallbackUri : undefined)
    : (normalizedUri ?? normalizedFallbackUri);

  const resolvedSource = source ?? (resolvedUri ? { uri: resolvedUri } : undefined);

  const resolvedRecyclingKey = Platform.OS === 'web' || source
    ? undefined
    : (recyclingKey ?? normalizedUri ?? normalizedFallbackUri ?? 'stable-remote-image');

  const handleError = useCallback(() => {
    if (normalizedUri) {
      setFailedPrimaryUri((currentValue) => currentValue ?? normalizedUri);
    }

    onError?.();
  }, [normalizedUri, onError]);

  return (
    <Image
      source={resolvedSource}
      style={style}
      contentFit={contentFit}
      cachePolicy={cachePolicy}
      transition={transition}
      recyclingKey={resolvedRecyclingKey}
      onError={handleError}
      testID={testID}
    />
  );
});
