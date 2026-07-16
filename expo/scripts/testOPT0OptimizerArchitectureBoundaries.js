const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { root } = require('./clubRoyaleTestBootstrap');

const ignoredDirectories = new Set(['node_modules', '.git', '.expo', 'dist', 'build']);
function listSourceFiles(start, results = []) {
  if (!fs.existsSync(start)) return results;
  const stat = fs.statSync(start);
  if (stat.isFile()) {
    if (/\.(ts|tsx)$/.test(start)) results.push(start);
    return results;
  }
  for (const entry of fs.readdirSync(start, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    listSourceFiles(path.join(start, entry.name), results);
  }
  return results;
}

const uiFiles = [
  ...listSourceFiles(path.join(root, 'app')),
  ...listSourceFiles(path.join(root, 'components')),
];
const allowedOptimizationImports = new Set([
  '@/lib/optimization',
  '@/lib/optimization/index',
  '@/lib/optimization/types',
  '@/lib/optimization/public',
]);
const forbiddenUiImports = [];
for (const file of uiFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const importPattern = /from\s+['"](@\/lib\/optimization(?:\/[^'"]+)?)['"]/g;
  let match;
  while ((match = importPattern.exec(source))) {
    if (!allowedOptimizationImports.has(match[1])) {
      forbiddenUiImports.push(`${path.relative(root, file)} -> ${match[1]}`);
    }
  }
}
assert.deepStrictEqual(
  forbiddenUiImports,
  [],
  `UI files must not import low-level optimization formulas directly:\n${forbiddenUiImports.join('\n')}`,
);

const trainingRoots = [
  path.join(root, 'lib', 'optimization'),
  path.join(root, 'backend', 'services', 'optimization'),
  path.join(root, 'state', 'PersonalCertificateOptimizerProvider.tsx'),
];
const forbiddenTrainingSources = [
  'knownProfileFallback',
  '@/mocks/',
  'confirmedBookedCruises',
  'CONFIRMED_CLUB_ROYALE_2025_POINTS',
  'getKnownCasinoProfileCruises',
];
const trainingViolations = [];
for (const file of trainingRoots.flatMap(item => listSourceFiles(item))) {
  const source = fs.readFileSync(file, 'utf8');
  for (const forbidden of forbiddenTrainingSources) {
    if (source.includes(forbidden)) trainingViolations.push(`${path.relative(root, file)} contains ${forbidden}`);
  }
}
assert.deepStrictEqual(
  trainingViolations,
  [],
  `Hidden known-profile or mock data must not enter optimizer training inputs:\n${trainingViolations.join('\n')}`,
);

console.log('PASS testOPT0OptimizerArchitectureBoundaries');
