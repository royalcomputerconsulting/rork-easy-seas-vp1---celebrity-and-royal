import SwiftUI

struct ContentView: View {
    @State private var store: EasySeasStore = EasySeasStore()
    @State private var selectedTab: EasySeasTab = .offers

    var body: some View {
        TabView(selection: $selectedTab) {
            OffersScreen(store: store)
                .tag(EasySeasTab.offers)
                .tabItem { Label(EasySeasTab.offers.title, systemImage: EasySeasTab.offers.symbol) }

            CruisesScreen(store: store)
                .tag(EasySeasTab.cruises)
                .tabItem { Label(EasySeasTab.cruises.title, systemImage: EasySeasTab.cruises.symbol) }

            BookedScreen(store: store)
                .tag(EasySeasTab.booked)
                .tabItem { Label(EasySeasTab.booked.title, systemImage: EasySeasTab.booked.symbol) }

            EventsScreen(store: store)
                .tag(EasySeasTab.calendar)
                .tabItem { Label(EasySeasTab.calendar.title, systemImage: EasySeasTab.calendar.symbol) }

            CasinoScreen(store: store)
                .tag(EasySeasTab.casino)
                .tabItem { Label(EasySeasTab.casino.title, systemImage: EasySeasTab.casino.symbol) }

            SlotsScreen(store: store)
                .tag(EasySeasTab.slots)
                .tabItem { Label(EasySeasTab.slots.title, systemImage: EasySeasTab.slots.symbol) }

            SettingsScreen(store: store)
                .tag(EasySeasTab.settings)
                .tabItem { Label(EasySeasTab.settings.title, systemImage: EasySeasTab.settings.symbol) }
        }
        .tint(EasySeasTheme.navy)
    }
}

#Preview {
    ContentView()
}
