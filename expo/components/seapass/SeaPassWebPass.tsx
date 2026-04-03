import React, { memo, useMemo } from 'react';
import { DimensionValue, Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import {
  BOARDING_KEY_RING_PATH,
  getSeaPassBarcodeBars,
  getSeaPassBarcodeCaption,
  getSeaPassData,
  ROYAL_CARIBBEAN_LOGO_PATHS,
  SEA_PASS_LAYOUT,
  SEA_PASS_LEGAL_LINES,
  SEA_PASS_NAME_LINES,
  SEA_PASS_PORT,
  SEA_PASS_PREVIEW_BACKGROUND,
  SEA_PASS_STATUS,
  SEA_PASS_VIEWBOX,
  type SeaPassWebPassData,
} from '@/lib/seaPassWebPass';

const SVG_FONT_FAMILY = Platform.select({
  ios: 'Helvetica Neue',
  android: 'sans-serif',
  default: 'Arial, Helvetica, sans-serif',
}) ?? 'System';

function buildHeaderPath(): string {
  const { cardX, cardY, cardWidth, headerHeight, radius } = SEA_PASS_LAYOUT;
  const top = cardY;
  const left = cardX;
  const right = cardX + cardWidth;
  const bottom = cardY + headerHeight;

  return `M${left + radius} ${top}H${right - radius}C${right - 12} ${top} ${right} ${top + 12} ${right} ${top + radius}V${bottom}H${left}V${top + radius}C${left} ${top + 12} ${left + 12} ${top} ${left + radius} ${top}Z`;
}

export interface SeaPassBarcodeProps {
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export const SeaPassBarcode = memo(function SeaPassBarcode({
  value,
  x,
  y,
  width,
  height,
  color = '#1E1F25',
}: SeaPassBarcodeProps) {
  const bars = useMemo(() => getSeaPassBarcodeBars(value, width), [value, width]);

  return (
    <G>
      {bars.map((bar, index) => (
        <Rect
          key={`${value}-${index}-${bar.x}`}
          x={x + bar.x}
          y={y}
          width={bar.width}
          height={height}
          rx={1.4}
          fill={color}
        />
      ))}
    </G>
  );
});

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
  const data = useMemo(() => getSeaPassData(input), [input]);
  const barcodeCaption = useMemo(() => getSeaPassBarcodeCaption(data), [data]);
  const headerPath = useMemo(() => buildHeaderPath(), []);

  return (
    <View style={[styles.container, style, { width }]} testID={testID ?? 'seapass.preview'}>
      <View style={styles.aspectRatioFrame}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${SEA_PASS_VIEWBOX.width} ${SEA_PASS_VIEWBOX.height}`}>
          <Defs>
            <SvgLinearGradient id="seaPassHeader" x1="0" y1="0" x2="1024" y2="548" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#4F2A95" />
              <Stop offset="0.52" stopColor="#6F49AE" />
              <Stop offset="1" stopColor="#5A319F" />
            </SvgLinearGradient>
            <SvgLinearGradient id="seaPassBody" x1="24" y1="572" x2="1000" y2="1512" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FAFAFB" />
              <Stop offset="1" stopColor="#F2F3F5" />
            </SvgLinearGradient>
          </Defs>

          <Rect x={24} y={24} width={976} height={1488} rx={34} fill="url(#seaPassBody)" />
          <Path d={headerPath} fill="url(#seaPassHeader)" />
          <Circle cx={512} cy={24} r={36} fill={SEA_PASS_PREVIEW_BACKGROUND} />
          <Circle cx={24} cy={556} r={34} fill={SEA_PASS_PREVIEW_BACKGROUND} />
          <Circle cx={1000} cy={556} r={34} fill={SEA_PASS_PREVIEW_BACKGROUND} />

          <G transform="translate(58 58)">
            <Path d={ROYAL_CARIBBEAN_LOGO_PATHS.crown} fill="#FFFFFF" />
            <Path d={ROYAL_CARIBBEAN_LOGO_PATHS.anchor} fill="#FFFFFF" />
            <SvgText x={128} y={66} fontFamily={SVG_FONT_FAMILY} fontSize={54} fontWeight="600" fill="#FFFFFF">
              Royal Caribbean
            </SvgText>
          </G>

          <SvgText
            x={916}
            y={106}
            textAnchor="end"
            fontFamily={SVG_FONT_FAMILY}
            fontSize={52}
            fontWeight="400"
            fill="#FFFFFF"
          >
            {data.time}
          </SvgText>
          <SvgText
            x={916}
            y={176}
            textAnchor="end"
            fontFamily={SVG_FONT_FAMILY}
            fontSize={72}
            fontWeight="300"
            fill="#FFFFFF"
          >
            {data.date}
          </SvgText>

          <SvgText x={60} y={222} fontFamily={SVG_FONT_FAMILY} fontSize={72} fontWeight="700" fill="#FFFFFF">
            {SEA_PASS_NAME_LINES[0]}
          </SvgText>
          <SvgText x={60} y={326} fontFamily={SVG_FONT_FAMILY} fontSize={72} fontWeight="700" fill="#FFFFFF">
            {SEA_PASS_NAME_LINES[1]}
          </SvgText>
          <SvgText x={60} y={422} fontFamily={SVG_FONT_FAMILY} fontSize={48} fontWeight="400" fill="#F7F3FF">
            {SEA_PASS_STATUS}
          </SvgText>

          <G transform="translate(58 446)">
            <Path d={BOARDING_KEY_RING_PATH} fill="#FFFFFF" />
          </G>

          <SvgText x={64} y={652} fontFamily={SVG_FONT_FAMILY} fontSize={32} fontWeight="500" fill="#8E929B">
            DECK
          </SvgText>
          <SvgText x={64} y={716} fontFamily={SVG_FONT_FAMILY} fontSize={56} fontWeight="400" fill="#30333A">
            {data.deck}
          </SvgText>
          <SvgText x={250} y={652} fontFamily={SVG_FONT_FAMILY} fontSize={32} fontWeight="500" fill="#8E929B">
            STATEROOM
          </SvgText>
          <SvgText x={250} y={716} fontFamily={SVG_FONT_FAMILY} fontSize={56} fontWeight="400" fill="#30333A">
            {data.stateroom}
          </SvgText>
          <SvgText
            x={912}
            y={652}
            textAnchor="end"
            fontFamily={SVG_FONT_FAMILY}
            fontSize={32}
            fontWeight="500"
            fill="#8E929B"
          >
            MUSTER
          </SvgText>
          <SvgText
            x={912}
            y={716}
            textAnchor="end"
            fontFamily={SVG_FONT_FAMILY}
            fontSize={56}
            fontWeight="400"
            fill="#30333A"
          >
            {data.muster}
          </SvgText>

          <SvgText x={64} y={840} fontFamily={SVG_FONT_FAMILY} fontSize={32} fontWeight="500" fill="#8E929B">
            RESERVATION #
          </SvgText>
          <SvgText x={64} y={904} fontFamily={SVG_FONT_FAMILY} fontSize={56} fontWeight="400" fill="#30333A">
            {data.reservation}
          </SvgText>
          <SvgText
            x={912}
            y={840}
            textAnchor="end"
            fontFamily={SVG_FONT_FAMILY}
            fontSize={32}
            fontWeight="500"
            fill="#8E929B"
          >
            SHIP
          </SvgText>
          <SvgText
            x={912}
            y={904}
            textAnchor="end"
            fontFamily={SVG_FONT_FAMILY}
            fontSize={56}
            fontWeight="400"
            fill="#30333A"
          >
            {data.ship}
          </SvgText>

          <SvgText x={64} y={1030} fontFamily={SVG_FONT_FAMILY} fontSize={32} fontWeight="500" fill="#8E929B">
            PORT
          </SvgText>
          <SvgText x={64} y={1096} fontFamily={SVG_FONT_FAMILY} fontSize={58} fontWeight="400" fill="#30333A">
            {SEA_PASS_PORT}
          </SvgText>

          <SvgText x={64} y={1210} fontFamily={SVG_FONT_FAMILY} fontSize={31} fontWeight="400" fill="#42454D">
            {SEA_PASS_LEGAL_LINES[0]}
          </SvgText>
          <SvgText x={64} y={1260} fontFamily={SVG_FONT_FAMILY} fontSize={31} fontWeight="400" fill="#42454D">
            {SEA_PASS_LEGAL_LINES[1]}
          </SvgText>
          <SvgText x={64} y={1310} fontFamily={SVG_FONT_FAMILY} fontSize={31} fontWeight="400" fill="#42454D">
            {SEA_PASS_LEGAL_LINES[2]}
          </SvgText>

          <SeaPassBarcode
            value={barcodeCaption}
            x={SEA_PASS_LAYOUT.barcodeX}
            y={SEA_PASS_LAYOUT.barcodeY}
            width={SEA_PASS_LAYOUT.barcodeWidth}
            height={SEA_PASS_LAYOUT.barcodeHeight}
          />

          <SvgText
            x={512}
            y={1350}
            textAnchor="middle"
            fontFamily={SVG_FONT_FAMILY}
            fontSize={42}
            fontWeight="400"
            fill="#30333A"
          >
            {barcodeCaption}
          </SvgText>

          <G transform="translate(640 1340)">
            <Rect width={286} height={116} rx={18} fill="#25262B" />
            <Rect x={28} y={27} width={84} height={62} rx={14} fill="#F4F5F7" />
            <Rect x={34} y={34} width={72} height={10} rx={4} fill="#8DC7E7" />
            <Rect x={34} y={44} width={72} height={10} rx={4} fill="#C6D57E" />
            <Rect x={34} y={54} width={72} height={10} rx={4} fill="#E7C06A" />
            <Path d="M44 64H96V70C96 78 89 84 82 84H58C50 84 44 78 44 70V64Z" fill="#D3956F" />
            <SvgText x={130} y={58} fontFamily={SVG_FONT_FAMILY} fontSize={24} fontWeight="500" fill="#FFFFFF">
              Add to
            </SvgText>
            <SvgText x={130} y={95} fontFamily={SVG_FONT_FAMILY} fontSize={34} fontWeight="400" fill="#FFFFFF">
              Apple Wallet
            </SvgText>
          </G>
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
