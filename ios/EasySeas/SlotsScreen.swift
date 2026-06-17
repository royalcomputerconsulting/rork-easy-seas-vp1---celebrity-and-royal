import SwiftUI

struct SlotsScreen: View {
    @Bindable var store: EasySeasStore
    @State private var showingFavoritesOnly: Bool = false

    private var machines: [SlotMachine] {
        let base = store.filteredSlotMachines
        return showingFavoritesOnly ? base.filter(\.isFavorite) : base
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 14) {
                    SectionHeader(title: "Slot Atlas", subtitle: "Machines, volatility, denominations, and ships where they have been spotted.", systemImage: "gamecontroller.fill")

                    Toggle(isOn: $showingFavoritesOnly) {
                        Label("Favorites only", systemImage: "star.fill")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(EasySeasTheme.navy)
                    }
                    .tint(EasySeasTheme.gold)
                    .padding(14)
                    .background(.white, in: .rect(cornerRadius: 18))

                    ForEach(machines) { machine in
                        SlotMachineRow(machine: machine) {
                            withAnimation(.snappy) { store.toggleFavorite(machine: machine) }
                        }
                    }

                    if machines.isEmpty {
                        EmptyStateView(title: "No machines found", subtitle: "Try another search or turn off favorites-only mode.", systemImage: "magnifyingglass")
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
}
