import type { ImageSourcePropType } from 'react-native';

const SIGNATURE_IMAGE_URL = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/9p97y61hr0a976hzrjxbl.png';

export const IMAGES = {
  // Local branded assets prevent the app from depending on an external R2 logo URL at launch.
  logo: require('@/assets/images/easy-seas-gauguin-logo.png') as ImageSourcePropType,
  header: require('@/assets/images/easy-seas-gauguin-header.png') as ImageSourcePropType,
  signature: SIGNATURE_IMAGE_URL,
};

export const LOCAL_IMAGES: Record<'logo' | 'header' | 'signature', ImageSourcePropType> = {
  logo: require('@/assets/images/easy-seas-gauguin-logo.png') as ImageSourcePropType,
  header: require('@/assets/images/easy-seas-gauguin-header.png') as ImageSourcePropType,
  signature: { uri: SIGNATURE_IMAGE_URL },
};
