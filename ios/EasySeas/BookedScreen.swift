import SwiftUI

struct BookedScreen: View {
    @Bindable var store: EasySeasStore
    @State private var mode: BookedMode = .all

    private enum BookedMode: String, CaseIterable, Identifiable {
        case all = "All"
        case upcoming = "Upcoming"
        case completed = "Completed"
        var id: String { rawValue }
    }

    private var visibleCruises: [BookedCruise] {
        switch mode {
        case .all: store.selectedBookedCruises
        case .upcoming: store.upcomingBookedCruises
        case .completed: store.completedBookedCruises
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 16) {
                    BrandSelectorView(store: store)
                    SectionHeader(title: "Booked Portfolio", subtitle: "Upcoming and completed cruises with offer, value, and casino context.", systemImage: "ferry.fill")

                    Picker("Mode", selection: $mode) {
                        ForEach(BookedMode.allCases) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)

                    HStack(spacing: 10) {
                        summaryCard("Upcoming", "\(store.upcomingBookedCruises.count)", EasySeasTheme.money)
                        summaryCard("Completed", "\(store.completedBookedCruises.count)", EasySeasTheme.purple)
                        summaryCard("Nights", "\(store.selectedBookedCruises.reduce(0) { $0 + $1.nights })", EasySeasTheme.aqua)
                    }

                    ForEach(visibleCruises) { cruise in
                        NavigationLink {
                            BookedCruiseDetailScreen(cruise: cruise)
                        } label: {
                            BookedCruiseCardView(cruise: cruise)
                        }
                        .buttonStyle(.plain)
                    }

                    if visibleCruises.isEmpty {
                        EmptyStateView(title: "No booked cruises", subtitle: "Book a sailing from the Cruises tab or run Sync Now.", systemImage: "ferry")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 100)
            }
            .background(EasySeasTheme.background.ignoresSafeArea())
            .navigationTitle("Booked")
            .toolbarTitleDisplayMode(.large)
        }
    }

    private func summaryCard(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.title3.weight(.heavy))
                .foregroundStyle(color)
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(EasySeasTheme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.white, in: .rect(cornerRadius: 16))
    }
}
