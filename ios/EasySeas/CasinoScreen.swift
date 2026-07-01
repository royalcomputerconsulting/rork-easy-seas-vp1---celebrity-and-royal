import SwiftUI

struct CasinoScreen: View {
    @Bindable var store: EasySeasStore
    @State private var activeMode: CasinoMode = .intelligence

    enum CasinoMode: String, CaseIterable, Identifiable {
        case intelligence = "Intelligence"
        case tiers = "Tiers"
        case sessions = "Sessions"
        var id: String { rawValue }
    }

    private var netValue: Double { store.totalRetailValue - store.totalPaid }
    private var completedPoints: Int { store.completedBookedCruises.reduce(0) { $0 + $1.casinoPoints } }
    private var totalNights: Int { store.selectedBookedCruises.reduce(0) { $0 + $1.nights } }

    // MARK: - Tier levels based on Club Royale + Crown & Anchor
    private var clubRoyaleTier: String {
        let pts = store.clubRoyalePoints
        if pts >= 250_000 { return "Masters" }
        if pts >= 100_000 { return "Signature" }
        if pts >= 25_000 { return "Prime" }
        return "Choice"
    }

    private var nextTier: (name: String, pointsNeeded: Int, progress: Double) {
        let pts = store.clubRoyalePoints
        if pts < 25_000 { return ("Prime", 25_000, Double(pts) / 25_000.0) }
        if pts < 100_000 { return ("Signature", 100_000, Double(pts - 25_000) / 75_000.0) }
        if pts < 250_000 { return ("Masters", 250_000, Double(pts - 100_000) / 150_000.0) }
        return ("Masters (Max)", 250_000, 1.0)
    }

    private var crownAnchorLevel: String {
        let pts = store.crownAnchorPoints
        if pts >= 700 { return "Pinnacle" }
        if pts >= 175 { return "Diamond Plus" }
        if pts >= 80 { return "Diamond" }
        if pts >= 55 { return "Emerald" }
        if pts >= 30 { return "Platinum" }
        return "Gold"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 16) {
                    heroCard

                    Picker("Mode", selection: $activeMode) {
                        ForEach(CasinoMode.allCases) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)

                    switch activeMode {
                    case .intelligence:
                        intelligenceSection
                        portfolioSection
                        completedResultsSection
                    case .tiers:
                        tierSection
                        crownAnchorSection
                    case .sessions:
                        sessionTrackingSection
                    }
                }
                .padding(.bottom, 100)
            }
            .background(EasySeasTheme.background.ignoresSafeArea())
            .navigationTitle("Casino")
            .toolbarTitleDisplayMode(.large)
        }
    }

    // MARK: - Hero Card
    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("2026 Casino Season")
                .font(.headline.weight(.heavy))
                .foregroundStyle(.white)

            HStack(spacing: 10) {
                darkMetric("Club Royale", store.clubRoyalePoints.formatted() + " pts")
                darkMetric("Tier", clubRoyaleTier)
                darkMetric("C&A", "\(store.crownAnchorPoints) pts")
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Path to \(nextTier.name)")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white.opacity(0.9))
                    Spacer()
                    Text("\(Int(nextTier.progress * 100))%")
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(EasySeasTheme.gold)
                }
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.18))
                        Capsule()
                            .fill(LinearGradient(colors: [EasySeasTheme.gold, EasySeasTheme.goldLight], startPoint: .leading, endPoint: .trailing))
                            .frame(width: max(8, proxy.size.width * min(max(nextTier.progress, 0), 1)))
                    }
                }
                .frame(height: 6)
                Text("\(nextTier.pointsNeeded - store.clubRoyalePoints) points to \(nextTier.name)")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.65))
            }
        }
        .padding(16)
        .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 24))
        .cardShadow()
        .padding(.horizontal, 16)
    }

    // MARK: - Intelligence Section
    private var intelligenceSection: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                StatTile(value: Formatters.dollars(store.totalRetailValue), label: "Retail Value", systemImage: "dollarsign.circle.fill", color: EasySeasTheme.money)
                StatTile(value: Formatters.dollars(store.totalPaid), label: "Total Paid", systemImage: "creditcard.fill", color: EasySeasTheme.aqua)
                StatTile(value: Formatters.dollars(netValue), label: "Net Captured", systemImage: "chart.line.uptrend.xyaxis", color: EasySeasTheme.seafoam)
            }
            HStack(spacing: 10) {
                StatTile(value: "\(store.selectedBookedCruises.count)", label: "Cruises", systemImage: "ferry.fill", color: EasySeasTheme.navy)
                StatTile(value: "\(totalNights)", label: "Nights", systemImage: "moon.stars.fill", color: EasySeasTheme.purple)
                StatTile(value: Formatters.dollars(store.averageValuePerCruise), label: "Avg Value", systemImage: "chart.bar.fill", color: EasySeasTheme.gold)
            }
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Portfolio value
    private var portfolioSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "Portfolio Value", subtitle: "Retail vs. paid comparison for booked cruises.", systemImage: "chart.pie.fill")

            ForEach(store.selectedBookedCruises.prefix(8)) { cruise in
                VStack(spacing: 6) {
                    HStack {
                        Text(cruise.shipName)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(EasySeasTheme.navy)
                        Spacer()
                        Text(cruise.isCompleted ? "Done" : "Upcoming")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(cruise.isCompleted ? EasySeasTheme.purple : EasySeasTheme.money)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background((cruise.isCompleted ? EasySeasTheme.purple : EasySeasTheme.money).opacity(0.1), in: .capsule)
                    }
                    HStack {
                        labeledValue("Retail", Formatters.dollars(cruise.retailValue))
                        Spacer()
                        labeledValue("Paid", Formatters.dollars(cruise.totalPaid))
                        Spacer()
                        labeledValue("Net", Formatters.dollars(max(0, cruise.retailValue - cruise.totalPaid)))
                    }
                }
                .padding(12)
                .background(EasySeasTheme.background, in: .rect(cornerRadius: 14)))
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 20)))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))
        .padding(.horizontal, 16)
    }

    private func labeledValue(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value).font(.caption.weight(.bold)).foregroundStyle(EasySeasTheme.navy)
            Text(label).font(.caption2).foregroundStyle(EasySeasTheme.textSecondary)
        }
    }

    // MARK: - Completed results
    private var completedResultsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Completed Cruise Results", subtitle: "ROI and performance from past sailings.", systemImage: "checkmark.seal.fill")

            ForEach(store.completedBookedCruises) { cruise in
                NavigationLink {
                    BookedCruiseDetailScreen(cruise: cruise)
                } label: {
                    BookedCruiseCardView(cruise: cruise)
                }
                .buttonStyle(.plain)
            }

            if store.completedBookedCruises.isEmpty {
                EmptyStateView(title: "No completed cruises yet", subtitle: "Completed Royal and Celebrity cruises appear here after Sync Now.", systemImage: "chart.bar")
            }
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Tier Section
    private var tierSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHeader(title: "Club Royale Tiers", subtitle: "Casino loyalty program progression.", systemImage: "crown.fill")

            ForEach(["Choice" as String, "Prime", "Signature", "Masters"], id: \.self) { tier in
                let threshold = tierThreshold(tier)
                let isCurrent = clubRoyaleTier == tier
                let isAchieved = store.clubRoyalePoints >= threshold
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(tier)
                            .font(.subheadline.weight(.heavy))
                            .foregroundStyle(isCurrent ? EasySeasTheme.gold : EasySeasTheme.navy)
                        Spacer()
                        Text("\(threshold.formatted()) pts")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(EasySeasTheme.textSecondary)
                        if isCurrent {
                            Text("CURRENT")
                                .font(.caption2.weight(.heavy))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(EasySeasTheme.gold, in: .capsule)
                        }
                    }
                    ProgressMetricView(
                        title: isAchieved ? "Achieved" : "Progress",
                        detail: "\(store.clubRoyalePoints) of \(threshold) points",
                        progress: min(Double(store.clubRoyalePoints) / Double(max(threshold, 1)), 1.0),
                        tint: isCurrent ? EasySeasTheme.gold : EasySeasTheme.aqua
                    )
                }
                .padding(12)
                .background(isCurrent ? EasySeasTheme.gold.opacity(0.06) : Color.clear, in: .rect(cornerRadius: 14)))
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 20)))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))
        .padding(.horizontal, 16)
    }

    private func tierThreshold(_ tier: String) -> Int {
        switch tier {
        case "Choice": return 0
        case "Prime": return 25_000
        case "Signature": return 100_000
        case "Masters": return 250_000
        default: return 0
        }
    }

    // MARK: - Crown & Anchor
    private var crownAnchorSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHeader(title: "Crown & Anchor Society", subtitle: "General loyalty program tier and points.", systemImage: "anchor.fill")

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Current Level: \(crownAnchorLevel)")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(EasySeasTheme.navy)
                        Text("\(store.crownAnchorPoints) points earned across \(totalNights) nights sailed.")
                            .font(.caption)
                            .foregroundStyle(EasySeasTheme.textSecondary)
                    }
                    Spacer()
                }

                ForEach(["Gold" as String, "Platinum", "Emerald", "Diamond", "Diamond Plus", "Pinnacle"], id: \.self) { level in
                    let threshold = crownAnchorThreshold(level)
                    HStack {
                        Text(level)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(crownAnchorLevel == level ? EasySeasTheme.gold : EasySeasTheme.textSecondary)
                        Spacer()
                        Text("\(threshold)+")
                            .font(.caption2)
                            .foregroundStyle(EasySeasTheme.textSecondary)
                        if crownAnchorLevel == level {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.caption)
                                .foregroundStyle(EasySeasTheme.gold)
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 20)))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))
        .padding(.horizontal, 16)
    }

    private func crownAnchorThreshold(_ level: String) -> Int {
        switch level {
        case "Gold": return 3
        case "Platinum": return 30
        case "Emerald": return 55
        case "Diamond": return 80
        case "Diamond Plus": return 175
        case "Pinnacle": return 700
        default: return 0
        }
    }

    // MARK: - Session Tracking
    private var sessionTrackingSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "Session Tracking", subtitle: "Log casino sessions to track PPH, points, and performance.", systemImage: "timer")

            VStack(spacing: 10) {
                sessionPrompt("Morning Session", "5:00 AM - 9:00 AM", "Early morning play when casino is quiet.")
                sessionPrompt("Afternoon Session", "2:00 PM - 6:00 PM", "Peak afternoon play on sea days.")
                sessionPrompt("Late Night Session", "11:00 PM - 2:00 AM", "High-limit late-night play window.")
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 20)))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))
        .padding(.horizontal, 16)
    }

    private func sessionPrompt(_ name: String, _ time: String, _ desc: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(name).font(.subheadline.weight(.bold)).foregroundStyle(EasySeasTheme.navy)
                Spacer()
                Text(time).font(.caption.weight(.bold)).foregroundStyle(EasySeasTheme.aqua)
            }
            Text(desc).font(.caption).foregroundStyle(EasySeasTheme.textSecondary)
            HStack {
                Spacer()
                Button("Log Session") {}
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(EasySeasTheme.navy, in: .capsule)
            }
        }
        .padding(10)
        .background(EasySeasTheme.background, in: .rect(cornerRadius: 14)))
    }

    // MARK: - Dark metric
    private func darkMetric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.headline.weight(.heavy))
                .foregroundStyle(EasySeasTheme.gold)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.76))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.white.opacity(0.10), in: .rect(cornerRadius: 16))
    }
}
