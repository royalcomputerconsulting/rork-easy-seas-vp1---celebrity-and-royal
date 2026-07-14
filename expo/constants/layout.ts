export const LARGE_SCREEN_BREAKPOINT = 768;
export const EXTRA_LARGE_SCREEN_BREAKPOINT = 1200;
export const DEFAULT_CONTENT_MAX_WIDTH = 980;
export const DEFAULT_TAB_BAR_MAX_WIDTH = 920;

export function getResponsiveHorizontalPadding(width: number): number {
  if (width >= EXTRA_LARGE_SCREEN_BREAKPOINT) {
    return 32;
  }

  if (width >= LARGE_SCREEN_BREAKPOINT) {
    return 24;
  }

  return 16;
}

export function getResponsiveTabBarWidth(width: number): number {
  const horizontalPadding = getResponsiveHorizontalPadding(width);
  const availableWidth = Math.max(width - horizontalPadding * 2, 320);

  return Math.min(DEFAULT_TAB_BAR_MAX_WIDTH, availableWidth);
}
