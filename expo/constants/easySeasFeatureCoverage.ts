export type EasySeasFeatureCoverageStatus = 'represented' | 'partial';

export interface EasySeasFeatureCoverageItem {
  id: number;
  title: string;
  status: EasySeasFeatureCoverageStatus;
  representedIn: string[];
  deficiencies: string[];
}

export const EASYSEAS_FEATURE_COVERAGE_CHECKLIST: EasySeasFeatureCoverageItem[] = [
  {
    id: 1,
    title: 'Offer Intelligence Score',
    status: 'partial',
    representedIn: ['Offer cards', 'Offer detail pages', 'Offer scoring library', 'Ask My Data result ranking'],
    deficiencies: ['AgentX comparison/recommendation tools do not consistently expose the score as a first-class field.', 'Scores still rely on safe estimates when imported retail value, taxes, cabin type, or itinerary fields are missing.'],
  },
  {
    id: 2,
    title: 'Casino Pays For Calculator',
    status: 'partial',
    representedIn: ['Offer detail pages', 'Offer intelligence calculations', 'Decode Offer explanations'],
    deficiencies: ['The calculator is not yet shown directly on booked cruise detail or standalone certificate detail views.', 'Upgrade cost depends on available imported pricing and is estimated when exact upgrade data is absent.'],
  },
  {
    id: 3,
    title: 'Multi-Account Club Royale Sync',
    status: 'partial',
    representedIn: ['Traveler profile fields', 'Owner/source email ownership fields', 'Import owner assignment', 'Profile-aware scoring functions'],
    deficiencies: ['There is no complete All Profiles / single profile / household / unassigned filter bar across all major screens.', 'Unknown-email assignment flow is not yet a dedicated review UI.', 'Linked traveler creation and switching exists at the data layer but is not fully surfaced as a polished multi-account workflow.'],
  },
  {
    id: 4,
    title: 'Certificate Stacking Notes on Certificate View',
    status: 'partial',
    representedIn: ['Offer detail certificate stacking notes', 'Certificate-aware offer scoring', 'Certificate Advisor AgentX mode'],
    deficiencies: ['Stacking notes are attached to offer detail, not a complete standalone certificate detail view.', 'Linked-profile certificate comparison is currently informational and limited by available owner/profile data.'],
  },
  {
    id: 5,
    title: 'Machine Condition Log',
    status: 'represented',
    representedIn: ['Machine Condition Log provider', 'Machine Atlas condition log panel', 'AgentX AP Scout context'],
    deficiencies: [],
  },
  {
    id: 6,
    title: 'Cruise Sea-Day Density Score',
    status: 'represented',
    representedIn: ['Cruise cards', 'Cruise detail planning intelligence', 'Offer intelligence scoring', 'Cruise replacement candidates'],
    deficiencies: ['Casino-open assumptions use itinerary-derived estimates when exact onboard casino hours are not imported.'],
  },
  {
    id: 7,
    title: 'Offer Expiration Command Center',
    status: 'represented',
    representedIn: ['Offers dashboard Command Center card', 'Full Command Center management screen', 'Expiration buckets', 'View/Decode/Compare/Archive/Mark skipped/Ask actions'],
    deficiencies: ['Only the highest-priority visible buckets/items are surfaced on the dashboard preview; the full queue lives in Command Center.'],
  },
  {
    id: 8,
    title: 'Royal / Celebrity Dual-System Mode',
    status: 'partial',
    representedIn: ['Brand and casino-program data fields', 'Royal/Celebrity sync toggle', 'Blue Chip and Club Royale labeling', 'Brand-aware offer labels'],
    deficiencies: ['Royal-only / Celebrity-only / all-brand filters are not consistently present on every planning, offer, and AgentX surface.', 'Some legacy copy still emphasizes Club Royale first even when Celebrity data is supported.'],
  },
  {
    id: 9,
    title: 'AgentX Mode Selector',
    status: 'represented',
    representedIn: ['AgentX mode selector strip', 'Travel Agent mode', 'Casino Host mode', 'Certificate Advisor mode', 'Loyalty Strategist mode', 'AP Scout mode', 'Calendar Planner mode', 'Import Auditor mode', 'EasySeas Guide mode'],
    deficiencies: ['AgentX states the selected mode, but selected profile/brand/archive context needs stronger visible confirmation in every answer.'],
  },
  {
    id: 10,
    title: 'Decode Offer Button',
    status: 'partial',
    representedIn: ['Offer cards', 'Offer detail pages', 'Expiration Command Center actions', 'Decoded offer helper'],
    deficiencies: ['Decode is not yet embedded as a structured action inside every AgentX response.', 'Certificate detail decoding is limited by the absence of a full standalone certificate detail page.'],
  },
  {
    id: 11,
    title: 'Cruise Replacement Finder',
    status: 'partial',
    representedIn: ['Cruise detail planning intelligence', 'Replacement Finder candidate list', 'Replacement ranking logic'],
    deficiencies: ['There is no goal picker yet for value, lower cost, sea days, back-to-back fit, expiring offer use, new ports, ship familiarity, or tier progress.', 'Results are shown on cruise detail rather than a fuller comparison workspace.'],
  },
  {
    id: 12,
    title: 'Permanent Passenger Calendar Button',
    status: 'partial',
    representedIn: ['Calendar Passenger view toggle', 'Life-at-sea timeline', 'Sea/port/land/expiration/tier/personal color coding'],
    deficiencies: ['The requested permanent button exists as a Passenger toggle, not a separate persistent button.', 'Profile/account filter support is not fully surfaced in the calendar view.', 'The visible timeline is capped for readability, so very large annual schedules need a fuller drill-down view.'],
  },
  {
    id: 13,
    title: 'Port Repetition / New Port Tracker',
    status: 'partial',
    representedIn: ['Cruise detail new-port score', 'Port tracker calculations', 'Offer intelligence planning boost'],
    deficiencies: ['There is no dedicated port history screen with all visited ports, countries, visit counts, and repeated itinerary badges.', 'Household versus individual novelty is only as strong as the current owner/profile data available to the tracker.'],
  },
  {
    id: 14,
    title: 'Ship Familiarity Score',
    status: 'partial',
    representedIn: ['Cruise detail ship score', 'Ship familiarity calculations', 'Offer intelligence planning boost', 'Replacement Finder ranking'],
    deficiencies: ['Machine/casino notes are not yet deeply merged into the score beyond available cruise and offer history.', 'There is no standalone ship familiarity history page.'],
  },
  {
    id: 15,
    title: 'Offer Archive Guard',
    status: 'partial',
    representedIn: ['Archive status fields', 'Review-needed missing-offer handling', 'Command Center archive action', 'Import reconciliation guardrails'],
    deficiencies: ['Missing offers are flagged rather than deleted, but there is no full review queue with Archive / Keep Active / Restore actions for every flagged item.', 'Replaced-offer lineage is not fully visualized.'],
  },
  {
    id: 16,
    title: 'Smart Import Reconciliation',
    status: 'partial',
    representedIn: ['Import merge reconciliation summaries', 'Duplicate/overlap detection', 'Review-needed flags', 'CSV import success summaries'],
    deficiencies: ['Imports are merged immediately after reconciliation instead of presenting a pre-apply review screen.', 'Changed field-level diffs are summarized but not exposed in a dedicated row-by-row reconciliation UI.'],
  },
  {
    id: 17,
    title: 'Ask My Data / Natural Language Search',
    status: 'partial',
    representedIn: ['AgentX Ask My Data tool', 'Natural-language data search parser', 'Ranked result formatting'],
    deficiencies: ['There is no standalone search screen outside AgentX.', 'Current selected profile and brand filters are not consistently passed into the search function.', 'The parser handles common queries but is not a full semantic query engine.'],
  },
  {
    id: 18,
    title: 'Learn the System / Book + App Companion',
    status: 'represented',
    representedIn: ['Learn the System screen', 'Dashboard entry card', 'Responsible-use and legal note', 'Scott Astin books companion card'],
    deficiencies: ['Book links depend on Settings companion links and are not duplicated inside the Learn screen.'],
  },
];

export const EASYSEAS_FEATURE_DEFICIENCIES = EASYSEAS_FEATURE_COVERAGE_CHECKLIST.flatMap((feature) =>
  feature.deficiencies.map((deficiency) => ({
    featureId: feature.id,
    featureTitle: feature.title,
    deficiency,
  })),
);
