export const roadmapSummary = {
  foundation: {
    focus: 'Persistence, theme tokens, layout primitives, and unified CTA system',
    items: [
      'Persist AppState snapshots for cruises, booked, offers, events, and metadata',
      'Codify dual light/deep-sea palette in constants/theme.ts and refactor shared components to consume it',
      'Add spacing and typography helpers so OfferCard, CruiseCard, StatCard, and Settings rows align',
      'Promote AnimatedActionButton as the primary CTA pattern with consistent icons and feedback'
    ]
  },
  tabModernization: {
    overview: 'Split header with loyalty stack + KPI carousel, masonry cards, and highlighted next sailings',
    booked: 'Match overview parchment background, add timeline/list toggle, inject predictive stats and contextual chips',
    scheduling: 'Slide-up advanced filters, conflict heatmap, swipeable recommendation cards, and matched OfferCard visuals',
    analytics: 'Accordion structure for snapshot/predictive/portfolio, lazy charts, surfaced verification status',
    events: 'Default week view, add floating import FAB, occupancy bars, and view-specific empty states',
    settings: 'Reorder into Profile/Data Hub/Automation/Danger Zone with clearer persistence messaging and confirmations'
  },
  rollout: {
    motionTesting: [
      'Animate cards and tab transitions with Animated API respecting reduced-motion users',
      'Add visual regression stories for Offer/Cruise/Stat cards',
      'Run usability smoke tests for navigation, filter persistence, and cold-start restore',
      'Document the unified component guidelines in ROADMAP so future work stays aligned'
    ],
    successCriteria: [
      'Theme tokens adopted by 90% shared components',
      'Cold starts restore previously imported data automatically',
      'Offer and Cruise cards share spacing/typography/iconography',
      'Analytics first meaningful paint under 1.5s with progressive loading',
      'Events tab chrome stays under two rows on small devices',
      'Settings separates safe vs destructive actions with confirmations'
    ]
  }
} as const;
