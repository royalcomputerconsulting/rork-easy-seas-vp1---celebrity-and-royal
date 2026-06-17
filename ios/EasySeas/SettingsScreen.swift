import SwiftUI

struct SettingsScreen: View {
    @Bindable var store: EasySeasStore
    @State private var showingSyncSheet: Bool = false

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 16) {
                    SectionHeader(title: "Settings", subtitle: "Sync casino programs, manage profile context, and review legal notices.", systemImage: "gearshape.fill")

                    profileCard
                    syncCard
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
        }
    }

    private var profileCard: some View {
        VStack(alignment: .leading, spacing: 14) {
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
            }
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
