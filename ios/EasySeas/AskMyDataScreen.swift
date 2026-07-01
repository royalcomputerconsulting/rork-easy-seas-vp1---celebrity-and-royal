import SwiftUI

struct AskMyDataScreen: View {
    @Bindable var store: EasySeasStore
    @State private var query: String = ""
    @State private var results: [AskMyDataResult] = []
    @State private var isSearching: Bool = false
    @FocusState private var isSearchFocused: Bool

    enum AskMyDataSource: String, CaseIterable, Identifiable {
        case overview, offers, cruises, certificates, calendar, slots
        var id: String { rawValue }
        var label: String {
            switch self {
            case .overview: "Overview"
            case .offers: "Offers"
            case .cruises: "Cruises"
            case .certificates: "Certificates"
            case .calendar: "Calendar"
            case .slots: "Slots"
            }
        }
        var symbol: String {
            switch self {
            case .overview: "sparkles"
            case .offers: "tag.fill"
            case .cruises: "ferry.fill"
            case .certificates: "ticket.fill"
            case .calendar: "calendar"
            case .slots: "gamecontroller.fill"
            }
        }
        var tint: Color {
            switch self {
            case .overview: Color.blue
            case .offers: EasySeasTheme.aqua
            case .cruises: Color.blue
            case .certificates: Color.orange
            case .calendar: Color.purple
            case .slots: Color.indigo
            }
        }
    }

    struct AskMyDataResult: Identifiable {
        let id: UUID = UUID()
        let source: AskMyDataSource
        let title: String
        let subtitle: String
        let match: String
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                heroCard
                scopeCard
                searchCard

                if !results.isEmpty {
                    resultsSection
                } else if !query.isEmpty && !isSearching {
                    EmptyStateView(
                        title: "No results found",
                        subtitle: "Try a different search term or clear the scope filter.",
                        systemImage: "magnifyingglass"
                    )
                }

                quickActionsSection
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 100)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Ask My Data")
        .navigationBarTitleDisplayMode(.large)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "wand.and.stars")
                    .font(.title2)
                    .foregroundStyle(EasySeasTheme.gold)
                Text("Search your cruise portfolio")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(.white)
            }
            Text("Natural-language search across offers, cruises, certificates, calendar, and slot machines. Try queries like \"suite deals\" or \"next 30 days Caribbean\".")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.82))
                .lineSpacing(3)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 20))
        .cardShadow()
    }

    private var scopeCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Search Scope")
                .font(.subheadline.weight(.heavy))
                .foregroundStyle(EasySeasTheme.navy)
            HStack(spacing: 8) {
                BrandPill(brand: .royalCaribbean, isSelected: store.selectedBrand == .royalCaribbean)
                BrandPill(brand: .celebrity, isSelected: store.selectedBrand == .celebrity)
            }
            Text("\(store.offers.count) offers, \(store.sailings.count) sailings, \(store.bookedCruises.count) booked cruises, \(store.slotMachines.count) slot machines scoped to \(store.selectedBrand.title)")
                .font(.caption)
                .foregroundStyle(EasySeasTheme.textSecondary)
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var searchCard: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(EasySeasTheme.textSecondary)
                TextField("Search offers, cruises, ships...", text: $query)
                    .focused($isSearchFocused)
                    .submitLabel(.search)
                    .onSubmit { performSearch() }
                if !query.isEmpty {
                    Button { query = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(EasySeasTheme.textSecondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(12)
            .background(EasySeasTheme.background, in: .rect(cornerRadius: 14))

            PrimaryButton(
                title: isSearching ? "Searching..." : "Search",
                systemImage: "magnifyingglass",
                isLoading: isSearching
            ) {
                performSearch()
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var resultsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("\(results.count) result(s) for \"\(query)\"")
                .font(.headline.weight(.heavy))
                .foregroundStyle(EasySeasTheme.navy)

            ForEach(results) { result in
                resultRow(result)
            }
        }
    }

    private func resultRow(_ result: AskMyDataResult) -> some View {
        HStack(spacing: 12) {
            Image(systemName: result.source.symbol)
                .foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(result.source.tint, in: .circle)

            VStack(alignment: .leading, spacing: 3) {
                Text(result.title)
                    .font(.subheadline.weight(.heavy))
                    .foregroundStyle(EasySeasTheme.navy)
                    .lineLimit(1)
                Text(result.subtitle)
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(result.source.label)
                .font(.caption2.weight(.bold))
                .foregroundStyle(result.source.tint)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(result.source.tint.opacity(0.12), in: .capsule)
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 16)))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Actions")
                .font(.headline.weight(.heavy))
                .foregroundStyle(EasySeasTheme.navy)

            quickActionButton("sparkles", "Portfolio Overview", "Summary of all offers, cruises, and bookings") { runOverviewSearch() }
            quickActionButton("tag.fill", "Active Offers", "Find all active casino offers") { runSearch("active offers") }
            quickActionButton("ferry.fill", "Upcoming Sailings", "View sailings in the next 90 days") { runSearch("upcoming sailings") }
            quickActionButton("calendar", "Completed Cruises", "Review completed cruise history") { runSearch("completed cruises") }
            quickActionButton("chart.line.uptrend.xyaxis", "Casino Performance", "Search for casino points and wins") { runSearch("casino points wins") }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private func quickActionButton(_ systemImage: String, _ title: String, _ subtitle: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(EasySeasTheme.nauticalGradient, in: .circle)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.subheadline.weight(.heavy)).foregroundStyle(EasySeasTheme.navy)
                    Text(subtitle).font(.caption).foregroundStyle(EasySeasTheme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(EasySeasTheme.textSecondary)
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }

    private func performSearch() {
        guard !query.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isSearching = true
        let q = query.lowercased().trimmingCharacters(in: .whitespaces)
        var found: [AskMyDataResult] = []

        // Search offers
        for offer in store.activeOffers {
            if offer.name.lowercased().contains(q) || offer.code.lowercased().contains(q) {
                found.append(AskMyDataResult(source: .offers, title: offer.name, subtitle: "Code: \(offer.code) — Expires \(Formatters.shortDate.string(from: offer.expiresOn))", match: q))
            }
            for perk in offer.perks where perk.lowercased().contains(q) {
                found.append(AskMyDataResult(source: .offers, title: "\(offer.name) perk: \(perk)", subtitle: "Code: \(offer.code)", match: q))
            }
        }

        // Search sailings
        for sailing in store.upcomingSailings {
            if sailing.shipName.lowercased().contains(q) || sailing.itineraryName.lowercased().contains(q) || sailing.destination.lowercased().contains(q) || sailing.departurePort.lowercased().contains(q) {
                found.append(AskMyDataResult(source: .cruises, title: "\(sailing.shipName) — \(sailing.itineraryName)", subtitle: "\(Formatters.shortDate.string(from: sailing.sailDate)) • \(sailing.nights)N • \(sailing.offerCode)", match: q))
            }
        }

        // Search booked
        for cruise in store.selectedBookedCruises {
            if cruise.shipName.lowercased().contains(q) || cruise.itineraryName.lowercased().contains(q) {
                let status = cruise.isCompleted ? "Completed" : "Upcoming"
                found.append(AskMyDataResult(source: .cruises, title: "\(cruise.shipName) — \(cruise.itineraryName)", subtitle: "\(Formatters.dollars(cruise.retailValue)) value • \(status) • \(cruise.offerCode)", match: q))
            }
        }

        // Search slots
        for machine in store.filteredSlotMachines {
            if machine.name.lowercased().contains(q) || machine.manufacturer.lowercased().contains(q) || machine.shipsSeen.joined(separator: " ").lowercased().contains(q) {
                found.append(AskMyDataResult(source: .slots, title: machine.name, subtitle: "\(machine.manufacturer) • \(machine.volatility) • \(machine.shipsSeen.joined(separator: ", "))", match: q))
            }
        }

        // Search calendar
        for event in store.calendarEvents {
            if event.title.lowercased().contains(q) || event.subtitle.lowercased().contains(q) {
                found.append(AskMyDataResult(source: .calendar, title: event.title, subtitle: "\(event.subtitle) • \(Formatters.shortDate.string(from: event.date))", match: q))
            }
        }

        results = Array(found.prefix(20))
        isSearching = false
    }

    private func runSearch(_ term: String) {
        query = term
        performSearch()
        isSearchFocused = false
    }

    private func runOverviewSearch() {
        let overview = """
        \(store.selectedBrand.title) Portfolio: \(store.activeOffers.count) active offers, \(store.upcomingSailings.count) sailings, \(store.selectedBookedCruises.count) booked cruises. Total value: \(Formatters.dollars(store.totalEconomicValue)). Club Royale: \(store.clubRoyalePoints) pts. Crown & Anchor: \(store.crownAnchorPoints) pts.
        """
        query = overview
        results = [
            AskMyDataResult(source: .overview, title: "Portfolio Summary", subtitle: "\(store.activeOffers.count) offers • \(store.upcomingSailings.count) sailings • \(store.selectedBookedCruises.count) booked", match: "overview")
        ]
        isSearchFocused = false
    }
}
