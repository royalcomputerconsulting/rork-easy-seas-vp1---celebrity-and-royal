import SwiftUI

/// Global library — browse the complete slot machine encyclopedia.
struct GlobalLibraryScreen: View {
    @Bindable var store: EasySeasStore
    @State private var searchText: String = ""
    @State private var selectedManufacturer: String? = nil

    private var manufacturers: [String] {
        Array(Set(store.slotMachines.map { $0.manufacturer })).sorted()
    }

    private var filteredMachines: [SlotMachine] {
        var result = store.slotMachines
        if let mfr = selectedManufacturer {
            result = result.filter { $0.manufacturer == mfr }
        }
        let query = searchText.trimmingCharacters(in: .whitespaces).lowercased()
        if !query.isEmpty {
            result = result.filter {
                $0.name.lowercased().contains(query) ||
                $0.manufacturer.lowercased().contains(query)
            }
        }
        return result.sorted { $0.name < $1.name }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                heroCard
                manufacturerFilter
                machinesList
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 100)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Global Library")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $searchText, prompt: "Search machines, manufacturers...")
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "books.vertical.fill")
                    .font(.title2)
                    .foregroundStyle(EasySeasTheme.gold)
                Text("Slot Machine Encyclopedia")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(.white)
            }
            Text("\(store.slotMachines.count) machines from \(manufacturers.count) manufacturers across the fleet.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.82))
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 20))
        .cardShadow()
    }

    private var manufacturerFilter: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Filter by Manufacturer")
                .font(.subheadline.weight(.heavy))
                .foregroundStyle(EasySeasTheme.navy)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    Button {
                        withAnimation(.snappy) { selectedManufacturer = nil }
                    } label: {
                        Text("All")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(selectedManufacturer == nil ? .white : EasySeasTheme.navy)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(selectedManufacturer == nil ? EasySeasTheme.navy : EasySeasTheme.navy.opacity(0.08), in: .capsule)
                    }
                    .buttonStyle(.plain)

                    ForEach(manufacturers, id: \.self) { mfr in
                        Button {
                            withAnimation(.snappy) { selectedManufacturer = mfr }
                        } label: {
                            Text(mfr)
                                .font(.caption.weight(.bold))
                                .foregroundStyle(selectedManufacturer == mfr ? .white : EasySeasTheme.navy)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(selectedManufacturer == mfr ? EasySeasTheme.navy : EasySeasTheme.navy.opacity(0.08), in: .capsule)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var machinesList: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("\(filteredMachines.count) machine(s)")
                .font(.headline.weight(.heavy))
                .foregroundStyle(EasySeasTheme.navy)

            if filteredMachines.isEmpty {
                EmptyStateView(title: "No machines found", subtitle: "Try a different manufacturer or search term.", systemImage: "magnifyingglass")
            } else {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(filteredMachines) { machine in
                        NavigationLink {
                            MachineDetailScreen(machine: machine, store: store)
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Image(systemName: "gamecontroller.fill")
                                        .font(.caption)
                                        .foregroundStyle(EasySeasTheme.aqua)
                                    Text(machine.manufacturer)
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(EasySeasTheme.textSecondary)
                                    Spacer()
                                    if machine.isFavorite {
                                        Image(systemName: "star.fill")
                                            .font(.caption2)
                                            .foregroundStyle(EasySeasTheme.gold)
                                    }
                                }
                                Text(machine.name)
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(EasySeasTheme.navy)
                                    .lineLimit(2)
                                Text(machine.volatility)
                                    .font(.caption2)
                                    .foregroundStyle(EasySeasTheme.textSecondary)
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.white, in: .rect(cornerRadius: 14)))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(EasySeasTheme.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}
