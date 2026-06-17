import SwiftUI

struct EventsScreen: View {
    @Bindable var store: EasySeasStore

    private var sortedEvents: [CalendarEventItem] {
        store.calendarEvents.sorted { $0.date < $1.date }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 14) {
                    SectionHeader(title: "Cruise Calendar", subtitle: "Sailings, offer deadlines, casino plans, and imported travel dates.", systemImage: "party.popper.fill")

                    ForEach(sortedEvents) { event in
                        CalendarEventRow(event: event)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 100)
            }
            .background(EasySeasTheme.background.ignoresSafeArea())
            .navigationTitle("Calendar")
            .toolbarTitleDisplayMode(.large)
        }
    }
}
