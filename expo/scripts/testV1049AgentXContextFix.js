
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const agentXPath = path.join(root, 'state', 'AgentXProvider.tsx');
const source = fs.readFileSync(agentXPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const definitionMatches = source.match(/function\s+buildCasinoIntelligenceContextText\s*\(/g) || [];
const callMatches = source.match(/buildCasinoIntelligenceContextText\s*\(/g) || [];

assert(definitionMatches.length === 1, 'Expected exactly one buildCasinoIntelligenceContextText function definition.');
assert(callMatches.length >= 2, 'Expected the function definition plus at least one call site.');
assert(source.indexOf('function buildCasinoIntelligenceContextText') < source.indexOf('const detail = buildCasinoIntelligenceContextText'), 'Function must be declared before it is called in AgentXProvider.');
assert(source.includes('Best Play Today:'), 'Context text should include Best Play Today section.');
assert(source.includes('Certificate Expiration Intelligence:'), 'Context text should include certificate expiration section.');
assert(source.includes('Top Casino Opportunity Scores:'), 'Context text should include casino opportunity section.');
assert(source.includes('Host View / Player Profile Summary:'), 'Context text should include Host View section.');

console.log('✅ v1049 AgentX context text fix checks passed');
