import type { ImageSourcePropType } from 'react-native';

const SIGNATURE_IMAGE_URL = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/9p97y61hr0a976hzrjxbl.png';

export const IMAGES = {
  logo: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/r5jl64tqs70xgl66k8ej2.png',
  signature: SIGNATURE_IMAGE_URL,
};

export const LOCAL_IMAGES: Record<'signature', ImageSourcePropType> = {
  signature: { uri: SIGNATURE_IMAGE_URL },
};

