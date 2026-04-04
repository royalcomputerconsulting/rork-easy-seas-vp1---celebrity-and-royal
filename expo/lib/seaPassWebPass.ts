export interface SeaPassWebPassData {
  time: string;
  date: string;
  deck: string;
  stateroom: string;
  muster: string;
  reservation: string;
  ship: string;
}

export interface SeaPassBarcodeBar {
  x: number;
  width: number;
}

export type SeaPassOverlayKey = keyof SeaPassWebPassData | 'barcodeCaption';

export interface SeaPassOverlayMask {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  radius: number;
  sampleX?: number;
  sampleY?: number;
}

export interface SeaPassDynamicOverlay {
  key: SeaPassOverlayKey;
  value: string;
  x: number;
  y: number;
  fill: string;
  fontSize: number;
  fontWeight: string;
  letterSpacing?: number;
  textAnchor?: 'middle' | 'end';
  mask: SeaPassOverlayMask;
}

interface SeaPassDynamicOverlayDefinition {
  x: number;
  y: number;
  fill: string;
  fontSize: number;
  fontWeight: string;
  letterSpacing?: number;
  textAnchor?: 'middle' | 'end';
  mask: SeaPassOverlayMask;
}

export const SEA_PASS_VIEWBOX = {
  width: 1024,
  height: 1536,
} as const;

export const SEA_PASS_DEFAULTS: SeaPassWebPassData = {
  time: '10:30 am',
  date: 'Apr 07',
  deck: '10',
  stateroom: '10134',
  muster: 'A4',
  reservation: '182213',
  ship: 'QN',
};

export const SEA_PASS_NAME_LINES = ['Scott', 'Merlis'] as const;
export const SEA_PASS_STATUS = 'DIAMOND PLUS • SIGNATURE';
export const SEA_PASS_PORT = 'LOS ANGELES, CALIFORNIA';
export const SEA_PASS_LEGAL_LINES = [
  'Due to government regulations, all guests are',
  'required to be at the pier and checked in no later',
  'than 90 minutes prior to the sail time.',
] as const;

export const SEA_PASS_PREVIEW_BACKGROUND = '#EFF3F8';
export const SEA_PASS_EXPORT_BACKGROUND = '#FFFFFF';
export const SEA_PASS_FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const SEA_PASS_APPROVED_SCREENSHOT_SOURCE_URL = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/2odahwrylhqkr8gb1jwp4.png';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function getSeaPassApprovedScreenshotUrl(): string {
  const apiBaseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL?.trim();

  if (!apiBaseUrl) {
    return SEA_PASS_APPROVED_SCREENSHOT_SOURCE_URL;
  }

  const normalizedBaseUrl = trimTrailingSlash(apiBaseUrl);

  if (normalizedBaseUrl.endsWith('/api')) {
    return `${normalizedBaseUrl}/seapass-approved-shell`;
  }

  return `${normalizedBaseUrl}/api/seapass-approved-shell`;
}

export const SEA_PASS_APPROVED_SCREENSHOT_URL = getSeaPassApprovedScreenshotUrl();

let approvedSeaPassImageDataUrlPromise: Promise<string> | null = null;

export const SEA_PASS_LAYOUT = {
  cardX: 24,
  cardY: 24,
  cardWidth: 976,
  cardHeight: 1488,
  radius: 34,
  headerHeight: 548,
  sideCutoutY: 556,
  sideCutoutRadius: 34,
  topNotchRadius: 36,
  barcodeX: 70,
  barcodeY: 1112,
  barcodeWidth: 884,
  barcodeHeight: 182,
} as const;

export const ROYAL_CARIBBEAN_LOGO_PATHS = {
  crown: 'M6 18L20 4L34 18L48 4L62 18L58 34H10L6 18ZM16 18H23V27L31 19L39 27V18H46L44 26H18L16 18Z',
  anchor: 'M18 38H30V54L18 62V74L31 67L34 64L37 67L50 74V62L38 54V38H50V50H60V30H45L34 18L23 30H8V50H18V38Z',
};

export const BOARDING_KEY_RING_PATH = 'M42 76C22 76 6 60 6 40C6 20 22 4 42 4C61 4 77 18 78 36H184V48H204V36H222V68H210V48H196V60H184V36H78C77 56 61 76 42 76ZM42 56C51 56 58 49 58 40C58 31 51 24 42 24C33 24 26 31 26 40C26 49 33 56 42 56Z';

const SEA_PASS_DYNAMIC_OVERLAY_DEFINITIONS: Record<SeaPassOverlayKey, SeaPassDynamicOverlayDefinition> = {
  time: {
    x: 956,
    y: 106,
    fill: '#FFFFFF',
    fontSize: 46,
    fontWeight: '400',
    letterSpacing: -1.1,
    textAnchor: 'end',
    mask: {
      x: 632,
      y: 36,
      width: 336,
      height: 84,
      fill: '#5A3C8E',
      radius: 8,
      sampleX: 632,
      sampleY: 228,
    },
  },
  date: {
    x: 958,
    y: 178,
    fill: '#FFFFFF',
    fontSize: 62,
    fontWeight: '300',
    letterSpacing: -1.6,
    textAnchor: 'end',
    mask: {
      x: 632,
      y: 104,
      width: 336,
      height: 108,
      fill: '#5A3C8E',
      radius: 8,
      sampleX: 632,
      sampleY: 228,
    },
  },
  deck: {
    x: 94,
    y: 608,
    fill: '#30333A',
    fontSize: 54,
    fontWeight: '400',
    letterSpacing: -0.8,
    mask: {
      x: 78,
      y: 558,
      width: 102,
      height: 70,
      fill: '#F4F4F5',
      radius: 6,
      sampleX: 474,
      sampleY: 558,
    },
  },
  stateroom: {
    x: 250,
    y: 608,
    fill: '#30333A',
    fontSize: 54,
    fontWeight: '400',
    letterSpacing: -0.8,
    mask: {
      x: 232,
      y: 558,
      width: 214,
      height: 70,
      fill: '#F4F4F5',
      radius: 6,
      sampleX: 474,
      sampleY: 558,
    },
  },
  muster: {
    x: 930,
    y: 608,
    fill: '#30333A',
    fontSize: 54,
    fontWeight: '400',
    letterSpacing: -0.8,
    textAnchor: 'end',
    mask: {
      x: 822,
      y: 558,
      width: 130,
      height: 70,
      fill: '#F4F4F5',
      radius: 6,
      sampleX: 644,
      sampleY: 558,
    },
  },
  reservation: {
    x: 94,
    y: 755,
    fill: '#30333A',
    fontSize: 54,
    fontWeight: '400',
    letterSpacing: -0.8,
    mask: {
      x: 78,
      y: 702,
      width: 222,
      height: 76,
      fill: '#F4F4F5',
      radius: 6,
      sampleX: 474,
      sampleY: 702,
    },
  },
  ship: {
    x: 930,
    y: 755,
    fill: '#30333A',
    fontSize: 54,
    fontWeight: '400',
    letterSpacing: -0.8,
    textAnchor: 'end',
    mask: {
      x: 822,
      y: 702,
      width: 130,
      height: 76,
      fill: '#F4F4F5',
      radius: 6,
      sampleX: 644,
      sampleY: 702,
    },
  },
  barcodeCaption: {
    x: 512,
    y: 1308,
    fill: '#30333A',
    fontSize: 48,
    fontWeight: '400',
    letterSpacing: -0.6,
    textAnchor: 'middle',
    mask: {
      x: 310,
      y: 1258,
      width: 404,
      height: 72,
      fill: '#F8F8F9',
      radius: 6,
      sampleX: 78,
      sampleY: 1360,
    },
  },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeField(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function getDynamicOverlayValue(key: SeaPassOverlayKey, data: SeaPassWebPassData, barcodeCaption: string): string {
  if (key === 'barcodeCaption') {
    return barcodeCaption;
  }

  return data[key];
}

function shouldRenderDynamicOverlay(key: SeaPassOverlayKey, value: string): boolean {
  if (key === 'barcodeCaption') {
    return value !== getSeaPassBarcodeCaption(SEA_PASS_DEFAULTS);
  }

  return value !== SEA_PASS_DEFAULTS[key];
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to load approved SeaPass image (${response.status}).`);
  }

  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = reader.result;

      if (typeof result === 'string') {
        resolve(result);
        return;
      }

      reject(new Error('Unable to convert approved SeaPass image for web export.'));
    };

    reader.onerror = () => reject(new Error('Unable to read approved SeaPass image for web export.'));
    reader.readAsDataURL(blob);
  });
}

async function getSeaPassApprovedScreenshotDataUrl(): Promise<string> {
  if (!approvedSeaPassImageDataUrlPromise) {
    approvedSeaPassImageDataUrlPromise = fetchImageAsDataUrl(SEA_PASS_APPROVED_SCREENSHOT_URL).catch((error) => {
      approvedSeaPassImageDataUrlPromise = null;
      throw error;
    });
  }

  return approvedSeaPassImageDataUrlPromise;
}

function buildSeaPassOverlaySvgMarkup(
  input: Partial<SeaPassWebPassData>,
  approvedImageHref: string,
): { defsMarkup: string; overlayMarkup: string } {
  const data = getSeaPassData(input);
  const barcodeCaption = getSeaPassBarcodeCaption(data);
  const overlays = getSeaPassDynamicOverlays(data);
  const safeImageHref = escapeXml(approvedImageHref);
  const defs: string[] = [];

  const overlayMarkup = overlays
    .map((overlay) => {
      const mask = overlay.mask;
      const clipPathId = `overlay-clip-${overlay.key}`;
      const textAnchor = overlay.textAnchor ? ` text-anchor="${overlay.textAnchor}"` : '';
      const letterSpacing = typeof overlay.letterSpacing === 'number' ? ` letter-spacing="${overlay.letterSpacing}"` : '';
      const value = escapeXml(getDynamicOverlayValue(overlay.key, data, barcodeCaption));
      const hasSampleBackground = typeof mask.sampleX === 'number' && typeof mask.sampleY === 'number';

      let eraseMarkup = `<rect x="${mask.x}" y="${mask.y}" width="${mask.width}" height="${mask.height}" rx="${mask.radius}" fill="${mask.fill}" />`;

      if (hasSampleBackground) {
        const sampleX = mask.sampleX ?? 0;
        const sampleY = mask.sampleY ?? 0;
        defs.push(
          `<clipPath id="${clipPathId}"><rect x="${mask.x}" y="${mask.y}" width="${mask.width}" height="${mask.height}" rx="${mask.radius}" ry="${mask.radius}" /></clipPath>`,
        );
        eraseMarkup = `<g clip-path="url(#${clipPathId})"><image href="${safeImageHref}" x="${mask.x - sampleX}" y="${mask.y - sampleY}" width="${SEA_PASS_VIEWBOX.width}" height="${SEA_PASS_VIEWBOX.height}" preserveAspectRatio="none" /></g>`;
      }

      return `${eraseMarkup}<text x="${overlay.x}" y="${overlay.y}"${textAnchor}${letterSpacing} font-family="${SEA_PASS_FONT_STACK}" font-size="${overlay.fontSize}" font-weight="${overlay.fontWeight}" fill="${overlay.fill}">${value}</text>`;
    })
    .join('');

  return {
    defsMarkup: defs.join(''),
    overlayMarkup,
  };
}

export function getSeaPassData(input: Partial<SeaPassWebPassData>): SeaPassWebPassData {
  return {
    time: normalizeField(input.time, SEA_PASS_DEFAULTS.time),
    date: normalizeField(input.date, SEA_PASS_DEFAULTS.date),
    deck: normalizeField(input.deck, SEA_PASS_DEFAULTS.deck),
    stateroom: normalizeField(input.stateroom, SEA_PASS_DEFAULTS.stateroom),
    muster: normalizeField(input.muster, SEA_PASS_DEFAULTS.muster),
    reservation: normalizeField(input.reservation, SEA_PASS_DEFAULTS.reservation),
    ship: normalizeField(input.ship, SEA_PASS_DEFAULTS.ship),
  };
}

export function getSeaPassBarcodeCaption(input: Pick<SeaPassWebPassData, 'reservation' | 'stateroom'>): string {
  const normalized = getSeaPassData(input as Partial<SeaPassWebPassData>);
  return `${normalized.reservation}-${normalized.stateroom}`;
}

export function getSeaPassDynamicOverlays(input: Partial<SeaPassWebPassData>): SeaPassDynamicOverlay[] {
  const data = getSeaPassData(input);
  const barcodeCaption = getSeaPassBarcodeCaption(data);
  const orderedKeys: SeaPassOverlayKey[] = ['time', 'date', 'deck', 'stateroom', 'muster', 'reservation', 'ship', 'barcodeCaption'];
  const topRightChanged = data.time !== SEA_PASS_DEFAULTS.time || data.date !== SEA_PASS_DEFAULTS.date;

  return orderedKeys.reduce<SeaPassDynamicOverlay[]>((accumulator, key) => {
    const overlayValue = getDynamicOverlayValue(key, data, barcodeCaption);
    const shouldRender = key === 'time' || key === 'date'
      ? topRightChanged
      : shouldRenderDynamicOverlay(key, overlayValue);

    if (!shouldRender) {
      return accumulator;
    }

    const definition = SEA_PASS_DYNAMIC_OVERLAY_DEFINITIONS[key];
    accumulator.push({
      key,
      value: overlayValue,
      x: definition.x,
      y: definition.y,
      fill: definition.fill,
      fontSize: definition.fontSize,
      fontWeight: definition.fontWeight,
      letterSpacing: definition.letterSpacing,
      textAnchor: definition.textAnchor,
      mask: definition.mask,
    });
    return accumulator;
  }, []);
}

function buildPatternForCharacter(character: string): number[] {
  const code = character.charCodeAt(0);
  return [
    1 + (code % 4),
    1 + ((code >> 1) % 2),
    2 + ((code >> 2) % 3),
    1 + ((code >> 3) % 2),
    1 + ((code >> 4) % 4),
    2 + ((code >> 5) % 3),
  ];
}

export function getSeaPassBarcodeBars(value: string, totalWidth: number): SeaPassBarcodeBar[] {
  const normalizedValue = value.trim().toUpperCase() || getSeaPassBarcodeCaption(SEA_PASS_DEFAULTS);
  const quietZone = 12;
  const interCharacterGap = 2;
  const startPattern = [3, 1, 1, 2, 1, 3, 2, 1];
  const endPattern = [4, 1, 1, 2, 2, 1, 3, 1];
  const rawBars: SeaPassBarcodeBar[] = [];
  let cursor = quietZone;

  const addPattern = (pattern: number[]) => {
    let isBlack = true;

    pattern.forEach((segmentWidth) => {
      if (isBlack) {
        rawBars.push({ x: cursor, width: segmentWidth });
      }
      cursor += segmentWidth;
      isBlack = !isBlack;
    });

    cursor += interCharacterGap;
  };

  addPattern(startPattern);
  Array.from(normalizedValue).forEach((character) => {
    addPattern(buildPatternForCharacter(character));
  });
  addPattern(endPattern);
  cursor += quietZone;

  const scale = totalWidth / Math.max(cursor, 1);

  return rawBars.map((bar) => ({
    x: bar.x * scale,
    width: Math.max(1.25, bar.width * scale),
  }));
}

export function buildSeaPassSvgMarkup(
  input: Partial<SeaPassWebPassData>,
  backgroundColor: string = SEA_PASS_EXPORT_BACKGROUND,
  approvedImageHref: string = SEA_PASS_APPROVED_SCREENSHOT_URL,
): string {
  const background = escapeXml(backgroundColor);
  const safeImageHref = escapeXml(approvedImageHref);
  const { defsMarkup, overlayMarkup } = buildSeaPassOverlaySvgMarkup(input, approvedImageHref);
  const defsSection = defsMarkup.length > 0 ? `<defs>${defsMarkup}</defs>` : '';

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${SEA_PASS_VIEWBOX.width}" height="${SEA_PASS_VIEWBOX.height}" viewBox="0 0 ${SEA_PASS_VIEWBOX.width} ${SEA_PASS_VIEWBOX.height}" fill="none">${defsSection}
  <rect x="0" y="0" width="${SEA_PASS_VIEWBOX.width}" height="${SEA_PASS_VIEWBOX.height}" fill="${background}" />
  <image href="${safeImageHref}" x="0" y="0" width="${SEA_PASS_VIEWBOX.width}" height="${SEA_PASS_VIEWBOX.height}" preserveAspectRatio="none" />${overlayMarkup}
</svg>`.trim();
}

export function buildSeaPassPrintHtml(input: Partial<SeaPassWebPassData>): string {
  const svg = buildSeaPassSvgMarkup(input, SEA_PASS_EXPORT_BACKGROUND, SEA_PASS_APPROVED_SCREENSHOT_URL);

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <style>
      @page {
        size: 1024px 1536px;
        margin: 0;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .sheet {
        width: 1024px;
        height: 1536px;
      }
      .sheet svg {
        width: 100%;
        height: 100%;
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="sheet">${svg}</div>
  </body>
</html>`.trim();
}

export async function exportSeaPassPngOnWeb(input: Partial<SeaPassWebPassData>, fileName: string): Promise<void> {
  let approvedImageHref: string;

  try {
    approvedImageHref = await getSeaPassApprovedScreenshotDataUrl();
    console.log('[SeaPassWebPass] Approved SeaPass shell embedded for exact PNG export');
  } catch (error) {
    console.error('[SeaPassWebPass] Unable to prepare approved SeaPass shell for PNG export', error);
    throw new Error('The approved SeaPass artwork is not ready for export yet. Please try again in a moment.');
  }

  const svgMarkup = buildSeaPassSvgMarkup(input, SEA_PASS_EXPORT_BACKGROUND, approvedImageHref);
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = SEA_PASS_VIEWBOX.width;
          canvas.height = SEA_PASS_VIEWBOX.height;
          const context = canvas.getContext('2d');

          if (!context) {
            reject(new Error('Canvas context unavailable.'));
            return;
          }

          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);

          const pngUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Failed to render PNG export.'));
        }
      };
      image.onerror = () => reject(new Error('Failed to load SeaPass SVG for PNG export.'));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function getSeaPassExportBaseName(input: Partial<SeaPassWebPassData>): string {
  const data = getSeaPassData(input);
  const reservation = data.reservation.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'reservation';
  const stateroom = data.stateroom.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'stateroom';
  return `seapass-${reservation}-${stateroom}`;
}
