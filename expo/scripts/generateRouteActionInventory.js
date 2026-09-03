const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const roots = ['app', 'components'];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

const records = roots.flatMap((directory) => walk(path.join(root, directory))).map((file) => {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  const testIds = unique([...source.matchAll(/testID\s*=\s*["'`]([^"'`$]+)["'`]/g)].map((match) => match[1]));
  const routes = unique([
    ...[...source.matchAll(/(?:router\.(?:push|replace)|href)\s*\(?(?:\s*\{\s*pathname:\s*)?["'`]([^"'`]+)["'`]/g)].map((match) => match[1]),
    ...[...source.matchAll(/pathname\s*:\s*["'`]([^"'`]+)["'`]/g)].map((match) => match[1]),
  ]);
  const actionCount = (source.match(/\bonPress\s*=/g) || []).length;
  const modalCount = (source.match(/<Modal\b/g) || []).length;
  const inputCount = (source.match(/<(?:TextInput|Switch|Picker)\b/g) || []).length;
  return { relative, testIds, routes, actionCount, modalCount, inputCount };
}).filter((record) => record.testIds.length || record.routes.length || record.actionCount || record.modalCount || record.inputCount);

const lines = [
  '# Easy Seas Build 445 — Route and Action Inventory',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  'This inventory is a presentation-preservation contract. Counts identify interactive source surfaces; stable test IDs and explicit destinations list the controls that can be exercised automatically. A redesign may move these controls, but may not silently remove them.',
  '',
  `- Interactive source files: ${records.length}`,
  `- onPress bindings: ${records.reduce((sum, record) => sum + record.actionCount, 0)}`,
  `- Stable test IDs: ${unique(records.flatMap((record) => record.testIds)).length}`,
  `- Explicit route destinations: ${unique(records.flatMap((record) => record.routes)).length}`,
  `- Modal declarations: ${records.reduce((sum, record) => sum + record.modalCount, 0)}`,
  `- Input declarations: ${records.reduce((sum, record) => sum + record.inputCount, 0)}`,
  '',
  '| Source | Actions | Modals | Inputs | Stable test IDs | Explicit destinations |',
  '| --- | ---: | ---: | ---: | --- | --- |',
  ...records.map((record) => `| \`${record.relative}\` | ${record.actionCount} | ${record.modalCount} | ${record.inputCount} | ${record.testIds.map((id) => `\`${id}\``).join('<br>') || '—'} | ${record.routes.map((route) => `\`${route}\``).join('<br>') || '—'} |`),
  '',
  '## Acceptance rule',
  '',
  'For each touched screen, compare its action, modal, input, test-ID, and route counts with this baseline. Any reduction must be explicitly accounted for as a deliberate move to another reachable screen; otherwise it is a regression.',
  '',
];

fs.writeFileSync(path.join(root, 'BUILD445_ROUTE_ACTION_INVENTORY.md'), `${lines.join('\n')}\n`);
console.log(`Wrote BUILD445_ROUTE_ACTION_INVENTORY.md with ${records.length} interactive files.`);
