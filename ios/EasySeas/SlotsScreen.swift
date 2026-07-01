import SwiftUI

struct SlotsScreen: View {
    @Bindable var store: EasySeasStore
    @State private var showingFavoritesOnly: Bool = false
    @State private var showSessionsSection: Bool = false
    @State private var activeSlotMode: SlotMode = .atlas

    enum SlotMode: String, CaseIterable, Identifiable {
        case atlas = "Atlas"
        case sessions = "Sessions"
        case strategy = "Strategy"
        var id: String { rawValue }
    }

    private var machines: [SlotMachine] {
        let base = store.filteredSlotMachines
        return showingFavoritesOnly ? base.filter(\.isFavorite) : base
    }

    // Simulated session stats
    private var totalSessions: Int { max(1, machines.count * 3) }
    private var averageDuration: Int { Int.random(in: 45...120) }
    private var totalWins: Int { Int.random(in: 5...35) }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 14) {
                    SectionHeader(title: "Slot Atlas", subtitle: "Machines, volatility, denominations, and ships where they have been spotted.", systemImage: "gamecontroller.fill")

                    Picker("Mode", selection: $activeSlotMode) {
                        ForEach(SlotMode.allCases) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)

                    switch activeSlotMode {
                    case .atlas:
                        atlasSection
                    case .sessions:
                        sessionsSection
                    case .strategy:
                        strategySection
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 100)
            }
            .background(EasySeasTheme.background.ignoresSafeArea())
            .navigationTitle("Slots")
            .toolbarTitleDisplayMode(.large)
            .searchable(text: $store.searchText, prompt: "Search machines, ships, makers")
        }
    }

    // MARK: - Atlas Section
    private var atlasSection: some View {
        VStack(spacing: 14) {
            // Stats summary
            HStack(spacing: 10) {
                StatTile(value: "\(machines.count)", label: "Machines", systemImage: "gamecontroller.fill", color: EasySeasTheme.navy)
                StatTile(value: "\(totalSessions)", label: "Sessions", systemImage: "timer", color: EasySeasTheme.aqua)
                StatTile(value: "\(totalWins)", label: "Wins", systemImage: "trophy.fill", color: EasySeasTheme.gold)
            }

            Toggle(isOn: $showingFavoritesOnly) {
                Label("Favorites only", systemImage: "star.fill")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(EasySeasTheme.navy)
            }
            .tint(EasySeasTheme.gold)
            .padding(14)
            .background(.white, in: .rect(cornerRadius: 18))

            ForEach(machines) { machine in
                NavigationLink {
                    MachineDetailScreen(machine: machine, store: store)
                } label: {
                    SlotMachineRow(machine: machine) {
                        withAnimation(.snappy) { store.toggleFavorite(machine: machine) }
                    }
                }
                .buttonStyle(.plain)
            }

            if machines.isEmpty {
                EmptyStateView(title: "No machines found", subtitle: "Try another search or turn off favorites-only mode.", systemImage: "magnifyingglass")
            }
        }
    }

    // MARK: - Sessions Section
    private var sessionsSection: some View {
        VStack(spacing: 14) {
            sessionsSummaryCard
            playingHoursCard
            casinoOpenHoursCard
            sessionTrackerCard
        }
    }

    private var sessionsSummaryCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Session Summary", subtitle: "Overview of all logged slot play sessions.", systemImage: "chart.bar.fill")

            HStack(spacing: 10) {
                StatTile(value: "\(totalSessions)", label: "Total Sessions", systemImage: "timer", color: EasySeasTheme.navy)
                StatTile(value: "\(averageDuration)m avg", label: "Duration", systemImage: "clock", color: EasySeasTheme.aqua)
                StatTile(value: "\(totalWins)", label: "Wins Logged", systemImage: "trophy.fill", color: EasySeasTheme.gold)
            }

            PrimaryButton(title: "Log New Session", systemImage: "plus.circle.fill") {
                store.syncLogs.append(SyncLogEntry(kind: .success, message: "New slot session logged"))
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var playingHoursCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Playing Hours", subtitle: "Your preferred casino session times.", systemImage: "clock.fill")

            VStack(spacing: 8) {
                playingHourRow("Morning", "5:00 AM - 9:00 AM", true)
                playingHourRow("Afternoon", "2:00 PM - 6:00 PM", true)
                playingHourRow("Late Night", "11:00 PM - 2:00 AM", false)
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private func playingHourRow(_ name: String, _ time: String, _ enabled: Bool) -> some View {
        HStack(spacing: 12) {
            Toggle("", isOn: .constant(enabled))
                .labelsHidden()
                .tint(EasySeasTheme.navy)
                .scaleEffect(0.8)
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.subheadline.weight(.bold)).foregroundStyle(EasySeasTheme.navy)
                Text(time).font(.caption).foregroundStyle(EasySeasTheme.textSecondary)
            }
            Spacer()
            Text("180 min").font(.caption.weight(.bold)).foregroundStyle(EasySeasTheme.aqua)
        }
        .padding(8)
        .background(EasySeasTheme.background, in: .rect(cornerRadius: 10)))
    }

    private var casinoOpenHoursCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Casino Open Hours", subtitle: "Based on next upcoming cruise ship schedule.", systemImage: "ferry.fill")

            if let next = store.upcomingBookedCruises.first {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Next cruise: \(next.shipName)")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(EasySeasTheme.navy)
                    Text("\(Formatters.shortDate.string(from: next.sailDate)) • \(next.nights) nights")
                        .font(.caption)
                        .foregroundStyle(EasySeasTheme.textSecondary)
                    Text("Casino typically opens at 9:00 AM on sea days and 5:00 PM on port days. Hours vary by ship and itinerary.")
                        .font(.caption)
                        .foregroundStyle(EasySeasTheme.textSecondary)
                        .lineSpacing(3)
                        .padding(.top, 4)
                }
            } else {
                Text("No upcoming cruise to estimate casino hours.")
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var sessionTrackerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Today's Plan", subtitle: "Golden time slots and session tracker for \(Formatters.shortDate.string(from: Date())).", systemImage: "calendar.badge.clock")

            VStack(spacing: 8) {
                trackerRow("Morning Window", "5:00 AM - 8:00 AM", "3h of casino-open golden time")
                trackerRow("Afternoon Window", "2:00 PM - 5:00 PM", "Peak play window on sea days")
                trackerRow("Late Window", "11:00 PM - 2:00 AM", "Premium late-night play")
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private func trackerRow(_ name: String, _ time: String, _ detail: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(name).font(.subheadline.weight(.bold)).foregroundStyle(EasySeasTheme.navy)
                Spacer()
                Text(time).font(.caption.weight(.bold)).foregroundStyle(EasySeasTheme.aqua)
            }
            Text(detail).font(.caption).foregroundStyle(EasySeasTheme.textSecondary)
        }
        .padding(10)
        .background(EasySeasTheme.background, in: .rect(cornerRadius: 12)))
    }

    // MARK: - Strategy Section
    private var strategySection: some View {
        VStack(spacing: 14) {
            SectionHeader(title: "Machine Strategy", subtitle: "Tips for maximizing your slot play based on machine characteristics.", systemImage: "lightbulb.fill")

            VStack(alignment: .leading, spacing: 10) {
                strategyTip("Volatility Matching", "High volatility = bigger wins but longer dry spells. Low volatility = steady small wins. Match to your bankroll size.", "chart.line.flattrend.xyaxis")
                strategyTip("Denomination Strategy", "Lower denominations (1¢, 2¢) let you play longer on the same bankroll. Higher denominations ($1+) generate more tier points per spin.", "dollarsign.circle")
                strategyTip("Fleet Familiarity", "Machines spotted on multiple ships are consistent across the fleet. Learn their patterns on one ship and apply them fleet-wide.", "ferry")
            }
            .padding(14)
            .background(.white, in: .rect(cornerRadius: 18)))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))

            topMachinesCard
        }
    }

    private func strategyTip(_ title: String, _ detail: String, _ symbol: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .frame(width: 32, height: 32)
                .foregroundStyle(.white)
                .background(EasySeasTheme.nauticalGradient, in: .circle)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.weight(.bold)).foregroundStyle(EasySeasTheme.navy)
                Text(detail).font(.caption).foregroundStyle(EasySeasTheme.textSecondary).lineSpacing(2)
            }
        }
        .padding(8)
        .background(EasySeasTheme.background, in: .rect(cornerRadius: 12)))
    }

    private var topMachinesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Top Machines by Ship", subtitle: "Frequently spotted machines across your cruise fleet.", systemImage: "star.fill")

            let grouped = Dictionary(grouping: store.slotMachines.filter(\.isFavorite)) { machine in
                machine.shipsSeen.first ?? "Fleet"
            }
            ForEach(Array(grouped.keys.sorted().prefix(5)), id: \.self) { ship in
                VStack(alignment: .leading, spacing: 4) {
                    Text(ship).font(.subheadline.weight(.bold)).foregroundStyle(EasySeasTheme.navy)
                    if let machines = grouped[ship] {
                        Text(machines.map(\.name).joined(separator: ", "))
                            .font(.caption)
                            .foregroundStyle(EasySeasTheme.textSecondary)
                            .lineLimit(2)
                    }
                }
                .padding(8)
                .background(EasySeasTheme.background, in: .rect(cornerRadius: 10)))
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }
}
