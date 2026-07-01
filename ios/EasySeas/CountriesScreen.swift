import SwiftUI

/// Countries screen — destination distribution from booked and available cruises.
struct CountriesScreen: View {
    @Bindable var store: EasySeasStore

    private var destinationCounts: [(destination: String, count: Int, ships: [String])] {
        var counts: [String: (count: Int, ships: Set<String>)] = [:]
        for sailing in store.sailings {
            let dest = sailing.destination
            var current = counts[dest] ?? (0, [])
            current.count += 1
            current.ships.insert(sailing.shipName)
            counts[dest] = current
        }
        for cruise in store.bookedCruises {
            let dest = cruise.itineraryName.components(separatedBy: ":").last?.trimmingCharacters(in: .whitespaces) ?? cruise.itineraryName
            guard !dest.isEmpty else { continue }
            var current = counts[dest] ?? (0, [])
            current.count += 1
            current.ships.insert(cruise.shipName)
            counts[dest] = current
        }
        return counts.map { (destination: $0.key, count: $0.value.count, ships: Array($0.value.ships)) }
            .sorted { $0.count > $1.count }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                heroCard
                if destinationCounts.isEmpty {
                    EmptyStateView(title: "No destinations", subtitle: "Import cruises or run Sync Now to see destination distribution.", systemImage: "globe.americas.fill")
                } else {
                    ForEach(destinationCounts, id: \.destination) { entry in
                        destinationRow(entry)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 100)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Destination Map")
        .navigationBarTitleDisplayMode(.large)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "globe.americas.fill")
                    .font(.title2)
                    .foregroundStyle(EasySeasTheme.gold)
                Text("Destination Distribution")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(.white)
            }
            Text("\(destinationCounts.count) destinations across \(store.sailings.count + store.bookedCruises.count) cruises.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.82))
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 20))
        .cardShadow()
    }

    private func destinationRow(_ entry: (destination: String, count: Int, ships: [String])) -> some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 14)
                    .fill(EasySeasTheme.aqua.opacity(0.12))
                    .frame(width: 48, height: 48)
                Image(systemName: "mappin.and.ellipse")
                    .foregroundStyle(EasySeasTheme.aqua)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(entry.destination)
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(EasySeasTheme.navy)
                Text("\(entry.count) cruise(s) on \(entry.ships.joined(separator: ", "))")
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
                    .lineLimit(2)
            }
            Spacer()
            Text("\(entry.count)")
                .font(.title3.weight(.heavy))
                .foregroundStyle(EasySeasTheme.aqua)
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }
}
