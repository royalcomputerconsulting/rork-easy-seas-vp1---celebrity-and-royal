import SwiftUI

struct SettingsScreen: View {
    @Bindable var store: EasySeasStore
    @State private var showingSyncSheet: Bool = false
    @State private var showingResetConfirmation: Bool = false

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 16) {
                    SectionHeader(title: "Settings", subtitle: "Sync casino programs, manage profile context, and review legal notices.", systemImage: "gearshape.fill")

                    profileCard
                    syncCard
                    toolsCard
                    moreToolsCard
                    premiumCard
                    legalCard
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 100)
            }
            .background(EasySeasTheme.background.ignoresSafeArea())
            .navigationTitle("Settings")
            .toolbarTitleDisplayMode(.large)
            .sheet(isPresented: $showingSyncSheet) {
                SyncNowSheet(store: store)
                    .presentationDetents([.medium, .large])
                    .presentationContentInteraction(.scrolls)
            }
            .confirmationDialog("Reset native Easy Seas data?", isPresented: $showingResetConfirmation, titleVisibility: .visible) {
                Button("Reset to sample baseline", role: .destructive) {
                    withAnimation(.snappy) { store.resetToSampleData() }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    private var profileCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            NavigationLink {
                ProfileEditScreen(store: store)
            } label: {
                HStack(spacing: 12) {
                    CompassLogoView(size: 54)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Easy Seas Profile")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(EasySeasTheme.navy)
                        Text(store.memberEmail)
                            .font(.subheadline)
                            .foregroundStyle(EasySeasTheme.textSecondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(EasySeasTheme.textSecondary)
                }
            }
            .buttonStyle(.plain)
            HStack(spacing: 8) {
                BrandPill(brand: .royalCaribbean, isSelected: store.selectedBrand == .royalCaribbean)
                BrandPill(brand: .celebrity, isSelected: store.selectedBrand == .celebrity)
            }
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))
        .cardShadow()
    }

    private var syncCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "Royal / Celebrity Sync", subtitle: "Capture all offers, sailings per offer, booked cruises, upcoming cruises, loyalty, and completed history.", systemImage: "arrow.triangle.2.circlepath")
            PrimaryButton(title: store.isSyncing ? "Syncing…" : "Sync Now", systemImage: "arrow.triangle.2.circlepath", isLoading: store.isSyncing) {
                showingSyncSheet = true
                Task { await store.runDemoSync() }
            }
            Text(store.lastSyncSummary)
                .font(.caption)
                .foregroundStyle(EasySeasTheme.textSecondary)
                .lineSpacing(3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(EasySeasTheme.background, in: .rect(cornerRadius: 14))
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))
        .cardShadow()
    }

    private var toolsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Native Clone Tools", subtitle: "Full feature parity with the Expo EasySeas app.", systemImage: "square.grid.2x2.fill")
            toolLink("Advisor", "Offer intelligence and trip-stack recommendations", "sparkles") {
                AdvisorScreen(store: store)
            }
            toolLink("Data Health", "QA offers, sailings, dates, duplicates, and unmatched codes", "checkmark.shield.fill") {
                DataHealthScreen(store: store)
            }
            toolLink("Import Review", "Review and apply assignment merges", "tray.and.arrow.down.fill") {
                ImportReviewScreen(store: store)
            }
            toolLink("SeaPass Generator", "Generate a safe native pass preview", "creditcard.fill") {
                SeaPassGeneratorScreen(store: store)
            }
            toolLink("Ask My Data", "Natural-language search across your cruise data", "wand.and.stars") {
                AskMyDataScreen(store: store)
            }
            toolLink("Command Center", "Offer expiration urgency buckets and management", "clock.badge") {
                WarRoomScreen(store: store)
            }
            toolLink("Learn the System", "Offer math, certificates, loyalty, machine logs, and tutorials", "book.fill") {
                LearnSystemScreen()
            }
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))
        .cardShadow()
    }

    private var moreToolsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Planning & Reference", subtitle: "Cruise planning, ports, destinations, and ship layouts.", systemImage: "map.fill")
            toolLink("Carnival Sync", "Sync Carnival VIFP casino offers and loyalty data", "ferry.fill") {
                CarnivalSyncScreen(store: store)
            }
            toolLink("Import Cruises", "Import casino offers, booked cruises, and sailing data", "square.and.arrow.down.fill") {
                ImportCruisesScreen(store: store)
            }
            toolLink("Passenger Calendar", "Upcoming and completed cruises by passenger type", "person.2.fill") {
                PassengerCalendarScreen(store: store)
            }
            toolLink("Port History", "Departure ports across all booked cruises", "map.fill") {
                PortHistoryScreen(store: store)
            }
            toolLink("Pricing Summary", "Retail value, paid, and net value per cruise", "dollarsign.circle.fill") {
                PricingSummaryScreen(store: store)
            }
            toolLink("Destination Map", "Destination distribution from cruise portfolio", "globe.americas.fill") {
                CountriesScreen(store: store)
            }
            toolLink("Day Agenda", "Today's events, weekly schedule, and offer deadlines", "calendar.badge.clock") {
                DayAgendaScreen(store: store)
            }
            toolLink("Global Library", "Complete slot machine encyclopedia", "books.vertical.fill") {
                GlobalLibraryScreen(store: store)
            }
            toolLink("Deck Plan", "Ship deck layouts and cabin zones", "square.grid.3x3.fill") {
                DeckPlanScreen(store: store)
            }
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))
        .cardShadow()
    }

    private var premiumCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Premium", subtitle: "Unlock advanced features with EasySeas Premium.", systemImage: "crown.fill")
            toolLink("EasySeas Premium", "Advanced analytics, auto-sync, AI advisor, and more", "crown.fill") {
                PaywallScreen()
            }
            Button(role: .destructive) {
                showingResetConfirmation = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "arrow.counterclockwise")
                        .frame(width: 36, height: 36)
                        .background(Color.red.opacity(0.10), in: .circle)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Reset Demo Data")
                            .font(.subheadline.weight(.heavy))
                        Text("Restore the native clone baseline")
                            .font(.caption)
                            .foregroundStyle(EasySeasTheme.textSecondary)
                    }
                    Spacer()
                }
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))
        .cardShadow()
    }

    private func toolLink<Destination: View>(_ title: String, _ subtitle: String, _ systemImage: String, @ViewBuilder destination: () -> Destination) -> some View {
        NavigationLink {
            destination()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(EasySeasTheme.nauticalGradient, in: .circle)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.subheadline.weight(.heavy))
                        .foregroundStyle(EasySeasTheme.navy)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(EasySeasTheme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(EasySeasTheme.textSecondary)
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }

    private var legalCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Disclaimer")
                .font(.headline.weight(.heavy))
                .foregroundStyle(EasySeasTheme.navy)
            Text("Easy Seas is for informational planning only. It is not gambling, legal, financial, or tax advice. Cruise line trademarks and program names belong to their respective owners; Easy Seas is not affiliated with or endorsed by those companies.")
                .font(.caption)
                .foregroundStyle(EasySeasTheme.textSecondary)
                .lineSpacing(3)
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 20))
    }
}
