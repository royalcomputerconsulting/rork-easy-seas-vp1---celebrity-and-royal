import type { ImageSourcePropType } from 'react-native';

export const IMAGES = {
  logo: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/r5jl64tqs70xgl66k8ej2.png',
  signature: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/cauyec4yp7yva1l5jm4a0.png',
};

export const LOCAL_IMAGES: Record<'signature', ImageSourcePropType> = {
  signature: require('../assets/images/signature-scott-astin.png'),
};

