import SwiftUI

struct CruisesScreen: View {
    @Bindable var store: EasySeasStore
    @State private var selectedCabin: CabinType? = nil
    @State private var noConflictsOnly: Bool = true
    @State private var activeTab: CruiseTab = .available
    @State private var sortOrder: SortOrder = .soonest

    enum CruiseTab: String, CaseIterable, Identifiable {
        case available = "Available"
        case all = "All"
        case b2b = "Back 2 Back"
        case booked = "Booked"
        var id: String { rawValue }
    }

    enum SortOrder: String, CaseIterable, Identifiable {
        case soonest = "Soonest"
        case longest = "Longest"
        case highestValue = "Value"
        var id: String { rawValue }
    }

    private var hasConflict: (CruiseSailing) -> Bool {
        { sailing in
            store.upcomingBookedCruises.contains { booked in
                sailing.sailDate <= booked.returnDate && booked.sailDate <= sailing.returnDate
            }
        }
    }

    private var filteredSailings: [CruiseSailing] {
        var result = store.upcomingSailings

        switch activeTab {
        case .available:
            result = result.filter { !hasConflict($0) }
        case .all:
            break
        case .b2b:
            return [] // Handled separately
        case .booked:
            return [] // Handled separately
        }

        if let cabin = selectedCabin {
            result = result.filter { $0.cabinType == cabin }
        }
        if noConflictsOnly && activeTab == .all {
            result = result.filter { !hasConflict($0) }
        }

        switch sortOrder {
        case .soonest:
            result.sort { $0.sailDate < $1.sailDate }
        case .longest:
            result.sort { $0.nights > $1.nights }
        case .highestValue:
            result.sort { $0.retailValue > $1.retailValue }
        }
        return result
    }

    private var backToBackSets: [B2BSet] {
        calculateBackToBackSets()
    }

    struct B2BSet: Identifiable {
        let id: String
        let sailings: [CruiseSailing]
        let totalNights: Int
        let departurePort: String
        let startDate: Date
        let endDate: Date
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 16) {
                    BrandSelectorView(store: store)
                    SectionHeader(title: "Cruise Finder", subtitle: "Eligible sailings from current offers — filter, sort, and book.", systemImage: "calendar.badge.clock")

                    tabBar
                    filterBar

                    switch activeTab {
                    case .available, .all:
                        ForEach(filteredSailings) { sailing in
                            NavigationLink {
                                CruiseDetailScreen(store: store, sailing: sailing)
                            } label: {
                                CruiseSailingCardView(sailing: sailing)
                            }
                            .buttonStyle(.plain)
                        }
                        if filteredSailings.isEmpty {
                            EmptyStateView(title: "No sailings match", subtitle: "Adjust filters to see more options.", systemImage: "calendar.badge.exclamationmark")
                        }
                    case .b2b:
                        b2bSection
                    case .booked:
                        bookedSection
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 100)
            }
            .background(EasySeasTheme.background.ignoresSafeArea())
            .navigationTitle("Cruises")
            .toolbarTitleDisplayMode(.large)
        }
    }

    // MARK: - Tab bar
    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(CruiseTab.allCases) { tab in
                    Button {
                        withAnimation(.snappy) { activeTab = tab }
                    } label: {
                        Text(tab.rawValue)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(activeTab == tab ? .white : EasySeasTheme.navy)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(activeTab == tab ? EasySeasTheme.navy : EasySeasTheme.navy.opacity(0.08), in: .capsule)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Filter bar
    private var filterBar: some View {
        VStack(alignment: .leading, spacing: 12) {
            Toggle(isOn: $noConflictsOnly) {
                Label("Hide schedule conflicts", systemImage: "checkmark.shield.fill")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(EasySeasTheme.navy)
            }
            .tint(EasySeasTheme.aqua)

            HStack(spacing: 6) {
                Text("Sort:").font(.caption.weight(.bold)).foregroundStyle(EasySeasTheme.textSecondary)
                ForEach(SortOrder.allCases) { order in
                    Button {
                        withAnimation(.snappy) { sortOrder = order }
                    } label: {
                        Text(order.rawValue)
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(sortOrder == order ? .white : EasySeasTheme.navy)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(sortOrder == order ? EasySeasTheme.navy : Color.clear, in: .capsule)
                    }
                    .buttonStyle(.plain)
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    cabinButton(nil, label: "All")
                    ForEach(CabinType.allCases) { cabin in
                        cabinButton(cabin, label: cabin.rawValue)
                    }
                }
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    // MARK: - B2B Section
    private var b2bSection: some View {
        VStack(spacing: 14) {
            if backToBackSets.isEmpty {
                EmptyStateView(title: "No Back-to-Back Sets Found", subtitle: "No consecutive cruise pairs with different offer codes that fit your schedule.", systemImage: "link")
            } else {
                ForEach(Array(backToBackSets.enumerated()), id: \.element.id) { index, set in
                    b2bSetCard(set, index: index + 1)
                }
            }
        }
    }

    private func b2bSetCard(_ set: B2BSet, index: Int) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "link")
                    .foregroundStyle(EasySeasTheme.aqua)
                Text("Back-to-Back Set #\(index)")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(set.totalNights)N total")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(EasySeasTheme.gold)
            }

            HStack(spacing: 12) {
                Label("\(Formatters.shortDate.string(from: set.startDate)) → \(Formatters.shortDate.string(from: set.endDate))", systemImage: "calendar")
                Label(set.departurePort, systemImage: "mappin.and.ellipse")
            }
            .font(.caption)
            .foregroundStyle(.white.opacity(0.82))

            ForEach(Array(set.sailings.enumerated()), id: \.offset) { idx, sailing in
                HStack(spacing: 10) {
                    Text("\(idx + 1)")
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(.white)
                        .frame(width: 22, height: 22)
                        .background(EasySeasTheme.aqua, in: .circle)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(sailing.shipName) — \(sailing.itineraryName)")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.white)
                        Text("\(sailing.nights)N • \(sailing.offerCode)")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.7))
                    }
                    Spacer()
                }
                .padding(8)
                .background(.white.opacity(0.1), in: .rect(cornerRadius: 10)))
            }
        }
        .padding(14)
        .background(LinearGradient(colors: [EasySeasTheme.navyDeep, EasySeasTheme.navy], startPoint: .topLeading, endPoint: .bottomTrailing), in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.aqua.opacity(0.3), lineWidth: 1))
    }

    // MARK: - Booked Section
    private var bookedSection: some View {
        VStack(spacing: 12) {
            ForEach(store.selectedBookedCruises) { cruise in
                NavigationLink {
                    BookedCruiseDetailScreen(cruise: cruise)
                } label: {
                    BookedCruiseCardView(cruise: cruise)
                }
                .buttonStyle(.plain)
            }
            if store.selectedBookedCruises.isEmpty {
                EmptyStateView(title: "No booked cruises", subtitle: "Book a sailing or run Sync Now.", systemImage: "ferry")
            }
        }
    }

    // MARK: - Cabin button
    private func cabinButton(_ cabin: CabinType?, label: String) -> some View {
        Button {
            withAnimation(.snappy) { selectedCabin = cabin }
        } label: {
            Text(label)
                .font(.caption.weight(.heavy))
                .foregroundStyle(selectedCabin == cabin ? .white : EasySeasTheme.navy)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(selectedCabin == cabin ? EasySeasTheme.navy : EasySeasTheme.navy.opacity(0.08), in: .capsule)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Back-to-Back calculation
    private func calculateBackToBackSets() -> [B2BSet] {
        var sets: [B2BSet] = []
        let sorted = store.upcomingSailings.sorted { $0.sailDate < $1.sailDate }

        for i in 0..<sorted.count {
            for j in (i + 1)..<min(i + 3, sorted.count) {
                let first = sorted[i]
                let second = sorted[j]
                guard first.offerCode != second.offerCode else { continue }
                let gapDays = Calendar.current.dateComponents([.day], from: first.returnDate, to: second.sailDate).day ?? 99
                guard gapDays >= 0 && gapDays <= 2 else { continue }
                guard first.brand == second.brand else { continue }

                let set = B2BSet(
                    id: "b2b-\(first.id)-\(second.id)",
                    sailings: [first, second],
                    totalNights: first.nights + second.nights,
                    departurePort: first.departurePort,
                    startDate: first.sailDate,
                    endDate: second.returnDate
                )
                if !sets.contains(where: { $0.sailings.map(\.id).sorted() == set.sailings.map(\.id).sorted() }) {
                    sets.append(set)
                }
            }
        }
        return Array(sets.prefix(10))
    }
}
