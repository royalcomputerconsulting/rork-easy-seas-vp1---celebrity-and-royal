const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const schedulerPath = path.join(root, 'lib', 'runAfterUiSettles.ts');
const casinoPath = path.join(root, 'components', 'casino', 'CasinoCommandCenter.tsx');
const analyticsPath = path.join(root, 'app', '(tabs)', 'analytics.tsx');

const scheduler = fs.readFileSync(schedulerPath, 'utf8');
const casino = fs.readFileSync(casinoPath, 'utf8');
const analytics = fs.readFileSync(analyticsPath, 'utf8');

assert(
  scheduler.includes("import * as ReactNative from 'react-native';"),
  'runAfterUiSettles must not require the deprecated InteractionManager named export to exist',
);
assert(
  !scheduler.includes("import { InteractionManager } from 'react-native';"),
  'runAfterUiSettles must access InteractionManager through the guarded React Native namespace',
);
assert(
  scheduler.includes('manager?.runAfterInteractions'),
  'runAfterUiSettles must guard InteractionManager before calling runAfterInteractions',
);
assert(
  scheduler.includes('setTimeout(callback, fallbackDelayMs)'),
  'runAfterUiSettles must fall back to a timer when InteractionManager is unavailable',
);
assert(
  casino.includes('useEffect') && casino.includes('CASINO_TRUTH_BATCH_SIZE'),
  'CasinoCommandCenter must retain bounded, deferred casino computation',
);
assert(
  !casino.includes('InteractionManager.runAfterInteractions'),
  'CasinoCommandCenter must not call InteractionManager directly',
);
assert(
  analytics.includes('useEffect') && analytics.includes('useMemo'),
  'Casino tab shell must retain effect-driven, memoized computation',
);
assert(
  !analytics.includes('InteractionManager.runAfterInteractions'),
  'Casino tab shell must not call InteractionManager directly',
);

console.log('build411 casino scheduler regression passed');
