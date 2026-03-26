const IS_DEV = __DEV__;

export const debugLog = (tag: string, ...args: unknown[]) => {
  if (IS_DEV) {
    console.log(`[${tag}]`, ...args);
  }
};

export const debugWarn = (tag: string, ...args: unknown[]) => {
  if (IS_DEV) {
    console.warn(`[${tag}]`, ...args);
  }
};

export const debugError = (tag: string, ...args: unknown[]) => {
  console.error(`[${tag}]`, ...args);
};
