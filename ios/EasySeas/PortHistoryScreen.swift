import SwiftUI

/// Port history screen — shows all departure ports the user has sailed from.
struct PortHistoryScreen: View {
    @Bindable var store: EasySeasStore

    private var portCounts: [(port: String, count: Int, lastSailed: Date)] {
        var counts: [String: (count: Int, lastSailed: Date)] = [:]
        for cruise in store.bookedCruises {
            let port = cruise.departurePort
            let existing = counts[port]
            counts[port] = ((existing?.count ?? 0) + 1, max(existing?.lastSailed ?? .distantPast, cruise.sailDate))
        }
        for sailing in store.sailings {
            let port = sailing.departurePort
            guard !counts.keys.contains(port) else { continue }
            counts[port] = (1, sailing.sailDate)
        }
        return counts.map { (port: $0.key, count: $0.value.count, lastSailed: $0.value.lastSailed) }
            .sorted { $0.lastSailed > $1.lastSailed }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                heroCard
                if portCounts.isEmpty {
                    EmptyStateView(title: "No port history", subtitle: "Import cruises or run Sync Now to populate your port history.", systemImage: "map")
                } else {
                    ForEach(portCounts, id: \.port) { entry in
                        portRow(entry)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 100)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Port History")
        .navigationBarTitleDisplayMode(.large)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "map.fill")
                    .font(.title2)
                    .foregroundStyle(EasySeasTheme.gold)
                Text("Departure Port History")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(.white)
            }
            Text("\(portCounts.count) port(s) visited across \(store.bookedCruises.count) booked cruises.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.82))
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 20))
        .cardShadow()
    }

    private func portRow(_ entry: (port: String, count: Int, lastSailed: Date)) -> some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(EasySeasTheme.aqua.opacity(0.12))
                    .frame(width: 48, height: 48)
                Image(systemName: "ferry.fill")
                    .foregroundStyle(EasySeasTheme.aqua)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(entry.port)
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(EasySeasTheme.navy)
                Text("\(entry.count) departure(s) • Last: \(Formatters.shortDate.string(from: entry.lastSailed))")
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
            }
            Spacer()
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }
}
