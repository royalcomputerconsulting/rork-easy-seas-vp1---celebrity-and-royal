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

function buildBarcodeSvgMarkup(value: string): string {
  const bars = getSeaPassBarcodeBars(value, SEA_PASS_LAYOUT.barcodeWidth);

  return bars
    .map((bar) => `<rect x="${(SEA_PASS_LAYOUT.barcodeX + bar.x).toFixed(2)}" y="${SEA_PASS_LAYOUT.barcodeY}" width="${bar.width.toFixed(2)}" height="${SEA_PASS_LAYOUT.barcodeHeight}" fill="#1E1F25" rx="1.4" />`)
    .join('');
}

function buildLogoSvgMarkup(): string {
  return `
    <g transform="translate(58 58)">
      <path d="${ROYAL_CARIBBEAN_LOGO_PATHS.crown}" fill="#FFFFFF" />
      <path d="${ROYAL_CARIBBEAN_LOGO_PATHS.anchor}" fill="#FFFFFF" />
      <text x="128" y="66" font-family="${SEA_PASS_FONT_STACK}" font-size="54" font-weight="600" fill="#FFFFFF">Royal Caribbean</text>
    </g>
  `;
}

function buildKeySvgMarkup(): string {
  return `
    <g transform="translate(58 446)">
      <path d="${BOARDING_KEY_RING_PATH}" fill="#FFFFFF" />
    </g>
  `;
}

function buildWalletButtonSvgMarkup(): string {
  return `
    <g transform="translate(640 1340)">
      <rect width="286" height="116" rx="18" fill="#25262B" />
      <rect x="28" y="27" width="84" height="62" rx="14" fill="#F4F5F7" />
      <rect x="34" y="34" width="72" height="10" rx="4" fill="#8DC7E7" />
      <rect x="34" y="44" width="72" height="10" rx="4" fill="#C6D57E" />
      <rect x="34" y="54" width="72" height="10" rx="4" fill="#E7C06A" />
      <path d="M44 64H96V70C96 78 89 84 82 84H58C50 84 44 78 44 70V64Z" fill="#D3956F" />
      <text x="130" y="58" font-family="${SEA_PASS_FONT_STACK}" font-size="24" font-weight="500" fill="#FFFFFF">Add to</text>
      <text x="130" y="95" font-family="${SEA_PASS_FONT_STACK}" font-size="34" font-weight="400" fill="#FFFFFF">Apple Wallet</text>
    </g>
  `;
}

function buildHeaderPath(): string {
  const { cardX, cardY, cardWidth, headerHeight, radius } = SEA_PASS_LAYOUT;
  const top = cardY;
  const left = cardX;
  const right = cardX + cardWidth;
  const bottom = cardY + headerHeight;
  return `M${left + radius} ${top}H${right - radius}C${right - 12} ${top} ${right} ${top + 12} ${right} ${top + radius}V${bottom}H${left}V${top + radius}C${left} ${top + 12} ${left + 12} ${top} ${left + radius} ${top}Z`;
}

export function buildSeaPassSvgMarkup(input: Partial<SeaPassWebPassData>, backgroundColor: string = SEA_PASS_EXPORT_BACKGROUND): string {
  const data = getSeaPassData(input);
  const caption = getSeaPassBarcodeCaption(data);
  const headerPath = buildHeaderPath();
  const background = escapeXml(backgroundColor);

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${SEA_PASS_VIEWBOX.width}" height="${SEA_PASS_VIEWBOX.height}" viewBox="0 0 ${SEA_PASS_VIEWBOX.width} ${SEA_PASS_VIEWBOX.height}" fill="none">
  <defs>
    <linearGradient id="seaPassHeader" x1="0" y1="0" x2="1024" y2="548" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#4F2A95" />
      <stop offset="0.52" stop-color="#6F49AE" />
      <stop offset="1" stop-color="#5A319F" />
    </linearGradient>
    <linearGradient id="seaPassBody" x1="24" y1="572" x2="1000" y2="1512" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FAFAFB" />
      <stop offset="1" stop-color="#F2F3F5" />
    </linearGradient>
  </defs>
  <rect x="24" y="24" width="976" height="1488" rx="34" fill="url(#seaPassBody)" />
  <path d="${headerPath}" fill="url(#seaPassHeader)" />
  <circle cx="512" cy="24" r="36" fill="${background}" />
  <circle cx="24" cy="556" r="34" fill="${background}" />
  <circle cx="1000" cy="556" r="34" fill="${background}" />
  ${buildLogoSvgMarkup()}
  <text x="916" y="106" text-anchor="end" font-family="${SEA_PASS_FONT_STACK}" font-size="52" font-weight="400" fill="#FFFFFF">${escapeXml(data.time)}</text>
  <text x="916" y="176" text-anchor="end" font-family="${SEA_PASS_FONT_STACK}" font-size="72" font-weight="300" fill="#FFFFFF">${escapeXml(data.date)}</text>
  <text x="60" y="222" font-family="${SEA_PASS_FONT_STACK}" font-size="72" font-weight="700" fill="#FFFFFF">${SEA_PASS_NAME_LINES[0]}</text>
  <text x="60" y="326" font-family="${SEA_PASS_FONT_STACK}" font-size="72" font-weight="700" fill="#FFFFFF">${SEA_PASS_NAME_LINES[1]}</text>
  <text x="60" y="422" font-family="${SEA_PASS_FONT_STACK}" font-size="48" font-weight="400" fill="#F7F3FF">${SEA_PASS_STATUS}</text>
  ${buildKeySvgMarkup()}
  <text x="64" y="652" font-family="${SEA_PASS_FONT_STACK}" font-size="32" font-weight="500" fill="#8E929B">DECK</text>
  <text x="64" y="716" font-family="${SEA_PASS_FONT_STACK}" font-size="56" font-weight="400" fill="#30333A">${escapeXml(data.deck)}</text>
  <text x="250" y="652" font-family="${SEA_PASS_FONT_STACK}" font-size="32" font-weight="500" fill="#8E929B">STATEROOM</text>
  <text x="250" y="716" font-family="${SEA_PASS_FONT_STACK}" font-size="56" font-weight="400" fill="#30333A">${escapeXml(data.stateroom)}</text>
  <text x="912" y="652" text-anchor="end" font-family="${SEA_PASS_FONT_STACK}" font-size="32" font-weight="500" fill="#8E929B">MUSTER</text>
  <text x="912" y="716" text-anchor="end" font-family="${SEA_PASS_FONT_STACK}" font-size="56" font-weight="400" fill="#30333A">${escapeXml(data.muster)}</text>
  <text x="64" y="840" font-family="${SEA_PASS_FONT_STACK}" font-size="32" font-weight="500" fill="#8E929B">RESERVATION #</text>
  <text x="64" y="904" font-family="${SEA_PASS_FONT_STACK}" font-size="56" font-weight="400" fill="#30333A">${escapeXml(data.reservation)}</text>
  <text x="912" y="840" text-anchor="end" font-family="${SEA_PASS_FONT_STACK}" font-size="32" font-weight="500" fill="#8E929B">SHIP</text>
  <text x="912" y="904" text-anchor="end" font-family="${SEA_PASS_FONT_STACK}" font-size="56" font-weight="400" fill="#30333A">${escapeXml(data.ship)}</text>
  <text x="64" y="1030" font-family="${SEA_PASS_FONT_STACK}" font-size="32" font-weight="500" fill="#8E929B">PORT</text>
  <text x="64" y="1096" font-family="${SEA_PASS_FONT_STACK}" font-size="58" font-weight="400" fill="#30333A">${SEA_PASS_PORT}</text>
  <text x="64" y="1210" font-family="${SEA_PASS_FONT_STACK}" font-size="31" font-weight="400" fill="#42454D">${SEA_PASS_LEGAL_LINES[0]}</text>
  <text x="64" y="1260" font-family="${SEA_PASS_FONT_STACK}" font-size="31" font-weight="400" fill="#42454D">${SEA_PASS_LEGAL_LINES[1]}</text>
  <text x="64" y="1310" font-family="${SEA_PASS_FONT_STACK}" font-size="31" font-weight="400" fill="#42454D">${SEA_PASS_LEGAL_LINES[2]}</text>
  ${buildBarcodeSvgMarkup(caption)}
  <text x="512" y="1350" text-anchor="middle" font-family="${SEA_PASS_FONT_STACK}" font-size="42" font-weight="400" fill="#30333A">${escapeXml(caption)}</text>
  ${buildWalletButtonSvgMarkup()}
</svg>`.trim();
}

export function buildSeaPassPrintHtml(input: Partial<SeaPassWebPassData>): string {
  const svg = buildSeaPassSvgMarkup(input, SEA_PASS_EXPORT_BACKGROUND);

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
  const svgMarkup = buildSeaPassSvgMarkup(input, SEA_PASS_EXPORT_BACKGROUND);
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
