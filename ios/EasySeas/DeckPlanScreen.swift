import SwiftUI

/// Deck plan screen — shows ship deck layout reference.
struct DeckPlanScreen: View {
    @Bindable var store: EasySeasStore

    private var ships: [String] {
        var seen = Set<String>()
        for sailing in store.sailings { seen.insert(sailing.shipName) }
        for cruise in store.bookedCruises { seen.insert(cruise.shipName) }
        return Array(seen).sorted()
    }

    @State private var selectedShip: String = ""

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                heroCard
                shipPickerCard
                deckInfoCard
                cabinLegendCard
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 100)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Deck Plan")
        .navigationBarTitleDisplayMode(.large)
        .onAppear {
            if selectedShip.isEmpty, let first = ships.first {
                selectedShip = first
            }
        }
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "square.grid.3x3.fill")
                    .font(.title2)
                    .foregroundStyle(EasySeasTheme.gold)
                Text("Deck Plan Reference")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(.white)
            }
            Text("Browse ship deck layouts. \(ships.count) ship(s) available from your cruise portfolio.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.82))
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 20))
        .cardShadow()
    }

    private var shipPickerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Select Ship", subtitle: "Choose a ship to view its deck layout.", systemImage: "ferry.fill")
            if ships.isEmpty {
                Text("No ships in portfolio.").font(.caption).foregroundStyle(EasySeasTheme.textSecondary)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(ships, id: \.self) { ship in
                            Button {
                                withAnimation(.snappy) { selectedShip = ship }
                            } label: {
                                Text(ship)
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(selectedShip == ship ? .white : EasySeasTheme.navy)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 10)
                                    .background(selectedShip == ship ? EasySeasTheme.navy : EasySeasTheme.navy.opacity(0.08), in: .capsule)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var deckInfoCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: selectedShip.isEmpty ? "Select a Ship" : selectedShip, subtitle: "Deck levels and cabin zones.", systemImage: "building.2.fill")

            // Simulated deck layout
            VStack(spacing: 6) {
                ForEach(["Deck 16 - Pool & Sports", "Deck 14-15 - Suites", "Deck 10-13 - Balcony Staterooms", "Deck 7-9 - Ocean View Staterooms", "Deck 3-6 - Interior Staterooms", "Deck 2 - Casino & Entertainment", "Deck 1 - Guest Services"], id: \.self) { deck in
                    HStack {
                        Text(deck)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(EasySeasTheme.navy)
                        Spacer()
                    }
                    .padding(10)
                    .background(EasySeasTheme.background, in: .rect(cornerRadius: 10)))
                }
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var cabinLegendCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Cabin Legend", subtitle: "Cabin type colors and symbols.", systemImage: "paintpalette.fill")
            HStack(spacing: 10) {
                legendItem("Interior", Color.gray.opacity(0.3))
                legendItem("Ocean View", EasySeasTheme.aqua.opacity(0.3))
                legendItem("Balcony", EasySeasTheme.seafoam.opacity(0.3))
            }
            HStack(spacing: 10) {
                legendItem("Suite", EasySeasTheme.purple.opacity(0.3))
                legendItem("Casino Area", EasySeasTheme.gold.opacity(0.3))
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private func legendItem(_ label: String, _ color: Color) -> some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 4)
                .fill(color)
                .frame(width: 20, height: 20)
                .overlay(RoundedRectangle(cornerRadius: 4).stroke(EasySeasTheme.border, lineWidth: 1))
            Text(label)
                .font(.caption)
                .foregroundStyle(EasySeasTheme.textSecondary)
        }
    }
}
