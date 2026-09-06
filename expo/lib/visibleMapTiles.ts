export interface VisibleMapTile {
  key: string;
  url: string;
  left: number;
  top: number;
}

export interface VisibleMapTileLayout {
  tiles: VisibleMapTile[];
  markerLeft: number;
  markerTop: number;
  zoom: number;
}

export function buildVisibleMapTileLayout(
  latitude: number,
  longitude: number,
  width: number,
  height: number,
  zoom = 7,
): VisibleMapTileLayout {
  const safeLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const normalizedLongitude = ((longitude + 180) % 360 + 360) % 360 - 180;
  const tileCount = 2 ** zoom;
  const x = ((normalizedLongitude + 180) / 360) * tileCount;
  const radians = safeLatitude * Math.PI / 180;
  const y = (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * tileCount;
  const baseX = Math.floor(x);
  const baseY = Math.floor(y);
  const fractionX = x - baseX;
  const fractionY = y - baseY;
  const tiles: VisibleMapTile[] = [];

  for (let row = -1; row <= 1; row += 1) {
    for (let column = -1; column <= 1; column += 1) {
      const tileX = ((baseX + column) % tileCount + tileCount) % tileCount;
      const tileY = Math.max(0, Math.min(tileCount - 1, baseY + row));
      tiles.push({
        key: `${zoom}-${tileX}-${tileY}-${column}-${row}`,
        url: `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`,
        left: (width / 2) + ((column - fractionX) * 256),
        top: (height / 2) + ((row - fractionY) * 256),
      });
    }
  }

  return {
    tiles,
    markerLeft: width / 2,
    markerTop: height / 2,
    zoom,
  };
}
