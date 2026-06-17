import SwiftUI

struct CruisesScreen: View {
    @Bindable var store: EasySeasStore
    @State private var selectedCabin: CabinType? = nil
    @State private var noConflictsOnly: Bool = true

    private var filteredSailings: [CruiseSailing] {
        store.upcomingSailings.filter { sailing in
            guard selectedCabin == nil || sailing.cabinType == selectedCabin else { return false }
            if noConflictsOnly {
                return !store.upcomingBookedCruises.contains { booked in
                    sailing.sailDate <= booked.returnDate && booked.sailDate <= sailing.returnDate
                }
            }
            return true
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 16) {
                    BrandSelectorView(store: store)
                    SectionHeader(title: "Cruise Finder", subtitle: "Eligible sailings from current offers, with conflict checks and cabin filters.", systemImage: "calendar.badge.clock")

                    filterBar

                    ForEach(filteredSailings) { sailing in
                        NavigationLink {
                            CruiseDetailScreen(store: store, sailing: sailing)
                        } label: {
                            CruiseSailingCardView(sailing: sailing)
                        }
                        .buttonStyle(.plain)
                    }

                    if filteredSailings.isEmpty {
                        EmptyStateView(title: "No sailings match", subtitle: "Adjust cabin or conflict filters to see more options.", systemImage: "calendar.badge.exclamationmark")
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

    private var filterBar: some View {
        VStack(alignment: .leading, spacing: 12) {
            Toggle(isOn: $noConflictsOnly) {
                Label("Hide schedule conflicts", systemImage: "checkmark.shield.fill")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(EasySeasTheme.navy)
            }
            .tint(EasySeasTheme.aqua)

            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    cabinButton(nil, label: "All")
                    ForEach(CabinType.allCases) { cabin in
                        cabinButton(cabin, label: cabin.rawValue)
                    }
                }
            }
            .scrollIndicators(.hidden)
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

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
}
