const fs = require('fs');
const ts = require('typescript');

const files = [
  'lib/casino/casinoForecasting.ts',
  'components/analytics/CasinoForecastingCard.tsx',
  'app/(tabs)/analytics.tsx',
  'state/AgentXProvider.tsx',
  'lib/casino/index.ts',
];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
    fileName: file,
  });
  const errors = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    console.error(`❌ ${file} has TypeScript parse errors`);
    for (const error of errors) console.error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
    process.exit(1);
  }
}

const engine = fs.readFileSync('lib/casino/casinoForecasting.ts', 'utf8');
const requiredFunctions = [
  'predictNextMonthCertificates',
  'predictInstantCertificate',
  'forecastAnnualCruiseValue',
  'forecastClassificationMovement',
  'calculateFutureCasinoPlayExpectedValue',
  'compareCasinoPlayers',
  'buildCasinoStrengthForecast',
];
for (const fn of requiredFunctions) {
  if (!engine.includes(`function ${fn}`)) {
    console.error(`❌ Missing ${fn}`);
    process.exit(1);
  }
}
const analytics = fs.readFileSync('app/(tabs)/analytics.tsx', 'utf8');
if (!analytics.includes('CasinoForecastingCard') || !analytics.includes('buildCasinoStrengthForecast')) {
  console.error('❌ Analytics screen is not wired to CasinoForecastingCard and buildCasinoStrengthForecast');
  process.exit(1);
}
const agent = fs.readFileSync('state/AgentXProvider.tsx', 'utf8');
for (const term of ['Casino Forecasting:', 'predicted next monthly certificates', 'Classification movement', 'Future casino-play directional value']) {
  if (!agent.includes(term)) {
    console.error(`❌ AgentX missing forecasting context term: ${term}`);
    process.exit(1);
  }
}
console.log('✅ v1048 casino forecasting mini-phase checks passed');
