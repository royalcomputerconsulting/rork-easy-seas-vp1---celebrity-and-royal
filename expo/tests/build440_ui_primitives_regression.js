const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const primitives = fs.readFileSync(path.join(root, 'components/ui/EasySeasPrimitives.tsx'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'constants/theme.ts'), 'utf8');

const requiredExports = [
  'PageHeader',
  'ThemedSectionCard',
  'StatusBadge',
  'EasySeasSearchField',
  'FilterButton',
  'SegmentedControl',
  'MetricCard',
  'AlertCard',
  'EmptyState',
  'DefinitionList',
  'DetailSheet',
  'InlineLoading',
];

for (const name of requiredExports) {
  if (!primitives.includes(`export function ${name}`)) {
    throw new Error(`Missing shared UI primitive: ${name}`);
  }
}

for (const token of ['brandNavy', 'oceanTeal', 'canvas', 'surface', 'minimumTarget']) {
  if (!theme.includes(token)) throw new Error(`Missing Easy Seas design token: ${token}`);
}

if (!primitives.includes('accessibilityRole="button"')) {
  throw new Error('Shared controls must expose button accessibility roles.');
}
if (!primitives.includes('TYPOGRAPHY.fontFamilyEditorial')) {
  throw new Error('Shared components must use the bundled editorial face.');
}

console.log('Build 440 shared UI primitives regression passed.');
