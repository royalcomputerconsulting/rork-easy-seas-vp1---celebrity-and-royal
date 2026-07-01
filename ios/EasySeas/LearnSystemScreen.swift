import SwiftUI

struct LearnSystemScreen: View {
    struct LearningTopic: Identifiable {
        let id: String
        let title: String
        let subtitle: String
        let bullets: [String]
        let symbol: String
        let accent: Color
    }

    struct TopicGroup: Identifiable {
        let id: String
        let title: String
        let accent: Color
        let topics: [LearningTopic]
    }

    private let groups: [TopicGroup] = [
        TopicGroup(id: "getting-started", title: "Getting Started", accent: EasySeasTheme.aqua, topics: [
            LearningTopic(id: "app-tutorials", title: "EasySeas app overview", subtitle: "Where to begin and what each tab does", symbol: "sparkles", accent: EasySeasTheme.aqua, bullets: [
                "Offers tab: Import and review casino offers, expiration urgency, decoded value, and scoring.",
                "Cruises tab: Browse available sailings by All Ships, Available, or All. Filter by ship, cabin type, and date.",
                "Booked tab: Track your upcoming and completed voyages, casino points, and stats.",
                "Calendar tab: View cruise events, offer deadlines, and imported travel dates.",
                "Slots tab: Browse slot machine observations, manage your slot atlas, and browse machines by ship.",
                "Settings tab: Sync casino programs, manage profile, and access tools.",
            ]),
            LearningTopic(id: "casino-basics", title: "Cruise casino basics", subtitle: "How cruise casino value is usually evaluated", symbol: "ferry.fill", accent: Color.blue, bullets: [
                "Casino value is not only the cabin price; taxes, fees, upgrade costs, FreePlay, and OBC all matter.",
                "Sea days generally create more casino-open time than port-heavy itineraries.",
                "Points earned onboard determine future offer tier and cabin eligibility.",
            ]),
        ]),
        TopicGroup(id: "offers", title: "Understanding Casino Offers", accent: EasySeasTheme.gold, topics: [
            LearningTopic(id: "offer-codes", title: "Offer codes explained", subtitle: "How to read casino offer codes", symbol: "tag.fill", accent: EasySeasTheme.gold, bullets: [
                "Offer codes follow patterns like 26BCP105 (year + program + sequence).",
                "The first two digits indicate the offer year (e.g., 26 = 2026).",
                "Letter groups identify the casino program and campaign.",
                "Trailing numbers sequence the offer within the campaign.",
            ]),
            LearningTopic(id: "offer-value", title: "Calculating offer value", subtitle: "Trade-in, FreePlay, OBC, and comps", symbol: "dollarsign.circle.fill", accent: EasySeasTheme.money, bullets: [
                "Trade-in value: The credit applied when you book using this offer.",
                "FreePlay: Casino credit loaded to your onboard account.",
                "Onboard Credit (OBC): Spending credit for the cruise.",
                "Total value = Trade-in + FreePlay + OBC + cabin upgrade eligibility.",
            ]),
        ]),
        TopicGroup(id: "loyalty", title: "Loyalty Programs", accent: Color.purple, topics: [
            LearningTopic(id: "club-royale", title: "Club Royale tiers", subtitle: "Royal Caribbean's casino loyalty program", symbol: "crown.fill", accent: EasySeasTheme.gold, bullets: [
                "Choice: 0-24,999 points — entry level",
                "Prime: 25,000-99,999 points — annual complimentary cruise",
                "Signature: 100,000-249,999 points — upgraded cabin and benefits",
                "Masters: 250,000+ points — premium tier with top benefits",
            ]),
            LearningTopic(id: "crown-anchor", title: "Crown & Anchor Society", subtitle: "Royal Caribbean's general loyalty program", symbol: "anchor.fill", accent: Color.blue, bullets: [
                "Points are earned per night sailed, with bonuses for suites and solo travelers.",
                "Gold: 3+ points, Platinum: 30+, Emerald: 55+, Diamond: 80+, Diamond Plus: 175+, Pinnacle: 700+.",
                "Benefits include balcony discounts, priority boarding, and onboard perks.",
            ]),
        ]),
        TopicGroup(id: "sync", title: "Syncing & Importing Data", accent: Color.orange, topics: [
            LearningTopic(id: "sync-now", title: "Sync Now explained", subtitle: "How the casino program sync works", symbol: "arrow.triangle.2.circlepath", accent: EasySeasTheme.aqua, bullets: [
                "Sync Now captures all casino offers, sailings per offer, booked cruises, loyalty, and completed history.",
                "The sync scrapes Royal Caribbean and Celebrity account pages.",
                "Offer codes are normalized automatically to prevent duplicates.",
                "Completed cruises are detected by return date and merged into the booked portfolio.",
            ]),
            LearningTopic(id: "import", title: "Importing data", subtitle: "CSV import and export options", symbol: "square.and.arrow.down.fill", accent: EasySeasTheme.seafoam, bullets: [
                "Import casino offer CSVs to bulk-add offers and sailings.",
                "Import booked cruise CSVs to track your portfolio.",
                "Export your portfolio as CSV for external analysis.",
                "Import Review helps validate assignments before merging.",
            ]),
        ]),
        TopicGroup(id: "resources", title: "Resources", accent: Color.teal, topics: [
            LearningTopic(id: "books", title: "Recommended reading", subtitle: "Books by Scott Astin", symbol: "book.fill", accent: Color.indigo, bullets: [
                "Smooth Sailing in Rough Waters — casino strategy and cruise planning guide.",
                "Available on Amazon in Kindle and paperback formats.",
                "Authored by Scott Astin, founder of the Easy Seas methodology.",
            ]),
            LearningTopic(id: "terms", title: "Key terms glossary", subtitle: "Important cruise and casino vocabulary", symbol: "character.book.closed.fill", accent: Color.cyan, bullets: [
                "PPH: Points Per Hour — a measure of casino play efficiency.",
                "Coin-in: Total amount wagered through a machine.",
                "Theoretical loss: Expected loss based on house edge and coin-in.",
                "Comp value: The estimated value of complimentary items received.",
            ]),
        ]),
    ]

    @State private var expandedTopics: Set<String> = []

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                heroCard

                ForEach(groups) { group in
                    groupSection(group)
                }

                disclaimerCard
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 100)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Learn the System")
        .navigationBarTitleDisplayMode(.large)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "book.fill")
                    .font(.title2)
                    .foregroundStyle(EasySeasTheme.gold)
                Text("EasySeas Knowledge Base")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(.white)
            }
            Text("Offer math, certificates, loyalty basics, machine logs, and EasySeas tutorials.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.82))
                .lineSpacing(3)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 20))
        .cardShadow()
    }

    private func groupSection(_ group: TopicGroup) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Circle()
                    .fill(group.accent)
                    .frame(width: 8, height: 8)
                Text(group.title)
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(EasySeasTheme.navy)
            }

            ForEach(group.topics) { topic in
                topicCard(topic)
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private func topicCard(_ topic: LearningTopic) -> some View {
        let isExpanded = expandedTopics.contains(topic.id)

        return VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(.snappy) {
                    if isExpanded {
                        expandedTopics.remove(topic.id)
                    } else {
                        expandedTopics.insert(topic.id)
                    }
                }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: topic.symbol)
                        .foregroundStyle(.white)
                        .frame(width: 32, height: 32)
                        .background(topic.accent, in: .circle)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(topic.title)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(EasySeasTheme.navy)
                        Text(topic.subtitle)
                            .font(.caption)
                            .foregroundStyle(EasySeasTheme.textSecondary)
                    }
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(EasySeasTheme.textSecondary)
                }
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(topic.bullets, id: \.self) { bullet in
                        HStack(alignment: .top, spacing: 8) {
                            Circle()
                                .fill(topic.accent)
                                .frame(width: 6, height: 6)
                                .padding(.top, 6)
                            Text(bullet)
                                .font(.caption)
                                .foregroundStyle(EasySeasTheme.textSecondary)
                                .lineSpacing(2)
                        }
                    }
                }
                .padding(.leading, 42)
                .padding(.top, 4)
            }
        }
        .padding(10)
        .background(EasySeasTheme.background, in: .rect(cornerRadius: 14)))
    }

    private var disclaimerCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "info.circle.fill")
                    .foregroundStyle(EasySeasTheme.aqua)
                Text("Disclaimer")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(EasySeasTheme.navy)
            }
            Text("Easy Seas is for informational planning only. It is not gambling, legal, financial, or tax advice. Cruise line trademarks and program names belong to their respective owners; Easy Seas is not affiliated with or endorsed by those companies.")
                .font(.caption)
                .foregroundStyle(EasySeasTheme.textSecondary)
                .lineSpacing(3)
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 20)))
    }
}
